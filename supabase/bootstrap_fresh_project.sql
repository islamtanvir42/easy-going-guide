-- ============================================================================
-- ONE-TIME BOOTSTRAP for a brand-new, empty Supabase project.
--
-- This is NOT a tracked migration file (it's not under supabase/migrations/)
-- — it's meant to be pasted once into the SQL Editor of a fresh Supabase
-- project to stand up the whole schema in its final, multi-platform form
-- directly (no oracle_version -> db_version rename needed, since the table
-- is created with the final columns from the start).
--
-- Safe to re-run: every statement either uses IF NOT EXISTS / OR REPLACE, or
-- is naturally idempotent (INSERT ... ON CONFLICT DO NOTHING, UPDATE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  os_family TEXT NOT NULL,
  os_version TEXT,
  environment TEXT NOT NULL,
  datacenter TEXT,
  start_date date,
  renewal_date date,
  expiry_date date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.servers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS servers_expiry_date_idx ON public.servers (expiry_date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='servers' AND policyname='servers readable by everyone') THEN
    CREATE POLICY "servers readable by everyone" ON public.servers FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT
);
GRANT SELECT ON public.owners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owners' AND policyname='owners readable by everyone') THEN
    CREATE POLICY "owners readable by everyone" ON public.owners FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.databases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL,
  sid TEXT,
  db_version TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'oracle',
  edition TEXT,
  patch_level TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_rac BOOLEAN NOT NULL DEFAULT false,
  cluster_name TEXT,
  node_count INTEGER,
  start_date date,
  renewal_date date,
  expiry_date date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.databases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT ALL ON public.databases TO service_role;
ALTER TABLE public.databases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS databases_expiry_date_idx ON public.databases (expiry_date);
CREATE INDEX IF NOT EXISTS databases_platform_idx ON public.databases (platform);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='databases' AND policyname='databases readable by everyone') THEN
    CREATE POLICY "databases readable by everyone" ON public.databases FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'databases_platform_check') THEN
    ALTER TABLE public.databases
      ADD CONSTRAINT databases_platform_check CHECK (platform IN ('oracle', 'mssql', 'postgresql'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.version_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  old_version TEXT,
  new_version TEXT NOT NULL,
  changed_on DATE NOT NULL DEFAULT CURRENT_DATE
);
GRANT SELECT ON public.version_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.version_history TO authenticated;
GRANT ALL ON public.version_history TO service_role;
ALTER TABLE public.version_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='version_history' AND policyname='version_history readable by everyone') THEN
    CREATE POLICY "version_history readable by everyone" ON public.version_history FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.scan_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL DEFAULT 'automated',
  success BOOLEAN NOT NULL DEFAULT true,
  notes TEXT
);
GRANT SELECT ON public.scan_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_log TO authenticated;
GRANT ALL ON public.scan_log TO service_role;
ALTER TABLE public.scan_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scan_log' AND policyname='scan_log readable by everyone') THEN
    CREATE POLICY "scan_log readable by everyone" ON public.scan_log FOR SELECT USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.resource_metrics (
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
CREATE INDEX IF NOT EXISTS idx_resource_metrics_db_time ON public.resource_metrics(database_id, recorded_at DESC);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='resource_metrics' AND policyname='Resource metrics are publicly readable') THEN
    CREATE POLICY "Resource metrics are publicly readable" ON public.resource_metrics FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.database_schemas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id uuid NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  schema_name text NOT NULL,
  schema_owner text,
  description text,
  table_count integer NOT NULL DEFAULT 0,
  size_gb numeric NOT NULL DEFAULT 0,
  last_analyzed date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_schemas_database_id ON public.database_schemas(database_id);
