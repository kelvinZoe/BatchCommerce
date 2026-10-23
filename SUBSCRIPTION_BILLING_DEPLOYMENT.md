# Subscription Billing Deployment

The repository contains the billing migration, Angular customer/admin interfaces, and Supabase Edge Functions. Applying the migration and deploying the functions are separate production operations.

## 1. Apply the database migration

First confirm the earlier flat-pricing and shared-rate-limit migrations are present, because billing depends on both:

- `20260904130000_flat_monthly_subscription.sql`
- `20260904140000_add_shared_request_rate_limits.sql`

Then run `supabase/migrations/20261022120000_subscription_billing_foundation.sql` in the Supabase SQL editor or through the normal migration workflow.

If billing foundation is already installed, also run `supabase/migrations/20261023133000_subscription_price_100_one_month_trial.sql` to set GHS 100 renewals and the one-month free period for newly-created shops.

After the production schema is updated, regenerate `web/src/lib/supabase/database.types.ts` before the Next.js frontend begins consuming billing tables.

After it succeeds, verify the first platform administrator was found:

```sql
select pa.user_id, au.email, pa.granted_at, pa.revoked_at
from public.platform_admins pa
join auth.users au on au.id = pa.user_id
where lower(au.email) = 'zoeinventions@gmail.com';
```

If the account was created after the migration, seed it once:

```sql
insert into public.platform_admins (user_id, granted_by, notes)
select id, id, 'Initial BatchCommerce platform administrator'
from auth.users
where lower(email) = 'zoeinventions@gmail.com'
on conflict (user_id) do update set revoked_at = null;
```

## 2. Configure Edge Function secrets

Copy the names from `supabase/functions/.env.example` and set real values in **Supabase Dashboard → Edge Functions → Secrets**. These secrets belong in Supabase, not Vercel:

- `APP_BASE_URL=https://batchcommerce.vercel.app`
- `APP_ALLOWED_ORIGINS=https://batchcommerce.vercel.app`
- `PAYSTACK_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL=BatchCommerce Support <support@pharma-uci.com>`
- `EMAIL_LOGO_URL=https://batchcommerce.vercel.app/assets/BatchCommerce.png`
- `MANUAL_MOMO_NETWORK`, `MANUAL_MOMO_NUMBER`, and `MANUAL_MOMO_NAME`
- `CRON_SECRET`, generated as a long random value

Supabase automatically supplies its URL and server/client keys to deployed functions. Never expose the Paystack secret or Supabase service-role key through Angular/Vercel public variables.

## 3. Deploy the functions

From the repository root:

```bash
supabase functions deploy billing-config
supabase functions deploy billing-initialize
supabase functions deploy billing-verify
supabase functions deploy manual-payment-submit
supabase functions deploy manual-payment-review
supabase functions deploy platform-admin
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy subscription-reminders --no-verify-jwt
```

## 4. Configure Paystack

Use test keys first. In Paystack, set the webhook URL to:

```text
https://hlewyduelyxzkezetnhb.supabase.co/functions/v1/paystack-webhook
```

Add `https://batchcommerce.vercel.app` as an approved callback origin/domain. Checkout initialization supplies the complete `/subscription` callback URL.

Test all of the following before replacing the test secret with the live key:

- GHS 100 card payment.
- GHS 100 Mobile Money payment.
- Discounted payment.
- Duplicate webhook delivery; only one entitlement must exist.
- Failed/abandoned checkout and discount release.
- Manual reference approval and rejection from `/platform-admin`.
- Expired access during and after the three-day grace period.

## 5. Schedule reminders

Enable Supabase Cron, `pg_cron`, `pg_net`, and Vault. Replace the placeholders in `supabase/subscription-reminders-cron.sql.example`, then run it once in the SQL editor. Ghana uses UTC, so `0 8 * * *` runs daily at 08:00 Africa/Accra.

## 6. Release gate

Before enabling live payments, confirm:

- `/platform-admin` opens only for `zoeinventions@gmail.com`.
- The manual receiving number and account name are correct.
- Paystack webhook deliveries receive HTTP 200 in test mode.
- Reminder emails arrive from the verified Resend sender.
- Existing active shops have exactly one `launch-transition:*` entitlement.
- No secret key appears in the Angular bundle or Vercel public variables.
