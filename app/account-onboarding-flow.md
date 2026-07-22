# Account Onboarding Flow

## Goal

Define the current account model for Batch Commerce around real, verified email identities:

- the first account for a shop uses a real email address
- staff invited later also use real email addresses
- shop access remains tenant-aware through `shop_memberships`
- pending memberships stay inactive until the invited user verifies email and signs in

## Recommended Model

### Owner / First Account

- Registers with real email, password, full name, and phone number.
- Must confirm the email address before continuing shop setup.
- Signs in again after verification and completes workspace bootstrap.
- Becomes the initial owner membership for the created shop.

### Staff / Subsequent Accounts

- Added by an owner or admin from the Users page.
- Created with full name, real email, role, optional phone number, username, and password.
- Receives a verification email from Supabase.
- Stays in `pending_verification` until the email is confirmed and the user signs in successfully.

## Why This Model Fits

- Email is the most durable identity for login, recovery, and future OAuth account linking.
- It avoids fake domains and synthetic-email workarounds.
- It keeps the current `app_users` plus `shop_memberships` split intact.
- It gives admins a clear invited-versus-active state without granting access too early.

## Core Rules

1. One person should have one global identity in `auth.users` and `app_users`.
2. Shop access must be granted through `shop_memberships`, not by duplicating auth users.
3. Every new human account should have a real email address.
4. `pending_verification` memberships must stay inactive until the user verifies email and signs in.
5. Phone numbers are optional contact data for now, not the primary authentication factor.

## Lifecycle

### A. Owner Registration

1. User opens the setup flow.
2. User enters:
   - full name
   - email
   - phone number
   - password
3. System signs the user up with Supabase email/password auth.
4. Supabase sends the confirmation email.
5. User confirms the email outside the app.
6. User signs in again.
7. App routes the user back into setup.
8. User creates the shop and receives the owner membership.

### B. Staff Invitation

1. Owner or admin opens Users.
2. Admin enters:
   - full name
   - email
   - username
   - role
   - password
   - optional phone number
3. System creates the auth user with email/password.
4. System creates the `app_users` row.
5. System creates a `pending_verification` shop membership.
6. Supabase sends a verification email.
7. Users page shows the member immediately as pending.

### C. Staff Activation

1. Staff opens the verification email.
2. Supabase marks the email as confirmed.
3. Staff signs in with email and password.
4. App detects the pending membership and activates it on first successful login.
5. User enters the app with the assigned role permissions.

### D. Daily Login

1. User enters email or username plus password.
2. Username is resolved to the stored email where available.
3. System authenticates with Supabase.
4. App loads the active `shop_membership`.
5. App restores the active shop context.

### E. Recovery and Future Identity Expansion

- Password reset should remain email-based.
- OAuth can be added later as an additional sign-in method bound to the same email identity.
- Phone can stay as profile/contact data unless the product later needs MFA or delivery OTP flows.

## Recommended Account States

### Membership State

- `pending_verification`
- `active`
- `suspended`
- `removed`

`pending_verification` is the important state for onboarding because it keeps a membership visible to admins without granting access yet.

## Data Model Guidance

### Existing Tables to Keep Using

- `app_users`
- `shop_memberships`
- `roles`

### Data That Should Exist Per User

In `app_users`:

- `id`
- `auth_id`
- `full_name`
- `email`
- `username`
- `phone`
- `invited_by`
- `created_at`
- `updated_at`

### Data That Should Exist Per Membership

In `shop_memberships`:

- `shop_id`
- `app_user_id`
- `auth_user_id`
- `role_id`
- `is_active`
- `membership_status`
- `invited_at`
- `accepted_at`
- `invited_by`

## UX Flow Recommendation

### Setup Page

- Keep owner registration email-first.
- Explain clearly that email verification is required before shop setup continues.
- Keep phone collection for owner contact and recovery context.

### Users Page

- Require email for new invites.
- Keep phone optional.
- Show membership state badges:
  - pending verification
  - active
  - suspended
- Offer resend verification email for pending members.

### Login Page

- Primary login: email plus password.
- Keep username as a convenience alias where the email can be resolved cleanly.
- Do not position phone as the primary sign-in identity for new accounts.

## Security Notes

- Do not grant operational access to pending members before verification succeeds.
- Do not create duplicate identities for the same person just because they join another shop.
- Do not update app-only email fields without keeping auth identity in sync.
- Email verification is now the trust gate for onboarding; phone validation alone is not enough.

## Current Decisions

1. Owner onboarding uses real email plus password, with phone collected during setup.
2. Staff onboarding uses real email plus password, with optional phone for profile/contact use.
3. Membership activation happens on first successful login after email verification.
4. OAuth is a later phase, not part of the current implementation slice.

## Natural Next Steps

1. Add a proper email-change flow so auth email and `app_users.email` stay synchronized.
2. Add password reset UX and copy that match the verified-email model.
3. Add Google or Microsoft OAuth only after email-first onboarding is stable in production.
