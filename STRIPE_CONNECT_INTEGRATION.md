# Stripe Connect Integration Guide for Trak

## Overview

This document outlines how to integrate Stripe Connect into Trak, enabling workspaces to accept payments from clients without Trak processing or facilitating the payments directly. Stripe Connect allows each workspace to have their own Stripe account while Trak acts as the platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Trak Platform                        │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  Workspace A │ ──────▶ │ Stripe       │                  │
│  │  (Connected) │         │ Connect      │                  │
│  └──────────────┘         │ Account A    │                  │
│                           └──────────────┘                  │
│                                  │                           │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  Workspace B │ ──────▶ │ Stripe       │                  │
│  │  (Connected) │         │ Connect      │                  │
│  └──────────────┘         │ Account B    │                  │
│                           └──────────────┘                  │
│                                  │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Stripe         │
                          │  Payment        │
                          │  Processing     │
                          └─────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  Client         │
                          │  (Pays)         │
                          └─────────────────┘
```

## Key Concepts

### Stripe Connect Account Types

**Recommended: Express Accounts**
- Workspaces connect via OAuth flow
- Stripe handles KYC/verification
- Workspaces access their Stripe dashboard
- Trak doesn't handle sensitive financial data
- Easier compliance (Stripe handles most of it)

### Payment Flow

1. **Workspace connects** Stripe account via OAuth
2. **Invoice/Payment Request created** in Trak for a project/client
3. **Payment link generated** using workspace's Stripe account
4. **Client pays** via Stripe Checkout or Payment Links
5. **Webhook updates** invoice status in Trak
6. **Workspace receives payment** directly to their Stripe account

### Trak's Role

- ✅ Facilitate Stripe Connect account creation
- ✅ Store invoice/payment request data
- ✅ Generate payment links
- ✅ Track payment status
- ✅ Display payment history
- ❌ Never touch actual payment funds
- ❌ Never store credit card information

---

## Database Schema

### New Tables

#### 1. `stripe_connect_accounts`
Stores Stripe Connect account information for workspaces.

```sql
CREATE TABLE stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE, -- Stripe Connect account ID (acct_xxx)
  account_type TEXT NOT NULL DEFAULT 'express', -- 'express' | 'standard' | 'custom'
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  email TEXT, -- Account email from Stripe
  country TEXT, -- Account country
  default_currency TEXT DEFAULT 'usd',
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  onboarding_url TEXT, -- URL to complete onboarding if incomplete
  dashboard_url TEXT, -- Link to Stripe Dashboard
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id) -- One Stripe account per workspace
);

CREATE INDEX idx_stripe_connect_workspace ON stripe_connect_accounts(workspace_id);
CREATE INDEX idx_stripe_connect_account_id ON stripe_connect_accounts(stripe_account_id);
```

#### 2. `invoices`
Stores invoices/payment requests created in Trak.

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number TEXT NOT NULL, -- Human-readable invoice number (e.g., INV-001)
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
  
  -- Amounts
  amount DECIMAL(10, 2) NOT NULL, -- Total amount in cents (stored as dollars)
  currency TEXT NOT NULL DEFAULT 'usd',
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL, -- Final amount after tax/discount
  
  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment information
  stripe_payment_intent_id TEXT, -- Stripe PaymentIntent ID
  stripe_checkout_session_id TEXT, -- Stripe Checkout Session ID
  stripe_payment_link_id TEXT, -- Stripe Payment Link ID
  payment_link_url TEXT, -- Public URL for client to pay
  
  -- Line items stored as JSONB (flexible)
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {description, quantity, unit_price, amount}
  
  -- Notes
  notes TEXT,
  terms TEXT, -- Payment terms
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, invoice_number) -- Unique invoice number per workspace
);

CREATE INDEX idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
```

