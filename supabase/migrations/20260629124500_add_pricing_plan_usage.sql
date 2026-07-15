-- Add paid plan/promo state and enforce monthly sales-record limits.
-- A sales record is one row in orders or stock_sales.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'promo',
  ADD COLUMN IF NOT EXISTS promo_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 months'),
  ADD COLUMN IF NOT EXISTS billing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_subscription_plan_check;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_subscription_plan_check
  CHECK (subscription_plan IN ('starter', 'growth', 'pro')) NOT VALID;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_subscription_status_check;

ALTER TABLE public.shops
  ADD CONSTRAINT shops_subscription_status_check
  CHECK (subscription_status IN ('promo', 'active', 'past_due', 'suspended', 'cancelled')) NOT VALID;

UPDATE public.shops
SET
  subscription_plan = COALESCE(NULLIF(subscription_plan, ''), 'starter'),
  subscription_status = COALESCE(NULLIF(subscription_status, ''), 'promo'),
  promo_started_at = COALESCE(promo_started_at, created_at, now()),
  promo_ends_at = COALESCE(promo_ends_at, COALESCE(created_at, now()) + interval '2 months'),
  plan_updated_at = COALESCE(plan_updated_at, now());

CREATE OR REPLACE FUNCTION public.shop_plan_limit(p_plan TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'starter' THEN 20
    WHEN 'growth' THEN 149
    WHEN 'pro' THEN NULL
    ELSE 20
  END;
$$;

CREATE OR REPLACE FUNCTION public.monthly_sales_record_count(
  p_shop_id UUID,
  p_month_start TIMESTAMPTZ DEFAULT date_trunc('month', now())
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT COUNT(*)::INTEGER
      FROM public.orders o
      WHERE o.shop_id = p_shop_id
        AND o.created_at >= p_month_start
        AND o.created_at < (p_month_start + interval '1 month')
    )
    +
    (
      SELECT COUNT(*)::INTEGER
      FROM public.stock_sales ss
      WHERE ss.shop_id = p_shop_id
        AND ss.created_at >= p_month_start
        AND ss.created_at < (p_month_start + interval '1 month')
    );
$$;

CREATE OR REPLACE FUNCTION public.enforce_shop_sales_record_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  IF NEW.shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop context is required to create a sales record.';
  END IF;

  SELECT *
    INTO v_shop
  FROM public.shops
  WHERE id = NEW.shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found for sales record.';
  END IF;

  IF COALESCE(v_shop.subscription_status, 'promo') = 'promo'
     AND now() <= COALESCE(v_shop.promo_ends_at, now()) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_shop.subscription_status, 'promo') <> 'active' THEN
    RAISE EXCEPTION 'Your 2-month promo has ended. Activate a paid plan to continue creating sales records.';
  END IF;

  v_limit := public.shop_plan_limit(v_shop.subscription_plan);

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  v_count := public.monthly_sales_record_count(NEW.shop_id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your % plan allows % monthly sales records. Upgrade to continue.',
      initcap(v_shop.subscription_plan),
      v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sales_record_limit ON public.orders;
DROP TRIGGER IF EXISTS trg_zz_orders_sales_record_limit ON public.orders;
CREATE TRIGGER trg_zz_orders_sales_record_limit
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_sales_record_limit();

DROP TRIGGER IF EXISTS trg_stock_sales_record_limit ON public.stock_sales;
DROP TRIGGER IF EXISTS trg_zz_stock_sales_record_limit ON public.stock_sales;
CREATE TRIGGER trg_zz_stock_sales_record_limit
  BEFORE INSERT ON public.stock_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_shop_sales_record_limit();

CREATE INDEX IF NOT EXISTS idx_orders_shop_created_usage
  ON public.orders(shop_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stock_sales_shop_created_usage
  ON public.stock_sales(shop_id, created_at);
