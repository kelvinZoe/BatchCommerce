# BatchCommerce Web

Parallel Next.js replacement for the Angular application in `../app`.

Do not treat this app as production-ready until the route and workflow gates in `../MODERNIZATION-TODO.md` are complete.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Use the Supabase publishable key for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Keep the service-role and Resend keys server-only.
4. Install dependencies and run the checks.

```bash
npm install
npm run check
npm run dev
```

The development server uses `http://localhost:3000` by default. The health endpoint is `/api/health`.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Architecture

- Target boundaries: `ARCHITECTURE.md`
- Migration decision: `docs/decisions/0001-nextjs-strangler-migration.md`
- Program backlog: `../MODERNIZATION-TODO.md`
