import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  DatabaseRow,
  DatabaseSchemaRow,
  ResourceMetricRow,
  ScanLogRow,
  Server,
  VersionHistoryRow,
} from "./inventory";

async function rest<T>(path: string): Promise<T> {
  // Prefer the Vite build-time value (always present, since it's inlined from
  // the committed .env at build) and fall back to a platform-configured
  // runtime env var for deployments that only set process.env.
  const url =
    import.meta.env["VITE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"];
  const key =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_PUBLISHABLE_KEY"]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Backend is not configured (missing ${missing})`);
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Backend request failed (${res.status})`);
  return (await res.json()) as T;
}

const idSchema = (data: unknown) => z.object({ id: z.string() }).parse(data);

export const getDatabases = createServerFn({ method: "GET" }).handler(async () =>
  rest<DatabaseRow[]>("databases?select=*,servers(*),owners(*)&order=instance_name"),
);

export const getServers = createServerFn({ method: "GET" }).handler(async () =>
  rest<Server[]>("servers?select=*&order=hostname"),
);

export const getScanLog = createServerFn({ method: "GET" }).handler(async () =>
  rest<ScanLogRow[]>("scan_log?select=*&order=scanned_at.desc"),
);

export const getDatabase = createServerFn({ method: "GET" })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const rows = await rest<DatabaseRow[]>(
      `databases?select=*,servers(*),owners(*)&id=eq.${encodeURIComponent(data.id)}&limit=1`,
    );
    return rows[0] ?? null;
  });

export const getScanLogForServer = createServerFn({ method: "GET" })
  .inputValidator(idSchema)
  .handler(async ({ data }) =>
    rest<ScanLogRow[]>(
      `scan_log?select=*&server_id=eq.${encodeURIComponent(data.id)}&order=scanned_at.desc`,
    ),
  );

export const getVersionHistory = createServerFn({ method: "GET" })
  .inputValidator(idSchema)
  .handler(async ({ data }) =>
    rest<VersionHistoryRow[]>(
      `version_history?select=*&database_id=eq.${encodeURIComponent(data.id)}&order=changed_on.desc`,
    ),
  );

export const getLatestMetrics = createServerFn({ method: "GET" }).handler(async () =>
  rest<ResourceMetricRow[]>("resource_metrics?select=*&order=recorded_at.desc"),
);

export const getMetricsForDatabase = createServerFn({ method: "GET" })
  .inputValidator(idSchema)
  .handler(async ({ data }) =>
    rest<ResourceMetricRow[]>(
      `resource_metrics?select=*&database_id=eq.${encodeURIComponent(data.id)}&order=recorded_at.asc`,
    ),
  );

export const getSchemasForDatabase = createServerFn({ method: "GET" })
  .inputValidator(idSchema)
  .handler(async ({ data }) =>
    rest<DatabaseSchemaRow[]>(
      `database_schemas?select=*&database_id=eq.${encodeURIComponent(data.id)}&order=schema_name`,
    ),
  );
