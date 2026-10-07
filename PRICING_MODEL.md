# BatchCommerce Pricing Model

BatchCommerce uses one flat monthly subscription for every shop.

## Price

**GHS 70 per month**

The price does not change with sales volume, team size, or feature usage. There are no Starter, Growth, Pro, usage-band, or feature-tier accounts.

Every active subscriber receives:

- The complete preorder and stock-sales workflows.
- Unlimited sales records.
- Product, client, receipt, reporting, shipping, delivery, role, and staff features.
- The same product experience regardless of shop size.

## Why the flat subscription fits BatchCommerce

BatchCommerce records payments that merchants often collect manually through cash, Mobile Money, or bank transfers. Percentage and per-order pricing would encourage merchants to move transactions outside the system or under-report activity.

A GHS 70 flat subscription provides:

- Predictable cost for merchants.
- Predictable recurring revenue for BatchCommerce.
- No usage anxiety or incentive to hide sales.
- Simple product messaging and payment administration.
- Equal access for small and high-volume shops.

## New-shop promotion

New shop owners receive two months of free access. After the promotion expires, the shop must have `subscription_status = 'active'` to create new preorder orders or stock sales.

Promotion guardrails remain:

- One shop per owner account.
- Device identification as a secondary abuse signal.
- Clear expiry information in the application.
- Server-side subscription enforcement on sales-record creation.

## Promo codes

Promo codes may:

- Extend a shop's promotional access by a configured number of days.
- Record a discount percentage against the GHS 70 subscription for a future billing workflow.
- Enforce activation windows and maximum redemption counts.
- Be redeemed only once per shop.

Promo codes cannot change a shop's account level because account tiers no longer exist. Code creation remains restricted to database or platform administrators until a secure platform-admin interface is introduced.

## Usage reporting

Monthly sales records are still counted for operational reporting, but they never change subscription price or product access.

A monthly sales record is:

- One preorder/customer order in `orders`.
- One direct stock sale in `stock_sales`.

Order items, stock-sale line items, products, clients, buying-list rows, arrivals, shipping, deliveries, tracking, and ledger records are not counted as sales records.

## Implementation rules

- `subscription_status` determines access after the promotion ends.
- `promo_ends_at` determines the free-access expiry date.
- Every active subscription costs GHS 70 per month and has unlimited usage.
- The legacy `subscription_plan` database field is retained temporarily as a compatibility marker and is constrained to `standard`.
- The legacy promo `plan_override` field is retained temporarily for API compatibility and is constrained to `NULL`.
- Settings and Subscription show status, the GHS 70 price, promotional expiry, and informational monthly usage without tier recommendations.
- Payment collection and subscription activation remain separate follow-up work. Until automated payments exist, authorized administrators activate a paid subscription by updating `subscription_status` to `active`.
