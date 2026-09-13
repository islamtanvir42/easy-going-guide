import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { UserMenu } from "@/components/inventory/UserMenu";
import { BarPanel } from "@/components/inventory/BarPanel";
import { StatusBadge, environmentTone } from "@/components/inventory/StatusBadge";
import ucbLogoAsset from "@/assets/ucb-logo.png.asset.json";
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
} from "@/lib/inventory";
import {
  getDatabases,
  getLatestMetrics,
  getScanLog,
  getServers,
} from "@/lib/inventory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
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

type CardFilter = "all" | "servers" | "outdated" | "overStorage" | "expiring";

function Overview() {
  const databases = useQuery({ queryKey: ["databases"], queryFn: () => getDatabases() });
  const servers = useQuery({ queryKey: ["servers"], queryFn: () => getServers() });
  const scans = useQuery({ queryKey: ["scan_log"], queryFn: () => getScanLog() });
  const metrics = useQuery({ queryKey: ["resource_metrics"], queryFn: () => getLatestMetrics() });

  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");
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
    if (!matchesTerm || !matchesEnv || !matchesStatus) return false;
    if (cardFilter === "outdated") return isEndOfLife(r.oracle_version);
    if (cardFilter === "overStorage") {
      const m = latest.get(r.id);
      return m ? isOverCapacity(m.storage_used_gb, m.storage_allocated_gb) : false;
    }
    if (cardFilter === "expiring") {
      const state = expiryState(r.expiry_date);
      return state === "warning" || state === "expired";
    }
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
            <img
              src={ucbLogoAsset.url}
              alt="UCB"
              className="h-auto w-20 shrink-0 object-contain sm:w-24"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">Database Inventory — Oracle Estate Overview</h1>
              <p className="text-xs text-muted-foreground">Oracle estate across all environments</p>
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
            hint="On an end-of-life Oracle release"
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
                  <StatusBadge tone={expiryState(r.expiry_date) === "expired" ? "danger" : "warning"}>
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
                  <StatusBadge tone={expiryState(s.expiry_date) === "expired" ? "danger" : "warning"}>
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
            title="Databases by Oracle version"
            subtitle="Amber marks end-of-life releases"
            data={byVersion}
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
              {showingServers
                ? `${filteredServers.length} of ${serverRows.length} servers`
                : `${filtered.length} of ${rows.length} databases`}
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
                  <th className="px-4 py-2 font-medium">Expiry</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {databases.isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Loading inventory…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
                          {expiryBadgeLabel(r.expiry_date) ? (
                            <StatusBadge
                              tone={expiryState(r.expiry_date) === "expired" ? "danger" : "warning"}
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
        </section>
      </main>
    </div>
  );
}
