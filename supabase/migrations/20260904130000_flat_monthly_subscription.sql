-- Replace the retired Starter/Growth/Pro tiers with one GHS 70 monthly
-- subscription. Keep subscription_plan and plan_override as constrained
-- compatibility fields so deployed clients and generated contracts do not
-- break while tier behavior is removed from the application.

BEGIN;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_subscription_plan_check;

UPDATE public.shops
SET
  subscription_plan = 'standard',
  plan_updated_at = now()
WHERE subscription_plan IS DISTINCT FROM 'standard';

ALTER TABLE public.shops
  ALTER COLUMN subscription_plan SET DEFAULT 'standard';

ALTER TABLE public.shops
  ADD CONSTRAINT shops_subscription_plan_check
  CHECK (subscription_plan = 'standard') NOT VALID;

ALTER TABLE public.shops
  VALIDATE CONSTRAINT shops_subscription_plan_check;

COMMENT ON COLUMN public.shops.subscription_plan IS
  'Compatibility marker for the single flat subscription. Always standard.';

UPDATE public.promo_codes
SET plan_override = NULL
WHERE plan_override IS NOT NULL;

ALTER TABLE public.promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_plan_override_check;

ALTER TABLE public.promo_codes
  ADD CONSTRAINT promo_codes_plan_override_check
  CHECK (plan_override IS NULL) NOT VALID;

ALTER TABLE public.promo_codes
  VALIDATE CONSTRAINT promo_codes_plan_override_check;

COMMENT ON COLUMN public.promo_codes.plan_override IS
  'Deprecated compatibility field. Flat subscriptions do not support plan overrides.';

DROP FUNCTION IF EXISTS public.shop_plan_limit(TEXT);

CREATE OR REPLACE FUNCTION public.enforce_shop_sales_record_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
BEGIN
  IF NEW.shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop context is required to create a sales record.';
  END IF;

  SELECT s.*
    INTO v_shop
  FROM public.shops AS s
  WHERE s.id = NEW.shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found for sales record.';
  END IF;

  IF COALESCE(v_shop.subscription_status, 'promo') = 'promo'
     AND now() <= COALESCE(v_shop.promo_ends_at, now()) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_shop.subscription_status, 'promo') <> 'active' THEN
    RAISE EXCEPTION 'Your 2-month promo has ended. Activate your GHS 70 monthly subscription to continue creating sales records.';
  END IF;

  -- Every active paid shop has the same unlimited access, regardless of size.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_shop_promo_code(
  p_shop_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  code TEXT,
  description TEXT,
  extra_promo_days INTEGER,
  discount_percent INTEGER,
  plan_override TEXT,
  promo_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT := public.normalize_promo_code(p_code);
  v_code public.promo_codes%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_promo_ends_at_before TIMESTAMPTZ;
  v_promo_ends_at_after TIMESTAMPTZ;
BEGIN
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'Enter a promo code.';
  END IF;

  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You cannot redeem a promo code for this shop.';
  END IF;

  SELECT pc.*
    INTO v_code
  FROM public.promo_codes AS pc
  WHERE pc.code_normalized = v_normalized
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promo code is invalid.';
  END IF;

  IF NOT v_code.is_active THEN
    RAISE EXCEPTION 'Promo code is no longer active.';
  END IF;

  IF v_code.starts_at IS NOT NULL AND now() < v_code.starts_at THEN
    RAISE EXCEPTION 'Promo code is not active yet.';
  END IF;

  IF v_code.expires_at IS NOT NULL AND now() > v_code.expires_at THEN
    RAISE EXCEPTION 'Promo code has expired.';
  END IF;

  IF v_code.max_redemptions IS NOT NULL AND v_code.redeemed_count >= v_code.max_redemptions THEN
    RAISE EXCEPTION 'Promo code has reached its redemption limit.';
  END IF;

  SELECT s.*
    INTO v_shop
  FROM public.shops AS s
  WHERE s.id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found.';
  END IF;

  IF v_shop.subscription_status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'This shop cannot redeem promo codes right now.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shop_promo_redemptions AS spr
    WHERE spr.shop_id = p_shop_id
      AND spr.promo_code_id = v_code.id
  ) THEN
    RAISE EXCEPTION 'This promo code has already been used for this shop.';
  END IF;

  v_promo_ends_at_before := v_shop.promo_ends_at;
  v_promo_ends_at_after := greatest(coalesce(v_shop.promo_ends_at, now()), now())
    + make_interval(days => greatest(coalesce(v_code.extra_promo_days, 0), 0));

  UPDATE public.shops AS s
  SET
    subscription_status = CASE
      WHEN s.subscription_status = 'active' THEN s.subscription_status
      WHEN coalesce(v_code.extra_promo_days, 0) > 0 THEN 'promo'
      ELSE s.subscription_status
    END,
    promo_started_at = coalesce(s.promo_started_at, now()),
    promo_ends_at = CASE
      WHEN coalesce(v_code.extra_promo_days, 0) > 0 THEN v_promo_ends_at_after
      ELSE s.promo_ends_at
    END,
    plan_updated_at = now()
  WHERE s.id = p_shop_id
  RETURNING s.* INTO v_shop;

  INSERT INTO public.shop_promo_redemptions (
    shop_id,
    promo_code_id,
    code,
    description,
    extra_promo_days,
    discount_percent,
    plan_override,
    promo_ends_at_before,
    promo_ends_at_after
  )
  VALUES (
    p_shop_id,
    v_code.id,
    v_code.code,
    v_code.description,
    v_code.extra_promo_days,
    v_code.discount_percent,
    NULL,
    v_promo_ends_at_before,
    v_shop.promo_ends_at
  );

  UPDATE public.promo_codes AS pc
  SET
    redeemed_count = pc.redeemed_count + 1,
    updated_at = now()
  WHERE pc.id = v_code.id;

  RETURN QUERY
  SELECT
    v_code.code,
    v_code.description,
    v_code.extra_promo_days,
    v_code.discount_percent,
    NULL::TEXT,
    v_shop.promo_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
