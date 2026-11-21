-- Follow-up safety fixes for Moolre seller payouts.
-- Safe to run after 20261121121000_moolre_seller_payout_foundation.sql.

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
        total_withdrawn = coalesce(total_withdrawn, 0) + v_req.amount,
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

CREATE OR REPLACE FUNCTION public.cancel_unsubmitted_moolre_withdrawal(
  _withdrawal_id uuid,
  _admin_note text DEFAULT NULL
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
  SELECT * INTO v_req
  FROM public.withdrawal_requests
  WHERE id = _withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found.';
  END IF;

  IF v_req.payout_status <> 'needs_review' OR v_req.status IN ('paid','rejected') THEN
    RAISE EXCEPTION 'Only an unsubmitted payout requiring review can be cancelled.';
  END IF;

  -- A transfer that may have reached Moolre must never be refunded by this function.
  IF EXISTS (
    SELECT 1 FROM public.moolre_payout_attempts
    WHERE withdrawal_id = _withdrawal_id
      AND (txstatus IS NOT NULL OR status IN ('processing','paid','failed'))
  ) THEN
    RAISE EXCEPTION 'This payout may have been submitted to Moolre. Check its status instead of cancelling it.';
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
  SET status = 'rejected',
      payout_status = 'failed',
      payout_provider = 'moolre',
      payout_last_error = left(coalesce(_admin_note, 'Cancelled by admin before any transfer was submitted'), 500),
      payout_updated_at = now(),
      updated_at = now()
  WHERE id = _withdrawal_id;

  UPDATE public.moolre_payout_attempts
  SET status = 'failed',
      moolre_message = left(coalesce(_admin_note, 'Cancelled by admin before any transfer was submitted'), 500),
      updated_at = now(),
      completed_at = now()
  WHERE withdrawal_id = _withdrawal_id
    AND txstatus IS NULL;

  INSERT INTO public.transactions (seller_id, type, amount, status, description)
  VALUES (v_req.seller_id, 'withdrawal_refund', v_req.amount, 'completed', 'Moolre payout cancelled before transfer — funds returned');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_unsubmitted_moolre_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_unsubmitted_moolre_withdrawal(uuid, text) TO service_role;
