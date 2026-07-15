# Shakhis Commerce Handoff

## Project Snapshot

Shakhis Commerce / BatchCommerce is an Angular 17 web app for managing WhatsApp preorder commerce workflows around products, clients, batches, orders, deliveries, buying lists, shipping, and stock sales.

The current canonical architecture is Supabase-backed, tenant-aware, and documented in `ARCHITECTURE.md`. Treat old SQLite/Electron-first notes as historical unless `ARCHITECTURE.md` says otherwise.

## What Is Already In Place

- Angular 17 standalone components.
- Supabase-backed database access through `DatabaseService`, with shared plumbing in `SupabaseDataAccessService`.
- Tenant-aware shop isolation with `shop_id` in tenant-owned tables; owner accounts are now guarded to one created shop, with generated device ID capture as a secondary promo-abuse signal.
- Bootstrap and Bootstrap Icons installed globally.
- Reusable modal shell component for centered, consistent dialogs.
- Shared table component with server-side paging, search, filters, action buttons, first-load skeletons, and muted refetch/search states.
- Shared batch list, batch detail header, and stat card components used by most workflow pages.
- DB-backed paging/search on the clients page.
- DB-backed paging/search/filter on the product catalog page.
- Reusable searchable select component with parent-driven DB search.

## Shared Components

### Modal Shell

`src/app/components/modal-shell/modal-shell.component.ts` is the reusable modal wrapper currently used across the newer flows. It handles:

- centered overlay layout
- size variants
- tone variants like warning and danger
- parent-supplied Bootstrap header icons
- body/footer content projection
- backdrop and Escape close behavior

### Table Component

`src/app/components/table/table.component.ts` is the shared list/table component used across the newer operational pages. It handles:

- DB-paged table display
- search rows per column
- filter dropdowns
- action button columns
- pagination controls
- local current-page sorting when needed
- initial skeleton loading inside the table
- muted/disabled existing rows during search, paging, or refetches

## Current UI Direction

The design direction is now consistent across the newer pages:

- Use the shared modal shell instead of custom overlays.
- Use the shared table for paged lists and action buttons.
- Use Bootstrap icon classes passed from the parent for modal headers.
- Keep searches and filters in the database when the list can grow.
- Preserve current-page sorting when that is the intended behavior.

## Current Work In Progress

### Phase 5: RBAC Coverage

Phase 5 is mostly implemented. Current active work has moved toward Phase 7 UI structure cleanup and Phase 8 verification.

What is now in place:

- RBAC resources, nav metadata, and CRUD/action metadata live in `src/app/models/index.ts`.
- `AuthService` exposes generic `canPerformPageOperation(resource, operation)` checks while preserving the existing page-specific helper methods.
- The Roles workbench now includes the operational pages/actions listed in `roles-list.txt`: Clients, Products, Orders, Buying List, Arrivals, Shipping, Shipping Ledger, Stock Sales, Manage Batches, and Roles.
- The Roles workbench UI was redesigned to be more compact and usable. The page picker and action builder no longer stretch to match each other's height.
- Products page action gates have been substantially wired to the new permission switches, including batch create/delete/rename, batch product add/edit/delete, closed-batch edit/delete checks, batch-product price updates, and locked price/stock fields while adding when `canEditPricesAndStockOnAdd` is off.
- Orders now has table-level delete actions plus method guards for create, add-items, delete, close, and reopen. Adding items to a closed batch requires `canEditOrderAfterBatchClosed`.
- Buying List now honors `canEditAfterSent` for moved-to-arrivals rows while keeping send-to-arrivals separately guarded.
- Arrivals now supports the stronger `canReverseToArrivals` path for sent-to-shipping items, including service cleanup of shipping queue/tracking rows.
- Shipping fee input/save actions now require shipping edit permissions.
- Shipping Ledger now allows payment edits after moving to deliveries only when `canEditAmountPaidAfterMove` is enabled.
- Manage Batches now has a rename workflow behind `canRenameBatch`.
- Stock Sales now has edit, delete/cancel, and close/finalize workflows behind `canEditSale`, `canDeleteSale`, and `canCloseSale`; delete/edit/cancel adjust product stock through `DatabaseService` where needed.
- Role-permission reads now use the config-aware permission mapping, so newly-added config flags can round-trip through the existing role editor.