GRANT SELECT ON public.database_schemas TO anon;
GRANT SELECT ON public.database_schemas TO authenticated;
GRANT ALL ON public.database_schemas TO service_role;
ALTER TABLE public.database_schemas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='database_schemas' AND policyname='database_schemas readable by everyone') THEN
    CREATE POLICY "database_schemas readable by everyone" ON public.database_schemas FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_database_schemas_updated_at') THEN
    CREATE TRIGGER update_database_schemas_updated_at
      BEFORE UPDATE ON public.database_schemas
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Accounts, roles and the approval workflow
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  team text,
  status text NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  approved_by uuid,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending','approved','rejected'));
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved') $$;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Admins can manage roles') THEN
    CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Write access: approved members can add/edit; admins can delete.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='servers' AND policyname='Approved members can add servers') THEN
    CREATE POLICY "Approved members can add servers" ON public.servers FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='servers' AND policyname='Approved members can edit servers') THEN
    CREATE POLICY "Approved members can edit servers" ON public.servers FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='servers' AND policyname='Admins can delete servers') THEN
    CREATE POLICY "Admins can delete servers" ON public.servers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owners' AND policyname='Approved members can add owners') THEN
    CREATE POLICY "Approved members can add owners" ON public.owners FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owners' AND policyname='Approved members can edit owners') THEN
    CREATE POLICY "Approved members can edit owners" ON public.owners FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='owners' AND policyname='Admins can delete owners') THEN
    CREATE POLICY "Admins can delete owners" ON public.owners FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='databases' AND policyname='Approved members can add databases') THEN
    CREATE POLICY "Approved members can add databases" ON public.databases FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='databases' AND policyname='Approved members can edit databases') THEN
    CREATE POLICY "Approved members can edit databases" ON public.databases FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='databases' AND policyname='Admins can delete databases') THEN
    CREATE POLICY "Admins can delete databases" ON public.databases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='version_history' AND policyname='Approved members can add version history') THEN
    CREATE POLICY "Approved members can add version history" ON public.version_history FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='version_history' AND policyname='Admins can delete version history') THEN
    CREATE POLICY "Admins can delete version history" ON public.version_history FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.version_history TO authenticated;
GRANT ALL ON public.servers TO service_role;
GRANT ALL ON public.owners TO service_role;
GRANT ALL ON public.databases TO service_role;
GRANT ALL ON public.version_history TO service_role;

-- ---------------------------------------------------------------------------
-- Seed data: original Oracle estate + SIT/RAC/multi-platform sample rows
-- ---------------------------------------------------------------------------

