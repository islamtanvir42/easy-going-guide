import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { UserMenu } from "@/components/inventory/UserMenu";
import { BarPanel } from "@/components/inventory/BarPanel";
import { StatusBadge, environmentTone } from "@/components/inventory/StatusBadge";
import ucbLogo from "@/assets/ucb-full-logo-transparent.png";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  expiryBadgeLabel,
  expiryState,
  formatDate,
  formatDateTime,
  isEndOfLife,
  isOverCapacity,
  latestByDatabase,
  majorVersionLabel,
  platformLabel,
} from "@/lib/inventory";
import { getDatabases, getLatestMetrics, getScanLog, getServers } from "@/lib/inventory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Database Inventory — Multi-Platform Estate Overview" },
      {
        name: "description",
        content:
          "Internal dashboard tracking Oracle, SQL Server and PostgreSQL databases across servers, operating systems and dev/sit/uat/prod environments, with version history and scan status.",
      },
      { property: "og:title", content: "Database Inventory — Multi-Platform Estate Overview" },
      {
        property: "og:description",
        content:
          "Track Oracle, SQL Server and PostgreSQL databases across servers, OS families, environments and RAC/cluster topology, with end-of-life flags and scan coverage.",
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
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "warning" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border bg-card p-4 text-left transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        active && "border-primary ring-1 ring-primary",
      )}
    >
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
    </button>
  );
}

type CardFilter = "all" | "servers" | "outdated" | "overStorage" | "expiring" | "rac";

