import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "warning" | "danger" | "success";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-accent text-accent-foreground border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-destructive/10 text-destructive border-transparent",
  success: "bg-success/12 text-success border-transparent",
};

export function StatusBadge({
  children,
  tone = "neutral",
  mono,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        mono && "tech",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function environmentTone(environment: string): Tone {
  if (environment === "prod") return "danger";
  if (environment === "uat") return "warning";
  if (environment === "sit") return "info";
  return "neutral";
}
