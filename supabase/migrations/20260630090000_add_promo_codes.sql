-- Add platform promo codes and shop-level redemption tracking.
-- Codes can extend a shop's promo window, optionally move it to a plan band,
-- and record a discount percentage for the future payment/admin flow.

CREATE OR REPLACE FUNCTION public.normalize_promo_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT upper(regexp_replace(coalesce(trim(p_code), ''), '\s+', '', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  code_normalized TEXT NOT NULL,
  description TEXT,
  extra_promo_days INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER,
  plan_override TEXT,
  max_redemptions INTEGER,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_extra_days_check CHECK (extra_promo_days >= 0),
  CONSTRAINT promo_codes_discount_check CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  CONSTRAINT promo_codes_plan_override_check CHECK (plan_override IS NULL OR plan_override IN ('starter', 'growth', 'pro')),
  CONSTRAINT promo_codes_max_redemptions_check CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT promo_codes_redeemed_count_check CHECK (redeemed_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_normalized_key
  ON public.promo_codes(code_normalized);

CREATE INDEX IF NOT EXISTS idx_promo_codes_active_window
  ON public.promo_codes(is_active, starts_at, expires_at);

CREATE TABLE IF NOT EXISTS public.shop_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  description TEXT,
  extra_promo_days INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER,
  plan_override TEXT,
  promo_ends_at_before TIMESTAMPTZ,
  promo_ends_at_after TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_promo_redemptions_once_per_shop_code UNIQUE (shop_id, promo_code_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_promo_redemptions_shop_redeemed
  ON public.shop_promo_redemptions(shop_id, redeemed_at DESC);

CREATE OR REPLACE FUNCTION public.set_promo_code_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := trim(NEW.code);
  NEW.code_normalized := public.normalize_promo_code(NEW.code);
  NEW.updated_at := now();

  IF NEW.code_normalized = '' THEN
    RAISE EXCEPTION 'Promo code is required.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_codes_normalized ON public.promo_codes;
CREATE TRIGGER trg_promo_codes_normalized
  BEFORE INSERT OR UPDATE ON public.promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_promo_code_normalized();

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_shop_promo_redemptions_updated ON public.shop_promo_redemptions;
    CREATE TRIGGER trg_shop_promo_redemptions_updated
      BEFORE UPDATE ON public.shop_promo_redemptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

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

  SELECT *
    INTO v_code
  FROM public.promo_codes
  WHERE code_normalized = v_normalized
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

  SELECT *
    INTO v_shop
  FROM public.shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found.';
  END IF;

  IF v_shop.subscription_status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'This shop cannot redeem promo codes right now.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.shop_promo_redemptions spr
    WHERE spr.shop_id = p_shop_id
      AND spr.promo_code_id = v_code.id
  ) THEN
    RAISE EXCEPTION 'This promo code has already been used for this shop.';
  END IF;

  v_promo_ends_at_before := v_shop.promo_ends_at;
  v_promo_ends_at_after := greatest(coalesce(v_shop.promo_ends_at, now()), now())
    + make_interval(days => greatest(coalesce(v_code.extra_promo_days, 0), 0));

  UPDATE public.shops
  SET
    subscription_plan = coalesce(v_code.plan_override, subscription_plan),
    subscription_status = CASE
      WHEN subscription_status = 'active' THEN subscription_status
      WHEN coalesce(v_code.extra_promo_days, 0) > 0 THEN 'promo'
      ELSE subscription_status
    END,
    promo_started_at = coalesce(promo_started_at, now()),
    promo_ends_at = CASE
      WHEN coalesce(v_code.extra_promo_days, 0) > 0 THEN v_promo_ends_at_after
      ELSE promo_ends_at
    END,
    plan_updated_at = now()
  WHERE id = p_shop_id
  RETURNING * INTO v_shop;

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

  UPDATE public.promo_codes
  SET
    redeemed_count = redeemed_count + 1,
    updated_at = now()
  WHERE id = v_code.id;

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

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members can read promo redemptions" ON public.shop_promo_redemptions;
CREATE POLICY "Shop members can read promo redemptions"
  ON public.shop_promo_redemptions
  FOR SELECT TO authenticated
  USING (public.has_shop_membership(shop_id));

REVOKE ALL ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_shop_promo_code(UUID, TEXT) TO authenticated;
