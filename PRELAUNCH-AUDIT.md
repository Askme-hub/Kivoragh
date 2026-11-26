# Kivora pre-launch audit — 26 November 2026

## Scope and baseline

This review was performed against the GitHub `main` baseline and the uploaded `Kivora-Phase32-Final-Handoff-4.zip`. The ZIP is an older snapshot and does not match the latest GitHub branch in its withdrawal implementation or migration history. Do not use the ZIP as the deployment source.

The friend's UI redesign is already present in the GitHub baseline, notably commit `313fd8532f7538fdb7292ead01f048f76f017e71` ("Redesigned friend pages"). It updates the homepage, product cards, mobile drawer/bottom navigation, account and order pages, and shared styles. Existing cart, wishlist, product, checkout, referral, store-credit and food-ordering flows should be regression-tested rather than replaced.

## Changes on this audit branch

- Moolre order polling now requires the provider status response to match the order's stored external reference and exact MoMo debit amount. The amount is the order total less applied store credit.
- Moolre order webhook now loads `store_credit_applied`, verifies the remaining debit amount, and records the full order total as paid value when finalizing the order.
- Moolre subscription polling and webhook now verify the provider reference and exact plan price before activating a subscription.
- Moolre payment initiation now checks that the order's payment reference was successfully persisted before calling the provider, and checks that a rejected provider request was successfully recorded as failed.
- Seller verification requests now go through an authenticated server function that verifies the caller owns the shop, the shop is approved, and the current verification state allows a new request.
- Added a database hardening SQL migration to revoke direct client writes to seller wallet/ledger/withdrawal tables and to restrict seller profile creation and verification-state changes. It permits only the seller's own approved shop to move from `not_verified` or `rejected` to `pending`; administrative verification remains available.

## Blocking findings — do not publish until resolved

### 1. Withdrawal RPC/schema mismatch

The current GitHub `src/lib/wallet.functions.ts` calls these database functions:

- `create_seller_withdrawal`
- `finalize_moolre_seller_withdrawal`
- `cancel_unsubmitted_moolre_withdrawal`

No definitions for those functions were found in the GitHub migration history or the uploaded ZIP. The current code also reads/writes `payout_status`, `payout_last_error`, `payout_updated_at`, and `moolre_payout_attempts`, but matching schema migrations were not found in the inspected source.

The ZIP contains an older atomic withdrawal pair named `request_seller_withdrawal` and `decide_seller_withdrawal`, with a different function signature and workflow. It is not a drop-in migration for the current GitHub wallet code.

### 2. Moolre payout Edge Function not found

The current server helper invokes the Supabase Edge Function named `moolre-payout`. No matching `supabase/functions/moolre-payout` source was found in the repository or the uploaded ZIP. Confirm where it is deployed and retrieve its source, authentication rules, request validation, and idempotency handling before enabling seller payouts.

### 3. Admin manual withdrawal reconciliation is not atomic

The current `decideWithdrawal` server function reads wallet balances, separately updates wallet balances, inserts ledger rows, and updates the withdrawal request. These operations are not one database transaction. A crash or concurrent admin action can leave records inconsistent. Replace this with a single audited, idempotent database RPC once the current payout schema is reconciled.

### 4. Migration history is not reconciled

The uploaded ZIP includes Supabase migrations that are absent from GitHub `main`, while GitHub contains newer Drizzle migrations through food ordering. The current wallet source and the ZIP's wallet migrations do not agree. Do not blindly run the ZIP's old atomic-withdrawal migration or apply the new guard migration to production until the actual Supabase migration history, schema, grants, triggers and RLS policies have been inspected in staging.

## Validation status

- Static release-readiness scripts were run against the uploaded ZIP snapshot:
  - lockfile consistency: PASS
  - critical route inventory: PASS
  - commerce source-contract checks: PASS (8/8)
  - E2E readiness source checks: PASS (9/9)
- These checks are source-presence/static checks from the ZIP snapshot, not execution of the latest GitHub branch.
- Dependencies were not installed in this environment; TypeScript, ESLint, Vitest and production build were not run on the audit branch.
- No browser/device QA, live Supabase policy inspection, Moolre sandbox payment, Moolre payout test, Paystack sandbox test, or production smoke test was performed.

## Release gate

1. Reconcile and commit the complete current Supabase schema/migration history.
2. Implement and test the database functions/tables required by the current wallet payout code, or disable the unfinished Moolre payout path until those dependencies exist.
3. Make admin withdrawal decisions atomic and idempotent.
4. Apply the new financial/profile guard migration in staging and verify legitimate seller/admin flows still work.
5. Run typecheck, lint, unit tests and production build on this exact branch.
6. Browser-test the redesigned UI at phone, tablet and desktop widths, including dark mode, and exercise cart, checkout, store credit, referrals, food ordering, account, order history and seller/admin workflows.
7. Run provider sandbox tests for successful, failed, pending, duplicate, wrong-reference and wrong-amount payments before production.

**Current decision: not production-ready.** The UI work is integrated, and the order/subscription payment checks have been strengthened on this branch. The wallet payout migration gap and missing Moolre payout Edge Function are release blockers.
