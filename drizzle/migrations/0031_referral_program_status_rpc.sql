-- Expose only the programme on/off state to signed-in users; reward amounts
-- and admin configuration remain private to administrators.
CREATE OR REPLACE FUNCTION public.referral_program_is_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT enabled FROM public.referral_settings WHERE id = true), false);
$$;

REVOKE ALL ON FUNCTION public.referral_program_is_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_program_is_enabled() TO authenticated;
