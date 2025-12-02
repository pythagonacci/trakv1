# Stripe Connect Integration - Quick Start

## Overview

Trak uses **Stripe Connect Express Accounts** so workspaces can accept payments directly from clients without Trak processing funds.

## Architecture Summary

```
Workspace → Stripe Connect Account → Client Payment
                                    ↓
                              Funds go directly to workspace
```

## Database Tables Needed

1. `stripe_connect_accounts` - Stores workspace Stripe account info
2. `invoices` - Stores invoices/payment requests
3. `payments` - Stores payment records (from webhooks)
4. `stripe_webhook_events` - Logs webhook events

## Implementation Phases

### ✅ Phase 1: Connect Account Setup
- [ ] Create database tables (migrations)
- [ ] Install Stripe SDK
- [ ] Add environment variables
- [ ] Build Connect account creation flow
- [ ] Build Connect status page
- [ ] Test onboarding flow

### ✅ Phase 2: Invoice Creation
- [ ] Create invoice server actions
- [ ] Build invoice creation UI
- [ ] Generate Stripe Payment Links
- [ ] Link invoices to projects/clients

### ✅ Phase 3: Webhook Handling
- [ ] Create webhook API route
- [ ] Handle payment events
- [ ] Update invoice status
- [ ] Create payment records

### ✅ Phase 4: UI & Navigation
- [ ] Add Payments section to sidebar
- [ ] Build invoice list page
- [ ] Build invoice detail page
- [ ] Add payment history view

## Quick Setup Steps

### 1. Stripe Setup

```bash
# Get your Stripe keys from https://dashboard.stripe.com
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 2. Install Dependencies

```bash
npm install stripe @stripe/stripe-js
```

### 3. Database Migration

Run SQL migrations (from STRIPE_CONNECT_INTEGRATION.md) to create tables.

### 4. Environment Variables

Add to `.env.local`:
```bash
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Key Files to Create

1. `src/app/actions/stripe-connect.ts` - Connect account management
2. `src/app/actions/invoice.ts` - Invoice creation/management
3. `src/app/api/stripe/webhook/route.ts` - Webhook handler
4. `src/app/dashboard/payments/connect/page.tsx` - Connect UI
5. `src/app/dashboard/payments/invoices/page.tsx` - Invoice list

## Payment Flow

1. **Workspace connects Stripe** → OAuth flow creates Express account
2. **Create invoice** → Invoice saved in Trak, Payment Link generated
3. **Send link to client** → Client pays via Stripe Checkout
4. **Webhook updates** → Payment status updated in Trak
5. **Workspace gets paid** → Funds go directly to workspace Stripe account

## Important Notes

- ✅ Trak never touches payment funds
- ✅ Each workspace has their own Stripe account
- ✅ Only owners/admins can manage Stripe connection
- ✅ All payment data is workspace-scoped
- ❌ Trak doesn't store credit card info
- ❌ Trak doesn't process payments

## Testing

### Stripe Test Mode
- Use test API keys (`sk_test_...`)
- Test card: `4242 4242 4242 4242`
- Any future expiry date, any CVC

### Test Webhooks Locally
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Navigation Updates

Add to sidebar (`layout-client.tsx`):
```typescript
<NavLink href="/dashboard/payments">
  <CreditCard className="h-4 w-4" />
  Payments
</NavLink>
```

## Security Checklist

- [ ] Webhook signature verification
- [ ] Workspace isolation (all queries filter by workspace_id)
- [ ] Role-based access (only owners/admins)
- [ ] HTTPS only (production)
- [ ] Idempotent webhook handling
- [ ] No card data storage

## Support

See `STRIPE_CONNECT_INTEGRATION.md` for full implementation details.


