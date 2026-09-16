import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { UserMenu } from "@/components/inventory/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/manage")({
  head: () => ({
    meta: [
      { title: "Add & update databases — Database Inventory" },
      {
        name: "description",
        content:
          "Member workspace for registering Oracle, SQL Server and PostgreSQL databases, servers and owners, and recording version upgrades.",
      },
      { property: "og:title", content: "Add & update databases — Database Inventory" },
      {
        property: "og:description",
        content:
          "Register databases across platforms and record version upgrades in the inventory.",
      },
    ],
  }),
  component: ManagePage,
});

type ServerOption = { id: string; hostname: string; environment: string };
type OwnerOption = { id: string; name: string };
type DbRow = { id: string; instance_name: string; db_version: string; server_id: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ManagePage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servers = useQuery({
    queryKey: ["manage", "servers"],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("servers")
        .select("id, hostname, environment")
        .order("hostname");
      if (e) throw e;
      return (data ?? []) as ServerOption[];
    },
  });

  const owners = useQuery({
    queryKey: ["manage", "owners"],
    queryFn: async () => {
      const { data, error: e } = await supabase.from("owners").select("id, name").order("name");
      if (e) throw e;
      return (data ?? []) as OwnerOption[];
    },
  });

  const dbs = useQuery({
    queryKey: ["manage", "databases"],
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("databases")
        .select("id, instance_name, db_version, server_id")
        .order("instance_name");
      if (e) throw e;
      return (data ?? []) as DbRow[];
    },
  });

  // ---- add database form state
  const [instanceName, setInstanceName] = useState("");
  const [sid, setSid] = useState("");
  const [platform, setPlatform] = useState("oracle");
  const [version, setVersion] = useState("19.0.0");
  const [edition, setEdition] = useState("Enterprise");
  const [serverId, setServerId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [isRac, setIsRac] = useState(false);
  const [clusterName, setClusterName] = useState("");
  const [nodeCount, setNodeCount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const addDatabase = useMutation({
    mutationFn: async () => {
      if (!instanceName.trim()) throw new Error("Give the database an instance name.");
      if (!serverId) throw new Error("Pick the server it runs on.");
      const { error: e } = await supabase.from("databases").insert({
        instance_name: instanceName.trim(),
        sid: sid.trim() || null,
        platform,
        db_version: version.trim(),
        edition: edition.trim() || null,
        server_id: serverId,
        owner_id: ownerId || null,
        is_rac: isRac,
        cluster_name: isRac ? clusterName.trim() || null : null,
        node_count: isRac && nodeCount ? Number(nodeCount) : null,
        start_date: startDate || null,
        renewal_date: renewalDate || null,
        expiry_date: expiryDate || null,
        status: "active",
      });
      if (e) throw e;
    },
    onSuccess: () => {
      setMessage(`${instanceName} was added to the inventory.`);
      setError(null);
      setInstanceName("");
      setSid("");
      setIsRac(false);
      setClusterName("");
      setNodeCount("");
      setStartDate("");
      setRenewalDate("");
      setExpiryDate("");
      queryClient.invalidateQueries({ queryKey: ["manage", "databases"] });
      queryClient.invalidateQueries({ queryKey: ["databases"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  // ---- version update
  const [updateId, setUpdateId] = useState("");
  const [newVersion, setNewVersion] = useState("");

  const updateVersion = useMutation({
    mutationFn: async () => {
      const target = (dbs.data ?? []).find((d) => d.id === updateId);
      if (!target) throw new Error("Pick a database first.");
      if (!newVersion.trim()) throw new Error("Type the new version.");
      const { error: e } = await supabase
        .from("databases")
        .update({ db_version: newVersion.trim() })
        .eq("id", target.id);
      if (e) throw e;
      const { error: h } = await supabase.from("version_history").insert({
        database_id: target.id,
        old_version: target.db_version,
        new_version: newVersion.trim(),
      });
      if (h) throw h;
      return target.instance_name;
    },
    onSuccess: (name) => {
      setMessage(`${name} is now recorded on ${newVersion}.`);
      setError(null);
      setNewVersion("");
      queryClient.invalidateQueries({ queryKey: ["manage", "databases"] });
      queryClient.invalidateQueries({ queryKey: ["databases"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  // ---- new server / owner
  const [hostname, setHostname] = useState("");
  const [osFamily, setOsFamily] = useState("Linux");
  const [environment, setEnvironment] = useState("prod");
  const [datacenter, setDatacenter] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerTeam, setOwnerTeam] = useState("");

  const addServer = useMutation({
    mutationFn: async () => {
      if (!hostname.trim()) throw new Error("Give the server a hostname.");
      const { error: e } = await supabase.from("servers").insert({
        hostname: hostname.trim(),
        os_family: osFamily,
        environment,
        datacenter: datacenter.trim() || null,
      });
      if (e) throw e;
    },
    onSuccess: () => {
      setMessage(`${hostname} was added.`);
      setError(null);
      setHostname("");
      setDatacenter("");
      queryClient.invalidateQueries({ queryKey: ["manage", "servers"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  const addOwner = useMutation({
    mutationFn: async () => {
      if (!ownerName.trim()) throw new Error("Give the owner a name.");
      const { error: e } = await supabase
        .from("owners")
        .insert({ name: ownerName.trim(), team: ownerTeam.trim() || null });
      if (e) throw e;
    },
    onSuccess: () => {
      setMessage(`${ownerName} was added.`);
      setError(null);
      setOwnerName("");
      setOwnerTeam("");
      queryClient.invalidateQueries({ queryKey: ["manage", "owners"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setMessage(null);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Member workspace — add and update databases
            </h1>
            <p className="text-xs text-muted-foreground">
              Register databases, servers and owners, and record version upgrades.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {message && (
          <p className="rounded-md border border-primary/30 bg-accent/40 px-4 py-2 text-sm">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Add a database</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Instance name">
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
            </Field>
            <Field label="SID">
              <Input value={sid} onChange={(e) => setSid(e.target.value)} />
            </Field>
            <Field label="Platform">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oracle">Oracle</SelectItem>
                  <SelectItem value="mssql">SQL Server</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Version">
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. 19.21.0.0.0, 26ai, 2022, 16"
              />
            </Field>
            <Field label="Edition">
              <Input value={edition} onChange={(e) => setEdition(e.target.value)} />
            </Field>
            <Field label="Server">
              <Select value={serverId} onValueChange={setServerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a server" />
                </SelectTrigger>
                <SelectContent>
                  {(servers.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.hostname} ({s.environment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Owner">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an owner" />
                </SelectTrigger>
                <SelectContent>
                  {(owners.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="RAC / cluster">
              <div className="flex h-9 items-center gap-2">
                <Switch checked={isRac} onCheckedChange={setIsRac} />
                <span className="text-sm text-muted-foreground">
                  {isRac ? "Running as RAC/cluster" : "Standalone"}
                </span>
              </div>
            </Field>
            {isRac ? (
              <>
                <Field label="Cluster name">
                  <Input value={clusterName} onChange={(e) => setClusterName(e.target.value)} />
                </Field>
                <Field label="Node count">
                  <Input
                    type="number"
                    min="1"
                    value={nodeCount}
                    onChange={(e) => setNodeCount(e.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Renewal date">
              <Input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
              />
            </Field>
            <Field label="Expiry date">
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </Field>
          </div>
          <Button
            className="mt-4"
            disabled={addDatabase.isPending}
            onClick={() => addDatabase.mutate()}
          >
            Add database
          </Button>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Update a database version</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The change is saved to the database record and to its version history.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Database">
              <Select value={updateId} onValueChange={setUpdateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a database" />
                </SelectTrigger>
                <SelectContent>
                  {(dbs.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.instance_name} — {d.db_version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="New version">
              <Input
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="19.0.0"
              />
            </Field>
          </div>
          <Button
            className="mt-4"
            disabled={updateVersion.isPending}
            onClick={() => updateVersion.mutate()}
          >
            Save new version
          </Button>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Add a server</h2>
            <div className="mt-4 space-y-4">
              <Field label="Hostname">
                <Input value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </Field>
              <Field label="Operating system">
                <Select value={osFamily} onValueChange={setOsFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Linux">Linux</SelectItem>
                    <SelectItem value="Windows">Windows</SelectItem>
                    <SelectItem value="AIX">AIX</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Environment">
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">prod</SelectItem>
                    <SelectItem value="uat">uat</SelectItem>
                    <SelectItem value="sit">sit</SelectItem>
                    <SelectItem value="dev">dev</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Datacenter">
                <Input value={datacenter} onChange={(e) => setDatacenter(e.target.value)} />
              </Field>
            </div>
            <Button
              className="mt-4"
              variant="outline"
              disabled={addServer.isPending}
              onClick={() => addServer.mutate()}
            >
              Add server
            </Button>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Add an owner</h2>
            <div className="mt-4 space-y-4">
              <Field label="Name">
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <Field label="Team">
                <Input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} />
              </Field>
            </div>
            <Button
              className="mt-4"
              variant="outline"
              disabled={addOwner.isPending}
              onClick={() => addOwner.mutate()}
            >
              Add owner
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}
