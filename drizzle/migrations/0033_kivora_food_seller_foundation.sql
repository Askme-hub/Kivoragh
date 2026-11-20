-- Phase 1: food seller operating settings.
-- One row per seller; food ordering remains opt-in and closed by default.
CREATE TABLE IF NOT EXISTS public.food_seller_settings (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_food_seller boolean NOT NULL DEFAULT false,
  accepting_orders boolean NOT NULL DEFAULT false,
  opens_at time NOT NULL DEFAULT '08:00',
  closes_at time NOT NULL DEFAULT '21:00',
  days_open text[] NOT NULL DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[],
  default_preparation_minutes integer NOT NULL DEFAULT 30,
  scheduled_orders_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Africa/Accra',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT food_seller_settings_prep_range CHECK (default_preparation_minutes BETWEEN 0 AND 1440),
  CONSTRAINT food_seller_settings_days_valid CHECK (
    days_open <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]
  )
);

CREATE INDEX IF NOT EXISTS food_seller_settings_active_idx
  ON public.food_seller_settings (is_food_seller, accepting_orders);

ALTER TABLE public.food_seller_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view their food settings" ON public.food_seller_settings;
CREATE POLICY "Sellers can view their food settings"
  ON public.food_seller_settings FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can create their food settings" ON public.food_seller_settings;
CREATE POLICY "Sellers can create their food settings"
  ON public.food_seller_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update their food settings" ON public.food_seller_settings;
CREATE POLICY "Sellers can update their food settings"
  ON public.food_seller_settings FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

GRANT SELECT, INSERT, UPDATE ON public.food_seller_settings TO authenticated;
REVOKE ALL ON public.food_seller_settings FROM anon;

CREATE OR REPLACE FUNCTION public.set_food_seller_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_food_seller_settings_updated_at ON public.food_seller_settings;
CREATE TRIGGER trg_food_seller_settings_updated_at
  BEFORE UPDATE ON public.food_seller_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_food_seller_settings_updated_at();
