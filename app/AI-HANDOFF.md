# Shakhis Commerce Handoff

## Project Snapshot

Shakhis Commerce is an Angular + Electron desktop app for managing commerce workflows around products, clients, batches, orders, deliveries, buying lists, and inventory-style operations.

The current work has moved the app toward a shared Supabase-backed, tenant-aware architecture with reusable UI primitives. The README still describes the older local-storage / SQLite-oriented shape in a few places, so treat this document as the current working state.

## What Is Already In Place

- Angular 17 standalone components.
- Electron shell with Angular dev startup through `npm run electron:dev`.
- Supabase-backed database access in `DatabaseService`.
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

### Products Page

The products page is the main active area.

What it currently does:

- Uses the shared modal shell for batch, batch-product, product, bulk delete, and price-change dialogs.
- Uses the shared table component for both batch products and catalog rows.
- Shows the product avatar circle next to the product name.
- Removes numbering from the catalog list.
- Supports DB-backed paging at 20 rows per page.
- Supports DB search on product name.
- Supports DB filter on product status through the table filter toolbar.
- Keeps batch-product list paging/search on the database as well.

The catalog page currently loads from `getProductCatalogPage(page, 20, search, statusFilter)`.

### Tenant / Multi-Shop Direction

The longer-term architecture direction is:

- Put `shop_id` on every tenant-owned table.
- Enforce isolation in Supabase RLS.
- Keep service-layer shop scoping as defense in depth.

This is already reflected in the multishop migration path for tables like `batch_products`.

## Important Decisions Already Made

- The custom reusable modal shell is preferred over `ngbModal` for this app.
- Product tables should stay reusable and consistent with the clients table pattern.
- DB paging/search is the right approach for growing lists.
- Current-page sorting remains local when requested.
- Searchable selects should emit search terms to the parent so the parent can query the DB.

## Key Files

- `src/app/pages/products/products.component.ts`
- `src/app/pages/clients/clients.component.ts`
- `src/app/components/modal-shell/modal-shell.component.ts`
- `src/app/components/table/table.component.ts`
- `src/app/components/searchable-select/searchable-select.component.ts`
- `src/app/services/database.service.ts`
- `src/app/models/index.ts`
- `supabase-migration-multishop-reset.sql`

## Current State of the Products Page

The products page now has:

- Shared table actions matching the client page style.
- Search on the product-name column.
- Avatar circle beside product names.
- 20-per-page DB pagination.
- DB-backed status filtering.
- Shared modal shell across all dialogs.

Remaining work, if any, is mostly cleanup and extension to the other pages.

## Likely Next Steps

1. Continue the shared modal rollout to the remaining pages that still use custom overlays.
2. Apply the same DB paging/search pattern to the rest of the large list pages.
3. Finish tenant hardening on any remaining tenant-owned tables that still rely on service-layer checks.
4. Review the README so it matches the current Supabase-first direction.
5. Convert any remaining custom page-specific tables to the shared table component where the layout fits.
6. Revisit the products page once more for final UI cleanup and remove any leftover custom table styles that are now redundant.
7. Update the products table filters or action labels if any edge-case behavior appears during real usage.

## Useful Run Commands

- `npm install`
- `npm start`
- `npm run electron:dev`
- `npm run build`
- `npm run dist`

## Notes For The Next Editor Session

- The app is in a good state for continuing UI cleanup and tenant hardening.
- The current active list page work is centered on the products page and its shared table/modal behavior.
- If you need the next change to be visible in the UI quickly, prioritize the products and clients pages first because the shared patterns are already in place there.