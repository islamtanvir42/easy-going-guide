DROP FUNCTION IF EXISTS public.is_approved(uuid);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employees') THEN
    EXECUTE 'CREATE POLICY "Admins can view employees" ON public.employees FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;

GRANT SELECT ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;