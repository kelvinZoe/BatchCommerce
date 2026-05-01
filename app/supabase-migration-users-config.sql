-- Migration: Add users_config JSONB column to role_permissions
-- Controls granular Users page operations: canAddUser, canDeleteUser

ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS users_config JSONB DEFAULT NULL;

COMMENT ON COLUMN role_permissions.users_config IS
  'Users page operations: canAddUser, canDeleteUser';
