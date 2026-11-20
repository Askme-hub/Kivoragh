-- Kivora referral automation.
-- A referral code is claimed once per referred account. Rewards are issued only
-- after the referred account completes its qualifying customer order or seller sale.

CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code()
RETURNS TABLE(code text, user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_type text;
  v_code text;
  v_existing public.referral_codes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  v_type := CASE WHEN public.has_role(v_user, 'seller') THEN 'seller' ELSE 'customer' END;
  SELECT * INTO v_existing FROM public.referral_codes WHERE user_id = v_user FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_type <> v_type THEN
      UPDATE public.referral_codes SET user_type = v_type, updated_at = now()
        WHERE id = v_existing.id;
      v_existing.user_type := v_type;
    END IF;
    RETURN QUERY SELECT v_existing.code, v_existing.user_type;
    RETURN;
  END IF;

  LOOP
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    BEGIN
      INSERT INTO public.referral_codes(user_id, user_type, code)
      VALUES (v_user, v_type, v_code);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Retry only when the generated code collided. A concurrent account insert
      -- is resolved by reading the user's newly created row below.
      SELECT * INTO v_existing FROM public.referral_codes WHERE user_id = v_user;
      IF FOUND THEN
        RETURN QUERY SELECT v_existing.code, v_existing.user_type;
        RETURN;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_code, v_type;
END $$;

REVOKE ALL ON FUNCTION public.get_or_create_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_referral_code(_code text, _source text DEFAULT 'signup')
RETURNS TABLE(referrer_user_id uuid, referred_user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ref public.referral_codes%ROWTYPE;
  v_enabled boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT enabled INTO v_enabled FROM public.referral_settings WHERE id = true;
  IF NOT coalesce(v_enabled, false) THEN RAISE EXCEPTION 'Referrals are not currently active'; END IF;

  SELECT * INTO v_ref FROM public.referral_codes
    WHERE code = upper(trim(_code)) AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral code is invalid or inactive'; END IF;
  IF v_ref.user_id = v_user THEN RAISE EXCEPTION 'You cannot use your own referral code'; END IF;

  -- Referral attribution must be made before the referred account starts trading.
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_user)
     OR EXISTS (SELECT 1 FROM public.order_items WHERE seller_id = v_user) THEN
    RAISE EXCEPTION 'Referral codes can only be applied before your first order or sale';
  END IF;

  INSERT INTO public.referral_events
    (referral_code_id, referrer_user_id, referred_user_id, referred_user_type,
     event_type, status, source)
  VALUES
    (v_ref.id, v_ref.user_id, v_user, v_ref.user_type, 'registration', 'pending',
     left(coalesce(nullif(_source, ''), 'signup'), 40))
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN QUERY SELECT v_ref.user_id, v_ref.user_type;
END $$;

REVOKE ALL ON FUNCTION public.claim_referral_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text, text) TO authenticated;

