-- Kivora store credit: use the existing marketing wallet balance as the canonical
-- non-withdrawable customer credit balance. Seller earnings remain separate.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_credit_applied numeric(12,2) NOT NULL DEFAULT 0
  CHECK (store_credit_applied >= 0 AND store_credit_applied <= total);

ALTER TABLE public.marketing_wallet_transactions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_wallet_transactions
  DROP CONSTRAINT IF EXISTS marketing_wallet_transactions_transaction_type_check;
ALTER TABLE public.marketing_wallet_transactions
  ADD CONSTRAINT marketing_wallet_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'referral_reward','referral_reward_reversal','campaign_credit','campaign_credit_reversal',
    'store_credit_spend','store_credit_refund'
  ));

CREATE INDEX IF NOT EXISTS marketing_wallet_transactions_order_idx
  ON public.marketing_wallet_transactions(order_id) WHERE order_id IS NOT NULL;

-- Authenticated users can only spend their own balance on their own unpaid order.
CREATE OR REPLACE FUNCTION public.apply_store_credit_to_order(_order_id uuid)
RETURNS TABLE(applied numeric, amount_due numeric, balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_balance numeric(12,2);
  v_applied numeric(12,2);
  v_existing numeric(12,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE id = _order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT promotional_balance INTO v_balance
    FROM public.marketing_wallets WHERE user_id = v_user FOR UPDATE;
  v_balance := coalesce(v_balance, 0);

  -- Idempotent retry: never debit twice for the same order.
  SELECT amount INTO v_existing FROM public.marketing_wallet_transactions
    WHERE idempotency_key = 'store-credit-spend:' || _order_id::text
      AND transaction_type = 'store_credit_spend';
  IF FOUND THEN
    RETURN QUERY SELECT v_existing, greatest(0, v_order.total - v_existing), v_balance;
    RETURN;
  END IF;

  IF v_order.payment_status <> 'pending'
     OR v_order.status NOT IN ('pending_payment','placed') THEN
    RAISE EXCEPTION 'This order is no longer eligible for store credit';
  END IF;

  v_applied := least(v_balance, v_order.total);
  IF v_applied <= 0 THEN
    RETURN QUERY SELECT 0::numeric, v_order.total, v_balance;
    RETURN;
  END IF;

  UPDATE public.marketing_wallets
    SET promotional_balance = promotional_balance - v_applied, updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO public.marketing_wallet_transactions
    (user_id, amount, transaction_type, status, idempotency_key, description, order_id)
  VALUES
    (v_user, v_applied, 'store_credit_spend', 'completed',
     'store-credit-spend:' || _order_id::text,
     'Kivora Store Credit used on order ' || coalesce(v_order.order_number, _order_id::text),
     _order_id);

  UPDATE public.orders
    SET store_credit_applied = v_applied,
        payment_method = CASE WHEN v_applied >= total THEN 'store_credit' ELSE payment_method END
    WHERE id = _order_id;

  SELECT promotional_balance INTO v_balance
    FROM public.marketing_wallets WHERE user_id = v_user;
  RETURN QUERY SELECT v_applied, greatest(0, v_order.total - v_applied), coalesce(v_balance,0);
END $$;

REVOKE ALL ON FUNCTION public.apply_store_credit_to_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_store_credit_to_order(uuid) TO authenticated;

-- Restore the credit exactly once if an order is cancelled or its online payment fails.
CREATE OR REPLACE FUNCTION public.restore_store_credit_for_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric(12,2);
BEGIN
  IF NEW.store_credit_applied > 0
     AND (
       (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
       OR (NEW.payment_status = 'failed' AND OLD.payment_status IS DISTINCT FROM 'failed')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.marketing_wallet_transactions
       WHERE idempotency_key = 'store-credit-refund:' || NEW.id::text
         AND transaction_type = 'store_credit_refund'
     ) THEN
    v_amount := NEW.store_credit_applied;
    INSERT INTO public.marketing_wallets(user_id, promotional_balance, currency)
      VALUES (NEW.user_id, v_amount, 'GHS')
      ON CONFLICT (user_id) DO UPDATE
        SET promotional_balance = public.marketing_wallets.promotional_balance + EXCLUDED.promotional_balance,
            updated_at = now();
    INSERT INTO public.marketing_wallet_transactions
      (user_id, amount, transaction_type, status, idempotency_key, description, order_id)
    VALUES
      (NEW.user_id, v_amount, 'store_credit_refund', 'completed',
       'store-credit-refund:' || NEW.id::text,
       'Store Credit returned for cancelled or failed order ' || coalesce(NEW.order_number, NEW.id::text),
       NEW.id);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.restore_store_credit_for_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_restore_store_credit_for_order ON public.orders;
CREATE TRIGGER trg_restore_store_credit_for_order
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_store_credit_for_order();

-- Hybrid COD + Store Credit seller settlement. The seller collects only the cash
-- portion; the Store Credit-funded portion is placed in normal 48-hour escrow.
CREATE OR REPLACE FUNCTION public.escrow_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_rate numeric;
  v_gross numeric;
  v_commission numeric;
  v_credit_total numeric;
  v_order_items_total numeric;
  v_credit_share numeric;
  v_credit_commission numeric;
  v_cash_commission numeric;
  v_credit_net numeric;
  v_method text;
BEGIN
  IF NEW.fulfillment_status = 'delivered'
     AND OLD.fulfillment_status IS DISTINCT FROM 'delivered'
     AND NEW.seller_id IS NOT NULL AND NEW.seller_net IS NULL THEN
    SELECT commission / 100.0 INTO v_rate FROM public.subscription_plans
      WHERE id = public.active_seller_plan(NEW.seller_id);
    v_rate := coalesce(v_rate, 0.12);
    v_gross := NEW.price * NEW.qty;
    v_commission := round(v_gross * v_rate, 2);
    SELECT payment_method, coalesce(store_credit_applied,0)
      INTO v_method, v_credit_total FROM public.orders WHERE id = NEW.order_id;
    SELECT coalesce(sum(price * qty),0) INTO v_order_items_total
      FROM public.order_items WHERE order_id = NEW.order_id;
    v_credit_share := CASE
      WHEN v_method = 'cod' AND v_order_items_total > 0
        THEN least(v_gross, round(v_credit_total * v_gross / v_order_items_total, 2))
      ELSE 0
    END;
    v_credit_commission := round(v_credit_share * v_rate, 2);
    v_cash_commission := greatest(0, v_commission - v_credit_commission);
    v_credit_net := greatest(0, v_credit_share - v_credit_commission);

    IF v_method = 'cod' THEN
      NEW.seller_net := v_credit_net;
      IF v_credit_net > 0 THEN
        NEW.escrow_release_at := now() + interval '48 hours';
        NEW.escrow_released := false;
        INSERT INTO public.seller_wallets (user_id, balance, escrow, commission_paid)
        VALUES (NEW.seller_id, -v_cash_commission, v_credit_net, v_commission)
        ON CONFLICT (user_id) DO UPDATE SET
          escrow = public.seller_wallets.escrow + v_credit_net,
          balance = public.seller_wallets.balance - v_cash_commission,
          commission_paid = public.seller_wallets.commission_paid + v_commission,
          updated_at = now();
        INSERT INTO public.transactions (seller_id, type, amount, status, order_id, description)
        VALUES (NEW.seller_id, 'escrow', v_credit_net, 'pending', NEW.order_id,
          'Store Credit-funded sale held 48h after delivery: ' || NEW.name);
      ELSE
        NEW.escrow_released := true;
        INSERT INTO public.seller_wallets (user_id, balance, commission_paid)
        VALUES (NEW.seller_id, -v_cash_commission, v_commission)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = public.seller_wallets.balance - v_cash_commission,
          commission_paid = public.seller_wallets.commission_paid + v_commission,
          updated_at = now();
      END IF;
      IF v_cash_commission > 0 THEN
        INSERT INTO public.transactions (seller_id, type, amount, order_id, description)
        VALUES (NEW.seller_id, 'cod_commission', -v_cash_commission, NEW.order_id,
          'COD commission owed on: ' || NEW.name);
      END IF;
      RETURN NEW;
    END IF;

    NEW.seller_net := v_gross - v_commission;
    NEW.escrow_release_at := now() + interval '48 hours';
    NEW.escrow_released := false;
    INSERT INTO public.seller_wallets (user_id, escrow, commission_paid)
    VALUES (NEW.seller_id, NEW.seller_net, v_commission)
    ON CONFLICT (user_id) DO UPDATE SET
      escrow = public.seller_wallets.escrow + NEW.seller_net,
      commission_paid = public.seller_wallets.commission_paid + v_commission,
      updated_at = now();
    INSERT INTO public.transactions (seller_id, type, amount, status, order_id, description)
    VALUES (NEW.seller_id, 'escrow', NEW.seller_net, 'pending', NEW.order_id,
      'Held 48h after delivery: ' || NEW.name);
    INSERT INTO public.transactions (seller_id, type, amount, order_id, description)
    VALUES (NEW.seller_id, 'commission', -v_commission, NEW.order_id, 'Commission on: ' || NEW.name);
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.escrow_on_delivery() FROM PUBLIC, anon, authenticated;

-- Cancellation messaging/refund status must distinguish external payments from
-- Store Credit. The restore trigger above returns the Store Credit portion.
CREATE OR REPLACE FUNCTION public.buyer_cancel_order(_order_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_refund text := 'none';
  v_external_refund numeric(12,2);
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id <> auth.uid() THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status NOT IN ('pending_payment','placed','pending_confirmation') THEN
    RAISE EXCEPTION 'This order is already being prepared or shipped and can no longer be cancelled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND fulfillment_status IN ('shipped','delivered')) THEN
    RAISE EXCEPTION 'This order is already being prepared or shipped and can no longer be cancelled';
  END IF;

  v_external_refund := greatest(0, coalesce(o.amount_paid, o.total) - coalesce(o.store_credit_applied, 0));
  IF o.payment_status = 'paid' AND o.payment_method <> 'cod' AND v_external_refund > 0 THEN
    v_refund := 'pending';
  END IF;

  UPDATE public.orders SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'buyer', refund_status = v_refund
    WHERE id = _order_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT DISTINCT seller_id, 'order', 'Order cancelled by buyer',
    'Order #' || o.order_number || ' was cancelled. Please do not ship it.', '/seller/orders/' || _order_id
  FROM public.order_items WHERE order_id = _order_id AND seller_id IS NOT NULL;

  INSERT INTO public.inbox_messages (user_id, title, body) VALUES (
    o.user_id,
    'Order cancelled',
    CASE
      WHEN v_refund = 'pending' THEN
        'Order #' || o.order_number || ' was cancelled. Your external payment refund of GH₵' ||
        to_char(v_external_refund, 'FM999999990.00') || ' will be sent to your original payment account within 2 working business days.' ||
        CASE WHEN coalesce(o.store_credit_applied,0) > 0 THEN ' Your Store Credit will be returned to your Kivora balance.' ELSE '' END
      WHEN coalesce(o.store_credit_applied,0) > 0 THEN
        'Order #' || o.order_number || ' was cancelled. Your Store Credit has been returned to your Kivora balance.'
      ELSE 'Order #' || o.order_number || ' was cancelled.'
    END
  );
  RETURN v_refund;
END $$;

REVOKE EXECUTE ON FUNCTION public.buyer_cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buyer_cancel_order(uuid) TO authenticated;
