-- Change the flat monthly subscription to GHS 100 and give newly-created
-- shops one month of free access. Existing promo dates and historical payment
-- ledger amounts are preserved.

BEGIN;

ALTER TABLE public.shops
  ALTER COLUMN promo_ends_at SET DEFAULT (now() + interval '1 month');

ALTER TABLE public.subscription_payments
  ALTER COLUMN base_amount_minor SET DEFAULT 10000;

CREATE OR REPLACE FUNCTION public.subscription_monthly_price_minor()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 10000;
$$;

REVOKE ALL ON FUNCTION public.subscription_monthly_price_minor()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_monthly_price_minor()
  TO service_role;

CREATE OR REPLACE FUNCTION public.compute_shop_subscription_summary(
  p_shop_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  access_state TEXT,
  can_create_sales_record BOOLEAN,
  access_starts_at TIMESTAMPTZ,
  access_ends_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  promo_ends_at TIMESTAMPTZ,
  pending_discount_percent INTEGER,
  next_amount_minor INTEGER,
  days_remaining INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_current_start TIMESTAMPTZ;
  v_current_end TIMESTAMPTZ;
  v_current_grace TIMESTAMPTZ;
  v_latest_end TIMESTAMPTZ;
  v_discount INTEGER;
  v_state TEXT;
  v_allowed BOOLEAN := FALSE;
  v_effective_start TIMESTAMPTZ;
  v_effective_end TIMESTAMPTZ;
  v_effective_grace TIMESTAMPTZ;
BEGIN
  SELECT shop.* INTO v_shop
  FROM public.shops AS shop
  WHERE shop.id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT entitlement.starts_at, entitlement.ends_at, entitlement.grace_ends_at
    INTO v_current_start, v_current_end, v_current_grace
  FROM public.subscription_entitlements AS entitlement
  WHERE entitlement.shop_id = p_shop_id
    AND entitlement.revoked_at IS NULL
    AND p_at >= entitlement.starts_at
    AND p_at <= entitlement.grace_ends_at
  ORDER BY entitlement.ends_at DESC
  LIMIT 1;

  SELECT max(entitlement.ends_at)
    INTO v_latest_end
  FROM public.subscription_entitlements AS entitlement
  WHERE entitlement.shop_id = p_shop_id
    AND entitlement.revoked_at IS NULL;

  SELECT redemption.discount_percent
    INTO v_discount
  FROM public.shop_promo_redemptions AS redemption
  WHERE redemption.shop_id = p_shop_id
    AND COALESCE(redemption.discount_percent, 0) > 0
    AND redemption.discount_consumed_at IS NULL
    AND redemption.discount_reserved_payment_id IS NULL
  ORDER BY redemption.redeemed_at, redemption.id
  LIMIT 1;

  IF v_shop.subscription_status IN ('suspended', 'cancelled') THEN
    v_state := v_shop.subscription_status;
    v_effective_end := greatest(v_shop.promo_ends_at, v_latest_end);
    v_effective_grace := CASE WHEN v_effective_end IS NULL THEN NULL ELSE v_effective_end + interval '3 days' END;
  ELSIF p_at <= v_shop.promo_ends_at THEN
    v_state := 'promo';
    v_allowed := TRUE;
    v_effective_start := v_shop.promo_started_at;
    v_effective_end := v_shop.promo_ends_at;
    v_effective_grace := v_shop.promo_ends_at + interval '3 days';
  ELSIF v_current_end IS NOT NULL AND p_at <= v_current_end THEN
    v_state := 'active';
    v_allowed := TRUE;
    v_effective_start := v_current_start;
    v_effective_end := v_current_end;
    v_effective_grace := v_current_grace;
  ELSIF p_at <= v_shop.promo_ends_at + interval '3 days' THEN
    v_state := 'grace';
    v_allowed := TRUE;
    v_effective_start := v_shop.promo_started_at;
    v_effective_end := v_shop.promo_ends_at;
    v_effective_grace := v_shop.promo_ends_at + interval '3 days';
  ELSIF v_current_grace IS NOT NULL AND p_at <= v_current_grace THEN
    v_state := 'grace';
    v_allowed := TRUE;
    v_effective_start := v_current_start;
    v_effective_end := v_current_end;
    v_effective_grace := v_current_grace;
  ELSE
    v_state := 'blocked';
    v_effective_end := greatest(v_shop.promo_ends_at, v_latest_end);
    v_effective_grace := CASE WHEN v_effective_end IS NULL THEN NULL ELSE v_effective_end + interval '3 days' END;
  END IF;

  RETURN QUERY SELECT
    v_state,
    v_allowed,
    v_effective_start,
    v_effective_end,
    v_effective_grace,
    v_shop.promo_ends_at,
    v_discount,
    round(public.subscription_monthly_price_minor() * (100 - COALESCE(v_discount, 0)) / 100.0)::INTEGER,
    CASE
      WHEN v_effective_end IS NULL THEN 0
      ELSE greatest(ceil(extract(epoch FROM (v_effective_end - p_at)) / 86400.0)::INTEGER, 0)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_shop_subscription_summary(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_shop_subscription_summary(UUID, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_subscription_payment(
  p_shop_id UUID,
  p_source TEXT,
  p_reference TEXT,
  p_submitted_by UUID,
  p_payer_email TEXT DEFAULT NULL,
  p_manual_sender_name TEXT DEFAULT NULL,
  p_manual_sender_phone TEXT DEFAULT NULL,
  p_manual_network TEXT DEFAULT NULL,
  p_manual_reference TEXT DEFAULT NULL,
  p_manual_paid_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.subscription_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.shop_promo_redemptions%ROWTYPE;
  v_payment public.subscription_payments%ROWTYPE;
  v_discount INTEGER := 0;
  v_base_amount INTEGER := public.subscription_monthly_price_minor();
  v_amount INTEGER := public.subscription_monthly_price_minor();
  v_status TEXT;
BEGIN
  IF p_source NOT IN ('paystack', 'manual') THEN
    RAISE EXCEPTION 'Unsupported payment source.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops AS shop WHERE shop.id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id::TEXT || ':subscription-payment', 0));

  UPDATE public.subscription_payments AS payment
  SET status = 'abandoned', updated_at = now(), failure_reason = 'Checkout was not completed within 24 hours.'
  WHERE payment.shop_id = p_shop_id
    AND payment.source = 'paystack'
    AND payment.status IN ('pending', 'initialized')
    AND payment.created_at < now() - interval '24 hours';

  UPDATE public.shop_promo_redemptions AS redemption
  SET discount_reserved_at = NULL,
      discount_reserved_payment_id = NULL,
      updated_at = now()
  WHERE redemption.shop_id = p_shop_id
    AND redemption.discount_consumed_at IS NULL
    AND redemption.discount_reserved_at < now() - interval '24 hours'
    AND EXISTS (
      SELECT 1
      FROM public.subscription_payments AS reserved_payment
      WHERE reserved_payment.id = redemption.discount_reserved_payment_id
        AND reserved_payment.source = 'paystack'
        AND reserved_payment.status = 'abandoned'
    );

  SELECT redemption.* INTO v_redemption
  FROM public.shop_promo_redemptions AS redemption
  WHERE redemption.shop_id = p_shop_id
    AND COALESCE(redemption.discount_percent, 0) > 0
    AND redemption.discount_consumed_at IS NULL
    AND redemption.discount_reserved_payment_id IS NULL
  ORDER BY redemption.redeemed_at, redemption.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_discount := COALESCE(v_redemption.discount_percent, 0);
    v_amount := round(v_base_amount * (100 - v_discount) / 100.0)::INTEGER;
  END IF;

  v_status := CASE WHEN p_source = 'manual' THEN 'pending_review' ELSE 'pending' END;

  INSERT INTO public.subscription_payments (
    shop_id, source, provider, provider_reference, status, base_amount_minor,
    discount_percent, amount_minor, payer_email, submitted_by,
    manual_sender_name, manual_sender_phone, manual_network,
    manual_reference, manual_paid_at
  ) VALUES (
    p_shop_id,
    p_source,
    CASE WHEN p_source = 'paystack' THEN 'paystack' ELSE 'manual' END,
    p_reference,
    v_status,
    v_base_amount,
    NULLIF(v_discount, 0),
    v_amount,
    nullif(btrim(COALESCE(p_payer_email, '')), ''),
    p_submitted_by,
    nullif(btrim(COALESCE(p_manual_sender_name, '')), ''),
    nullif(btrim(COALESCE(p_manual_sender_phone, '')), ''),
    nullif(btrim(COALESCE(p_manual_network, '')), ''),
    nullif(btrim(COALESCE(p_manual_reference, '')), ''),
    p_manual_paid_at
  ) RETURNING * INTO v_payment;

  IF v_redemption.id IS NOT NULL THEN
    UPDATE public.shop_promo_redemptions AS redemption
    SET discount_reserved_at = now(),
        discount_reserved_payment_id = v_payment.id,
        updated_at = now()
    WHERE redemption.id = v_redemption.id;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subscription_payment(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_subscription_payment(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_shop_sales_record_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop context is required to create a sales record.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops AS shop WHERE shop.id = NEW.shop_id) THEN
    RAISE EXCEPTION 'Shop not found for sales record.';
  END IF;

  IF NOT public.shop_has_subscription_access(NEW.shop_id) THEN
    RAISE EXCEPTION 'Your BatchCommerce access has ended. Renew your GHS 100 monthly subscription to continue creating sales records.';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