Known RBAC notes:

- Shipping: `canEditShippingItem` currently participates in fee editing because the page has no broader non-fee shipping-item edit workflow yet. If a future item-edit workflow is added, split that permission more explicitly.
- Continue replacing any future admin-only or hardcoded action gates with explicit RBAC operation checks as new workflows are added.

### Products Page

The products page remains the strongest reference page for shared table/modal patterns and RBAC action gating.

What it currently does:

- Uses the shared modal shell for batch, batch-product, product, bulk delete, and price-change dialogs.
- Uses the shared table component for both batch products and catalog rows.
- Shows the product avatar circle next to the product name.
- Removes numbering from the catalog list.
- Supports DB-backed paging at 20 rows per page.
- Supports DB search on product name.
- Supports DB filter on product status through the table filter toolbar.
- Keeps batch-product list paging/search on the database as well.
- Enforces most product/batch RBAC action switches at the page level.

The catalog page currently loads from `getProductCatalogPage(page, 20, search, statusFilter)`.

### Tenant / Multi-Shop Direction

The architecture direction is:

- Put `shop_id` on every tenant-owned table.
- Enforce isolation in Supabase RLS.
- Keep service-layer shop scoping as defense in depth.
- Use `customers` in database/service internals while keeping “Clients” as the UI label.
- Use `batches` and `batch_id` as canonical relationships. Keep `batch_name` only as display/legacy compatibility until migration cleanup completes.

This is already reflected in the multishop migration path for tables like `batch_products`, `orders`, `buying_list`, and `arrival_items`.

Phase 3 added database hardening notes in `DATABASE-HARDENING.md` and an idempotent migration for damage allocation, stock-pricing columns, tenant indexes, RLS coverage, and status constraints.

Phase 4 has started. Shared Supabase query helpers and snake_case/camelCase mapping now live in `src/app/services/supabase-data-access.service.ts`, and client/customer CRUD now lives in `src/app/services/client-data.service.ts` behind the existing `DatabaseService` facade.

Phase 5 action coverage is mostly wired for the listed operational pages. The remaining RBAC work is mostly verification: smoke-test non-admin roles and replace any future hardcoded gates discovered during new workflow work.

Phase 7 has also moved forward:

- The app shell is responsive with mobile navigation behavior.
- `app-table` keeps dense tables horizontally scrollable on mobile instead of converting rows into vertical cards.
- `app-table` now shows skeleton bars for initial load and keeps existing rows visible but muted during search/page/refetch states.
- Products batch list now uses `app-batch-list-section` instead of local batch-grid/search/pagination markup.
- Settings clear-data confirmation and Expenses add/edit now use `app-modal-shell`.
- Obvious dead CSS and stale local page styles were removed after shared component migrations.
- Products, Orders, Buying List, Arrivals, Shipping, Shipping Ledger, Product Tracking, Damaged Items, and Clients use shared table/list/stat patterns in several key areas.
- Remaining visible legacy UI patterns include Deliveries, Users, Stock Sales, Expenses table layout, and several larger workflow modal overlays that can be migrated when the layout fits.

Phase 9 quality remediation has started:

