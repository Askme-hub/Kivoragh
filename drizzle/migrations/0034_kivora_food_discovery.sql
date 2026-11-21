-- Phase 2: public food seller discovery and food menu categories.
-- Only approved sellers who have opted into Food & Groceries are exposed publicly.

INSERT INTO public.categories (name, slug, sort_order)
VALUES
  ('Prepared Meals', 'prepared-meals', 13),
  ('Bakery & Snacks', 'bakery-snacks', 14),
  ('Drinks', 'drinks', 15)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.public_food_sellers()
RETURNS TABLE (
  user_id uuid,
  slug text,
  shop_name text,
  bio text,
  logo_url text,
  banner_url text,
  location text,
  whatsapp_number text,
  business_category text,
  verification_status text,
  product_count bigint,
  accepting_orders boolean,
  is_open_now boolean,
  opens_at time,
  closes_at time,
  days_open text[],
  default_preparation_minutes integer,
  scheduled_orders_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ghana_clock AS (
    SELECT now() AT TIME ZONE 'Africa/Accra' AS local_now
  )
  SELECT
    sp.user_id,
    sp.slug,
    sp.shop_name,
    sp.bio,
    sp.logo_url,
    sp.banner_url,
    sp.location,
    sp.whatsapp_number,
    sp.business_category,
    CASE
      WHEN sp.status = 'approved' AND sp.verification_status = 'verified'
      THEN 'verified'
      ELSE 'not_verified'
    END AS verification_status,
    (
      SELECT count(*)
      FROM public.products p
      WHERE p.seller_id = sp.user_id
        AND p.approval_status = 'approved'
    ) AS product_count,
    fs.accepting_orders,
    (
      fs.accepting_orders
      AND CASE extract(isodow FROM gc.local_now)::integer
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
        ELSE 'sunday'
      END = ANY(fs.days_open)
      AND CASE
        WHEN fs.opens_at <= fs.closes_at THEN
          gc.local_now::time >= fs.opens_at
          AND gc.local_now::time < fs.closes_at
        ELSE
          gc.local_now::time >= fs.opens_at
          OR gc.local_now::time < fs.closes_at
      END
    ) AS is_open_now,
    fs.opens_at,
    fs.closes_at,
    fs.days_open,
    fs.default_preparation_minutes,
    fs.scheduled_orders_enabled
  FROM public.seller_profiles sp
  INNER JOIN public.food_seller_settings fs
    ON fs.seller_id = sp.user_id
  CROSS JOIN ghana_clock gc
  WHERE sp.status = 'approved'
    AND sp.slug IS NOT NULL
    AND fs.is_food_seller = true
  ORDER BY is_open_now DESC, sp.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.public_food_sellers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_food_sellers() TO anon, authenticated;
