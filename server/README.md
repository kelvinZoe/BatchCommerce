Batch Commerce Admin API

This small Express service provides protected admin endpoints that use the Supabase `service_role` key for operations the browser cannot safely perform directly. Browser callers must send a Supabase access token, and the API verifies that the caller is an admin/owner for the target shop before using service-role privileges.

Setup

1. Copy `.env.example` to `.env` and fill values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role key)
RESEND_API_KEY=re_...
EMAIL_FROM=Batch Commerce <onboarding@resend.dev>
APP_BASE_URL=https://batchcommerce.vercel.app
ADMIN_API_ALLOWED_ORIGINS=https://batchcommerce.vercel.app
# Optional backward compatible alias
RESEND_FROM_EMAIL=Batch Commerce <no-reply@your-domain.com>
PORT=3000
```

2. Install dependencies and run:

```bash
cd server
npm install
npm start
```

Usage

Call admin endpoints with the signed-in user's Supabase access token in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/admin/create-user \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"shopId":"<shop-id>","email":"kwame@example.com","password":"asdf123","full_name":"Kwame Asante","roleId":2,"autoConfirm":true}'
```

Response on success:

```json
{ "success": true, "appUserId": 12, "authUserId": "..." }
```

When configured, the admin and public registration routes send verification emails through Resend after the account is created.

Security notes

- Keep the `SUPABASE_SERVICE_ROLE_KEY` secret. Do not commit it to source control.
- Keep the `RESEND_API_KEY` secret as well.
- Restrict CORS with `ADMIN_API_ALLOWED_ORIGINS` and keep the service reachable only from expected frontend/admin surfaces.
- This endpoint uses the Supabase Admin Auth API (`/auth/v1/admin/users`) which requires the `service_role` key.
