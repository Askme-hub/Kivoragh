-- Allow buyers to choose the exact amount of Kivora Store Credit to apply.
-- The database remains authoritative and validates the amount against the locked
-- wallet balance and the locked order total.

DROP FUNCTION IF EXISTS public.apply_store_credit_to_order(uuid);

CREATE FUNCTION public.apply_store_credit_to_order(
  _order_id uuid,
  _requested_amount numeric DEFAULT NULL
)
RETURNS TABLE(applied numeric, amount_due numeric, balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_balance numeric(12,2);
  v_applied numeric(12,2);
  v_existing numeric(12,2);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _requested_amount IS NOT NULL AND _requested_amount < 0 THEN
    RAISE EXCEPTION 'Store Credit amount cannot be negative';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = _order_id AND user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT promotional_balance INTO v_balance
  FROM public.marketing_wallets
  WHERE user_id = v_user
  FOR UPDATE;
  v_balance := coalesce(v_balance, 0);

  -- Idempotent retry: never debit twice for the same order.
  SELECT amount INTO v_existing
  FROM public.marketing_wallet_transactions
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

  -- If no amount is supplied, preserve the previous full-available-credit behavior.
  v_applied := least(
    v_balance,
    v_order.total,
    coalesce(_requested_amount, v_order.total)
  );

  IF v_applied <= 0 THEN
    RETURN QUERY SELECT 0::numeric, v_order.total, v_balance;
    RETURN;
  END IF;

  UPDATE public.marketing_wallets
  SET promotional_balance = promotional_balance - v_applied,
      updated_at = now()
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
  FROM public.marketing_wallets
  WHERE user_id = v_user;

  RETURN QUERY SELECT v_applied, greatest(0, v_order.total - v_applied), coalesce(v_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_credit_to_order(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_store_credit_to_order(uuid, numeric) TO authenticated;