-- Internal helper: qualify once and issue the configured reward in the same
-- transaction. The unique idempotency key prevents duplicate wallet credits.
CREATE OR REPLACE FUNCTION public.complete_referral_event(
  _event_id uuid,
  _event_type text,
  _order_id uuid,
  _amount numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.referral_events%ROWTYPE;
  v_enabled boolean;
  v_reward numeric(12,2);
  v_referrer_type text;
  v_tx_id uuid;
BEGIN
  SELECT * INTO v_event FROM public.referral_events
    WHERE id = _event_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT user_type INTO v_referrer_type
    FROM public.referral_codes WHERE id = v_event.referral_code_id;

  SELECT enabled,
    CASE WHEN v_referrer_type = 'seller'
      THEN seller_referrer_reward ELSE customer_referrer_reward END
  INTO v_enabled, v_reward
  FROM public.referral_settings WHERE id = true;

  IF NOT coalesce(v_enabled, false) THEN RETURN; END IF;

  UPDATE public.referral_events
    SET event_type = _event_type,
        status = 'qualified',
        qualified_order_id = _order_id,
        qualification_amount = _amount,
        qualified_at = now()
    WHERE id = _event_id AND status = 'pending';

  IF NOT FOUND OR coalesce(v_reward, 0) <= 0 THEN RETURN; END IF;

  INSERT INTO public.marketing_wallet_transactions
    (user_id, amount, transaction_type, status, referral_event_id,
     idempotency_key, description)
  VALUES
    (v_event.referrer_user_id, v_reward, 'referral_reward', 'completed',
     v_event.id, 'referral-reward:' || v_event.id::text,
     CASE WHEN v_event.referred_user_type = 'seller'
       THEN 'Referral reward: first successful seller sale'
       ELSE 'Referral reward: first completed paid customer order' END)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NOT NULL THEN
    INSERT INTO public.marketing_wallets(user_id, promotional_balance, currency)
    VALUES (v_event.referrer_user_id, v_reward, 'GHS')
    ON CONFLICT (user_id) DO UPDATE
      SET promotional_balance = public.marketing_wallets.promotional_balance + EXCLUDED.promotional_balance,
          updated_at = now();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.complete_referral_event(uuid, text, uuid, numeric)
  FROM PUBLIC, anon, authenticated;

-- Customer qualification: the FIRST completed paid order must meet the minimum.
-- A COD order is treated as paid only once all its items are delivered.
CREATE OR REPLACE FUNCTION public.qualify_customer_referral_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
  v_min numeric(12,2);
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.payment_status <> 'paid' AND NEW.payment_method <> 'cod' THEN RETURN NEW; END IF;

  SELECT customer_min_order_amount INTO v_min
    FROM public.referral_settings WHERE id = true;
  IF NEW.total < coalesce(v_min, 100) THEN RETURN NEW; END IF;

  -- A prior completed paid order, even one below the threshold, disqualifies
  -- this account because the rule applies to its first completed paid order.
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = NEW.user_id
      AND o.status = 'delivered'
      AND (o.payment_status = 'paid' OR o.payment_method = 'cod')
      AND (o.created_at, o.id) < (NEW.created_at, NEW.id)
  ) THEN RETURN NEW; END IF;

  SELECT id INTO v_event FROM public.referral_events
    WHERE referred_user_id = NEW.user_id
      AND referred_user_type = 'customer'
      AND status = 'pending'
    FOR UPDATE;
  IF v_event IS NOT NULL THEN
    PERFORM public.complete_referral_event(v_event, 'customer_first_paid_order', NEW.id, NEW.total);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.qualify_customer_referral_on_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_qualify_customer_referral_on_order ON public.orders;
CREATE TRIGGER trg_qualify_customer_referral_on_order
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.qualify_customer_referral_on_order();

-- Seller qualification: first delivered item from a seller, on a paid online,
-- Store Credit, or completed COD order. One referral reward per referred account.
CREATE OR REPLACE FUNCTION public.qualify_seller_referral_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event uuid;
  v_order public.orders%ROWTYPE;
  v_amount numeric(12,2);
BEGIN
  IF NEW.fulfillment_status <> 'delivered'
     OR OLD.fulfillment_status IS NOT DISTINCT FROM NEW.fulfillment_status
     OR NEW.seller_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_order.payment_status <> 'paid' AND v_order.payment_method <> 'cod' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_items i
    JOIN public.orders o ON o.id = i.order_id
    WHERE i.seller_id = NEW.seller_id
      AND i.fulfillment_status = 'delivered'
      AND (o.payment_status = 'paid' OR o.payment_method = 'cod')
      AND (o.created_at, o.id, i.id) < (v_order.created_at, v_order.id, NEW.id)
  ) THEN RETURN NEW; END IF;

  SELECT id INTO v_event FROM public.referral_events
    WHERE referred_user_id = NEW.seller_id
      AND referred_user_type = 'seller'
      AND status = 'pending'
    FOR UPDATE;
  IF v_event IS NOT NULL THEN
    v_amount := NEW.price * NEW.qty;
    PERFORM public.complete_referral_event(v_event, 'seller_first_successful_sale', NEW.order_id, v_amount);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.qualify_seller_referral_on_delivery() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_qualify_seller_referral_on_delivery ON public.order_items;
CREATE TRIGGER trg_qualify_seller_referral_on_delivery
AFTER UPDATE OF fulfillment_status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.qualify_seller_referral_on_delivery();


-- Keep referral classifications in sync with approved marketplace roles.
-- The code owner's role determines which referrer reward applies; the referred
-- account's role determines whether customer-order or seller-sale qualification runs.
CREATE OR REPLACE FUNCTION public.sync_referral_role_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_seller boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'seller'
  ) INTO v_is_seller;

  UPDATE public.referral_codes
    SET user_type = CASE WHEN v_is_seller THEN 'seller' ELSE 'customer' END,
        updated_at = now()
    WHERE user_id = NEW.user_id;

  UPDATE public.referral_events
    SET referred_user_type = CASE WHEN v_is_seller THEN 'seller' ELSE 'customer' END
    WHERE referred_user_id = NEW.user_id AND status = 'pending';

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sync_referral_role_classification()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_referral_role_classification ON public.user_roles;
CREATE TRIGGER trg_sync_referral_role_classification
AFTER INSERT OR UPDATE OF role ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_referral_role_classification();
