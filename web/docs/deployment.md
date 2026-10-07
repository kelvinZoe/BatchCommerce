# Next.js staging deployment

This runbook deploys the Next.js application as a separate, protected staging
project while the Angular application remains the production system. It does
not authorize a production-domain cutover.

## Deployment boundaries

Maintain two independent Vercel projects connected to this repository:

| Project | Root directory | Purpose | Domain |
|---|---|---|---|
| Existing Angular project | Keep its current setting | Production application and rollback reference | `https://batchcommerce.vercel.app` |
| New Next.js project | `web` | Preview and staging validation only | A separate stable staging domain |

Do not change the Angular project's root directory, production branch, build
settings, environment variables, or domain assignment. Do not attach
`batchcommerce.vercel.app` to the Next.js project.

## Create the Next.js Vercel project

1. Commit and push the intended Next.js checkpoint before creating the
   deployment.
2. In Vercel, import the same BatchCommerce Git repository as a new project.
3. Give the project an unambiguous name such as
   `batchcommerce-next-staging`.
4. Set **Root Directory** to `web`.
5. Confirm that Vercel detects **Next.js**. Leave the install command, build
   command, and output directory on their framework defaults.
6. Track `feat/nextjs-foundation` initially, or use a dedicated
   `next-staging` branch if a long-lived staging branch is preferred. Do not
   change the Angular project's production branch.
7. Assign a stable domain belonging only to this project, for example
   `https://batchcommerce-next-staging.vercel.app`. Use the exact domain Vercel
   assigns if the example name is unavailable.
8. Enable Vercel Authentication or password protection for the staging
   deployment before sharing its URL.

If the initial import uses `main` and cannot locate `web`, create or configure
the project without changing the Angular project, set the Next.js project's
tracked branch, and create a deployment from the pushed Next.js branch.

## Environment variables

Configure the following variables in the new Next.js project. Use staging
values for both the Vercel Preview and the staging project's Production
environment unless a branch-specific value is intentionally required.

```text
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
RESEND_API_KEY=<server-only-resend-key>
APP_BASE_URL=https://<exact-next-staging-domain>
EMAIL_LOGO_URL=https://<exact-next-staging-domain>/assets/BatchCommerce.png
```

Generate a separate secret for the shared rate limiter:

```text
RATE_LIMIT_HMAC_SECRET=<at-least-32-random-characters>
```

For example, generate one locally with `openssl rand -hex 32`, then save the
result directly in Vercel. The application HMAC-protects client identifiers and
stores globally consistent counters in Supabase. Never prefix this secret with
`NEXT_PUBLIC_`, and do not reuse the service-role or Resend key.

The Next.js application does not currently read `ADMIN_API_URL`,
`SUPABASE_URL`, or `SUPABASE_KEY`; do not copy them into this project merely
because they exist in the Angular project. Vercel project-level variables do
not transfer automatically between projects.

Treat `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and
`RATE_LIMIT_HMAC_SECRET` as server-only secrets. Never paste secret values into
source files, commits, deployment logs, screenshots, or browser-visible
variables.

## Staging Supabase is required for mutation testing

Use a dedicated non-production Supabase project whose schema and migrations
match the application. Registration, workspace setup, password recovery, and
future feature commands can write data or perform privileged operations. A
protected Vercel URL does not make production database mutations safe.

If a staging Supabase project is not ready, the Next.js site may be deployed
behind protection for build and visual inspection, but do not exercise:

- account registration or email verification;
- first-workspace creation;
- password recovery or password changes;
- tenant, role, subscription, stock, order, or other workflow mutations.

Do not reuse production test credentials in staging. Seed named staging-only
accounts and shops instead.

## Supabase Auth redirects

Keep the production Supabase **Site URL** and all Angular production redirect
entries unchanged. In the staging Supabase project's Auth URL configuration,
add the exact stable staging URLs:

```text
https://<exact-next-staging-domain>/auth/callback
https://<exact-next-staging-domain>/reset-password
```

`APP_BASE_URL` must use the same stable origin, without a trailing slash. Email
verification and password-reset links are generated from this value. Avoid
using transient commit deployment URLs for email flows. If a branch-specific
domain is deliberately used, give that branch its own `APP_BASE_URL` and add
the exact callback URLs to the staging Supabase allow-list.

## Deployment validation

After the first deployment, verify the deployment and its logs before testing
authenticated behavior:

1. Confirm the Vercel deployment was built from `web/package.json`, not the
   root Angular configuration.
2. Confirm `GET /api/health` returns HTTP 200 with
   `"service":"batchcommerce-web"` and `"status":"ok"`.
3. Confirm `/login`, `/setup`, `/auth/callback`, and `/reset-password` render
   from the stable staging domain.
4. Confirm `/assets/BatchCommerce.png`, the manifest, and application icons
   load successfully.
5. Confirm an unauthenticated visit to `/dashboard` redirects to `/login`.
6. With staging-only accounts, test login, logout, registration, verification,
   workspace setup, password recovery, and password update.
7. Confirm the `20260904140000_add_shared_request_rate_limits.sql` migration is
   applied before testing any rate-limited auth flow; those flows intentionally
   fail closed when the RPC is absent.
8. Verify owner, restricted-role, inactive-membership, and cross-shop cases
   against staging data before treating the authentication slice as approved.
9. Inspect Vercel function logs for environment-validation errors, callback
   failures, Resend failures, unexpected service-role errors, and leaked
   sensitive data.

Record the deployment URL, Git commit, test account identifiers, test results,
known failures, and the last verified Angular deployment before proceeding to
feature-level staging tests.

## Rollback

The Angular project remains the production and rollback boundary throughout
this phase. A failed Next.js staging deployment must not cause a production
traffic change.

For a staging application failure:

1. Stop testing the failing deployment.
2. Roll the Next.js project back to its last verified Vercel deployment, or
   revert the responsible application commit and redeploy.
3. Review Vercel function logs and Supabase logs before retrying.
4. If staging data was mutated incorrectly, use a reviewed forward fix or
   restore the dedicated staging database as appropriate. Do not apply an
   untested destructive rollback to production.
5. Leave the Angular domain, project, Render service, and production Supabase
   configuration unchanged.

## No production cutover

Creating this staging project does not make the Next.js application the
production application. Do not move `batchcommerce.vercel.app`, proxy customer
routes to Next.js, disable the Angular deployment, retire Render, or point the
Next.js staging project at production mutation traffic until the route-parity,
security, integration, end-to-end, monitoring, and rollback gates in
`MODERNIZATION-TODO.md` are complete and the cutover is separately approved.
