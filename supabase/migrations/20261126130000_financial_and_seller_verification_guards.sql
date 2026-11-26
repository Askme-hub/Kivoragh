-- Kivora security hardening: protect financial records and seller verification.
-- Apply to staging first after confirming the existing schema and migration history.

-- Financial ledger and wallet mutations are server/database-trigger only.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.seller_wallets FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.transactions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.withdrawal_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.seller_wallets TO authenticated;
GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.withdrawal_requests TO authenticated;
GRANT ALL ON TABLE public.seller_wallets TO service_role;
GRANT ALL ON TABLE public.transactions TO service_role;
GRANT ALL ON TABLE public.withdrawal_requests TO service_role;

-- Service-role calls originate from trusted server functions and must not be
-- mistaken for ordinary seller requests by SECURITY DEFINER trigger functions.
CREATE OR REPLACE FUNCTION public.guard_seller_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.status := 'pending';
  NEW.verification_status := 'not_verified';
  NEW.verified_at := NULL;
  NEW.verified_by := NULL;
  NEW.verification_note := NULL;
  NEW.verification_requested_at := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_seller_profile_insert() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_seller_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Shop ownership cannot be changed';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only an administrator can change shop approval status';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
     OR NEW.verification_requested_at IS DISTINCT FROM OLD.verification_requested_at THEN
    IF NOT (
      OLD.user_id = auth.uid()
      AND OLD.status = 'approved'
      AND OLD.verification_status IN ('not_verified', 'rejected')
      AND NEW.verification_status = 'pending'
      AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
      AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by
      AND NEW.verification_note IS NOT DISTINCT FROM OLD.verification_note
      AND NEW.verification_requested_at IS NOT DISTINCT FROM OLD.verification_requested_at
    ) THEN
      RAISE EXCEPTION 'Only an administrator can change shop verification details; sellers may only submit a verification request';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_seller_profile_update() FROM PUBLIC, anon, authenticated;

-- Preserve the verification audit log while explicitly allowing only a seller's
-- own approved shop to transition from not_verified/rejected to pending.
CREATE OR REPLACE FUNCTION public.guard_seller_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF is_admin THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      IF NEW.verification_status = 'verified' THEN
        NEW.verified_at := now();
        NEW.verified_by := auth.uid();
      ELSE
        NEW.verified_at := NULL;
        NEW.verified_by := NULL;
      END IF;
      INSERT INTO public.seller_verification_log
        (seller_id, actor_id, action, old_status, new_status, note)
      VALUES
        (NEW.user_id, auth.uid(), 'admin_' || NEW.verification_status,
         OLD.verification_status, NEW.verification_status, NEW.verification_note);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.user_id = auth.uid()
       AND OLD.status = 'approved'
       AND NEW.verification_status = 'pending'
       AND OLD.verification_status IN ('not_verified', 'rejected') THEN
      NEW.verification_requested_at := now();
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
      NEW.verification_note := NULL;
      INSERT INTO public.seller_verification_log
        (seller_id, actor_id, action, old_status, new_status, note)
      VALUES
        (NEW.user_id, auth.uid(), 'seller_request',
         OLD.verification_status, 'pending', NULL);
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Invalid seller verification state transition';
  END IF;

  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
     OR NEW.verification_requested_at IS DISTINCT FROM OLD.verification_requested_at THEN
    RAISE EXCEPTION 'Only an administrator can change shop verification metadata';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_seller_verification() FROM PUBLIC, anon, authenticated;

-- Recreate triggers so deployments with a partially applied prior hardening
-- migration converge to one known definition.
DROP TRIGGER IF EXISTS trg_guard_seller_profile_insert ON public.seller_profiles;
CREATE TRIGGER trg_guard_seller_profile_insert
  BEFORE INSERT ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_profile_insert();

DROP TRIGGER IF EXISTS trg_guard_seller_profile_update ON public.seller_profiles;
CREATE TRIGGER trg_guard_seller_profile_update
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_profile_update();

DROP TRIGGER IF EXISTS trg_guard_seller_verification ON public.seller_profiles;
CREATE TRIGGER trg_guard_seller_verification
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_verification();
