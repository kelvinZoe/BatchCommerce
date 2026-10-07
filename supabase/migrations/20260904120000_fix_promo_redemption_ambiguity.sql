-- Fix the promo redemption RPC's PL/pgSQL output-variable collision.
-- `RETURNS TABLE (... promo_ends_at ...)` creates an output variable with the
-- same name as shops.promo_ends_at, so every column reference must be explicit.

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
    subscription_plan = coalesce(v_code.plan_override, s.subscription_plan),
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
    v_code.plan_override,
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
    v_code.plan_override,
    v_shop.promo_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
