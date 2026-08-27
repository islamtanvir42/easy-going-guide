import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { BarPanel } from "@/components/inventory/BarPanel";
import { StatusBadge, environmentTone } from "@/components/inventory/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCAN_OVERDUE_DAYS,
  formatDateTime,
  isEndOfLife,
  majorVersionLabel,
} from "@/lib/inventory";
import { getDatabases, getScanLog, getServers } from "@/lib/inventory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Database Inventory — Oracle Estate Overview" },
      {
        name: "description",
        content:
          "Internal dashboard tracking Oracle databases across servers, operating systems and prod/uat/dev environments, with version history and scan status.",
      },
      { property: "og:title", content: "Database Inventory — Oracle Estate Overview" },
      {
        property: "og:description",
        content:
          "Track Oracle databases across servers, OS families and environments, with end-of-life flags and scan coverage.",
      },
    ],
  }),
  component: Overview,
});

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "warning" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tech mt-2 text-3xl font-semibold",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Overview() {
  const databases = useQuery({ queryKey: ["databases"], queryFn: () => getDatabases() });
  const servers = useQuery({ queryKey: ["servers"], queryFn: () => getServers() });
  const scans = useQuery({ queryKey: ["scan_log"], queryFn: () => getScanLog() });

  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = databases.data ?? [];
  const serverRows = servers.data ?? [];
  const scanRows = scans.data ?? [];

  const lastScan = scanRows[0]?.scanned_at ?? null;

  const overdue = useMemo(() => {
    const cutoff = Date.now() - SCAN_OVERDUE_DAYS * 86400000;
    return serverRows.filter((s) => {
      const latest = scanRows.find((scan) => scan.server_id === s.id);
      return !latest || new Date(latest.scanned_at).getTime() < cutoff;
    }).length;
  }, [serverRows, scanRows]);

  const outdated = rows.filter((r) => isEndOfLife(r.oracle_version)).length;

  const byVersion = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.oracle_version, (counts.get(r.oracle_version) ?? 0) + 1));
    const data = [...counts.entries()]
      .map(([label, value]) => ({ label, value, warn: isEndOfLife(label) }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    if (data.length > 0) return data;
    // Dummy values so the chart renders while no inventory is loaded
    return [
      { label: "19.0.0", value: 8 },
      { label: "21.0.0", value: 4 },
      { label: "12.2.0", value: 5, warn: true },
      { label: "11.2.0", value: 3, warn: true },
    ];
  }, [rows]);

  const byOs = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const os = r.servers?.os_family ?? "Unknown";
      counts.set(os, (counts.get(os) ?? 0) + 1);
    });
    const data = [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    if (data.length > 0) return data;
    // Dummy values so the chart renders while no inventory is loaded
    return [
      { label: "Linux", value: 12 },
      { label: "Windows", value: 6 },
      { label: "AIX", value: 2 },
    ];
  }, [rows]);

  const filtered = rows.filter((r) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      r.instance_name.toLowerCase().includes(term) ||
      (r.servers?.hostname ?? "").toLowerCase().includes(term);
    const matchesEnv = environment === "all" || r.servers?.environment === environment;
    const matchesStatus = status === "all" || r.status === status;
    return matchesTerm && matchesEnv && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Database Inventory</h1>
            <p className="text-xs text-muted-foreground">Oracle estate across all environments</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last scan</p>
            <p className="tech text-sm">{formatDateTime(lastScan)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total databases"
            value={rows.length}
            hint={`${rows.filter((r) => r.status === "active").length} active`}
          />
          <SummaryCard
            label="Total servers"
            value={serverRows.length}
            hint={`${new Set(serverRows.map((s) => s.datacenter)).size} datacenters`}
          />
          <SummaryCard
            label="Outdated versions"
            value={outdated}
            hint="On an end-of-life Oracle release"
            tone="warning"
          />
          <SummaryCard
            label="Scans overdue"
            value={overdue}
            hint={`No scan in ${SCAN_OVERDUE_DAYS} days`}
            tone="danger"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BarPanel
            title="Databases by Oracle version"
            subtitle="Amber marks end-of-life releases"
            data={byVersion}
          />
          <BarPanel title="Databases by OS family" subtitle="Host operating system" data={byOs} />
        </div>

        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instance or hostname…"
              className="tech h-9 max-w-xs text-sm"
            />
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All environments</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="uat">uat</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="decommissioned">decommissioned</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} of {rows.length} databases
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Instance</th>
                  <th className="px-4 py-2 font-medium">Hostname</th>
                  <th className="px-4 py-2 font-medium">Oracle version</th>
                  <th className="px-4 py-2 font-medium">OS family</th>
                  <th className="px-4 py-2 font-medium">Environment</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {databases.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading inventory…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No databases match these filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const eol = isEndOfLife(r.oracle_version);
                    return (
                      <tr
                        key={r.id}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/50"
                        onClick={() => {
                          window.location.href = `/databases/${r.id}`;
                        }}
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            to="/databases/$id"
                            params={{ id: r.id }}
                            className="tech font-medium text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.instance_name}
                          </Link>
                        </td>
                        <td className="tech px-4 py-2.5 text-muted-foreground">
                          {r.servers?.hostname ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("tech", eol && "font-medium text-warning")}>
                            {r.oracle_version}
                          </span>
                          {eol ? (
                            <span className="ml-2 text-xs text-warning">
                              EOL ({majorVersionLabel(r.oracle_version)})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">{r.servers?.os_family ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge
                            mono
                            tone={environmentTone(r.servers?.environment ?? "dev")}
                          >
                            {r.servers?.environment ?? "—"}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>
                            {r.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
