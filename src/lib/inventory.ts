import { supabase } from "@/integrations/supabase/client";

export type Server = {
  id: string;
  hostname: string;
  ip_address: string | null;
  os_family: string;
  os_version: string | null;
  environment: string;
  datacenter: string | null;
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

export async function fetchDatabases() {
  const { data, error } = await supabase
    .from("databases")
    .select("*, servers(*), owners(*)")
    .order("instance_name");
  if (error) throw error;
  return (data ?? []) as unknown as DatabaseRow[];
}

export async function fetchDatabase(id: string) {
  const { data, error } = await supabase
    .from("databases")
    .select("*, servers(*), owners(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as DatabaseRow | null;
}

export async function fetchServers() {
  const { data, error } = await supabase.from("servers").select("*").order("hostname");
  if (error) throw error;
  return (data ?? []) as unknown as Server[];
}

export async function fetchScanLog() {
  const { data, error } = await supabase
    .from("scan_log")
    .select("*")
    .order("scanned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ScanLogRow[];
}

export async function fetchScanLogForServer(serverId: string) {
  const { data, error } = await supabase
    .from("scan_log")
    .select("*")
    .eq("server_id", serverId)
    .order("scanned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ScanLogRow[];
}

export async function fetchVersionHistory(databaseId: string) {
  const { data, error } = await supabase
    .from("version_history")
    .select("*")
    .eq("database_id", databaseId)
    .order("changed_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VersionHistoryRow[];
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
