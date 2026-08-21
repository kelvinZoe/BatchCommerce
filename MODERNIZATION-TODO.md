# BatchCommerce Modernization and Next.js Migration

This is the active roadmap for replacing the Angular client without duplicating its architectural debt. The existing Angular app remains the production reference until each migrated feature passes its completion gates.

## Program principles

- Preserve the existing Supabase PostgreSQL database, Auth identities, RLS policies, migrations, and transactional RPCs.
- Do not perform a big-bang cutover. Migrate one complete vertical feature at a time.
- Do not copy Angular page components directly into React.
- Visual components do not access Supabase or privileged APIs directly.
- Simple tenant-scoped reads may use a caller-scoped Supabase client; privileged and multi-step mutations execute server-side or through transactional RPCs.
- The Supabase service-role key, Resend key, and future payment secrets remain server-only.
- Every migrated route must preserve tenancy, permissions, responsive behavior, accessibility, loading/error states, and current business behavior.
- Angular is removed only after full route parity, production verification, and a rollback window.

## Definition of done for every migrated feature

- [ ] Server page or protected layout verifies the current session and workspace.
- [ ] RLS and application permissions are tested for owner, admin, restricted user, and a different shop.
- [ ] Feature is split into route, state/controller, form, presentation, query, and mutation boundaries where applicable.
- [ ] No component imports an admin Supabase client or service-role secret.
- [ ] Multi-step state changes are atomic, tenant-scoped, permission-checked, and safe to retry.
- [ ] Inputs and mutation results have runtime schemas and TypeScript types.
- [ ] Loading, empty, error, success, and repeated-submit states are handled.
- [ ] Keyboard navigation, labels, focus visibility, contrast, reduced motion, and mobile layout are verified.
- [ ] Unit, integration, and end-to-end tests cover the critical behavior.
- [ ] Angular and Next.js behavior match before traffic moves to the new route.

## Phase 0: Architecture and safety baseline

- [x] Agree on the three core goals: reduce client-heavy database orchestration, migrate fully to Next.js, and replace oversized components.
- [x] Expand the program to include security, testing, observability, CI/CD, data integrity, design-system, accessibility, PWA, audit, and documentation work.
- [x] Create this migration backlog.
- [x] Record the target architecture in `web/ARCHITECTURE.md`.
- [x] Add an architecture decision record for Next.js App Router and the strangler migration.
- [x] Inventory every Angular route, permission resource, Supabase dependency, workflow mutation, and migration owner in `web/docs/migration/current-system-inventory.md`.
- [x] Classify current database calls as safe browser reads, safe browser CRUD, privileged server operations, or transactional workflows.
- [x] Establish naming rules: `customers` internally, Clients in UI; `batches` and `batch_id` are canonical.
- [x] Document rollback and production cutover rules.
- [ ] Close the security review findings for unrestricted membership/shop column updates, mutable Admin-role escalation, and under-authorized `SECURITY DEFINER` workflow RPCs before migrated mutations receive production traffic.
- [ ] Restrict `monthly_sales_record_count` execution and add tenant authorization before exposing pricing/usage reads.

## Phase 1: Next.js foundation

- [x] Create the parallel `web/` Next.js App Router application.
- [x] Enable strict TypeScript, ESLint, absolute imports, initial tests, and CI quality commands. Formatting and feature import-boundary enforcement remain pending.
- [x] Add environment validation with separate public and server-only schemas.
- [x] Add Supabase browser, server-cookie, and server-admin clients.
- [x] Add cookie refresh/proxy handling without caching authenticated responses.
- [x] Create `(public)` and `(workspace)` route groups.
- [x] Add root error, not-found, loading, and protected access-denied experiences.
- [x] Create the responsive workspace shell and typed navigation catalog; expose routes only after each feature migrates.
- [ ] Add design tokens and initial Button, Input, Dialog, Table, Badge, Toast, Skeleton, and Empty State primitives.
- [x] Restore the manifest, supplied brand icons, and theme metadata.
- [ ] Add service-worker installability and explicitly safe offline behavior.
- [x] Add a `/health` endpoint. Build/version metadata remains pending.

## Phase 2: Authentication, tenancy, and permissions

- [x] Implement login and logout with Supabase cookie sessions.
- [ ] Implement registration through the managed server path.
- [x] Implement callback exchange for PKCE, token-hash, and legacy fragment links. Registration-triggered verification email remains with registration.
- [x] Implement forgot-password and reset-password flows through Resend.
- [ ] Implement phone verification where still required.
- [ ] Implement first-owner workspace setup and the single-owner-shop guard.
- [x] Resolve active shop membership on the server and revalidate the active-shop cookie.
- [x] Protect the workspace layout and migrated resource routes.
- [x] Centralize RBAC metadata and typed CRUD operation checks.
- [ ] Prove that application RBAC and database RLS agree for all roles.
- [ ] Preserve existing Supabase users and sessions through the cutover plan.
- [x] Harden base membership/permission helpers against inactive shops and app-user profiles in a forward migration.

