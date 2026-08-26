
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  os_family TEXT NOT NULL,
  os_version TEXT,
  environment TEXT NOT NULL,
  datacenter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.servers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servers readable by everyone" ON public.servers FOR SELECT USING (true);

CREATE TABLE public.owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT
);
GRANT SELECT ON public.owners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners readable by everyone" ON public.owners FOR SELECT USING (true);

CREATE TABLE public.databases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL,
  sid TEXT,
  oracle_version TEXT NOT NULL,
  edition TEXT,
  patch_level TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.databases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT ALL ON public.databases TO service_role;
ALTER TABLE public.databases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "databases readable by everyone" ON public.databases FOR SELECT USING (true);

CREATE TABLE public.version_history (
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
CREATE POLICY "version_history readable by everyone" ON public.version_history FOR SELECT USING (true);

CREATE TABLE public.scan_log (
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
CREATE POLICY "scan_log readable by everyone" ON public.scan_log FOR SELECT USING (true);

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
('11111111-1111-1111-1111-000000000010','ora-dev-db03','10.40.3.33','Windows','Windows Server 2016','dev','DC-Local');

INSERT INTO public.owners (id, name, team) VALUES
('22222222-2222-2222-2222-000000000001','Priya Raman','Core Banking DBA'),
('22222222-2222-2222-2222-000000000002','Marcus Feld','Data Platform'),
('22222222-2222-2222-2222-000000000003','Aisha Karim','ERP Operations'),
('22222222-2222-2222-2222-000000000004','Tom Lindqvist','Infrastructure');

INSERT INTO public.databases (id, server_id, owner_id, instance_name, sid, oracle_version, edition, patch_level, status) VALUES
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
('33333333-3333-3333-3333-000000000015','11111111-1111-1111-1111-000000000010','22222222-2222-2222-2222-000000000003','ERPDEV','ERPD','12.1.0.2.0','Standard','PSU 12.1.0.2.210119','decommissioned');

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
('33333333-3333-3333-3333-000000000014','19.18.0.0.0','19.20.0.0.0','2025-12-04');

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
