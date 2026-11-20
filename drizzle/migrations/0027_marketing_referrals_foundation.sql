-- Kivora marketing foundation: campaign tracking, referral qualification and non-withdrawable promo credits.
-- All writes that can award value are reserved for trusted server-side code (service_role).

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text,
  campaign_type text NOT NULL CHECK (campaign_type IN ('banner','coupon','flash_sale','popup','featured_products','referral','seasonal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  target_type text NOT NULL DEFAULT 'all' CHECK (target_type IN ('all','customers','sellers','new_users','returning_customers')),
  target_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text,
  source_id uuid,
  budget numeric(12,2) CHECK (budget IS NULL OR budget >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_status_window_idx
  ON public.marketing_campaigns (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click','product_view','add_to_cart','checkout_started','order_paid')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_date_idx
  ON public.campaign_events (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_events_order_idx
  ON public.campaign_events (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_events_event_key_unique
  ON public.campaign_events (event_key) WHERE event_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT false,
  customer_min_order_amount numeric(12,2) NOT NULL DEFAULT 100 CHECK (customer_min_order_amount >= 100),
  customer_referrer_reward numeric(12,2) NOT NULL DEFAULT 0 CHECK (customer_referrer_reward >= 0),
  seller_referrer_reward numeric(12,2) NOT NULL DEFAULT 0 CHECK (seller_referrer_reward >= 0),
  currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.referral_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('customer','seller')),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,16}$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_codes_code_active_idx ON public.referral_codes (code) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  referred_user_type text NOT NULL CHECK (referred_user_type IN ('customer','seller')),
  event_type text NOT NULL CHECK (event_type IN ('registration','customer_first_paid_order','seller_first_successful_sale')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rejected','reversed')),
  qualified_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  qualification_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  CHECK (referrer_user_id <> referred_user_id),
  CHECK (qualification_amount IS NULL OR qualification_amount >= 0)
);
CREATE INDEX IF NOT EXISTS referral_events_referrer_idx
  ON public.referral_events (referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_events_status_idx
  ON public.referral_events (status, created_at DESC);

-- Dedicated promotional-credit balance. It is deliberately separate from seller earnings
-- and cannot be used by the seller withdrawal flow.
CREATE TABLE IF NOT EXISTS public.marketing_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  promotional_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (promotional_balance >= 0),
  currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_reward','referral_reward_reversal','campaign_credit','campaign_credit_reversal')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','reversed')),
  referral_event_id uuid REFERENCES public.referral_events(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  description text NOT NULL,
  currency text NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_wallet_transactions_user_idx
  ON public.marketing_wallet_transactions (user_id, created_at DESC);

-- RLS: users can read their own referral and promotional-credit history.
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_wallet_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.marketing_campaigns TO anon, authenticated;
GRANT SELECT ON public.campaign_events TO authenticated;
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referral_events TO authenticated;
GRANT SELECT ON public.marketing_wallets TO authenticated;
GRANT SELECT ON public.marketing_wallet_transactions TO authenticated;
GRANT SELECT ON public.referral_settings TO authenticated;
GRANT ALL ON public.marketing_campaigns, public.campaign_events, public.referral_settings,
  public.referral_codes, public.referral_events, public.marketing_wallets,
  public.marketing_wallet_transactions TO service_role;

CREATE POLICY "public reads active marketing campaigns" ON public.marketing_campaigns
  FOR SELECT TO anon, authenticated USING (
    status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "admins manage marketing campaigns" ON public.marketing_campaigns
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read campaign events" ON public.campaign_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage referral settings" ON public.referral_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own referral code" ON public.referral_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own referral events" ON public.referral_events
  FOR SELECT TO authenticated USING (
    referrer_user_id = auth.uid() OR referred_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "users read own marketing wallet" ON public.marketing_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own marketing wallet transactions" ON public.marketing_wallet_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- No client-side INSERT/UPDATE/DELETE policies are intentionally provided for referral
-- qualification, reward settings, campaign events or promotional wallet records.
