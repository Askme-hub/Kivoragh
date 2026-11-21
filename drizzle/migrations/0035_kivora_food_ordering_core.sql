-- Phase 3A: food order metadata and customer/seller visibility.
-- Food orders remain regular Kivora orders for payment, commission and refunds.

CREATE TABLE IF NOT EXISTS public.food_order_details (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  fulfillment_method text NOT NULL CHECK (fulfillment_method IN ('door','pickup')),
  requested_for timestamptz,
  preparation_minutes integer NOT NULL DEFAULT 30 CHECK (preparation_minutes BETWEEN 0 AND 1440),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  status text NOT NULL DEFAULT 'placed'
    CHECK (status IN ('placed','accepted','preparing','ready_for_pickup','out_for_delivery','completed','cancelled')),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_order_details_seller_status_idx
  ON public.food_order_details (seller_id, status, created_at DESC);

ALTER TABLE public.food_order_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view their food order details" ON public.food_order_details;
CREATE POLICY "Buyers can view their food order details"
  ON public.food_order_details FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = food_order_details.order_id AND o.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Food sellers can view their food orders" ON public.food_order_details;
CREATE POLICY "Food sellers can view their food orders"
  ON public.food_order_details FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

GRANT SELECT ON public.food_order_details TO authenticated;
REVOKE ALL ON public.food_order_details FROM anon;

CREATE OR REPLACE FUNCTION public.set_food_order_details_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_food_order_details_updated_at ON public.food_order_details;
CREATE TRIGGER trg_food_order_details_updated_at
  BEFORE UPDATE ON public.food_order_details
  FOR EACH ROW EXECUTE FUNCTION public.set_food_order_details_updated_at();
