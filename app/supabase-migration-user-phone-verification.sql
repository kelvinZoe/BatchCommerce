-- ============================================================
-- Shakhis Commerce – Staff Phone Verification Support
-- Run this in the Supabase SQL Editor before using WhatsApp OTP invites
-- ============================================================

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

ALTER TABLE shop_memberships
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

UPDATE shop_memberships
SET membership_status = CASE
  WHEN is_active THEN 'active'
  ELSE 'suspended'
END
WHERE membership_status IS NULL OR membership_status = '';

UPDATE shop_memberships
SET invited_at = COALESCE(invited_at, created_at, now())
WHERE invited_at IS NULL;

UPDATE shop_memberships
SET accepted_at = COALESCE(accepted_at, updated_at, created_at, now())
WHERE membership_status = 'active' AND accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shop_memberships_membership_status
  ON shop_memberships(membership_status);

CREATE INDEX IF NOT EXISTS idx_app_users_phone_verified_at
  ON app_users(phone_verified_at);