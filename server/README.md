Shakhis Admin API

This small Express service provides a protected admin endpoint to create Supabase auth users using the `service_role` key and to insert the corresponding `app_users` row in the application database. Use this from a secure admin environment (not the browser).

Setup

1. Copy `.env.example` to `.env` and fill values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role key)
ADMIN_API_SECRET=a-long-secret-only-known-to-admin
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Shakhis Commerce <no-reply@your-domain.com>
PORT=3000
```

2. Install dependencies and run:

```bash
cd server
npm install
npm start
```

Usage

Call the endpoint with your admin secret in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/admin/create-user \
  -H "Authorization: Bearer <ADMIN_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email":"kwame@example.com","password":"asdf123","full_name":"Kwame Asante","roleId":2,"autoConfirm":true}'
```

Response on success:

```json
{ "success": true, "appUserId": 12, "authUserId": "..." }
```

When configured, the public registration route also sends a welcome email through Resend after the account is created.

Security notes

- Keep the `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_API_SECRET` secret. Do not commit them to source control.
- Keep the `RESEND_API_KEY` secret as well.
- Restrict access to this service (run it in a private network, or behind an admin-only VPN / firewall). Validate admin sessions if wiring into your existing backend authentication.
- This endpoint uses the Supabase Admin Auth API (`/auth/v1/admin/users`) which requires the `service_role` key.
