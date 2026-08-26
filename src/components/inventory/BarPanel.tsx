import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number; warn?: boolean };

export function BarPanel({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: BarDatum[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </header>
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          data.map((d) => (
            <div key={d.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3">
              <span className={cn("tech truncate text-xs", d.warn && "text-warning")}>
                {d.label}
              </span>
              <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className={cn("h-full rounded-sm", d.warn ? "bg-warning" : "bg-primary")}
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
              <span className="tech text-right text-xs text-muted-foreground">{d.value}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