function Overview() {
  const databases = useQuery({ queryKey: ["databases"], queryFn: () => getDatabases() });
  const servers = useQuery({ queryKey: ["servers"], queryFn: () => getServers() });
  const scans = useQuery({ queryKey: ["scan_log"], queryFn: () => getScanLog() });
  const metrics = useQuery({ queryKey: ["resource_metrics"], queryFn: () => getLatestMetrics() });

  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");

  const toggleCard = (f: CardFilter) => setCardFilter((cur) => (cur === f ? "all" : f));

  const rows = databases.data ?? [];
  const serverRows = servers.data ?? [];
  const scanRows = scans.data ?? [];

  const lastScan = scanRows[0]?.scanned_at ?? null;

  const latest = useMemo(() => latestByDatabase(metrics.data ?? []), [metrics.data]);

  const overCapacity = rows.filter((r) => {
    const m = latest.get(r.id);
    return m ? isOverCapacity(m.storage_used_gb, m.storage_allocated_gb) : false;
  }).length;

  const expiringDbs = rows.filter((r) => {
    const state = expiryState(r.expiry_date);
    return state === "warning" || state === "expired";
  });
  const expiringServers = serverRows.filter((s) => {
    const state = expiryState(s.expiry_date);
    return state === "warning" || state === "expired";
  });

  const topRam = useMemo(() => {
    const data = rows
      .map((r) => {
        const m = latest.get(r.id);
        return m
          ? {
              label: r.instance_name,
              value: Math.round(Number(m.ram_used_gb)),
              warn: isOverCapacity(m.ram_used_gb, m.ram_allocated_gb),
            }
          : null;
      })
      .filter((d): d is { label: string; value: number; warn: boolean } => d !== null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    if (data.length > 0) return data;
    return [
      { label: "ORCLPRD1", value: 96 },
      { label: "FINPRD", value: 72 },
      { label: "HRUAT", value: 40 },
    ];
  }, [rows, latest]);

  const outdated = rows.filter((r) => isEndOfLife(r.platform, r.db_version)).length;
  const racCount = rows.filter((r) => r.is_rac).length;

  const byPlatform = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.platform, (counts.get(r.platform) ?? 0) + 1));
    const data = [...counts.entries()]
      .map(([platform, value]) => ({ label: platformLabel(platform), value }))
      .sort((a, b) => b.value - a.value);
    if (data.length > 0) return data;
    // Dummy values so the chart renders while no inventory is loaded
    return [
      { label: "Oracle", value: 15 },
      { label: "SQL Server", value: 3 },
      { label: "PostgreSQL", value: 3 },
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
    const matchesPlatform = platform === "all" || r.platform === platform;
    if (!matchesTerm || !matchesEnv || !matchesStatus || !matchesPlatform) return false;
    if (cardFilter === "outdated") return isEndOfLife(r.platform, r.db_version);
    if (cardFilter === "overStorage") {
      const m = latest.get(r.id);
      return m ? isOverCapacity(m.storage_used_gb, m.storage_allocated_gb) : false;
    }
    if (cardFilter === "expiring") {
      const state = expiryState(r.expiry_date);
      return state === "warning" || state === "expired";
    }
    if (cardFilter === "rac") return r.is_rac;
    return true;
  });

  const filteredServers = serverRows.filter((s) => {
    const term = search.trim().toLowerCase();
    const matchesTerm = !term || s.hostname.toLowerCase().includes(term);
    const matchesEnv = environment === "all" || s.environment === environment;
    return matchesTerm && matchesEnv;
  });

  const showingServers = cardFilter === "servers";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <img src={ucbLogo} alt="UCB" className="h-auto w-20 shrink-0 object-contain sm:w-24" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">
                Database Inventory — Multi-Platform Estate Overview
              </h1>
              <p className="text-xs text-muted-foreground">
                Oracle, SQL Server and PostgreSQL estate across all environments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last scan</p>
              <p className="tech text-sm">{formatDateTime(lastScan)}</p>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total databases"
            value={rows.length}
            hint={`${rows.filter((r) => r.status === "active").length} active`}
            active={cardFilter === "all"}
            onClick={() => toggleCard("all")}
          />
          <SummaryCard
            label="Total servers"
            value={serverRows.length}
            hint={`${new Set(serverRows.map((s) => s.datacenter)).size} datacenters`}
            active={cardFilter === "servers"}
            onClick={() => toggleCard("servers")}
          />
          <SummaryCard
            label="Outdated versions"
            value={outdated}
            hint="On an end-of-life release"
            tone="warning"
            active={cardFilter === "outdated"}
            onClick={() => toggleCard("outdated")}
          />
          <SummaryCard
            label="Over 85% storage"
            value={overCapacity}
            hint="Databases near storage capacity"
            tone="danger"
            active={cardFilter === "overStorage"}
            onClick={() => toggleCard("overStorage")}
          />
          <SummaryCard
            label="Expiring in 90 days"
            value={expiringDbs.length + expiringServers.length}
            hint={`${expiringDbs.length} databases · ${expiringServers.length} servers`}
            active={cardFilter === "expiring"}
            onClick={() => toggleCard("expiring")}
            {...(expiringDbs.length + expiringServers.length > 0
              ? { tone: "warning" as const }
              : {})}
          />
          <SummaryCard
            label="RAC / cluster"
            value={racCount}
            hint="Databases running as RAC/cluster"
            active={cardFilter === "rac"}
            onClick={() => toggleCard("rac")}
          />
        </div>

        {expiringDbs.length + expiringServers.length > 0 ? (
          <section className="rounded-lg border border-warning/40 bg-warning-soft p-4">
            <h2 className="text-sm font-semibold text-warning">
              Expiry alerts — within the next 90 days
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {expiringDbs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/databases/$id"
                    params={{ id: r.id }}
                    className="tech font-medium text-primary hover:underline"
                  >
                    {r.instance_name}
                  </Link>
                  <span className="text-muted-foreground">database</span>
                  <StatusBadge
                    tone={expiryState(r.expiry_date) === "expired" ? "danger" : "warning"}
                  >
                    {expiryBadgeLabel(r.expiry_date)}
                  </StatusBadge>
                  <span className="tech text-xs text-muted-foreground">
                    {formatDate(r.expiry_date)}
                  </span>
                </li>
              ))}
              {expiringServers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="tech font-medium">{s.hostname}</span>
                  <span className="text-muted-foreground">server</span>
                  <StatusBadge
                    tone={expiryState(s.expiry_date) === "expired" ? "danger" : "warning"}
                  >
                    {expiryBadgeLabel(s.expiry_date)}
                  </StatusBadge>
                  <span className="tech text-xs text-muted-foreground">
                    {formatDate(s.expiry_date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <BarPanel
            title="Databases by platform"
            subtitle="Oracle / SQL Server / PostgreSQL"
            data={byPlatform}
          />
          <BarPanel title="Databases by OS family" subtitle="Host operating system" data={byOs} />
          <BarPanel
            title="Top databases by RAM usage"
            subtitle="GB used at latest scan"
            data={topRam}
          />
        </div>

        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instance or hostname…"
              className="tech h-9 max-w-xs text-sm"
            />
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="oracle">Oracle</SelectItem>
                <SelectItem value="mssql">SQL Server</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
              </SelectContent>
            </Select>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All environments</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="uat">uat</SelectItem>
                <SelectItem value="sit">sit</SelectItem>
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
              {showingServers
                ? `${filteredServers.length} of ${serverRows.length} servers`
                : `${filtered.length} of ${rows.length} databases`}
            </span>
          </div>

          {showingServers ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Hostname</th>
                    <th className="px-4 py-2 font-medium">IP address</th>
                    <th className="px-4 py-2 font-medium">OS family</th>
                    <th className="px-4 py-2 font-medium">Environment</th>
                    <th className="px-4 py-2 font-medium">Datacenter</th>
                    <th className="px-4 py-2 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Loading servers…
                      </td>
                    </tr>
                  ) : filteredServers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No servers match these filters.
                      </td>
                    </tr>
                  ) : (
                    filteredServers.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="tech px-4 py-2.5 font-medium">{s.hostname}</td>
                        <td className="tech px-4 py-2.5 text-muted-foreground">
                          {s.ip_address ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">{s.os_family}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge mono tone={environmentTone(s.environment)}>
                            {s.environment}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-2.5">{s.datacenter ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {expiryBadgeLabel(s.expiry_date) ? (
                            <StatusBadge
                              tone={expiryState(s.expiry_date) === "expired" ? "danger" : "warning"}
                            >
                              {expiryBadgeLabel(s.expiry_date)}
                            </StatusBadge>
                          ) : (
                            <span className="tech text-xs text-muted-foreground">
                              {formatDate(s.expiry_date)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Instance</th>
                    <th className="px-4 py-2 font-medium">Hostname</th>
                    <th className="px-4 py-2 font-medium">Platform</th>
                    <th className="px-4 py-2 font-medium">Version</th>
                    <th className="px-4 py-2 font-medium">RAC / Cluster</th>
                    <th className="px-4 py-2 font-medium">OS family</th>
                    <th className="px-4 py-2 font-medium">Environment</th>
                    <th className="px-4 py-2 font-medium">Expiry</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {databases.isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        Loading inventory…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        No databases match these filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const eol = isEndOfLife(r.platform, r.db_version);
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
                          <td className="px-4 py-2.5">{platformLabel(r.platform)}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn("tech", eol && "font-medium text-warning")}>
                              {r.db_version}
                            </span>
                            {eol ? (
                              <span className="ml-2 text-xs text-warning">
                                EOL ({majorVersionLabel(r.platform, r.db_version)})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.is_rac ? (
                              <StatusBadge mono tone="info">
                                {r.cluster_name ?? "RAC"}
                                {r.node_count ? ` · ${r.node_count}n` : ""}
                              </StatusBadge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Standalone</span>
                            )}
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
                            {expiryBadgeLabel(r.expiry_date) ? (
                              <StatusBadge
                                tone={
                                  expiryState(r.expiry_date) === "expired" ? "danger" : "warning"
                                }
                              >
                                {expiryBadgeLabel(r.expiry_date)}
                              </StatusBadge>
                            ) : (
                              <span className="tech text-xs text-muted-foreground">
                                {formatDate(r.expiry_date)}
                              </span>
                            )}
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
          )}
        </section>
      </main>
    </div>
  );
}
