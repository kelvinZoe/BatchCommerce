# Database Hardening Notes

This note tracks the Phase 3 database/tenancy cleanup work.

## Sources Of Truth

- `supabase/migrations/` is the incremental migration path used by Supabase.
- `app/supabase-migration-multishop-reset.sql` is a reference/reset schema for the current multishop shape.
- `supabase/migrations/20260318091337_remote_schema.sql` is currently empty, so it should not be treated as a trustworthy baseline schema.

## Phase 3 Migration

`supabase/migrations/20260610120000_database_tenancy_hardening.sql` adds an idempotent hardening layer for the current live schema:

- Ensures the `has_shop_membership(shop_id)` RLS helper exists.
- Creates/repairs `damage_order_allocations`, including tenant, batch, product, client, audit, and undo metadata columns.
- Backfills damage allocation tenant/batch metadata from related order rows where possible.
- Reasserts product stock-pricing columns expected by the Angular app.
- Ensures and backfills `batch_id` on legacy shipping fee, payment, and batch-total rows where the batch can be matched by shop/name.
- Adds tenant and workflow indexes for common batch, product, order, shipping, delivery, stock, role, and damage allocation queries.
- Enables RLS and read/write policies for `damage_order_allocations`.
- Attaches standard updated/shop/actor triggers to `damage_order_allocations` when the trigger helper functions exist.
- Adds `NOT VALID` check constraints for key status fields so new/updated rows stay inside app-supported enums without blocking existing historical rows.

This migration is meant to harden an existing project schema. It is not a complete empty-database bootstrap by itself.

`supabase/migrations/20260610123000_fix_updated_at_trigger_columns.sql` follows up by adding missing `updated_at` columns to tables that already had `update_updated_at` triggers attached.

## Reset Schema Updates

`app/supabase-migration-multishop-reset.sql` now includes:

- Product-level stock sale pricing defaults.
- The `damage_order_allocations` table.
- Nullable `batch_id` support on shipping batch totals.
- Indexes, updated-at trigger, shop/actor triggers, RLS enablement, and policies for `damage_order_allocations`.

## Remaining Transitional Areas

- Shipping fees, shipping payments, shipping batch totals, delivery records, and damage allocation flows still carry `batch_name` for compatibility and display.
- New code should prefer `batch_id` and only use `batch_name` as display or legacy cleanup fallback.
- A later cleanup should finish converting shipping batch totals from name-keyed uniqueness to a `batch_id` relationship before service code fully drops name-based paths.
- No live Supabase migration was applied from this repo cleanup pass; apply and verify migrations through the project's normal Supabase deployment process.