#### 3. `payments`
Stores payment records (from Stripe webhooks).

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Stripe information
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT, -- Connect transfer ID
  
  -- Amount
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  application_fee_amount DECIMAL(10, 2) DEFAULT 0, -- Platform fee (if any)
  
  -- Payment details
  payment_method TEXT, -- 'card' | 'ach' | 'etc'
  status TEXT NOT NULL, -- 'succeeded' | 'pending' | 'failed' | 'refunded'
  
  -- Dates
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_workspace ON payments(workspace_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);
```

#### 4. `stripe_webhook_events`
Logs Stripe webhook events for debugging and idempotency.

```sql
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id), -- May be null for platform events
  stripe_account_id TEXT, -- Connect account ID if Connect event
  
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_stripe_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX idx_webhook_events_workspace ON stripe_webhook_events(workspace_id);
```

### Updates to Existing Tables

#### `workspaces`
Add optional Stripe Connect account reference (already handled by foreign key).

#### `projects`
Optional: Add invoice-related fields if needed:
- `invoice_template_id` (future: reusable invoice templates)
- `billing_method` (e.g., 'fixed', 'hourly', 'milestone')

---

## Stripe Connect Setup

### 1. Stripe Account Setup

1. **Create Stripe Account** (if not already)
   - Go to https://dashboard.stripe.com
   - Complete business verification

2. **Enable Connect**
   - Dashboard → Settings → Connect
   - Choose account type (Express recommended)
   - Get API keys

3. **Get API Keys**
   - Dashboard → Developers → API keys
   - You'll need:
     - **Publishable key** (pk_live_xxx or pk_test_xxx)
     - **Secret key** (sk_live_xxx or sk_test_xxx)
     - **Webhook signing secret** (whsec_xxx)

### 2. Environment Variables

Add to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Connect Settings
STRIPE_CONNECT_REDIRECT_URI=http://localhost:3000/api/stripe/connect/callback
NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID=ca_xxx # Optional for OAuth
```

### 3. Install Dependencies

```bash
npm install stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

---

## Implementation Steps

### Phase 1: Stripe Connect Account Creation

#### 1.1 Server Actions

Create `src/app/actions/stripe-connect.ts`:

```typescript
"use server";

import Stripe from "stripe";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Create Stripe Connect account for workspace (Express account)
 */
export async function createConnectAccount(workspaceId: string) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Check if user is workspace owner/admin
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only workspace owners and admins can connect Stripe" };
  }

  // Check if account already exists
  const { data: existing } = await supabase
    .from("stripe_connect_accounts")
    .select("id, stripe_account_id, onboarding_complete")
    .eq("workspace_id", workspaceId)
    .single();

  if (existing) {
    // Return existing account info
    if (existing.onboarding_complete) {
      return {
        error: "Stripe account already connected and onboarded",
        data: existing,
      };
    }
    // Return onboarding URL if incomplete
    const account = await stripe.accounts.retrieve(existing.stripe_account_id);
    const accountLink = await stripe.accountLinks.create({
      account: existing.stripe_account_id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payments/connect?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payments/connect?success=true`,
      type: "account_onboarding",
    });
    return { data: { onboarding_url: accountLink.url } };
  }

  // Create new Express account
  const account = await stripe.accounts.create({
    type: "express",
    country: "US", // Default, can be made dynamic
    email: user.email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payments/connect?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payments/connect?success=true`,
    type: "account_onboarding",
  });

  // Save to database
  const { data: connectAccount, error: dbError } = await supabase
    .from("stripe_connect_accounts")
    .insert({
      workspace_id: workspaceId,
      stripe_account_id: account.id,
      account_type: "express",
      email: user.email || null,
    })
    .select()
    .single();

  if (dbError) {
    // Rollback Stripe account creation
    await stripe.accounts.del(account.id);
    return { error: `Database error: ${dbError.message}` };
  }

  revalidatePath("/dashboard/payments");
  return { data: { onboarding_url: accountLink.url, account_id: account.id } };
}

/**
 * Get Connect account status for workspace
 */
