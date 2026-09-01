export type Server = {
  id: string;
  hostname: string;
  ip_address: string | null;
  os_family: string;
  os_version: string | null;
  environment: string;
  datacenter: string | null;
  start_date: string | null;
  renewal_date: string | null;
  expiry_date: string | null;
};

export type Owner = { id: string; name: string; team: string | null };

export type DatabaseRow = {
  id: string;
  server_id: string;
  owner_id: string | null;
  instance_name: string;
  sid: string | null;
  oracle_version: string;
  edition: string | null;
  patch_level: string | null;
  status: string;
  start_date: string | null;
  renewal_date: string | null;
  expiry_date: string | null;
  servers: Server | null;
  owners: Owner | null;
};

export type VersionHistoryRow = {
  id: string;
  database_id: string;
  old_version: string | null;
  new_version: string;
  changed_on: string;
};

export type ScanLogRow = {
  id: string;
  server_id: string;
  scanned_at: string;
  method: string;
  success: boolean;
  notes: string | null;
};

/** Oracle major releases considered end-of-life / unsupported. */
const EOL_MAJORS = ["11.", "12."];

export function isEndOfLife(version: string) {
  return EOL_MAJORS.some((major) => version.startsWith(major));
}

export function majorVersionLabel(version: string) {
  const [major] = version.split(".");
  return `${major}c`;
}

export const SCAN_OVERDUE_DAYS = 7;

/** Warn this many days before a license/support expiry date. */
export const EXPIRY_WARNING_DAYS = 90;

export type ExpiryState = "expired" | "warning" | "ok" | "none";

export function daysUntilExpiry(expiry: string | null | undefined): number | null {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${expiry}T00:00:00`);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

export function expiryState(expiry: string | null | undefined): ExpiryState {
  const days = daysUntilExpiry(expiry);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRY_WARNING_DAYS) return "warning";
  return "ok";
}

export function expiryBadgeLabel(expiry: string | null | undefined): string | null {
  const state = expiryState(expiry);
  const days = daysUntilExpiry(expiry);
  if (state === "expired") return `Expired ${Math.abs(days ?? 0)}d ago`;
  if (state === "warning") return `Expires in ${days}d`;
  return null;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export type ResourceMetricRow = {
  id: string;
  database_id: string;
  recorded_at: string;
  ram_allocated_gb: number;
  ram_used_gb: number;
  cpu_cores: number;
  cpu_usage_percent: number;
  storage_allocated_gb: number;
  storage_used_gb: number;
  tablespace_used_percent: number;
};

/** Usage above this percentage is considered over capacity. */
export const OVER_CAPACITY_PERCENT = 85;

export function usagePercent(used: number, allocated: number) {
  if (!allocated) return 0;
  return (Number(used) / Number(allocated)) * 100;
}

export function isOverCapacity(used: number, allocated: number) {
  return usagePercent(used, allocated) > OVER_CAPACITY_PERCENT;
}

/** Most recent metric row per database (input must be ordered recorded_at desc). */
export function latestByDatabase(rows: ResourceMetricRow[]) {
  const map = new Map<string, ResourceMetricRow>();
  rows.forEach((r) => {
    if (!map.has(r.database_id)) map.set(r.database_id, r);
  });
  return map;
}