- `SupabaseDataAccessService` now exposes `requireActiveShopId()` so inserts can fail early instead of writing nullable shop context.
- Product/Product Catalog create/update/delete paths now use explicit active-shop requirements and service-layer shop scoping.
- `supabase/migrations/20260710120000_add_product_delete_cascade_rpc.sql` adds guarded transactional `delete_product_catalog_cascade`, and `DatabaseService.deleteProductCatalog()` prefers it with a scoped compatibility fallback until the migration is applied.
- `supabase/migrations/20260710123000_add_batch_delete_cascade_rpc.sql` adds guarded transactional `delete_batch_cascade`, and `DatabaseService.deleteBatchCascadeById()` prefers it with the existing scoped client-side deletion as a compatibility fallback.
- `supabase/migrations/20260710130000_add_stock_sale_mutation_rpcs.sql` adds guarded transactional stock-sale create/update/cancel/delete RPCs, and `DatabaseService` now prefers them with client-side compatibility fallbacks.
- `src/app/services/batch-data.service.ts` is the first Phase 9 domain extraction behind the `DatabaseService` facade. It owns batch list/detail/create/update/open/close/delete plus RPC-first cascade deletion; workflow-heavy buying/arrivals/shipping helpers still live in `DatabaseService` for now.
- `src/app/services/product-data.service.ts` is the second Phase 9 extraction behind the facade. It owns product/catalog CRUD, batch-product CRUD, product cascade delete, price-impact preview, and batch-product price recalculation.
- `src/app/services/stock-sale-data.service.ts` is the third Phase 9 extraction behind the facade. It owns stock availability reads, stock-sale paging/detail, RPC-first stock-sale create/update/cancel/delete, close/finalize, and scoped stock-adjustment compatibility fallbacks. `DatabaseService.createStockSale()` still runs the pricing/promo guard before delegating.
- `SupabaseDataAccessService` now carries the shared `isMissingRpcError()` helper so extracted data services can keep RPC-first compatibility behavior without duplicating it.
- `npm test` now runs Node contract tests in `app/tests/sql-rpc-contract.test.js`, covering pricing-band alignment, promo-code guardrails, high-risk RPC migration contracts, and RPC-first service fallbacks.
- `app/tests/supabase-live.integration.test.js` adds an opt-in live Supabase integration harness. It is skipped by default, refuses the known production project, and requires explicit `SUPABASE_TEST_*` credentials for a dedicated test project.
- Seeded live tests now cover promo-code redemption, pricing guards, stock-sale RPC lifecycle with stock restoration, order creation, and a buying-list to arrivals workflow transition.
- `app/TESTING.md` documents the fast local contract tests and the guarded live integration-test command.
- Continue this phase by moving the next multi-step destructive workflow into an RPC/server-side function and then extracting the matching domain service.

Pricing model foundation is now implemented in code:

- `supabase/migrations/20260629124500_add_pricing_plan_usage.sql` adds shop plan/promo fields and DB triggers for monthly sales-record checks.
- `supabase/migrations/20260629130000_allow_pricing_overages.sql` changes paid tier limits into billing bands: Starter 0-40, Growth 41-120, Pro 121+, with active paid shops allowed to create overages.
- `supabase/migrations/20260630090000_add_promo_codes.sql` adds platform promo codes, one-use-per-shop redemption tracking, and the guarded `redeem_shop_promo_code` RPC.
- A monthly sales record means one `orders` row or one `stock_sales` row.
- `DatabaseService.getPricingUsage()` computes current monthly usage, promo status, remaining records, and recommended tier.
- `DatabaseService.redeemPromoCode()` applies promo codes through the RPC, then `/subscription` refreshes usage after a successful redemption.
- New preorder orders and new stock sales are guarded in the service layer before insert; Supabase triggers require promo/active status server-side but no longer block paid overages.
- Settings shows a read-only Plan & Usage card.
- `/subscription` is a dedicated subscription-status page that reuses the `settings` route permission and shows promo status, current band, monthly usage, overages, promo-code redemption, and next action guidance.
- Remaining pricing work is payment collection/admin plan-management so a shop can become `active` after promo expiry, plus a secure platform/admin promo-code creation UI if campaign management should happen inside the app.

