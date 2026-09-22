-- Safe-to-re-run version of 20260916080000_multi_platform_rac_sit.sql.
-- That migration's RENAME COLUMN / ADD CONSTRAINT lines error out on a
-- second run (or a run that starts partway through an already-migrated
-- table), which is what caused it to abort mid-way on some environments.
-- This file brings public.databases to the same end state no matter which
-- of its columns already exist, and can be run any number of times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'databases'
  ) THEN
    RAISE EXCEPTION 'public.databases does not exist. Run the base schema migrations (20260826155408 through 20260908044742) first — this project has no tables at all yet.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'databases' AND column_name = 'oracle_version'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'databases' AND column_name = 'db_version'
  ) THEN
    ALTER TABLE public.databases RENAME COLUMN oracle_version TO db_version;
  END IF;
END $$;

ALTER TABLE public.databases
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'oracle',
  ADD COLUMN IF NOT EXISTS is_rac BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cluster_name TEXT,
  ADD COLUMN IF NOT EXISTS node_count INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'databases_platform_check'
  ) THEN
    ALTER TABLE public.databases
      ADD CONSTRAINT databases_platform_check CHECK (platform IN ('oracle', 'mssql', 'postgresql'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS databases_platform_idx ON public.databases (platform);

-- All pre-existing seed rows are Oracle instances; flag two as RAC clusters.
UPDATE public.databases SET platform = 'oracle' WHERE platform IS NULL;

UPDATE public.databases
SET is_rac = true, cluster_name = 'CBNK-RAC1', node_count = 2
WHERE id IN ('33333333-3333-3333-3333-000000000001','33333333-3333-3333-3333-000000000002');

UPDATE public.databases
SET is_rac = true, cluster_name = 'LEDGER-RAC1', node_count = 3
WHERE id = '33333333-3333-3333-3333-000000000003';

-- New servers: a SIT box per platform, plus MSSQL and PostgreSQL estates.
INSERT INTO public.servers (id, hostname, ip_address, os_family, os_version, environment, datacenter) VALUES
('11111111-1111-1111-1111-000000000011','ora-sit-db01','10.50.4.41','Linux','Oracle Linux 9.3','sit','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000012','mssql-prod-db01','10.20.1.21','Windows','Windows Server 2022','prod','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000013','mssql-uat-db01','10.30.2.41','Windows','Windows Server 2022','uat','DC-Dublin'),
('11111111-1111-1111-1111-000000000014','mssql-sit-db01','10.50.4.42','Windows','Windows Server 2019','sit','DC-Dublin'),
('11111111-1111-1111-1111-000000000015','pg-prod-db01','10.20.1.31','Linux','Ubuntu 22.04','prod','DC-Singapore'),
('11111111-1111-1111-1111-000000000016','pg-uat-db01','10.30.2.51','Linux','Ubuntu 22.04','uat','DC-Singapore'),
('11111111-1111-1111-1111-000000000017','pg-dev-db01','10.40.3.41','Linux','Ubuntu 22.04','dev','DC-Local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.databases
  (id, server_id, owner_id, instance_name, sid, db_version, platform, edition, patch_level, status, is_rac, cluster_name, node_count) VALUES
('33333333-3333-3333-3333-000000000016','11111111-1111-1111-1111-000000000011','22222222-2222-2222-2222-000000000001','CBNKSIT','CBSIT','26ai','oracle','Enterprise','RU 26.1','active', true, 'CBNK-RAC-SIT', 2),
('33333333-3333-3333-3333-000000000017','11111111-1111-1111-1111-000000000012',NULL,'MSSQLPRD01', NULL,'2022','mssql','Enterprise','CU14','active', true, 'MSSQL-AG-PROD1', 3),
('33333333-3333-3333-3333-000000000018','11111111-1111-1111-1111-000000000013',NULL,'MSSQLUAT01', NULL,'2019','mssql','Standard','CU28','active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000019','11111111-1111-1111-1111-000000000014',NULL,'MSSQLSIT01', NULL,'2022','mssql','Standard','CU13','active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000020','11111111-1111-1111-1111-000000000015',NULL,'PGPROD01', NULL,'16','postgresql','Enterprise', NULL,'active', true, 'PG-PATRONI-PROD1', 3),
('33333333-3333-3333-3333-000000000021','11111111-1111-1111-1111-000000000016',NULL,'PGUAT01', NULL,'15', 'postgresql', NULL, NULL,'active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000022','11111111-1111-1111-1111-000000000017',NULL,'PGDEV01', NULL,'13', 'postgresql', NULL, NULL,'active', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Resource metrics for the new databases (same shape as the original seed).
WITH base AS (
  SELECT d.id,
         (ARRAY[16,32,64,128,256])[1 + (abs(hashtext(d.id::text)) % 5)]::numeric AS ram_alloc,
         (ARRAY[4,8,16,32])[1 + (abs(hashtext(d.id::text || 'c')) % 4)]::numeric AS cores,
         (ARRAY[200,500,1000,2000,4000])[1 + (abs(hashtext(d.id::text || 's')) % 5)]::numeric AS storage_alloc,
         (0.45 + (abs(hashtext(d.id::text || 'r')) % 50) / 100.0) AS ram_ratio,
         (0.40 + (abs(hashtext(d.id::text || 'x')) % 55) / 100.0) AS st_ratio
  FROM public.databases d
  WHERE d.id IN (
    '33333333-3333-3333-3333-000000000016','33333333-3333-3333-3333-000000000017',
    '33333333-3333-3333-3333-000000000018','33333333-3333-3333-3333-000000000019',
    '33333333-3333-3333-3333-000000000020','33333333-3333-3333-3333-000000000021',
    '33333333-3333-3333-3333-000000000022'
  )
  AND NOT EXISTS (SELECT 1 FROM public.resource_metrics m WHERE m.database_id = d.id)
), pts AS (
  SELECT b.*, gs AS n, now() - (gs * interval '5 days') AS recorded_at
  FROM base b, generate_series(0, 6) AS gs
)
INSERT INTO public.resource_metrics
  (database_id, recorded_at, ram_allocated_gb, ram_used_gb, cpu_cores, cpu_usage_percent,
   storage_allocated_gb, storage_used_gb, tablespace_used_percent)
SELECT
  id,
  recorded_at,
  ram_alloc,
  round(least(ram_alloc * least(ram_ratio + n * 0.005, 0.99), ram_alloc)::numeric, 1),
  cores,
  round((25 + (abs(hashtext(id::text || n::text)) % 65))::numeric, 1),
  storage_alloc,
  round(least(storage_alloc * least(st_ratio + n * 0.004, 0.98), storage_alloc)::numeric, 1),
  round((least(st_ratio + n * 0.004, 0.98) * 100)::numeric, 1)
FROM pts;
