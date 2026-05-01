-- ============================================================
-- Shakhis Commerce – Expenses Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ╔═══════════════════════════════════════╗
-- ║  1. EXPENSES TABLE                    ║
-- ╚═══════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
    -- salary, rent, utilities, transport, supplies, marketing, maintenance, food, other
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  recipient TEXT DEFAULT '',           -- who received the payment (employee name for salaries)
  payment_method TEXT DEFAULT 'cash',  -- cash, mobile_money, bank_transfer
  reference TEXT DEFAULT '',           -- receipt number, transaction ID, etc.
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════╗
-- ║  2. INDEXES                           ║
-- ╚═══════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- ╔═══════════════════════════════════════╗
-- ║  3. AUTO-UPDATE TRIGGER               ║
-- ╚═══════════════════════════════════════╝

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ╔═══════════════════════════════════════╗
-- ║  4. ROW LEVEL SECURITY                ║
-- ╚═══════════════════════════════════════╝

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expenses" ON expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update expenses" ON expenses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete expenses" ON expenses
  FOR DELETE TO authenticated USING (true);

-- ╔═══════════════════════════════════════╗
-- ║  5. ADD EXPENSE PERMISSIONS TO ROLES  ║
-- ╚═══════════════════════════════════════╝

-- Admin: full access
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
VALUES (
  (SELECT id FROM roles WHERE name = 'Admin'),
  'expenses', TRUE, TRUE, TRUE, TRUE
) ON CONFLICT (role_id, resource) DO NOTHING;

-- Accountant: full access to expenses
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
VALUES (
  (SELECT id FROM roles WHERE name = 'Accountant'),
  'expenses', TRUE, TRUE, TRUE, TRUE
) ON CONFLICT (role_id, resource) DO NOTHING;

-- Sales: view only
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
VALUES (
  (SELECT id FROM roles WHERE name = 'Sales'),
  'expenses', FALSE, FALSE, FALSE, FALSE
) ON CONFLICT (role_id, resource) DO NOTHING;

-- Delivery: no access
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
VALUES (
  (SELECT id FROM roles WHERE name = 'Delivery'),
  'expenses', FALSE, FALSE, FALSE, FALSE
) ON CONFLICT (role_id, resource) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════╗
-- ║  DONE! Expenses table is ready.                       ║
-- ║  Admin & Accountant have full access.                 ║
-- ║  Salaries are tracked as category = 'salary'.         ║
-- ╚═══════════════════════════════════════════════════════╝
