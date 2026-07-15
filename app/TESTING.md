# Testing

This project currently has two test layers.

## Contract tests

Run the fast local checks from `app/`:

```sh
npm test
```

These tests inspect source and migration contracts for pricing, promo-code rules,
high-risk RPCs, and service fallback wiring. They do not connect to Supabase.

## Live Supabase integration tests

Live tests are opt-in and skipped by default. They must only run against a
dedicated local, test, staging, or dev Supabase project.

Required environment variables:

```sh
export RUN_SUPABASE_INTEGRATION_TESTS=true
export SUPABASE_TEST_URL="https://your-test-project.supabase.co"
export SUPABASE_TEST_ANON_KEY="your-test-anon-key"
export SUPABASE_TEST_SERVICE_ROLE_KEY="your-test-service-role-key"
npm run test:integration
```

Safety guards:

- The test harness refuses the known production Supabase host.
- The URL must look like a local/test/staging/dev target.
- If a safe non-standard test URL is intentional, set
  `ALLOW_NON_TEST_SUPABASE_URL=true`.

The live harness verifies safe environment configuration, basic schema access,
and seeded workflows for:

- Promo-code redemption and one-use-per-shop protection.
- Pricing guards for expired promo shops versus active paid shops.
- Stock-sale create/update/cancel/delete RPC lifecycle with stock restoration.
- Order creation plus a small buying-list to arrivals workflow transition.

Each seeded test creates its own disposable auth user, shop, catalog rows, and
workflow rows, then deletes the shop and auth user during cleanup.
