CREATE TABLE public.resource_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ram_allocated_gb NUMERIC NOT NULL,
  ram_used_gb NUMERIC NOT NULL,
  cpu_cores NUMERIC NOT NULL,
  cpu_usage_percent NUMERIC NOT NULL,
  storage_allocated_gb NUMERIC NOT NULL,
  storage_used_gb NUMERIC NOT NULL,
  tablespace_used_percent NUMERIC NOT NULL
);

GRANT SELECT ON public.resource_metrics TO anon;
GRANT SELECT ON public.resource_metrics TO authenticated;
GRANT ALL ON public.resource_metrics TO service_role;

ALTER TABLE public.resource_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resource metrics are publicly readable"
  ON public.resource_metrics FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_resource_metrics_db_time ON public.resource_metrics(database_id, recorded_at DESC);

-- Seed: 7 readings per database over the past 30 days
WITH base AS (
  SELECT d.id,
         (ARRAY[16,32,64,128,256])[1 + (abs(hashtext(d.id::text)) % 5)]::numeric AS ram_alloc,
         (ARRAY[4,8,16,32])[1 + (abs(hashtext(d.id::text || 'c')) % 4)]::numeric AS cores,
         (ARRAY[200,500,1000,2000,4000])[1 + (abs(hashtext(d.id::text || 's')) % 5)]::numeric AS storage_alloc,
         (0.45 + (abs(hashtext(d.id::text || 'r')) % 50) / 100.0) AS ram_ratio,
         (0.40 + (abs(hashtext(d.id::text || 'x')) % 55) / 100.0) AS st_ratio
  FROM public.databases d
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