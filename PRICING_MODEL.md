# BatchCommerce Pricing Model

BatchCommerce uses one flat monthly subscription for every shop.

## Price

**GHS 100 per month**

The price does not change with sales volume, team size, or feature usage. There are no Starter, Growth, Pro, usage-band, or feature-tier accounts.

Every active subscriber receives:

- The complete preorder and stock-sales workflows.
- Unlimited sales records.
- Product, client, receipt, reporting, shipping, delivery, role, and staff features.
- The same product experience regardless of shop size.

## Why the flat subscription fits BatchCommerce

BatchCommerce records payments that merchants often collect manually through cash, Mobile Money, or bank transfers. Percentage and per-order pricing would encourage merchants to move transactions outside the system or under-report activity.

A GHS 100 flat subscription provides:

- Predictable cost for merchants.
- Predictable recurring revenue for BatchCommerce.
- No usage anxiety or incentive to hide sales.
- Simple product messaging and payment administration.
- Equal access for small and high-volume shops.

## New-shop promotion

New shop owners receive one month of free access. After the promotion expires, a current paid entitlement or its three-day grace period is required to create new preorder orders or stock sales. Shops created before this change keep their existing promotion expiry date.

Promotion guardrails remain:

- One shop per owner account.
- Device identification as a secondary abuse signal.
- Clear expiry information in the application.
- Server-side subscription enforcement on sales-record creation.

## Promo codes

Promo codes may:

- Extend a shop's promotional access by a configured number of days.
- Apply a discount percentage to one successful GHS 100 renewal.
- Enforce activation windows and maximum redemption counts.
- Be redeemed only once per shop.

Discounts never stack. A redeemed discount is reserved for one payment attempt and consumed only when that payment succeeds. Promo codes cannot change a shop's account level because account tiers no longer exist. Code creation is restricted to the protected platform-admin console.

## Usage reporting

Monthly sales records are still counted for operational reporting, but they never change subscription price or product access.

A monthly sales record is:

- One preorder/customer order in `orders`.
- One direct stock sale in `stock_sales`.

Order items, stock-sale line items, products, clients, buying-list rows, arrivals, shipping, deliveries, tracking, and ledger records are not counted as sales records.

## Implementation rules

- The entitlement ledger and promo dates determine access. `subscription_status` remains an explicit suspension/cancellation control and compatibility field.
- `promo_ends_at` determines the free-access expiry date.
- Every active subscription costs GHS 100 per month and has unlimited usage.
- A successful payment adds one calendar month after the later of today, the promo end, or the latest non-revoked entitlement end.
- A three-day grace period follows free or paid access. Existing data remains readable after grace, but new orders and stock sales are blocked.
- Paystack payment success is accepted only after server-side reference, status, currency, and amount verification. Browser redirects never activate access by themselves.
- Manual MoMo references require platform-admin approval and use the same idempotent entitlement-granting function.
- The legacy `subscription_plan` database field is retained temporarily as a compatibility marker and is constrained to `standard`.
- The legacy promo `plan_override` field is retained temporarily for API compatibility and is constrained to `NULL`.
- Subscription shows the current access window, next charge, Paystack checkout, manual MoMo fallback, promo code, and payment history.
- `/platform-admin` provides audited shop access, payment review, and promo-code controls to platform administrators.
