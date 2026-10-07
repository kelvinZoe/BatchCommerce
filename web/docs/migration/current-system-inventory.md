# Current system migration inventory

This document is the Phase 0 baseline for the Angular-to-Next.js migration. It is based on the current Angular routes, service data access, Express handlers, and Supabase migrations. Update it whenever the legacy application changes during migration.

## Route and permission parity

| URL | Permission resource | Migration area |
| --- | --- | --- |
| `/setup` | Public | Authentication and workspace setup |
| `/login` | Public | Authentication |
| `/verify-phone` | Public | Authentication |
| `/reset-password` | Public | Authentication |
| `/auth/callback` | Public | Authentication |
| `/dashboard` | `dashboard` | Dashboard |
| `/clients` | `clients` | Clients/customers |
| `/products` | `products` | Products and batch products |
| `/orders` | `orders` | Orders |
| `/buying-list` | `buying_list` | Buying workflow |
| `/arrivals` | `arrivals` | Arrival workflow |
| `/product-tracking` | `product_tracking` | Tracking workflow |
| `/shipping` | `shipping` | Shipping |
| `/shipping-ledger` | `shipping` | Shipping ledger |
| `/deliveries` | `deliveries` | Deliveries |
| `/stock-sales` | `stock_sales` | Stock Sales pilot |
| `/damaged-items` | `damaged_items` | Damage workflow |
| `/reports` | `reports` | Reports |
| `/expenses` | `expenses` | Expenses |
| `/import` | `import` | Import |
| `/batches` | `batches` | Batch administration |
| `/users` | `users` | User administration |
| `/roles` | `roles` | RBAC administration |
| `/subscription` | `settings` | Subscription |
| `/settings` | `settings` | Workspace settings |

The typed catalog in `src/lib/auth/resources.ts` is the Next.js source of truth. `shipping` intentionally owns two routes and `settings` intentionally owns both settings and subscription.

## Current database ownership

| Angular service | Main tables or operations | Target boundary |
| --- | --- | --- |
| `auth.service` | shops, memberships, app users, roles, permissions, workspace bootstrap | Server auth/workspace module; retain bootstrap RPC |
| `client-data.service` | customers | Feature query and server mutation module |
| `product-data.service` | products, batch products, order/stock references | Feature queries; retain cascade-delete RPC |
| `order-data.service` | orders, items, customers, batches, buying list, damage allocations | Server commands plus transactional workflow RPCs where needed |
| `batch-data.service` | broad batch, arrival, order, shipping, delivery, damage, and stock-sale graph | Split by feature; retain cascade-delete RPC |
| `shipping-data.service` | shipping fees/payments, deliveries, batches, customers, damage allocations | Feature query/command modules |
| `shipping-workflow.service` | arrival-to-shipping and paid-client-to-delivery transitions | Retain transactional RPCs |
| `stock-sale-data.service` | stock sales/items/products | Pilot feature; retain all mutation RPCs |
| `pricing-data.service` | flat subscription, usage, orders, stock sales, promo redemption | Server subscription module; retain redemption RPC and GHS 70 flat-price rule |
| `dashboard-data.service` | dashboard aggregates and damage allocations | Server-side read model |
| `database.service` | cross-feature legacy facade | Remove incrementally; no equivalent catch-all in Next.js |
| `supabase-data-access.service` | batches | Replace with the owning feature query module |

The setup page is the only current page with a direct Supabase table call (`app_users`). It must move behind the server workspace boundary. Other direct `.from(...)` search hits in pages/components are JavaScript `Array.from(...)`, not database access.

## Call classification

- **Safe browser reads:** caller-scoped, tenant-filtered, RLS-protected live refreshes that genuinely benefit from a browser client. Default initial reads still belong in Server Components.
- **Safe browser CRUD:** none are approved by default. A mutation may remain browser-to-Supabase only after explicit tenant, RBAC, validation, audit, and retry review.
- **Privileged server operations:** user administration, identity availability, verification email, password reset email, shop profile administration, and privileged price changes.
- **Transactional workflows:** workspace bootstrap, product/batch cascade deletion, promo redemption, stock-sale create/update/cancel/delete, arrivals-to-shipping, and paid-client-to-deliveries.

Existing transactional RPCs:

- `bootstrap_shop_workspace`
- `delete_product_catalog_cascade`
- `delete_batch_cascade`
- `redeem_shop_promo_code`
- `create_stock_sale_with_items`
- `update_stock_sale_with_items`
- `cancel_stock_sale_with_stock_restore`
- `delete_cancelled_stock_sale`
- `send_confirmed_arrivals_to_shipping`
- `send_confirmed_arrival_item_to_shipping`
- `send_paid_client_to_deliveries`

## Express replacement inventory

| Endpoint | Classification | Next.js owner |
| --- | --- | --- |
| `POST /public/register` | Public, rate-limited identity/workspace operation | Auth server action/route handler |
| `POST /public/password-reset` | Public Resend delivery | Auth route handler |
| `POST /admin/create-user` | Privileged identity operation | Users server command |
| `POST /admin/user-availability` | Privileged identity lookup | Users server query |
| `POST /admin/resend-verification` | Privileged Resend delivery | Users server command |
| `DELETE /admin/delete-user/:authId` | Destructive privileged operation | Users server command |
| `POST /admin/update-shop-profile` | Privileged workspace operation | Settings server command |
| `POST /admin/update-batch-product-price` | Privileged cross-table mutation | Products server command/RPC |
| `POST /admin/preview-price-change` | Privileged impact query | Products server query |

## Naming rules

- Database and TypeScript domain name: `customers`; user-facing label: **Clients**.
- `batches` and `batch_id` are canonical. Do not add relationships based on `batch_name`.
- Permission keys use the existing snake_case `AppResource` values.
- Route slugs remain compatible with current bookmarked URLs.
- Feature modules own their queries and commands; there will be no generic replacement for `database.service`.

## Cutover and rollback rules

1. Migrate a complete route behind its existing URL and prove role, tenant, workflow, responsive, and accessibility parity.
2. Deploy to preview, then staging, then a limited production cohort. Record errors, latency, and mutation outcomes.
3. Keep the last verified Angular deployment and its compatible Express service available throughout the rollback window.
4. Do not ship a database migration that makes the live Angular route incompatible before that route's rollback window closes.
5. Roll back traffic—not data—when application behavior fails. Use forward database fixes unless an explicitly tested down migration is safe.
6. Retire a legacy route or endpoint only after production traffic and logs show the Next.js replacement is healthy and no callers remain.
