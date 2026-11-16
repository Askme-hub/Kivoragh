CREATE POLICY "roles admin read" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.settings TO anon, authenticated;
CREATE POLICY "settings public site read" ON public.settings FOR SELECT TO anon, authenticated USING (key LIKE 'site.%');
CREATE OR REPLACE FUNCTION public.guard_self_admin_removal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own admin access';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER guard_self_admin_removal BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_self_admin_removal();