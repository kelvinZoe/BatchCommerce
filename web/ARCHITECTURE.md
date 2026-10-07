# BatchCommerce Next.js Target Architecture

## Purpose

The `web/` application is the incremental replacement for the Angular client in `app/`. It must not receive production traffic until authentication, tenancy, permissions, PWA behavior, and at least one complete workflow have passed the gates in `../MODERNIZATION-TODO.md`.

## Runtime boundaries

- **Server Components** load authenticated initial data and compose non-interactive views.
- **Client Components** own local interaction only: forms, dialogs, tables, filters, and optimistic feedback.
- **Feature controllers/hooks** coordinate client-visible server state without embedding business workflows in visual components.
- **Server Actions and Route Handlers** validate commands and perform bounded server-side work.
- **PostgreSQL RPCs** own multi-step, state-changing, inventory, financial, and destructive transactions.
- **RLS** is the authoritative tenant and data authorization boundary.
- **Application RBAC** controls route/action availability and provides user-facing permission feedback.

## Supabase clients

| Client | Location | Credential | Allowed work |
|---|---|---|---|
| Browser | `src/lib/supabase/browser.ts` | Publishable key + user session | RLS-scoped reads and explicitly approved simple CRUD |
| Server | `src/lib/supabase/server.ts` | Publishable key + cookie session | Authenticated queries, Server Actions, Route Handlers |
| Admin | `src/lib/supabase/admin.ts` | Service-role key | Narrow privileged server-only operations after explicit authorization |

The admin client must never be imported by a Client Component. Having an authenticated user is not enough to authorize an admin operation; handlers must verify the active shop and required permission first.

## Feature structure

```text
src/features/<feature>/
├── components/      # focused presentation and forms
├── hooks/           # client controller and query behavior
├── server/          # server-only queries and commands
├── schemas/         # runtime command and form validation
├── types.ts         # feature view models and result unions
└── utils.ts         # pure calculations only
```

Routes compose features but do not become business-logic containers.

## Data and workflow rules

- Use `customers` and `customer_id` internally; Clients remains a UI label.
- Use `batches` and `batch_id`; do not copy legacy `order_batches` or new `batch_name` relationships.
- Do not pass raw database rows directly into editable forms.
- Mutations accept typed, runtime-validated commands.
- Important mutations return discriminated result unions instead of booleans.
- Retryable mutations define explicit idempotency behavior.
- Authenticated responses are private and must not use shared or incremental caches.

## Migration rule

Angular remains the behavior reference. A route moves only after its complete feature slice satisfies the shared definition of done in `../MODERNIZATION-TODO.md`. Express remains available until equivalent server handlers have been deployed, observed, and approved.
