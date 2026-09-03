import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge, environmentTone } from "@/components/inventory/StatusBadge";
import { UsageBar } from "@/components/inventory/UsageBar";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  expiryBadgeLabel,
  expiryState,
  formatDate,
  formatDateTime,
  isEndOfLife,
  usagePercent,
} from "@/lib/inventory";
import {
  getDatabase,
  getMetricsForDatabase,
  getScanLogForServer,
  getSchemasForDatabase,
  getVersionHistory,
} from "@/lib/inventory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/databases/$id")({
  head: () => ({
    meta: [
      { title: "Database Detail — Database Inventory" },
      {
        name: "description",
        content:
          "Instance metadata, Oracle version history and server scan history for a single tracked database.",
      },
      { property: "og:title", content: "Database Detail — Database Inventory" },
      {
        property: "og:description",
        content: "Instance metadata, version history timeline and scan history for one Oracle database.",
      },
    ],
  }),
  component: DatabaseDetail,
});

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm", mono && "tech")}>{value}</dd>
    </div>
  );
}

function DatabaseDetail() {
  const { id } = Route.useParams();
  const db = useQuery({ queryKey: ["database", id], queryFn: () => getDatabase({ data: { id } }) });
  const history = useQuery({
    queryKey: ["version_history", id],
    queryFn: () => getVersionHistory({ data: { id } }),
  });
  const metrics = useQuery({
    queryKey: ["resource_metrics", id],
    queryFn: () => getMetricsForDatabase({ data: { id } }),
  });
  const schemas = useQuery({
    queryKey: ["database_schemas", id],
    queryFn: () => getSchemasForDatabase({ data: { id } }),
  });
  const serverId = db.data?.server_id;
  const scans = useQuery({
    queryKey: ["scan_log", serverId],
    queryFn: () => getScanLogForServer({ data: { id: serverId! } }),
    enabled: Boolean(serverId),
  });

  if (db.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading database…</p>;
  }

  if (!db.data) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">This database was not found.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to inventory
        </Link>
      </div>
    );
  }

  const row = db.data;
  const eol = isEndOfLife(row.oracle_version);
  const metricRows = metrics.data ?? [];
  const current = metricRows[metricRows.length - 1] ?? null;
  const trend = metricRows.map((m) => ({
    date: formatDate(m.recorded_at),
    "RAM used (GB)": Number(m.ram_used_gb),
    "Storage used (GB)": Number(m.storage_used_gb),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link to="/" className="text-xs text-primary hover:underline">
            ← Back to inventory
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="tech text-lg font-semibold tracking-tight">{row.instance_name}</h1>
            <span className="tech text-sm text-muted-foreground">
              {row.servers?.hostname ?? "—"}
            </span>
            <StatusBadge tone={row.status === "active" ? "success" : "neutral"}>
              {row.status}
            </StatusBadge>
            {eol ? <StatusBadge tone="warning">End-of-life version</StatusBadge> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Metadata</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field label="SID" value={row.sid ?? "—"} mono />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Oracle version
              </dt>
              <dd className={cn("tech mt-1 text-sm", eol && "font-medium text-warning")}>
                {row.oracle_version}
              </dd>
            </div>
            <Field label="Edition" value={row.edition ?? "—"} />
            <Field label="Patch level" value={row.patch_level ?? "—"} mono />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Environment</dt>
              <dd className="mt-1">
                <StatusBadge mono tone={environmentTone(row.servers?.environment ?? "dev")}>
                  {row.servers?.environment ?? "—"}
                </StatusBadge>
              </dd>
            </div>
            <Field
              label="Owner"
              value={
                row.owners ? `${row.owners.name} · ${row.owners.team ?? "—"}` : "Unassigned"
              }
            />
            <Field label="IP address" value={row.servers?.ip_address ?? "—"} mono />
            <Field label="Operating system" value={row.servers?.os_version ?? "—"} mono />
            <Field label="Datacenter" value={row.servers?.datacenter ?? "—"} />
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Lifecycle</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Database · {row.instance_name}
              </h3>
              <dl className="grid gap-4">
                <Field label="Start date" value={formatDate(row.start_date)} mono />
                <Field label="Renewal date" value={formatDate(row.renewal_date)} mono />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expiry date
                  </dt>
                  <dd className="tech mt-1 flex items-center gap-2 text-sm">
                    {formatDate(row.expiry_date)}
                    {expiryBadgeLabel(row.expiry_date) ? (
                      <StatusBadge
                        tone={expiryState(row.expiry_date) === "expired" ? "danger" : "warning"}
                      >
                        {expiryBadgeLabel(row.expiry_date)}
                      </StatusBadge>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Server · {row.servers?.hostname ?? "—"}
              </h3>
              <dl className="grid gap-4">
                <Field label="Start date" value={formatDate(row.servers?.start_date)} mono />
                <Field label="Renewal date" value={formatDate(row.servers?.renewal_date)} mono />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expiry date
                  </dt>
                  <dd className="tech mt-1 flex items-center gap-2 text-sm">
                    {formatDate(row.servers?.expiry_date)}
                    {expiryBadgeLabel(row.servers?.expiry_date) ? (
                      <StatusBadge
                        tone={
                          expiryState(row.servers?.expiry_date) === "expired" ? "danger" : "warning"
                        }
                      >
                        {expiryBadgeLabel(row.servers?.expiry_date)}
                      </StatusBadge>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Resource usage</h2>
          {current ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <UsageBar
                  label="RAM"
                  percent={usagePercent(current.ram_used_gb, current.ram_allocated_gb)}
                  detail={`${Number(current.ram_used_gb)} / ${Number(current.ram_allocated_gb)} GB`}
                />
                <UsageBar
                  label="CPU"
                  percent={Number(current.cpu_usage_percent)}
                  detail={`${Number(current.cpu_cores)} cores`}
                />
                <UsageBar
                  label="Storage"
                  percent={usagePercent(current.storage_used_gb, current.storage_allocated_gb)}
                  detail={`${Number(current.storage_used_gb)} / ${Number(current.storage_allocated_gb)} GB`}
                />
                <UsageBar
                  label="Tablespace"
                  percent={Number(current.tablespace_used_percent)}
                  detail="of allocated tablespace"
                />
              </div>
              <div className="mt-6 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="RAM used (GB)"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Storage used (GB)"
                      stroke="var(--color-warning)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No resource metrics recorded.</p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Version history</h2>
          {history.data && history.data.length > 0 ? (
            <ol className="space-y-4 border-l pl-5">
              {history.data.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="tech text-sm">
                    <span className="text-muted-foreground">{h.old_version ?? "—"}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className={cn(isEndOfLife(h.new_version) && "text-warning")}>
                      {h.new_version}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(h.changed_on)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No recorded version changes.</p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold tracking-tight">Datasets / schemas</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Data sets stored inside {row.instance_name}
          </p>
          {schemas.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading datasets…</p>
          ) : schemas.data && schemas.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Schema</th>
                    <th className="py-2 pr-4 font-medium">Owner</th>
                    <th className="py-2 pr-4 font-medium">Purpose</th>
                    <th className="py-2 pr-4 text-right font-medium">Tables</th>
                    <th className="py-2 pr-4 text-right font-medium">Size (GB)</th>
                    <th className="py-2 font-medium">Last analyzed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schemas.data.map((s) => (
                    <tr key={s.id}>
                      <td className="tech py-2.5 pr-4">{s.schema_name}</td>
                      <td className="tech py-2.5 pr-4 text-muted-foreground">
                        {s.schema_owner ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.description ?? "—"}</td>
                      <td className="tech py-2.5 pr-4 text-right">{s.table_count}</td>
                      <td className="tech py-2.5 pr-4 text-right">{Number(s.size_gb).toFixed(1)}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {s.last_analyzed ? formatDate(s.last_analyzed) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No datasets recorded for this database.</p>
          )}
        </section>


        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">
            Scan history · {row.servers?.hostname ?? "server"}
          </h2>
          {scans.data && scans.data.length > 0 ? (
            <ul className="divide-y">
              {scans.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="tech w-48 text-sm">{formatDateTime(s.scanned_at)}</span>
                  <StatusBadge tone="info">{s.method}</StatusBadge>
                  <StatusBadge tone={s.success ? "success" : "danger"}>
                    {s.success ? "success" : "failed"}
                  </StatusBadge>
                  <span className="text-sm text-muted-foreground">{s.notes ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No scans recorded for this server.</p>
          )}
        </section>
      </main>
    </div>
  );
}
