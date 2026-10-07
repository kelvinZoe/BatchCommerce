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

## Registration and first workspace

`/setup` is state-aware. Signed-out visitors receive the account-registration form;
verified users without a membership receive the first-shop form; users with an
existing active workspace are redirected to the dashboard. An inactive or pending
membership never falls through into owner-shop creation.

Registration runs in a Server Action. Supabase Admin generates the signup link and
creates the unconfirmed Auth identity in one managed operation, then Resend delivers
the branded verification message with a request-scoped idempotency key so ambiguous
provider failures can be retried once without sending a duplicate. Passwords are
never persisted by BatchCommerce.
If Resend definitively rejects the initial delivery, the server attempts to delete
only that newly created, still-unconfirmed identity and reports an error instead
of presenting a false success. It retains the identity when provider acceptance
is ambiguous, and a confirmed identity is never deleted by this cleanup path.

Workspace creation re-authenticates the caller, derives the identity email from
Supabase Auth, validates the command at runtime, and calls the transactional
`bootstrap_shop_workspace` RPC. The RPC response is parsed before the active-shop
and owner-device cookies are written.

## Password recovery

`POST /api/auth/password-reset` validates and rate-limits requests, asks Supabase Admin to generate the recovery link, and sends the branded message through Resend. Its success response never reveals whether the account exists. Each response includes a request ID; provider acceptance or failure is logged against that ID while the public response stays generic.

Every message is sent from the fixed identity:

`BatchCommerce Support <support@pharma-uci.com>`

Required server-only deployment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `APP_BASE_URL`
- `RATE_LIMIT_HMAC_SECRET` (an independent random value of at least 32 characters)
- `EMAIL_LOGO_URL` (optional when the default public asset is correct)

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not prefix service-role, Resend, or rate-limit credentials with `NEXT_PUBLIC_`.
`APP_BASE_URL` is mandatory so privileged email generation never trusts a forwarded
request host. Add production and local `/auth/callback` and `/reset-password` URLs
to the Supabase Auth redirect allow-list before testing email links.

Sign-in, registration, workspace setup, and password recovery consume atomic
fixed-window counters in Supabase. Only the service-role client may execute the
limiter RPC. Client identifiers are HMAC-protected before storage, and auth work
fails closed if the shared limiter cannot answer.

## Deliberately separate follow-up work

- Phone/WhatsApp verification and secure pending-membership activation.
- Self-service resend for expired or accepted-but-undelivered verification links.
- OAuth buttons, which exist in legacy service code but are not exposed in the accepted login UI.
- Integration tests against a dedicated Supabase project for owner, admin, restricted, suspended, inactive, and cross-shop cases.
