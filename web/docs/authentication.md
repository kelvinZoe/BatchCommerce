# Authentication foundation

The Next.js auth boundary uses Supabase cookie sessions. A valid Auth user is necessary but is not sufficient for workspace access.

## Request flow

1. Login accepts an email, username, or supported phone number.
2. Username lookup happens only on the server with the service-role client; the password is still verified only by Supabase Auth.
3. The server resolves an active membership using the user-session client so RLS remains in force.
4. Workspace resolution validates the shop, app-user profile, membership status, role ownership, and resource permissions.
5. Protected pages call `requirePermission(resource, action)` and denied users go to `/access-denied`.
6. Logout awaits Supabase sign-out. The active-shop preference is retained but is always revalidated against the next authenticated user.

Public authentication URLs remain compatible with the Angular application:

- `/login`
- `/setup`
- `/auth/callback`
- `/reset-password`

The callback supports PKCE codes, token hashes, and legacy implicit-flow URL fragments so links sent before cutover continue to work.

## Password recovery

`POST /api/auth/password-reset` validates and rate-limits requests, asks Supabase Admin to generate the recovery link, and sends the branded message through Resend. Its success response never reveals whether the account exists. Each response includes a request ID; provider acceptance or failure is logged against that ID while the public response stays generic.

Every message is sent from the fixed identity:

`BatchCommerce Support <support@pharma-uci.com>`

Required server-only deployment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `APP_BASE_URL`
- `EMAIL_LOGO_URL` (optional when the default public asset is correct)

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not prefix service-role or Resend credentials with `NEXT_PUBLIC_`. Add production and local `/auth/callback` and `/reset-password` URLs to the Supabase Auth redirect allow-list before testing email links.

The in-process limiter is a useful first barrier but is not globally consistent across serverless instances. Replace it with a shared edge/KV limiter before production traffic moves from Express.

## Deliberately separate follow-up work

- Registration and the full workspace bootstrap form.
- Phone/WhatsApp verification and secure pending-membership activation.
- OAuth buttons, which exist in legacy service code but are not exposed in the accepted login UI.
- Live Supabase-generated database types. The current type file is an auth-scoped snapshot of the canonical reset schema and is not a substitute for generation from the production project.
- Integration tests against a dedicated Supabase project for owner, admin, restricted, suspended, inactive, and cross-shop cases.
