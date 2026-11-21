-- Kivora: restore seller withdrawals to manual admin processing.
-- New requests reserve funds atomically and remain eligible for admin review.
-- Existing Moolre payout records are intentionally left untouched for safe reconciliation.

CREATE OR REPLACE FUNCTION public.create_seller_withdrawal(
  _seller_id uuid,
  _amount numeric,
  _payout_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.payout_accounts%ROWTYPE;
  v_balance numeric;
  v_request_id uuid;
  v_details text;
BEGIN
  IF _seller_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) THEN
    RAISE EXCEPTION 'Enter a valid withdrawal amount with no more than two decimal places.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _seller_id AND role = 'seller'
  ) THEN
    RAISE EXCEPTION 'Only sellers can request withdrawals.';
  END IF;

  SELECT * INTO v_account
  FROM public.payout_accounts
  WHERE id = _payout_account_id AND seller_id = _seller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select a valid saved payout account.';
  END IF;

  SELECT balance INTO v_balance
  FROM public.seller_wallets
  WHERE user_id = _seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seller wallet was not found.';
  END IF;

  IF v_balance < _amount THEN
    RAISE EXCEPTION 'Withdrawal exceeds available balance.';
  END IF;

  v_details := v_account.account_name || ' · ' || v_account.account_number ||
    CASE WHEN coalesce(v_account.provider, '') <> '' THEN ' (' || v_account.provider || ')' ELSE '' END;

  INSERT INTO public.withdrawal_requests (
    seller_id, amount, status, method, account_details, payout_status, payout_updated_at, payout_provider
  ) VALUES (
    _seller_id, _amount, 'pending', v_account.method, v_details, 'not_started', NULL, NULL
  ) RETURNING id INTO v_request_id;

  UPDATE public.seller_wallets
  SET balance = balance - _amount,
      pending = pending + _amount,
      updated_at = now()
  WHERE user_id = _seller_id;

  INSERT INTO public.transactions (seller_id, type, amount, status, description)
  VALUES (
    _seller_id, 'withdrawal_request', -_amount, 'pending',
    'Manual withdrawal request via ' || v_account.method
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_seller_withdrawal(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_withdrawal(uuid, numeric, uuid) TO service_role;

COMMENT ON FUNCTION public.create_seller_withdrawal(uuid, numeric, uuid)
IS 'Creates a seller withdrawal request for manual Kivora admin processing; reserves funds atomically and does not call a payout provider.';
