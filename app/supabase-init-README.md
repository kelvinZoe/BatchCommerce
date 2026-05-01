# Supabase init — runbook

This file explains how to apply the single init migration and link a Supabase Auth user
to the seeded `app_users` row so you can log in as an administrator.

Files
- `app/supabase-init.sql` — the idempotent migration that creates tables, roles, and a placeholder admin app_user.
- `scripts/create_admin_with_service_role.js` — (optional) a Node helper that can create a Supabase Auth user using the service_role key and link it to `app_users`.

Quick steps

1) Apply the migration

Open the Supabase SQL editor and run the contents of `app/supabase-init.sql`, or run it via psql against your database.

2) Create a Supabase Auth user (choose one)

- Dashboard: Auth → Users → Invite or create a new user with email `admin@example.com`.
- Node script (recommended for automation):

```bash
# set your project URL and service role key in the environment
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"

# run the helper (edit script or pass args as needed)
node scripts/create_admin_with_service_role.js
```

The script will return the created Auth user's UUID (example: `303f9abc-...`).

3) Link Auth user to app_user row

Run this SQL (replace the UUID):

```sql
UPDATE app_users
SET auth_id = '<AUTH_USER_UUID>'
WHERE email = 'admin@example.com';
```

4) Verify and refresh

- Confirm the `auth_id` is set:

```sql
SELECT id, email, auth_id FROM app_users WHERE email = 'admin@example.com';
```

- If your app still returns schema errors (PGRST204), refresh/redeploy PostgREST in the Supabase dashboard or restart the project so the schema cache picks up new columns.

Notes and troubleshooting
- The `supabase-init.sql` is idempotent — it uses `CREATE TABLE IF NOT EXISTS` and `INSERT ... ON CONFLICT DO NOTHING` so it is safe to run multiple times.
- If you prefer to manually create the Auth user in the dashboard, copy the user's UUID and run the `UPDATE` above to link it.
- If you want, I can: add a small README-driven Node script that runs the migration and creates/links the admin automatically (requires storing the service_role key). Ask and I'll add it.

Keeping `supabase-init.sql` in sync
- Important: whenever you add or change any schema (new migration files like `supabase-migration-*.sql` or code that depends on new columns/tables), also update `app/supabase-init.sql` so a fresh database can be created from this single file.
- Recommended workflow:
	- Add a new incremental migration file `app/supabase-migration-<desc>.sql` for changes.
	- After verifying the migration, copy the corresponding table/column additions and seed data into `app/supabase-init.sql` (or update its logic to perform the same idempotent changes).
	- Run and verify `app/supabase-init.sql` on a fresh database before shipping.

If you'd like, I can add a small helper script that aggregates migrations into a single init file or automates the admin user creation and linking — tell me if you want that automated.
