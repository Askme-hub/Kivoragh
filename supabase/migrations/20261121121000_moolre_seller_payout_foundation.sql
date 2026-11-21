-- Kivora: safe, atomic foundation for Moolre seller payouts.
-- This migration does not initiate any Moolre transfer. Live payouts remain disabled.

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS payout_provider text,
  ADD COLUMN IF NOT EXISTS payout_last_error text,
  ADD COLUMN IF NOT EXISTS payout_updated_at timestamptz;

ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_payout_status_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_payout_status_check
  CHECK (payout_status IN ('not_started','queued','validating','processing','paid','failed','needs_review'));

CREATE TABLE IF NOT EXISTS public.moolre_payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  externalref text NOT NULL UNIQUE,
  channel text NOT NULL,
  receiver text NOT NULL,
  expected_name text NOT NULL,
  validated_name text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','validating','processing','paid','failed','needs_review')),
  moolre_transaction_id text,
  moolre_code text,
  moolre_message text,
  txstatus integer CHECK (txstatus IS NULL OR txstatus IN (0,1,2,3)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_moolre_payout_attempts_withdrawal
  ON public.moolre_payout_attempts(withdrawal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moolre_payout_attempts_status
  ON public.moolre_payout_attempts(status, created_at);

ALTER TABLE public.moolre_payout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moolre_payout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.moolre_payout_attempts TO service_role;

-- All balance movements for a seller withdrawal happen in one database transaction.
-- Only the server-side service-role client may call this function.
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
    seller_id, amount, status, method, account_details, payout_status, payout_updated_at
  ) VALUES (
    _seller_id, _amount, 'pending', v_account.method, v_details, 'queued', now()
  ) RETURNING id INTO v_request_id;

  UPDATE public.seller_wallets
  SET balance = balance - _amount,
      pending = pending + _amount,
      updated_at = now()
  WHERE user_id = _seller_id;

  INSERT INTO public.transactions (seller_id, type, amount, status, description)
  VALUES (
    _seller_id, 'withdrawal_request', -_amount, 'pending',
    'Withdrawal request via ' || v_account.method
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_seller_withdrawal(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_withdrawal(uuid, numeric, uuid) TO service_role;

-- Finalize a withdrawal exactly once after Moolre confirms a terminal outcome.
-- Pending/unknown outcomes never release funds or mark a withdrawal paid.
CREATE OR REPLACE FUNCTION public.finalize_moolre_seller_withdrawal(
  _withdrawal_id uuid,
  _outcome text,
  _moolre_transaction_id text DEFAULT NULL,
  _moolre_code text DEFAULT NULL,
  _moolre_message text DEFAULT NULL,
  _txstatus integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.withdrawal_requests%ROWTYPE;
  v_pending numeric;
BEGIN
  IF _outcome NOT IN ('paid','failed','processing','needs_review') THEN
    RAISE EXCEPTION 'Invalid payout outcome.';
  END IF;
  IF _txstatus IS NOT NULL AND _txstatus NOT IN (0,1,2,3) THEN
    RAISE EXCEPTION 'Invalid Moolre transaction status.';
  END IF;

  SELECT * INTO v_req
  FROM public.withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found.';
  END IF;

  -- A completed or refunded request cannot be finalized a second time.
  IF v_req.payout_status IN ('paid','failed') THEN
    RETURN true;
  END IF;

  IF _outcome = 'paid' THEN
    IF _txstatus IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'A payout can only be marked paid when Moolre confirms txstatus 1.';
    END IF;

    SELECT pending INTO v_pending
    FROM public.seller_wallets
    WHERE user_id = v_req.seller_id
    FOR UPDATE;

    IF NOT FOUND OR v_pending < v_req.amount THEN
      RAISE EXCEPTION 'Seller pending balance does not cover this withdrawal.';
    END IF;

    UPDATE public.seller_wallets
    SET pending = pending - v_req.amount,
        total_withdrawn = total_withdrawn + v_req.amount,
        updated_at = now()
    WHERE user_id = v_req.seller_id;

    UPDATE public.withdrawal_requests
    SET status = 'paid', payout_status = 'paid', payout_provider = 'moolre',
        payout_last_error = NULL, payout_updated_at = now(), updated_at = now()
    WHERE id = _withdrawal_id;

    INSERT INTO public.transactions (seller_id, type, amount, status, description)
    VALUES (v_req.seller_id, 'withdrawal', -v_req.amount, 'completed', 'Moolre seller payout completed');

  ELSIF _outcome = 'failed' THEN
    IF _txstatus IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'Funds can only be refunded after Moolre confirms txstatus 2.';
    END IF;

    SELECT pending INTO v_pending
    FROM public.seller_wallets
    WHERE user_id = v_req.seller_id
    FOR UPDATE;

    IF NOT FOUND OR v_pending < v_req.amount THEN
      RAISE EXCEPTION 'Seller pending balance does not cover this withdrawal.';
    END IF;

    UPDATE public.seller_wallets
    SET pending = pending - v_req.amount,
        balance = balance + v_req.amount,
        updated_at = now()
    WHERE user_id = v_req.seller_id;

    UPDATE public.withdrawal_requests
    SET status = 'rejected', payout_status = 'failed', payout_provider = 'moolre',
        payout_last_error = left(coalesce(_moolre_message, _moolre_code, 'Moolre confirmed payout failure'), 500),
        payout_updated_at = now(), updated_at = now()
    WHERE id = _withdrawal_id;

    INSERT INTO public.transactions (seller_id, type, amount, status, description)
    VALUES (v_req.seller_id, 'withdrawal_refund', v_req.amount, 'completed', 'Moolre confirmed payout failure — funds returned');

  ELSE
    UPDATE public.withdrawal_requests
    SET payout_status = _outcome, payout_provider = 'moolre',
        payout_last_error = CASE WHEN _outcome = 'needs_review'
          THEN left(coalesce(_moolre_message, _moolre_code, 'Payout requires manual review'), 500)
          ELSE NULL END,
        payout_updated_at = now(), updated_at = now()
    WHERE id = _withdrawal_id;
  END IF;

  UPDATE public.moolre_payout_attempts
  SET status = _outcome,
      moolre_transaction_id = coalesce(_moolre_transaction_id, moolre_transaction_id),
      moolre_code = coalesce(_moolre_code, moolre_code),
      moolre_message = coalesce(_moolre_message, moolre_message),
      txstatus = coalesce(_txstatus, txstatus),
      updated_at = now(),
      completed_at = CASE WHEN _outcome IN ('paid','failed') THEN now() ELSE completed_at END
  WHERE withdrawal_id = _withdrawal_id
    AND id = (
      SELECT id FROM public.moolre_payout_attempts
      WHERE withdrawal_id = _withdrawal_id
      ORDER BY created_at DESC LIMIT 1
    );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_moolre_seller_withdrawal(uuid, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_moolre_seller_withdrawal(uuid, text, text, text, text, integer) TO service_role;
