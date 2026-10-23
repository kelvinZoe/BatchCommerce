-- Subscription billing foundation for the flat GHS 70 BatchCommerce plan.
-- Payment providers and privileged UI actions must use the service role through
-- trusted Edge Functions. Shop users receive read-only access through RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  notes TEXT
);

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS platform_admin
    WHERE platform_admin.user_id = p_user_id
      AND platform_admin.revoked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.is_current_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_current_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_platform_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('paystack', 'manual', 'transition', 'admin', 'promo')),
  provider TEXT NOT NULL DEFAULT 'internal' CHECK (provider IN ('paystack', 'manual', 'internal')),
  provider_reference TEXT,
  provider_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'initialized', 'pending_review', 'successful', 'failed', 'abandoned', 'rejected', 'refunded', 'reversed')
  ),
  currency TEXT NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  base_amount_minor INTEGER NOT NULL DEFAULT 7000 CHECK (base_amount_minor >= 0),
  discount_percent INTEGER CHECK (discount_percent BETWEEN 0 AND 100),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  channel TEXT,
  payer_email TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  manual_sender_name TEXT,
  manual_sender_phone TEXT,
  manual_network TEXT CHECK (manual_network IS NULL OR manual_network IN ('mtn', 'telecel', 'airteltigo')),
  manual_reference TEXT,
  manual_paid_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  paid_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_reference_key
  ON public.subscription_payments(provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_transaction_key
  ON public.subscription_payments(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_manual_reference_key
  ON public.subscription_payments(lower(manual_reference))
  WHERE source = 'manual' AND manual_reference IS NOT NULL AND status <> 'rejected';

CREATE INDEX IF NOT EXISTS subscription_payments_shop_created_idx
  ON public.subscription_payments(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS subscription_payments_review_queue_idx
  ON public.subscription_payments(status, created_at)
  WHERE source = 'manual' AND status = 'pending_review';

CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  payment_id UUID UNIQUE REFERENCES public.subscription_payments(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('payment', 'transition', 'admin', 'promo')),
  source_reference TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  grace_ends_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_entitlements_window_check CHECK (ends_at > starts_at),
  CONSTRAINT subscription_entitlements_grace_check CHECK (grace_ends_at >= ends_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_entitlements_source_reference_key
  ON public.subscription_entitlements(source_reference)
  WHERE source_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_entitlements_shop_window_idx
  ON public.subscription_entitlements(shop_id, starts_at, ends_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.subscription_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paystack')),
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT subscription_provider_events_key_unique UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS subscription_provider_events_reference_idx
  ON public.subscription_provider_events(provider_reference, received_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_reminder_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  reminder_key TEXT NOT NULL,
  access_ends_at TIMESTAMPTZ NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_reminder_delivery_unique UNIQUE (shop_id, reminder_key, access_ends_at, recipient_email)
);

CREATE TABLE IF NOT EXISTS public.platform_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_promo_redemptions
  ADD COLUMN IF NOT EXISTS discount_reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_reserved_payment_id UUID REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_payment_id UUID REFERENCES public.subscription_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shop_promo_redemptions_pending_discount_idx
  ON public.shop_promo_redemptions(shop_id, redeemed_at)
  WHERE discount_percent > 0 AND discount_consumed_at IS NULL;

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
    round(7000 * (100 - COALESCE(v_discount, 0)) / 100.0)::INTEGER,
    CASE
      WHEN v_effective_end IS NULL THEN 0
      ELSE greatest(ceil(extract(epoch FROM (v_effective_end - p_at)) / 86400.0)::INTEGER, 0)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_shop_subscription_summary(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_shop_subscription_summary(UUID, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.get_shop_subscription_summary(p_shop_id UUID)
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
BEGIN
  IF NOT public.has_shop_permission(p_shop_id, 'billing', 'view')
     AND NOT public.is_current_platform_admin() THEN
    RAISE EXCEPTION 'You do not have permission to view billing for this shop.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.compute_shop_subscription_summary(p_shop_id, now());
END;
$$;

REVOKE ALL ON FUNCTION public.get_shop_subscription_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shop_subscription_summary(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_has_subscription_access(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT summary.can_create_sales_record
  FROM public.compute_shop_subscription_summary(p_shop_id, now()) AS summary;
$$;

REVOKE ALL ON FUNCTION public.shop_has_subscription_access(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_has_subscription_access(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.can_shop_create_sales_record(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_shop_membership(p_shop_id) THEN
    RAISE EXCEPTION 'You do not have access to this shop.' USING ERRCODE = '42501';
  END IF;
  RETURN public.shop_has_subscription_access(p_shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.can_shop_create_sales_record(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_shop_create_sales_record(UUID) TO authenticated;

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
  v_amount INTEGER := 7000;
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
    v_amount := round(7000 * (100 - v_discount) / 100.0)::INTEGER;
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
    7000,
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

CREATE OR REPLACE FUNCTION public.release_subscription_payment(
  p_payment_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('failed', 'abandoned', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported terminal payment status.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.subscription_payments AS payment
  SET status = p_status,
      failure_reason = nullif(btrim(COALESCE(p_reason, '')), ''),
      updated_at = now()
  WHERE payment.id = p_payment_id
    AND payment.status NOT IN ('successful', 'refunded', 'reversed');

  UPDATE public.shop_promo_redemptions AS redemption
  SET discount_reserved_at = NULL,
      discount_reserved_payment_id = NULL,
      updated_at = now()
  WHERE redemption.discount_reserved_payment_id = p_payment_id
    AND redemption.discount_consumed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.release_subscription_payment(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_subscription_payment(UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_subscription_payment(
  p_payment_id UUID,
  p_provider_transaction_id TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS public.subscription_entitlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.subscription_payments%ROWTYPE;
  v_existing public.subscription_entitlements%ROWTYPE;
  v_entitlement public.subscription_entitlements%ROWTYPE;
  v_shop public.shops%ROWTYPE;
  v_latest_end TIMESTAMPTZ;
  v_starts_at TIMESTAMPTZ;
BEGIN
  SELECT entitlement.* INTO v_existing
  FROM public.subscription_entitlements AS entitlement
  WHERE entitlement.payment_id = p_payment_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT payment.* INTO v_payment
  FROM public.subscription_payments AS payment
  WHERE payment.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status IN ('rejected', 'refunded', 'reversed') THEN
    RAISE EXCEPTION 'This payment cannot grant subscription access.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_payment.shop_id::TEXT || ':subscription-entitlement', 0));

  SELECT shop.* INTO v_shop
  FROM public.shops AS shop
  WHERE shop.id = v_payment.shop_id
  FOR UPDATE;

  SELECT max(entitlement.ends_at) INTO v_latest_end
  FROM public.subscription_entitlements AS entitlement
  WHERE entitlement.shop_id = v_payment.shop_id
    AND entitlement.revoked_at IS NULL;

  v_starts_at := greatest(
    now(),
    COALESCE(v_shop.promo_ends_at, now()),
    COALESCE(v_latest_end, now())
  );

  INSERT INTO public.subscription_entitlements (
    shop_id, payment_id, source, source_reference,
    starts_at, ends_at, grace_ends_at, created_by, note
  ) VALUES (
    v_payment.shop_id,
    v_payment.id,
    CASE WHEN v_payment.source = 'promo' THEN 'promo' ELSE 'payment' END,
    'payment:' || v_payment.id::TEXT,
    v_starts_at,
    v_starts_at + interval '1 month',
    v_starts_at + interval '1 month 3 days',
    v_payment.submitted_by,
    CASE WHEN v_payment.amount_minor = 0 THEN '100% subscription discount' ELSE 'Monthly subscription payment' END
  ) RETURNING * INTO v_entitlement;

  UPDATE public.subscription_payments AS payment
  SET status = 'successful',
      provider_transaction_id = COALESCE(nullif(btrim(COALESCE(p_provider_transaction_id, '')), ''), payment.provider_transaction_id),
      channel = COALESCE(nullif(btrim(COALESCE(p_channel, '')), ''), payment.channel),
      paid_at = COALESCE(p_paid_at, now()),
      verified_at = now(),
      updated_at = now()
  WHERE payment.id = p_payment_id;

  UPDATE public.shop_promo_redemptions AS redemption
  SET discount_consumed_at = now(),
      discount_payment_id = p_payment_id,
      discount_reserved_at = NULL,
      updated_at = now()
  WHERE redemption.discount_reserved_payment_id = p_payment_id
    AND redemption.discount_consumed_at IS NULL;

  UPDATE public.shops AS shop
  SET subscription_status = 'active',
      billing_started_at = COALESCE(shop.billing_started_at, now()),
      plan_updated_at = now()
  WHERE shop.id = v_payment.shop_id
    AND shop.subscription_status NOT IN ('suspended', 'cancelled');

  RETURN v_entitlement;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_payment(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.review_manual_subscription_payment(
  p_payment_id UUID,
  p_decision TEXT,
  p_reviewer UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS public.subscription_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.subscription_payments%ROWTYPE;
  v_after public.subscription_payments%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin(p_reviewer) THEN
    RAISE EXCEPTION 'Platform administrator access is required.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject.' USING ERRCODE = '22023';
  END IF;

  SELECT payment.* INTO v_before
  FROM public.subscription_payments AS payment
  WHERE payment.id = p_payment_id
    AND payment.source = 'manual'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manual payment not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_before.status <> 'pending_review' THEN
    RAISE EXCEPTION 'This manual payment has already been reviewed.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.subscription_payments AS payment
  SET reviewed_by = p_reviewer,
      reviewed_at = now(),
      review_note = nullif(btrim(COALESCE(p_note, '')), ''),
      updated_at = now()
  WHERE payment.id = p_payment_id;

  IF p_decision = 'approve' THEN
    PERFORM public.apply_subscription_payment(p_payment_id, NULL, 'mobile_money', COALESCE(v_before.manual_paid_at, now()));
  ELSE
    PERFORM public.release_subscription_payment(p_payment_id, 'rejected', COALESCE(p_note, 'Rejected by platform administrator.'));
  END IF;

  SELECT payment.* INTO v_after
  FROM public.subscription_payments AS payment
  WHERE payment.id = p_payment_id;

  INSERT INTO public.platform_action_audit (
    actor_user_id, action, target_type, target_id, shop_id, reason, before_state, after_state
  ) VALUES (
    p_reviewer,
    'manual_payment_' || p_decision,
    'subscription_payment',
    p_payment_id::TEXT,
    v_before.shop_id,
    nullif(btrim(COALESCE(p_note, '')), ''),
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.review_manual_subscription_payment(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_manual_subscription_payment(UUID, TEXT, UUID, TEXT) TO service_role;

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
    RAISE EXCEPTION 'Your BatchCommerce access has ended. Renew your GHS 70 monthly subscription to continue creating sales records.';
  END IF;

  RETURN NEW;
END;
$$;

-- Give every existing active shop one migration-time month. Promo shops keep
-- their original promo dates and are not changed by this transition grant.
INSERT INTO public.subscription_entitlements (
  shop_id, source, source_reference, starts_at, ends_at, grace_ends_at, note
)
SELECT
  shop.id,
  'transition',
  'launch-transition:' || shop.id::TEXT,
  now(),
  now() + interval '1 month',
  now() + interval '1 month 3 days',
  'One-month transition grant for shops active before automated billing.'
FROM public.shops AS shop
WHERE shop.subscription_status = 'active'
ON CONFLICT (source_reference) WHERE source_reference IS NOT NULL DO NOTHING;

-- Existing system admin roles should display the new resource in the role UI.
INSERT INTO public.role_permissions (
  shop_id, role_id, resource, can_view, can_create, can_edit, can_delete
)
SELECT role.shop_id, role.id, 'billing', TRUE, TRUE, FALSE, FALSE
FROM public.roles AS role
WHERE role.is_system = TRUE
  AND lower(role.name) = 'admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_admin_billing_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_system = TRUE AND lower(NEW.name) = 'admin' THEN
    INSERT INTO public.role_permissions (
      shop_id, role_id, resource, can_view, can_create, can_edit, can_delete
    ) VALUES (
      NEW.shop_id, NEW.id, 'billing', TRUE, TRUE, FALSE, FALSE
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_admin_billing_permission ON public.roles;
CREATE TRIGGER trg_seed_admin_billing_permission
  AFTER INSERT ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_admin_billing_permission();

-- Seed the requested first platform administrator when the Auth account exists.
INSERT INTO public.platform_admins (user_id, granted_by, notes)
SELECT auth_user.id, auth_user.id, 'Initial BatchCommerce platform administrator'
FROM auth.users AS auth_user
WHERE lower(auth_user.email) = 'zoeinventions@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_action_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can read own grant" ON public.platform_admins;
CREATE POLICY "Platform admins can read own grant"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND revoked_at IS NULL);

DROP POLICY IF EXISTS "Billing viewers can read shop payments" ON public.subscription_payments;
CREATE POLICY "Billing viewers can read shop payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (
    public.has_shop_permission(shop_id, 'billing', 'view')
    OR public.is_current_platform_admin()
  );

DROP POLICY IF EXISTS "Billing viewers can read shop entitlements" ON public.subscription_entitlements;
CREATE POLICY "Billing viewers can read shop entitlements"
  ON public.subscription_entitlements FOR SELECT TO authenticated
  USING (
    public.has_shop_permission(shop_id, 'billing', 'view')
    OR public.is_current_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can read action audit" ON public.platform_action_audit;
CREATE POLICY "Platform admins can read action audit"
  ON public.platform_action_audit FOR SELECT TO authenticated
  USING (public.is_current_platform_admin());

-- Supabase no longer auto-grants Data API privileges to newly-created public
-- tables. Keep these grants explicit and least-privileged so fresh projects,
-- preview branches, and `supabase db reset` behave like production.
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_provider_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.subscription_reminder_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_action_audit FROM PUBLIC, anon, authenticated;

-- Browser clients may only read records allowed by the RLS policies above.
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT SELECT ON public.subscription_entitlements TO authenticated;
GRANT SELECT ON public.platform_action_audit TO authenticated;

-- Trusted Edge Functions use the service role for provider events, payment
-- state transitions, reminder delivery records, and platform administration.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_entitlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_provider_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_reminder_deliveries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_action_audit TO service_role;

-- Compatibility grants for public tables created by earlier migrations. They
-- are required when the migration history is replayed after the grant-default
-- change. RLS remains authoritative for authenticated access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_order_allocations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.damage_order_allocations_id_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_order_allocations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.damage_order_allocations_id_seq TO service_role;

GRANT SELECT ON public.shop_promo_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_promo_redemptions TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