## Phase 3: Database boundary remediation

- [ ] Generate TypeScript database types from the live migration schema.
- [ ] Add typed query and command result contracts.
- [ ] Move remaining direct component database access behind feature data modules.
- [ ] Replace remaining `batch_name` relationship logic with `batch_id`.
- [ ] Inventory multi-step mutations still running from the client.
- [ ] Move destructive and state-changing sequences into guarded transactional RPCs or server functions.
- [ ] Add explicit idempotency behavior for retryable operations.
- [ ] Return structured result/error codes instead of generic booleans.
- [ ] Review indexes against real paging, search, reporting, and workflow queries.
- [ ] Add migration validation, staging application, backup, and recovery instructions.

## Phase 4: Pilot vertical feature - Stock Sales

- [ ] Document current Angular create, edit, close, cancel, delete, paging, search, permission, and stock-restoration behavior.
- [ ] Implement server-side initial query and typed filters.
- [ ] Implement Stock Sales feature controller and query/mutation hooks.
- [ ] Build stock-sale table, detail, form, close, cancel, and delete components.
- [ ] Reuse the existing transactional stock-sale RPCs.
- [ ] Prevent duplicate submissions and expose structured mutation outcomes.
- [ ] Add unit tests for calculations and validation.
- [ ] Add integration tests for stock reduction/restoration and tenant isolation.
- [ ] Add Playwright coverage for the complete lifecycle.
- [ ] Complete Angular/Next.js parity review and approve the reference pattern.

## Phase 5: Feature migration sequence

- [ ] Settings and Subscription.
- [ ] Clients/Customers.
- [ ] Expenses and Reports.
- [ ] Products and batch products.
- [ ] Batches.
- [ ] Orders.
- [ ] Buying List.
- [ ] Arrivals, damage allocation, and Product Tracking.
- [ ] Shipping.
- [ ] Shipping Ledger.
- [ ] Deliveries.
- [ ] Users.
- [ ] Roles and permission editor.
- [ ] Dashboard.
- [ ] Import/export workflows.

Each item above must satisfy the shared feature definition of done. Complex workflow features also require transactional integration tests before cutover.

## Phase 6: Server consolidation

- [ ] Inventory every Express endpoint, caller, authorization rule, environment variable, and side effect.
- [ ] Add runtime schemas, request-size limits, rate limits, structured errors, audit records, and correlation IDs to replacement handlers.
- [ ] Move Resend verification and password-reset delivery to server-only Next.js modules.
- [ ] Move privileged user creation/deletion and identity availability checks.
- [ ] Move shop-profile and privileged pricing operations.
- [ ] Add idempotency and webhook verification foundations for future billing.
- [ ] Verify serverless runtime compatibility for every endpoint.
- [ ] Remove frontend dependency on the Render API.
- [ ] Retire Express and Render only after production traffic and logs confirm parity.

## Phase 7: Quality, security, and operations

- [ ] Add unit tests for pure calculations, schemas, permission mapping, and reducers.
- [ ] Run Supabase/RPC integration tests against a dedicated non-production project.
- [ ] Add Playwright authentication, tenancy, RBAC, and workflow suites.
- [ ] Add CI gates for format, lint, typecheck, tests, production build, migration checks, and dependency audit.
- [ ] Add preview and staging environments that cannot use production test credentials accidentally.
- [ ] Add frontend and server exception monitoring.
- [ ] Add structured logs, correlation IDs, RPC error context, and slow-query monitoring.
- [ ] Add Resend delivery webhook/log handling without exposing message secrets.
- [ ] Review security headers, CSRF posture, cookie settings, origin validation, rate limits, and dependency alerts.
- [ ] Verify audit coverage for user, role, price, stock, batch, order, shipping payment, cancellation, and subscription changes.
- [ ] Test database backup restoration and document incident response.

## Phase 8: Production cutover and removal

- [ ] Produce a route-by-route parity matrix.
- [ ] Verify old URLs, email callbacks, bookmarks, and redirects.
- [ ] Verify PWA installation/update behavior on desktop and mobile.
- [ ] Complete full workflow smoke tests on staging with realistic data volume.
- [ ] Complete multi-shop isolation and restricted-role penetration tests.
- [ ] Run a limited production rollout with monitoring and rollback available.
- [ ] Move primary production traffic to Next.js.
- [ ] Hold the Angular deployment as a rollback artifact for the agreed window.
- [ ] Remove Angular build/deployment configuration after final approval.
- [ ] Remove the Express/Render service after final endpoint approval.
- [ ] Archive migration notes and publish the final architecture/handoff documentation.

## Deferred product work

These are valuable but should not delay the architecture foundation or first migrated workflow:

- [ ] Payment provider and automated subscription activation.
- [ ] Platform administration and promo-code management.
- [ ] Background jobs and scheduled notifications.
- [ ] Realtime operational notifications.
- [ ] Product analytics and feature flags.
- [ ] Advanced exports, data-retention controls, and customer-facing storefronts.
