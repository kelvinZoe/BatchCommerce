# ADR 0001: Migrate Angular to Next.js with a strangler strategy

- **Status:** Accepted
- **Date:** 2026-08-21

## Context

BatchCommerce currently runs as an Angular SPA with direct caller-scoped Supabase access and a separate Express service for privileged operations. The product has accumulated large route components, client-orchestrated database workflows, duplicated frontend/database authorization concerns, and two deployment boundaries.

The PostgreSQL schema, RLS policies, Auth users, migrations, and transactional RPCs are valuable and should not be rewritten.

## Decision

Build a parallel Next.js App Router application in `web/` and replace Angular one complete feature at a time.

- Use Server Components for authenticated initial reads and non-interactive composition.
- Use Client Components only for interaction-heavy feature islands.
- Use Supabase cookie sessions through `@supabase/ssr`.
- Keep RLS authoritative and verify membership/permissions server-side.
- Move multi-step mutations into PostgreSQL RPCs or narrow server-only commands.
- Keep Angular live as the behavioral reference until route parity and cutover gates pass.
- Keep Express temporarily and retire it only after every privileged endpoint has a verified Next.js replacement.

## Consequences

### Positive

- Feature migration can ship incrementally and be rolled back.
- Database integrity work is reusable by Angular and Next.js during transition.
- New components start with strict route/state/workflow/presentation boundaries.
- Privileged integrations can eventually share one Vercel deployment and TypeScript contract surface.

### Negative

- Angular and Next.js coexist temporarily.
- Authentication, environment variables, PWA behavior, and shared visual language must be maintained across both clients during migration.
- Route parity and test discipline are required to prevent behavioral regressions.

## Rejected alternative

A big-bang rewrite was rejected because BatchCommerce contains interconnected inventory, order, shipping, payment, role, and tenant workflows that cannot be safely replaced without incremental parity checks and rollback capability.
