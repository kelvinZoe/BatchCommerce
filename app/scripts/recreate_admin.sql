-- Ensure admin role exists (idempotent)
INSERT INTO roles (name, description, is_system)
SELECT 'admin', 'Administrator', true
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='admin');

-- Ensure app_users admin row exists (no auth_id yet)
WITH r AS (
  SELECT id FROM roles WHERE name = 'admin' LIMIT 1
)
INSERT INTO app_users (auth_id, username, full_name, phone, role_id, is_active)
SELECT NULL, 'admin@yourshop.com', 'Administrator', '0000000000', r.id, true
FROM r
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username IN ('admin','admin@yourshop.com'));

-- Grant full permissions to admin role (idempotent)
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete)
SELECT r.id, res.key, true, true, true, true
FROM roles r, (VALUES
  ('dashboard'),('arrivals'),('reports'),('products'),('clients'),('orders'),('deliveries'),
  ('buying_list'),('expenses'),('import'),('users'),('roles'),('settings')
) AS res(key)
WHERE r.name = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions p WHERE p.role_id = r.id AND p.resource = res.key
  );

-- After running this script, create a Supabase Auth user (see Node helper) and then update app_users.auth_id:
-- UPDATE app_users SET auth_id = '<AUTH_USER_UUID>' WHERE username IN ('admin','admin@yourshop.com');

-- Optional: make username the email
-- UPDATE app_users SET username = 'admin@yourshop.com' WHERE username = 'admin';