INSERT INTO public.servers (id, hostname, ip_address, os_family, os_version, environment, datacenter) VALUES
('11111111-1111-1111-1111-000000000001','ora-prod-db01','10.20.1.11','Linux','Oracle Linux 8.9','prod','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000002','ora-prod-db02','10.20.1.12','Linux','Red Hat 9.3','prod','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000003','ora-prod-db03','10.20.1.13','Windows','Windows Server 2019','prod','DC-Dublin'),
('11111111-1111-1111-1111-000000000004','ora-uat-db01','10.30.2.21','Linux','Ubuntu 22.04','uat','DC-Dublin'),
('11111111-1111-1111-1111-000000000005','ora-uat-db02','10.30.2.22','Windows','Windows Server 2022','uat','DC-Dublin'),
('11111111-1111-1111-1111-000000000006','ora-dev-db01','10.40.3.31','Linux','Ubuntu 20.04','dev','DC-Local'),
('11111111-1111-1111-1111-000000000007','ora-dev-db02','10.40.3.32','Linux','Oracle Linux 7.9','dev','DC-Local'),
('11111111-1111-1111-1111-000000000008','ora-prod-db04','10.20.1.14','Linux','Red Hat 8.6','prod','DC-Singapore'),
('11111111-1111-1111-1111-000000000009','ora-uat-db03','10.30.2.23','Linux','Oracle Linux 8.7','uat','DC-Singapore'),
('11111111-1111-1111-1111-000000000010','ora-dev-db03','10.40.3.33','Windows','Windows Server 2016','dev','DC-Local'),
('11111111-1111-1111-1111-000000000011','ora-sit-db01','10.50.4.41','Linux','Oracle Linux 9.3','sit','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000012','mssql-prod-db01','10.20.1.21','Windows','Windows Server 2022','prod','DC-Frankfurt'),
('11111111-1111-1111-1111-000000000013','mssql-uat-db01','10.30.2.41','Windows','Windows Server 2022','uat','DC-Dublin'),
('11111111-1111-1111-1111-000000000014','mssql-sit-db01','10.50.4.42','Windows','Windows Server 2019','sit','DC-Dublin'),
('11111111-1111-1111-1111-000000000015','pg-prod-db01','10.20.1.31','Linux','Ubuntu 22.04','prod','DC-Singapore'),
('11111111-1111-1111-1111-000000000016','pg-uat-db01','10.30.2.51','Linux','Ubuntu 22.04','uat','DC-Singapore'),
('11111111-1111-1111-1111-000000000017','pg-dev-db01','10.40.3.41','Linux','Ubuntu 22.04','dev','DC-Local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.owners (id, name, team) VALUES
('22222222-2222-2222-2222-000000000001','Priya Raman','Core Banking DBA'),
('22222222-2222-2222-2222-000000000002','Marcus Feld','Data Platform'),
('22222222-2222-2222-2222-000000000003','Aisha Karim','ERP Operations'),
('22222222-2222-2222-2222-000000000004','Tom Lindqvist','Infrastructure')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.databases (id, server_id, owner_id, instance_name, sid, db_version, edition, patch_level, status) VALUES
('33333333-3333-3333-3333-000000000001','11111111-1111-1111-1111-000000000001','22222222-2222-2222-2222-000000000001','COREBANK1','CBNK1','19.20.0.0.0','Enterprise','RU 19.20','active'),
('33333333-3333-3333-3333-000000000002','11111111-1111-1111-1111-000000000001','22222222-2222-2222-2222-000000000001','COREBANK2','CBNK2','19.21.0.0.0','Enterprise','RU 19.21','active'),
('33333333-3333-3333-3333-000000000003','11111111-1111-1111-1111-000000000002','22222222-2222-2222-2222-000000000002','LEDGERP','LDGR','21.11.0.0.0','Enterprise','RU 21.11','active'),
('33333333-3333-3333-3333-000000000004','11111111-1111-1111-1111-000000000002','22222222-2222-2222-2222-000000000002','WAREHSE','WHSE','12.2.0.1.0','Enterprise','PSU 12.2.0.1.220118','active'),
('33333333-3333-3333-3333-000000000005','11111111-1111-1111-1111-000000000003','22222222-2222-2222-2222-000000000003','ERPPROD','ERPP','19.19.0.0.0','Standard','RU 19.19','active'),
('33333333-3333-3333-3333-000000000006','11111111-1111-1111-1111-000000000003','22222222-2222-2222-2222-000000000003','ERPARCH','ERPA','11.2.0.4.0','Enterprise','PSU 11.2.0.4.201020','active'),
('33333333-3333-3333-3333-000000000007','11111111-1111-1111-1111-000000000004','22222222-2222-2222-2222-000000000001','COREBANKU','CBNKU','19.20.0.0.0','Enterprise','RU 19.20','active'),
('33333333-3333-3333-3333-000000000008','11111111-1111-1111-1111-000000000004','22222222-2222-2222-2222-000000000004','TESTINT','TSTI','21.3.0.0.0','Standard','RU 21.3','active'),
('33333333-3333-3333-3333-000000000009','11111111-1111-1111-1111-000000000005','22222222-2222-2222-2222-000000000003','ERPUAT','ERPU','19.18.0.0.0','Standard','RU 19.18','active'),
('33333333-3333-3333-3333-000000000010','11111111-1111-1111-1111-000000000006','22222222-2222-2222-2222-000000000002','DEVSANDBX','DSBX','21.11.0.0.0','Standard','RU 21.11','active'),
('33333333-3333-3333-3333-000000000011','11111111-1111-1111-1111-000000000007','22222222-2222-2222-2222-000000000004','LEGACYDEV','LGCY','11.2.0.4.0','Standard','PSU 11.2.0.4.190115','decommissioned'),
('33333333-3333-3333-3333-000000000012','11111111-1111-1111-1111-000000000008','22222222-2222-2222-2222-000000000001','PAYMENTS','PAYP','19.21.0.0.0','Enterprise','RU 19.21','active'),
('33333333-3333-3333-3333-000000000013','11111111-1111-1111-1111-000000000008','22222222-2222-2222-2222-000000000002','ANALYTX','ANLX','21.12.0.0.0','Enterprise','RU 21.12','active'),
('33333333-3333-3333-3333-000000000014','11111111-1111-1111-1111-000000000009','22222222-2222-2222-2222-000000000004','PAYUAT','PAYU','19.20.0.0.0','Enterprise','RU 19.20','active'),
('33333333-3333-3333-3333-000000000015','11111111-1111-1111-1111-000000000010','22222222-2222-2222-2222-000000000003','ERPDEV','ERPD','12.1.0.2.0','Standard','PSU 12.1.0.2.210119','decommissioned'),
('33333333-3333-3333-3333-000000000016','11111111-1111-1111-1111-000000000011','22222222-2222-2222-2222-000000000001','CBNKSIT','CBSIT','26ai','Enterprise','RU 26.1','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.databases (id, server_id, owner_id, instance_name, sid, db_version, platform, edition, patch_level, status, is_rac, cluster_name, node_count) VALUES
('33333333-3333-3333-3333-000000000017','11111111-1111-1111-1111-000000000012',NULL,'MSSQLPRD01', NULL,'2022','mssql','Enterprise','CU14','active', true, 'MSSQL-AG-PROD1', 3),
('33333333-3333-3333-3333-000000000018','11111111-1111-1111-1111-000000000013',NULL,'MSSQLUAT01', NULL,'2019','mssql','Standard','CU28','active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000019','11111111-1111-1111-1111-000000000014',NULL,'MSSQLSIT01', NULL,'2022','mssql','Standard','CU13','active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000020','11111111-1111-1111-1111-000000000015',NULL,'PGPROD01', NULL,'16','postgresql','Enterprise', NULL,'active', true, 'PG-PATRONI-PROD1', 3),
('33333333-3333-3333-3333-000000000021','11111111-1111-1111-1111-000000000016',NULL,'PGUAT01', NULL,'15', 'postgresql', NULL, NULL,'active', false, NULL, NULL),
('33333333-3333-3333-3333-000000000022','11111111-1111-1111-1111-000000000017',NULL,'PGDEV01', NULL,'13', 'postgresql', NULL, NULL,'active', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.databases
SET is_rac = true, cluster_name = 'CBNK-RAC1', node_count = 2
WHERE id IN ('33333333-3333-3333-3333-000000000001','33333333-3333-3333-3333-000000000002');

UPDATE public.databases
SET is_rac = true, cluster_name = 'LEDGER-RAC1', node_count = 3
WHERE id = '33333333-3333-3333-3333-000000000003';

UPDATE public.databases
SET is_rac = true, cluster_name = 'CBNK-RAC-SIT', node_count = 2
WHERE id = '33333333-3333-3333-3333-000000000016';

INSERT INTO public.version_history (database_id, old_version, new_version, changed_on) VALUES
('33333333-3333-3333-3333-000000000001','19.18.0.0.0','19.19.0.0.0','2025-02-14'),
('33333333-3333-3333-3333-000000000001','19.19.0.0.0','19.20.0.0.0','2025-09-03'),
('33333333-3333-3333-3333-000000000002','19.20.0.0.0','19.21.0.0.0','2026-01-22'),
('33333333-3333-3333-3333-000000000003','19.21.0.0.0','21.11.0.0.0','2025-11-11'),
('33333333-3333-3333-3333-000000000004','12.1.0.2.0','12.2.0.1.0','2021-06-30'),
('33333333-3333-3333-3333-000000000005','19.17.0.0.0','19.19.0.0.0','2025-05-19'),
('33333333-3333-3333-3333-000000000006','11.2.0.3.0','11.2.0.4.0','2019-03-12'),
('33333333-3333-3333-3333-000000000012','19.19.0.0.0','19.21.0.0.0','2026-03-08'),
('33333333-3333-3333-3333-000000000013','21.11.0.0.0','21.12.0.0.0','2026-05-27'),
('33333333-3333-3333-3333-000000000014','19.18.0.0.0','19.20.0.0.0','2025-12-04')
ON CONFLICT DO NOTHING;

INSERT INTO public.scan_log (server_id, scanned_at, method, success, notes) VALUES
('11111111-1111-1111-1111-000000000001', now() - interval '6 hours','automated',true,'Full inventory scan completed'),
('11111111-1111-1111-1111-000000000001', now() - interval '8 days','automated',true,'Full inventory scan completed'),
('11111111-1111-1111-1111-000000000002', now() - interval '1 day','automated',true,'2 instances discovered'),
('11111111-1111-1111-1111-000000000003', now() - interval '3 days','manual',true,'Manual check by ERP Operations'),
('11111111-1111-1111-1111-000000000004', now() - interval '12 days','automated',false,'SSH timeout, credentials expired'),
('11111111-1111-1111-1111-000000000005', now() - interval '2 days','automated',true,'WMI scan OK'),
('11111111-1111-1111-1111-000000000006', now() - interval '20 days','manual',true,'Dev box, scanned on request'),
('11111111-1111-1111-1111-000000000007', now() - interval '31 days','automated',false,'Host unreachable'),
('11111111-1111-1111-1111-000000000008', now() - interval '5 hours','automated',true,'Full inventory scan completed'),
('11111111-1111-1111-1111-000000000009', now() - interval '4 days','automated',true,'1 instance discovered'),
('11111111-1111-1111-1111-000000000010', now() - interval '45 days','manual',true,'Pending decommission');

-- Server lifecycle dates (spread across the estate, same formula as the original app).
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY hostname) AS rn
  FROM public.servers
)
UPDATE public.servers s
SET
  start_date = COALESCE(s.start_date, CURRENT_DATE - (INTERVAL '1 year' * (1 + (n.rn % 4))) - (INTERVAL '30 days' * n.rn)),
  expiry_date = COALESCE(s.expiry_date, CURRENT_DATE + (INTERVAL '1 day' * (CASE n.rn % 5 WHEN 0 THEN 25 WHEN 1 THEN 60 WHEN 2 THEN 150 WHEN 3 THEN 260 ELSE 420 END)))
FROM numbered n
WHERE s.id = n.id;

UPDATE public.servers
SET renewal_date = expiry_date - INTERVAL '30 days'
WHERE expiry_date IS NOT NULL AND renewal_date IS NULL;

-- Resource metrics: 7 readings per database over the past 30 days.
WITH base AS (
  SELECT d.id,
         (ARRAY[16,32,64,128,256])[1 + (abs(hashtext(d.id::text)) % 5)]::numeric AS ram_alloc,
         (ARRAY[4,8,16,32])[1 + (abs(hashtext(d.id::text || 'c')) % 4)]::numeric AS cores,
         (ARRAY[200,500,1000,2000,4000])[1 + (abs(hashtext(d.id::text || 's')) % 5)]::numeric AS storage_alloc,
         (0.45 + (abs(hashtext(d.id::text || 'r')) % 50) / 100.0) AS ram_ratio,
         (0.40 + (abs(hashtext(d.id::text || 'x')) % 55) / 100.0) AS st_ratio
  FROM public.databases d
  WHERE NOT EXISTS (SELECT 1 FROM public.resource_metrics m WHERE m.database_id = d.id)
), pts AS (
  SELECT b.*, gs AS n, now() - (gs * interval '5 days') AS recorded_at
  FROM base b, generate_series(0, 6) AS gs
)
INSERT INTO public.resource_metrics
  (database_id, recorded_at, ram_allocated_gb, ram_used_gb, cpu_cores, cpu_usage_percent,
   storage_allocated_gb, storage_used_gb, tablespace_used_percent)
SELECT
  id, recorded_at, ram_alloc,
  round(least(ram_alloc * least(ram_ratio + n * 0.005, 0.99), ram_alloc)::numeric, 1),
  cores,
  round((25 + (abs(hashtext(id::text || n::text)) % 65))::numeric, 1),
  storage_alloc,
  round(least(storage_alloc * least(st_ratio + n * 0.004, 0.98), storage_alloc)::numeric, 1),
  round((least(st_ratio + n * 0.004, 0.98) * 100)::numeric, 1)
FROM pts;
