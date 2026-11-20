-- Capture referral attribution submitted during account creation.
-- This runs on the trusted auth.users insert path so email-confirmation signups
-- do not lose the referral code before they receive a session.

CREATE OR REPLACE FUNCTION public.record_signup_referral(
  _referred_user_id uuid,
  _code text,
  _source text DEFAULT 'signup'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref public.referral_codes%ROWTYPE;
  v_enabled boolean;
BEGIN
  IF _referred_user_id IS NULL OR nullif(trim(_code), '') IS NULL THEN RETURN; END IF;

  SELECT enabled INTO v_enabled FROM public.referral_settings WHERE id = true;
  IF NOT coalesce(v_enabled, false) THEN RETURN; END IF;

  SELECT * INTO v_ref FROM public.referral_codes
    WHERE code = upper(trim(_code)) AND is_active = true;
  IF NOT FOUND OR v_ref.user_id = _referred_user_id THEN RETURN; END IF;

  INSERT INTO public.referral_events
    (referral_code_id, referrer_user_id, referred_user_id, referred_user_type,
     event_type, status, source)
  VALUES
    (v_ref.id, v_ref.user_id, _referred_user_id,
     CASE WHEN public.has_role(_referred_user_id, 'seller') THEN 'seller' ELSE 'customer' END,
     'registration', 'pending', left(coalesce(nullif(_source, ''), 'signup'), 40))
  ON CONFLICT (referred_user_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.record_signup_referral(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_signup_referral_from_auth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.record_signup_referral(
    NEW.id,
    NEW.raw_user_meta_data ->> 'referral_code',
    'signup'
  );
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.capture_signup_referral_from_auth()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_signup_referral ON auth.users;
CREATE TRIGGER trg_capture_signup_referral
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_signup_referral_from_auth();