## Important Decisions Already Made

- The custom reusable modal shell is preferred over `ngbModal` for this app.
- Product tables should stay reusable and consistent with the clients table pattern.
- DB paging/search is the right approach for growing lists.
- Current-page sorting remains local when requested.
- Searchable selects should emit search terms to the parent so the parent can query the DB.

## Key Files

- `src/app/pages/products/products.component.ts`
- `src/app/pages/roles/roles.component.ts`
- `src/app/pages/clients/clients.component.ts`
- `src/app/pages/orders/orders.component.ts`
- `src/app/pages/buying-list/buying-list.component.ts`
- `src/app/pages/arrivals/arrivals.component.ts`
- `src/app/pages/shipping/shipping.component.ts`
- `src/app/pages/shipping-ledger/shipping-ledger.component.ts`
- `src/app/pages/stock-sales/stock-sales.component.ts`
- `src/app/pages/batches/batches.component.ts`
- `src/app/components/modal-shell/modal-shell.component.ts`
- `src/app/components/table/table.component.ts`
- `src/app/components/searchable-select/searchable-select.component.ts`
- `src/app/services/database.service.ts`
- `src/app/services/supabase-data-access.service.ts`
- `src/app/services/client-data.service.ts`
- `src/app/services/batch-data.service.ts`
- `src/app/services/product-data.service.ts`
- `src/app/services/stock-sale-data.service.ts`
- `src/app/services/auth.service.ts`
- `src/app/models/index.ts`
- `roles-list.txt`
- `ARCHITECTURE.md`
- `DATABASE-HARDENING.md`
- `supabase-migration-multishop-reset.sql`
- `../supabase/migrations/20260610124500_add_stock_sales_close_state.sql`

## Current Verification State

The latest known build status:

- `npm run build` passes.
- Known warnings remain around Angular bundle/style budgets.
- The Roles component now also exceeds its style budget after the compact RBAC workbench redesign.
- Existing warnings also include the small css-inline-fonts Inter warning and one Bootstrap selector warning.
- The previous Products/Orders component style budget warnings and Deliveries optional-chain warnings were resolved during cleanup.

The current automated test suite is intentionally small:

- `npm test` runs fast local contract checks and skips live Supabase integration tests unless explicitly enabled.
- `npm run test:integration` can run the live Supabase harness when `RUN_SUPABASE_INTEGRATION_TESTS=true` and dedicated `SUPABASE_TEST_*` credentials are provided.
- Seeded live workflow tests are written but still need to be run against a dedicated Supabase test project.
- Manual smoke testing through the commerce workflow plus role-restricted accounts remains important until the live suite has been run and stabilized against test data.

## Likely Next Steps

1. Continue migrating remaining custom modal overlays to `app-modal-shell` where the layout fits.
2. Migrate table-heavy legacy pages where practical: Deliveries, Users, Stock Sales, Expenses.
3. Smoke test role-restricted users against every page in `roles-list.txt`, with special attention to destructive actions and closed-batch edits.
4. Continue Phase 9 by extracting the next low-risk `DatabaseService` domain behind the facade, likely `PricingDataService`, `DashboardDataService`, or `OrderDataService`.
5. Continue replacing legacy `batch_name` relationships with `batch_id` after the needed migrations are verified.
6. Revisit Angular style budgets after the UI refactors settle, especially `roles.component.ts`.

## Useful Run Commands

- `npm install`
- `npm start`
- `npm run dev`
- `npm run build`

## Notes For The Next Editor Session

- The app is in a good state for continuing UI structure cleanup, RBAC verification, and tenant hardening.
- The role editor can express the listed operational actions; treat any mismatch found during smoke testing as a Phase 5 cleanup bug.
- Products is the best reference implementation for page-level RBAC gates using the expanded permission config.
- If the next change needs visible impact quickly, migrate one legacy list/modal/table pattern at a time and verify with `npm run build`.
