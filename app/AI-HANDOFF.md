# Shakhis Commerce Handoff

## Project Snapshot

Shakhis Commerce / BatchCommerce is an Angular 17 web app for managing WhatsApp preorder commerce workflows around products, clients, batches, orders, deliveries, buying lists, shipping, and stock sales.

The current canonical architecture is Supabase-backed, tenant-aware, and documented in `ARCHITECTURE.md`. Treat old SQLite/Electron-first notes as historical unless `ARCHITECTURE.md` says otherwise.

## What Is Already In Place

- Angular 17 standalone components.
- Supabase-backed database access through `DatabaseService`, with shared plumbing in `SupabaseDataAccessService`.
- Multi-shop tenancy with `shop_id` in tenant-owned tables.
- Bootstrap and Bootstrap Icons installed globally.
- Reusable modal shell component for centered, consistent dialogs.
- Shared table component with server-side paging, search, filters, and action buttons.
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

`src/app/components/table/table.component.ts` is the shared list/table component used by the clients page and the products page. It handles:

- DB-paged table display
- search rows per column
- filter dropdowns
- action button columns
- pagination controls
- local current-page sorting when needed

## Current UI Direction

The design direction is now consistent across the newer pages:

- Use the shared modal shell instead of custom overlays.
- Use the shared table for paged lists and action buttons.
- Use Bootstrap icon classes passed from the parent for modal headers.
- Keep searches and filters in the database when the list can grow.
- Preserve current-page sorting when that is the intended behavior.

## Current Work In Progress

### Phase 5: RBAC Coverage

The current active area is Phase 5: making role permissions match the real operational pages.

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
- Stock Sales now has edit and delete workflows behind `canEditSale` and `canDeleteSale`; delete/edit adjust product stock through `DatabaseService`.
- Role-permission reads now use the config-aware permission mapping, so newly-added config flags can round-trip through the existing role editor.

Known RBAC gaps that still need wiring:

- Stock Sales: `canCloseSale` now has a schema migration in `supabase/migrations/20260610124500_add_stock_sales_close_state.sql`, but the close/finalize UI and service method still need to be wired after the migration is applied.
- Shipping: `canEditShippingItem` currently participates in fee editing because the page has no broader non-fee shipping-item edit workflow yet. If a future item-edit workflow is added, split that permission more explicitly.

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

Phase 5 action coverage is mostly wired for the listed operational pages. The remaining RBAC work is the Stock Sales close/finalize workflow after the close-state migration is applied, plus any future hardcoded action gates discovered during smoke testing.

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
- Existing warnings also include the small css-inline-fonts Inter warning, one selector warning, and optional-chain warnings in deliveries.

No test suite has been established yet, so the important safety net is still manual smoke testing through the full commerce workflow plus role-restricted accounts.

## Likely Next Steps

1. Apply the stock sale close-state migration, then wire the Stock Sales close/finalize workflow behind `canCloseSale`.
2. Smoke test role-restricted users against every page in `roles-list.txt`, with special attention to destructive actions and closed-batch edits.
3. Continue Phase 4 by extracting the next low-risk `DatabaseService` domain behind the facade.
4. Continue replacing legacy `batch_name` relationships with `batch_id` after the needed migrations are verified.
5. Continue the shared modal/table rollout to remaining pages where the layout fits.
6. Revisit Angular style budgets after the UI refactors settle, especially `roles.component.ts`.

## Useful Run Commands

- `npm install`
- `npm start`
- `npm run dev`
- `npm run build`

## Notes For The Next Editor Session

- The app is in a good state for continuing RBAC enforcement and tenant hardening.
- The role editor can now express more actions than several pages can enforce. Treat that mismatch as the main Phase 5 cleanup target.
- Products is the best reference implementation for page-level RBAC gates using the expanded permission config.
- If the next change needs visible impact quickly, wire one missing permission at a time and verify it with a non-admin role.