export async function getConnectAccountStatus(workspaceId: string) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase } = authResult;

  // Check membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authResult.user.id)
    .single();

  if (!membership) {
    return { error: "Not a workspace member" };
  }

  // Get Connect account
  const { data: account } = await supabase
    .from("stripe_connect_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (!account) {
    return { data: null }; // No account connected
  }

  // Refresh status from Stripe
  const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

  // Update database with latest status
  await supabase
    .from("stripe_connect_accounts")
    .update({
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
      details_submitted: stripeAccount.details_submitted,
      onboarding_complete:
        stripeAccount.charges_enabled && stripeAccount.details_submitted,
      dashboard_url: `https://dashboard.stripe.com/connect/accounts/${stripeAccount.id}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return {
    data: {
      ...account,
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
      details_submitted: stripeAccount.details_submitted,
      onboarding_complete:
        stripeAccount.charges_enabled && stripeAccount.details_submitted,
    },
  };
}

/**
 * Get Stripe Dashboard login link for workspace
 */
export async function getDashboardLoginLink(workspaceId: string) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase } = authResult;

  // Verify membership and role
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authResult.user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only owners and admins can access Stripe dashboard" };
  }

  // Get Connect account
  const { data: account } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!account) {
    return { error: "No Stripe account connected" };
  }

  // Create login link
  const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);

  return { data: { url: loginLink.url } };
}
```

#### 1.2 Connect UI Page

Create `src/app/dashboard/payments/connect/page.tsx`:

```typescript
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getConnectAccountStatus, createConnectAccount, getDashboardLoginLink } from "@/app/actions/stripe-connect";
import ConnectAccountClient from "./connect-account-client";

export default async function ConnectPage() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return <div>No workspace selected</div>;
  }

  const accountStatus = await getConnectAccountStatus(workspaceId);
  
  return (
    <ConnectAccountClient
      workspaceId={workspaceId}
      initialAccountStatus={accountStatus.data}
    />
  );
}
```

Create `src/app/dashboard/payments/connect/connect-account-client.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createConnectAccount, getDashboardLoginLink } from "@/app/actions/stripe-connect";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Loader2, AlertCircle } from "lucide-react";

export default function ConnectAccountClient({
  workspaceId,
  initialAccountStatus,
}: {
  workspaceId: string;
  initialAccountStatus: any;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    
    const result = await createConnectAccount(workspaceId);
    
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    
    if (result.data?.onboarding_url) {
      // Redirect to Stripe onboarding
      window.location.href = result.data.onboarding_url;
    }
  };

  const handleDashboard = async () => {
    setLoading(true);
    const result = await getDashboardLoginLink(workspaceId);
    if (result.data?.url) {
      window.open(result.data.url, "_blank");
    }
    setLoading(false);
  };

  if (initialAccountStatus?.onboarding_complete) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
            <h2 className="text-xl font-semibold">Stripe Connected</h2>
          </div>
          <p className="text-[var(--muted-foreground)] mb-6">
            Your Stripe account is connected and ready to accept payments.
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleDashboard}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Open Stripe Dashboard
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-semibold mb-2">Connect Stripe Account</h2>
        <p className="text-[var(--muted-foreground)] mb-6">
          Connect your Stripe account to start accepting payments from clients.
          You'll be redirected to Stripe to complete the setup process.
        </p>
        
        {error && (
          <div className="mb-4 p-3 rounded-[2px] border border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)] flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        
        <Button
          onClick={handleConnect}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Connect Stripe Account"
          )}
        </Button>
      </div>
    </div>
  );
}
```

### Phase 2: Invoice Creation

#### 2.1 Invoice Server Actions

Create `src/app/actions/invoice.ts`:

```typescript
"use server";

import Stripe from "stripe";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number; // in dollars
  amount: number; // quantity * unit_price
}

export interface CreateInvoiceData {
  project_id?: string;
  client_id?: string;
  line_items: InvoiceLineItem[];
  issue_date: string; // YYYY-MM-DD
  due_date?: string; // YYYY-MM-DD
  notes?: string;
  terms?: string;
  tax_amount?: number;
  discount_amount?: number;
}

/**
 * Create invoice and generate payment link
 */
export async function createInvoice(
  workspaceId: string,
  invoiceData: CreateInvoiceData
) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Verify workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { error: "Not a workspace member" };
  }

  // Get Stripe Connect account
  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id, charges_enabled, onboarding_complete")
    .eq("workspace_id", workspaceId)
    .single();

  if (!connectAccount || !connectAccount.onboarding_complete) {
    return {
      error:
        "Stripe account not connected or onboarding not complete. Please connect your Stripe account first.",
    };
  }

  // Calculate totals
  const subtotal = invoiceData.line_items.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const tax = invoiceData.tax_amount || 0;
  const discount = invoiceData.discount_amount || 0;
  const total = subtotal + tax - discount;

  // Generate invoice number
  const { data: lastInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const nextNumber =
    lastInvoice?.invoice_number
      ? parseInt(lastInvoice.invoice_number.split("-")[1]) + 1
      : 1;
  const invoiceNumber = `INV-${String(nextNumber).padStart(4, "0")}`;

  // Create Stripe Payment Link
  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: invoiceData.line_items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.description,
          },
          unit_amount: Math.round(item.unit_price * 100), // Convert to cents
        },
        quantity: item.quantity,
      })),
      metadata: {
        workspace_id: workspaceId,
        invoice_number: invoiceNumber,
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payments/invoices?paid=true`,
        },
      },
    },
    {
      stripeAccount: connectAccount.stripe_account_id,
    }
  );

  // Save invoice to database
  const { data: invoice, error: dbError } = await supabase
    .from("invoices")
    .insert({
      workspace_id: workspaceId,
      project_id: invoiceData.project_id || null,
      client_id: invoiceData.client_id || null,
      invoice_number: invoiceNumber,
      status: "sent",
      amount: subtotal,
      currency: "usd",
      tax_amount: tax,
      discount_amount: discount,
      total_amount: total,
      issue_date: invoiceData.issue_date,
      due_date: invoiceData.due_date || null,
      line_items: invoiceData.line_items,
      notes: invoiceData.notes || null,
      terms: invoiceData.terms || null,
      stripe_payment_link_id: paymentLink.id,
      payment_link_url: paymentLink.url,
      created_by: user.id,
    })
    .select()
    .single();

  if (dbError) {
    // Rollback Stripe Payment Link
    await stripe.paymentLinks.update(paymentLink.id, { active: false });
    return { error: `Database error: ${dbError.message}` };
  }

  revalidatePath("/dashboard/payments");
  return { data: invoice };
}

