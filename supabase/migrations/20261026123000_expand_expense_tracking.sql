-- Expand the existing shop expense ledger so operating costs can retain the
-- vendor, payment method, and receipt reference shown in the Expenses UI.

BEGIN;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recipient TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS reference TEXT NOT NULL DEFAULT '';

UPDATE public.expenses
SET description = name
WHERE btrim(COALESCE(description, '')) = '';

CREATE INDEX IF NOT EXISTS idx_expenses_shop_category_date
  ON public.expenses(shop_id, category, expense_date DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
