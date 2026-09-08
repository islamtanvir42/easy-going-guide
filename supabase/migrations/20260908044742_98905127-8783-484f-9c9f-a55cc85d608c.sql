CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'approved'
  )
$$;

REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.version_history TO authenticated;
GRANT ALL ON public.servers TO service_role;
GRANT ALL ON public.owners TO service_role;
GRANT ALL ON public.databases TO service_role;
GRANT ALL ON public.version_history TO service_role;

CREATE POLICY "Approved members can add servers" ON public.servers
  FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved members can edit servers" ON public.servers
  FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Admins can delete servers" ON public.servers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved members can add owners" ON public.owners
  FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved members can edit owners" ON public.owners
  FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Admins can delete owners" ON public.owners
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved members can add databases" ON public.databases
  FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved members can edit databases" ON public.databases
  FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Admins can delete databases" ON public.databases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved members can add version history" ON public.version_history
  FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Admins can delete version history" ON public.version_history
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));