/**
 * Get invoices for workspace
 */
export async function getInvoices(workspaceId: string, filters?: {
  project_id?: string;
  client_id?: string;
  status?: string;
}) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase } = authResult;

  let query = supabase
    .from("invoices")
    .select(`
      *,
      project:projects(id, name),
      client:clients(id, name, company)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filters?.project_id) {
    query = query.eq("project_id", filters.project_id);
  }
  if (filters?.client_id) {
    query = query.eq("client_id", filters.client_id);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data: invoices, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data: invoices || [] };
}
```

### Phase 3: Webhook Handler

#### 3.1 Webhook API Route

Create `src/app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Store webhook event
  await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as any,
    processed: false,
  });

  // Handle different event types
  switch (event.type) {
    case "payment_intent.succeeded": {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    }
    case "payment_intent.payment_failed": {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    }
    case "checkout.session.completed": {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    }
    // Add more event handlers as needed
  }

  // Mark webhook as processed
  await supabase
    .from("stripe_webhook_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = await createClient();
  
  // Find invoice by metadata or payment link
  // Update invoice status to 'paid'
  // Create payment record
  
  // Implementation details...
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Handle failed payment
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Handle completed checkout
}
```

### Phase 4: UI Components

#### 4.1 Invoice List Page

Create `src/app/dashboard/payments/invoices/page.tsx`:

```typescript
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getInvoices } from "@/app/actions/invoice";
import InvoicesListClient from "./invoices-list-client";

export default async function InvoicesPage() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return <div>No workspace selected</div>;
  }

  const invoicesResult = await getInvoices(workspaceId);
  
  return (
    <InvoicesListClient
      workspaceId={workspaceId}
      initialInvoices={invoicesResult.data || []}
    />
  );
}
```

---

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Idempotency**: Handle duplicate webhook events
3. **Access Control**: Only owners/admins can manage Stripe accounts
4. **Workspace Isolation**: All queries must filter by workspace_id
5. **No Card Storage**: Never store credit card information
6. **HTTPS Only**: All payment flows must use HTTPS

---

## Testing

### Test Mode

1. Use Stripe test mode keys
2. Use test card numbers: `4242 4242 4242 4242`
3. Test webhooks using Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Test Scenarios

- [ ] Connect Stripe account
- [ ] Create invoice
- [ ] Send payment link to client
- [ ] Process payment
- [ ] Handle webhook events
- [ ] View payment history
- [ ] Handle refunds (future)

---

## Next Steps

1. **Set up database tables** (run migrations)
2. **Configure Stripe** (get API keys)
3. **Implement Phase 1** (Connect account creation)
4. **Test Connect flow** end-to-end
5. **Implement Phase 2** (Invoice creation)
6. **Implement Phase 3** (Webhooks)
7. **Build UI** for invoice management
8. **Add to navigation** (Payments section)

---

## Additional Features (Future)

- Invoice templates
- Recurring invoices
- Payment reminders
- Automated payment collection
- Refund handling
- Payment analytics
- Tax reporting
- Multi-currency support
- Custom payment methods

---

## Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Connect Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Payment Links](https://stripe.com/docs/payment-links)

---

**Last Updated:** December 2024


