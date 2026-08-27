import { OVER_CAPACITY_PERCENT } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export function UsageBar({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const over = pct > OVER_CAPACITY_PERCENT;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("tech text-xs", over ? "font-medium text-destructive" : "text-muted-foreground")}>
          {detail}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-sm bg-muted">
        <div
          className={cn("h-full rounded-sm", over ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={cn("tech mt-1 text-xs", over ? "text-destructive" : "text-muted-foreground")}>
        {pct.toFixed(1)}%
      </p>
    </div>
  );
}
