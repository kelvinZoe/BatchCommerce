# BatchCommerce Architecture

This document is the canonical architecture note for the current app. Older docs may still mention SQLite, Electron-first packaging, `clients`, or `order_batches`; treat those as historical unless this file says otherwise.

## Current Shape

BatchCommerce is a Supabase-backed Angular 17 application for WhatsApp preorder commerce. The Angular SPA in `app/` is the primary client. The Express service in `server/` is a protected admin API for privileged operations that must not run in the browser, such as Supabase Auth admin actions.

The app is multi-shop/tenant-aware. Tenant-owned tables use `shop_id`, Supabase RLS is the primary isolation boundary, and service-layer shop scoping is defense in depth.

## Canonical Names

- UI language may say **Clients** because that is friendlier for shop staff.
- Database and service internals should use `customers` and `customer_id`.
- The canonical batch table is `batches`.
- Do not introduce new `order_batches` references.
- Use `batch_id` for new relationships.
- `batch_name` is a legacy/display compatibility field in shipping and delivery areas until a migration fully moves those flows to `batch_id`.

## Main Runtime Boundaries

- `app/src/app/pages/` contains route-level Angular screens.
- `app/src/app/components/` contains reusable UI primitives such as tables, modals, batch cards, and stat cards.
- `app/src/app/services/supabase.service.ts` owns the browser Supabase client.
- `app/src/app/services/auth.service.ts` owns session, shop context, users, roles, and permissions for now.
- `app/src/app/models/index.ts` contains the canonical RBAC resource catalog, navigation metadata, CRUD action type, and page-specific permission config models.
- `app/src/app/services/supabase-data-access.service.ts` owns shared Supabase data-access helpers, including tenant scoping and snake_case/camelCase mapping.
- `app/src/app/services/database.service.ts` is the current compatibility data-access facade. It delegates extracted domains while pages are migrated gradually.
- `app/src/app/services/client-data.service.ts` is the first extracted domain data service behind the facade.
- `server/index.js` owns privileged admin/server-only operations.
- `supabase/migrations/` is the incremental database migration path.
- `app/supabase-migration-multishop-reset.sql` is the current reference/reset schema, not a replacement for incremental migrations.
- `app/DATABASE-HARDENING.md` tracks Phase 3 database/tenancy cleanup notes.

## Canonical Business Flow

1. Create a batch in `batches`.
2. Add batch-specific products/prices in `batch_products`, optionally seeded from `products`.
3. Capture paid customer orders in `orders` and `order_items`.
4. Close the batch and generate/maintain `buying_list` rows by product.
5. Move ordered products into `arrival_items` when they arrive.
6. Confirm arrivals, handle shortages through damage/follow-up flows, and update stock where appropriate.
7. Track product shipping details and fees.
8. Use shipping ledger records to collect customer shipping payments.
9. Send paid customers to `deliveries` and track delivery status.
10. Sell available stock through stock-sales flows without sending those sales through the preorder buying-list pipeline.

## Cleanup Rules For Future Work

- Prefer `batch_id` joins over `batch_name` lookups for new code.
- Keep `batch_name` only as display text or migration compatibility.
- Prefer `customers` in models/services/database code and map to “Clients” at the UI edge.
- Add new pages and permission resources through the canonical RBAC catalog before wiring routes, nav, or role UI controls.
- Any direct `this.sb.from(...)` call in data services should be checked for `scopeShopQuery(...)` unless it targets non-tenant data.
- New destructive operations should delete child tables first and always scope by `shop_id`.
- Do not put service-role keys or privileged Supabase admin calls in the Angular app.
- Keep generated files (`dist/`, `.angular/`, `release/`, `.temp/`) out of git.

## Known Transitional Areas

- `DatabaseService` still mixes many domains and contains legacy compatibility code. Phase 4 has started with shared data-access plumbing and `ClientDataService`; continue extracting one domain at a time behind the facade.
- `AuthService` still mixes session, workspace, users, roles, verification, admin API, and permission checking. Phase 5 has started with a canonical resource/nav catalog, generic page-operation checks, and a broader Roles workbench driven by the configured page/action model; continue extracting auth domains behind the existing service facade.
- Shipping, shipping ledger, damage allocation, and delivery flows still carry `batch_name` compatibility paths. Phase 3 added/verified the database-side `batch_id` shape for damage allocation and shipping cleanup paths; Phase 4 should simplify service code further.
- UI resources are named `clients`, while database resources are `customers`. This is acceptable if the mapping stays explicit.
