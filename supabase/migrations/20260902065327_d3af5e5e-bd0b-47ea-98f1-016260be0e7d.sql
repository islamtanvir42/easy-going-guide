CREATE TABLE public.database_schemas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id uuid NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  schema_name text NOT NULL,
  schema_owner text,
  description text,
  table_count integer NOT NULL DEFAULT 0,
  size_gb numeric NOT NULL DEFAULT 0,
  last_analyzed date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_database_schemas_database_id ON public.database_schemas(database_id);

GRANT SELECT ON public.database_schemas TO anon;
GRANT SELECT ON public.database_schemas TO authenticated;
GRANT ALL ON public.database_schemas TO service_role;

ALTER TABLE public.database_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "database_schemas readable by everyone"
ON public.database_schemas FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_database_schemas_updated_at
BEFORE UPDATE ON public.database_schemas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();