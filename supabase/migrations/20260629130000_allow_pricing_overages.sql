-- Allow paid shops to continue creating sales records after crossing tier ranges.
-- Tiers now represent recommended billing bands:
-- starter: 0-40 monthly sales records
-- growth: 41-120 monthly sales records
-- pro: 121+ monthly sales records

CREATE OR REPLACE FUNCTION public.shop_plan_limit(p_plan TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan
    WHEN 'starter' THEN 40
    WHEN 'growth' THEN 120
    WHEN 'pro' THEN NULL
    ELSE 40
  END;
$$;

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

  -- Paid active shops may create overages. The app reports overage usage
  -- and recommends the next tier instead of blocking sales operations.
  RETURN NEW;
END;
$$;
