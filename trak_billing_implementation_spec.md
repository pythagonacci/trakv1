# Trak Billing + Plan Gating End-to-End Implementation Spec

## 0. Objective

Implement pricing, Stripe billing integration, and plan gating for Trak with these launch rules:

### Free
- 1 workspace
- up to 3 projects
- up to 3 **top-level** tabs per project
- up to 15 **top-level** blocks per tab
- 5 AI commands per day
- no Everything page
- no configurable dashboard
- no cross-project analytics
- no cross-project AI

### Standard
- $15 / user / month
- 1 workspace
- unlimited projects
- unlimited tabs
- unlimited blocks
- no Everything page
- no configurable dashboard
- charts scoped to a single project
- do **not** fully differentiate AI from Business yet, beyond free-plan metering and business-only feature gating

### Business
- $25 / user / month
- unlimited workspaces
- unlimited projects
- unlimited tabs
- unlimited blocks
- Everything page enabled
- configurable dashboard enabled
- cross-project analytics enabled
- cross-project AI enabled

### Explicit scoping decisions already made
- AI quota: count only normal app AI commands through `/api/ai` and `/api/ai/stream`
- tab limit counts only **top-level** tabs (`parent_tab_id IS NULL`)
- block limit counts only **top-level** blocks (`parent_block_id IS NULL`)
- seats = `workspace_members` only; ignore invites, client/public users, link recipients

This spec is designed around the actual repo findings: `createWorkspace`, `createProject`, `createTab`, and `createBlock` are the real creation funnels; Everything is powered by `getWorkspaceEverything`; dashboard configuration is currently client-side; dashboard charts already distinguish `"workspace"` vs `"project"` scope; AI has multiple entry points but you only want the free quota on `/api/ai` and `/api/ai/stream`.

---

# 1. Implementation principles

## 1.1 Stripe is billing truth, app DB is entitlement truth
Use Stripe for:
- paid subscriptions
- plan price
- billing status
- seat quantity
- checkout
- portal
- invoice/subscription lifecycle

Use your app DB for:
- resolved workspace plan
- access checks
- structural limits
- free AI daily quota
- feature access decisions

Do **not** make feature access depend on frontend Stripe state.

## 1.2 Workspace is the billing unit
Billing attaches to a workspace, not directly to a user.
That fits the existing architecture:
- projects belong to workspaces
- workspace membership already exists
- most cross-project features are workspace-scoped
- current workspace is already selected via cookie and membership logic

## 1.3 Centralize plan resolution
Do not scatter tier logic all over the repo.
Create one canonical entitlement resolver:
- input: `workspaceId`
- output: a resolved entitlement object

Every gated backend action must call that resolver.

## 1.4 Enforce on the server, not just in UI
Frontend limit states are for UX.
Server enforcement is the real rule.
For Trak specifically, all of these must be enforced in backend entry points:
- create workspace
- create project
- create tab
- create block
- Everything data access
- workspace-scope chart generation
- AI quota check for `/api/ai` and `/api/ai/stream`

The audit confirmed the current code only checks access/membership, not plan limits, so this must be added explicitly.

---

# 2. New system to add

Implement the following new pieces:

## 2.1 Billing persistence layer
Add a dedicated workspace billing state model.
Do **not** overload existing `payments`, `payment_events`, or `workspaces.stripe_account_*` fields. The audit indicates those are for client invoicing / Connect-style flows, not SaaS subscriptions.

Introduce a new workspace subscription/billing record that stores:
- workspace id
- current plan key
- billing status
- Stripe customer id
- Stripe subscription id
- Stripe price id
- seat quantity
- cancel-at-period-end
- current billing period dates
- updated-at metadata

## 2.2 Daily AI usage layer
Add a dedicated daily usage table or equivalent persistence for free-plan quota:
- workspace id
- usage date
- commands used

Unique by `(workspace_id, usage_date)`.

## 2.3 Entitlement resolver
Create a central server-side module that resolves workspace entitlements from billing state.

Recommended location:
- `src/lib/billing/`
or
- `src/lib/entitlements/`

Use a structure that is easy to import from server actions and API routes.

## 2.4 Stripe integration layer
Add:
- checkout session creation endpoint or server action
- customer portal session creation endpoint or server action
- webhook route
- helper to map Stripe subscription/price state to internal plan state

## 2.5 Plan-aware UI state
Add:
- hidden/disabled nav items
- upgrade prompts
- limit counters
- create-button disable states

But keep UI gating secondary to server enforcement.

---

# 3. Canonical plan model

Create a single plan-definition module.

## 3.1 Canonical plan keys
Use exactly:
- `free`
- `standard`
- `business`

Do not invent extra tier keys right now.

## 3.2 Entitlement object shape
The resolver should return one normalized object, something like:

- `planKey`
- `billingStatus`
- `maxWorkspaces`
- `maxProjectsPerWorkspace`
- `maxTopLevelTabsPerProject`
- `maxTopLevelBlocksPerTab`
- `aiDailyCommandLimit`
- `allowEverythingPage`
- `allowDashboardConfiguration`
- `allowWorkspaceScopeCharts`
- `allowCrossProjectAnalytics`
- `allowCrossProjectAI`

Not all fields must be stored in DB; many can come from static code config.

## 3.3 Static rules
Use this exact launch logic:

### Free
- max workspaces: 1
- max projects per workspace: 3
- max top-level tabs per project: 3
- max top-level blocks per tab: 15
- ai daily command limit: 5
- allow Everything: false
- allow dashboard configuration: false
- allow workspace-scope charts: false
- allow cross-project analytics: false
- allow cross-project AI: false

### Standard
- max workspaces: 1
- projects: unlimited
- tabs: unlimited
- blocks: unlimited
- ai daily command limit: none for now
- allow Everything: false
- allow dashboard configuration: false
- allow workspace-scope charts: false
- allow cross-project analytics: false
- allow cross-project AI: false for business-only surfaces; do not overbuild deeper AI differentiation yet

### Business
- max workspaces: unlimited
- projects: unlimited
- tabs: unlimited
- blocks: unlimited
- allow Everything: true
- allow dashboard configuration: true
- allow workspace-scope charts: true
- allow cross-project analytics: true
- allow cross-project AI: true

---

# 4. DB and data-model guidance

Do not hardcode exact migrations from this spec. The agent should produce the best migrations consistent with the existing Supabase schema and migration conventions already used in `trak/supabase/migrations`.

## 4.1 Add a dedicated workspace billing table
Design a table specifically for product billing.

Recommended conceptual fields:
- primary id
- `workspace_id` unique FK to `workspaces`
- `plan_key`
- `billing_status`
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_price_id`
- `seat_quantity`
- `cancel_at_period_end`
- `current_period_start`
- `current_period_end`
- `last_synced_at`
- timestamps

### Guidance
- have one row per workspace
- free workspaces should still have a billing row if that simplifies entitlement resolution
- do not put SaaS subscription state directly on `workspaces` unless there is a strong schema reason; a dedicated table is cleaner and avoids collision with existing Stripe account fields

## 4.2 Add a daily AI usage table
Conceptual fields:
- primary id
- `workspace_id`
- `usage_date`
- `commands_used`
- timestamps

Unique constraint:
- `(workspace_id, usage_date)`

## 4.3 Optional audit/event table
Strongly recommended:
- workspace id
- event type
- source
- payload snapshot
- created at

This is useful for Stripe webhook debugging and plan-change investigations.

## 4.4 RLS / access guidance
Because the repo uses a mix of server checks and RLS, and current plan limits are not in RLS, keep plan enforcement primarily in server actions/API handlers first.

Do not try to push full plan logic into RLS for launch.
That is unnecessary complexity.

---

# 5. Stripe setup assumptions

The human will create the Stripe products/prices manually.
The code should assume these env vars exist:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STANDARD_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `NEXT_PUBLIC_APP_URL`

Optional:
- customer portal configuration id, if needed

## 5.1 Stripe products
The user will create:
- Standard monthly seat price: $15
- Business monthly seat price: $25

Both should be recurring monthly per-seat prices.

## 5.2 Free plan
Free is not a Stripe subscription.
Free is represented internally by:
- no active paid subscription
- `plan_key = free`

## 5.3 Seat quantity
Stripe quantity should equal the count of `workspace_members`.

---

# 6. New backend modules to introduce

## 6.1 Billing config module
Create a small static config module defining:
- plan constants
- feature matrix
- price-id to plan-key mapping
- helper functions for plan resolution

Purpose:
- one place for canonical plan definitions
- reusable in webhook handler, checkout, portal, UI loading, entitlements

## 6.2 Workspace billing data-access module
Add a module responsible for:
- read billing row by workspace
- create billing row if missing
- update billing state from Stripe webhook
- compute seat count
- map plan state to entitlement state

## 6.3 Entitlements resolver
Add `getWorkspaceEntitlements(workspaceId)`.

Responsibilities:
- verify workspace exists
- load or initialize billing row
- determine resolved plan
- return final entitlement object

This should be the single entry point for all plan checks.

## 6.4 Limit/usage helper module
Add helpers such as:
- `assertCanCreateWorkspace(userId)`
- `assertCanCreateProject(workspaceId)`
- `assertCanCreateTopLevelTab(projectId)`
- `assertCanCreateTopLevelBlock(tabId)`
- `assertCanUseAiCommand(workspaceId)`
- `assertCanAccessEverythingPage(workspaceId)`
- `assertCanUseWorkspaceScopeCharts(workspaceId)`

Keep them thin wrappers around `getWorkspaceEntitlements`, plus the relevant counts.

---

# 7. Workspace billing flow

## 7.1 Default behavior when workspace is created
When `createWorkspace` runs:
- after creating the workspace and owner membership
- create a default billing row for that workspace, plan = `free`, billing status = `free`

This keeps the system consistent from day one.

## 7.2 Workspace count enforcement
Modify `createWorkspace` in `src/app/actions/workspace.ts`.

Before creating a workspace:
- determine how many workspaces the current user belongs to or owns
- recommended rule for launch: count `workspace_members` rows for the current user
- resolve what plan the user is allowed to act under

Because billing is workspace-based and the user may already be in multiple workspaces, the simplest launch rule is:
- free and standard users cannot create a second workspace
- business users can

### Important implementation note
Since plan is workspace-based, not user-global, the agent should define a practical launch rule for workspace creation:
- either check whether the user already owns/belongs to one non-business workspace
- or introduce a simple user-level capability check based on their existing memberships

For launch, keep it simple:
- if the user already belongs to any workspace and none of those memberships correspond to a Business workspace they own/administer, block creating another workspace
- do not overdesign org-level billing yet

The agent should make this pragmatic and consistent.

---

# 8. Project gating

## 8.1 Entry point
Modify `createProject` in `src/app/actions/project.ts`.

## 8.2 Enforcement rule
Before insert:
- resolve workspace entitlements
- if max projects is unlimited, allow
- otherwise count projects in the workspace
- if count >= limit, reject with a domain-specific error

## 8.3 Ensure all create-project paths funnel through this
`createProjectFromProduct` must not bypass the plan check.
Best approach:
- keep the plan check inside `createProject`
- let `createProjectFromProduct` delegate

## 8.4 Error semantics
Use a typed/domain error style if the codebase already has one.
If not, return a clear error object the UI can detect and convert into upgrade messaging.

Message guidance:
- “Free workspaces can have up to 3 projects. Upgrade to Standard for unlimited projects.”

---

# 9. Tab gating

## 9.1 Entry point
Modify `createTab` in `src/app/actions/tab.ts`.

## 9.2 Count definition
Count only top-level tabs:
- same project
- `parent_tab_id IS NULL`

Do not count nested tabs for the free-tier limit.

## 9.3 Enforcement rule
Before insert:
- resolve project → workspace
- resolve workspace entitlements
- if unlimited, allow
- otherwise count top-level tabs
- if count >= 3, reject

## 9.4 Important nuance
Because `createProject` automatically creates a default tab, the first tab for a new project is consumed immediately.

That is okay.
It means a free project starts with:
- 1 existing top-level tab
- user can add 2 more

Do not special-case around this.

---

# 10. Block gating

## 10.1 Entry point
Modify `createBlock` in `src/app/actions/block.ts`.

## 10.2 Count definition
Count only top-level blocks:
- same tab
- `parent_block_id IS NULL`

Do not count nested/section-child blocks for the free-tier limit.

## 10.3 Enforcement rule
Before insert:
- resolve tab → project → workspace
- resolve entitlements
- if unlimited, allow
- otherwise count top-level blocks
- if count >= 15, reject

## 10.4 AI-created blocks
Because AI tools also call into creation paths, the plan check must live inside `createBlock`, not only in UI components or tool executors.

That prevents bypass via:
- AI tool execution
- workflow execution
- other future server-triggered creation paths

---

# 11. Free AI daily quota

## 11.1 What counts
Only count:
- `/api/ai`
- `/api/ai/stream`

Do not count:
- dashboard insights
- search
- file analysis
- slack
- warmup
- undo

That was the scoping decision you made.

## 11.2 Why this is acceptable
That means:
- quota must be enforced in these two endpoints only
- other AI-like flows remain outside the 5/day rule for now

## 11.3 Add a shared helper
Create a helper such as:
- `assertAndConsumeFreeAiCommandQuota(workspaceId)`

Responsibilities:
- resolve entitlements
- if non-free, allow immediately
- if free, inspect today’s usage row
- if commands_used >= 5, reject
- otherwise increment usage safely and continue

## 11.4 Increment semantics
Best launch behavior:
- consume quota only once the request is accepted for execution
- do not charge quota for obviously invalid input or authorization failures
- if the underlying model call fails catastrophically before meaningful execution, consider rolling back or not consuming

The agent should implement this in the cleanest way consistent with your current request flow.

## 11.5 Where to apply it
Add it near the top of:
- `src/app/api/ai/route.ts`
- `src/app/api/ai/stream/route.ts`

Do not bury the logic in the UI.

## 11.6 Error message
Return a consistent domain error:
- “You’ve used 5/5 AI commands today on Free. Upgrade for more AI access.”

---

# 12. Everything page = Business only

## 12.1 Server enforcement
Add a plan check inside `getWorkspaceEverything` in `src/app/actions/everything-view.ts`.

Do not rely only on route-level hiding.

## 12.2 Page-level guard
Also gate in:
- `/dashboard/workspace/everything/page.tsx`

Use this for better UX and cleaner early return.
But the server action remains the real enforcement point.

## 12.3 UI gating
Hide the Everything nav item in:
- `layout-client.tsx`

Only show it if entitlements allow it.

---

# 13. Dashboard configuration = Business only

## 13.1 Current architecture
Dashboard configuration is currently client-side/localStorage-based, not server-persisted.

That means:
- there is no fully authoritative server-side config to protect yet
- the initial implementation should focus on UI gating and scope validation where data is fetched

## 13.2 Required launch behavior
For Free and Standard:
- no dashboard customization UI
- do not expose configure/edit controls
- do not expose workspace-scope charts

For Business:
- show customization UI normally

## 13.3 Gating points
Hide/disable in:
- dashboard config modal/context
- dashboard overview components
- any “add widget / configure dashboard” controls

## 13.4 Important limitation
Because config is localStorage-based, a user could theoretically manipulate client state.
That is acceptable for launch **only if** the actual server-side data queries still enforce scope restrictions.

---

# 14. Cross-project / workspace-scope charts = Business only

## 14.1 Server enforcement point
Modify the chart-generation server action identified in the audit:
- `generateDashboardChartData` in `src/app/actions/chart-actions.ts`

## 14.2 Rule
If chart scope is `"workspace"`:
- require Business

If chart scope is `"project"`:
- allow for all plans, subject to normal project access

## 14.3 UI gating
In the dashboard chart configuration UI:
- hide `"workspace"` scope for non-Business
- default them to `"project"` scope only

This prevents confusing UX while keeping server-side scope enforcement real.

---

# 15. Cross-project AI = Business only

## 15.1 Launch scope
Do **not** deeply rebuild the AI tool system right now.
You said you are not worried yet about full Standard vs Business AI differentiation.

## 15.2 What to enforce now
For now, enforce Business-only only on the clearly visible/business-only workspace-wide AI surfaces:
- Everything page
- workspace dashboard analytics
- any explicit workspace-wide AI queries surfaced through those features

Do not attempt a complete tool-level permission graph across all AI tools unless the agent finds it trivial.

## 15.3 Product honesty
On the pricing page and UI, phrase this as:
- Business unlocks cross-project AI and analytics

Even if the first engineering cut mainly enforces this through the existing workspace-wide surfaces rather than a full internal AI tool-permission rewrite.

---

# 16. Stripe checkout flow

## 16.1 Add checkout session creation
Implement a server action or authenticated API route that:
- requires user session
- verifies user can administer the target workspace
- calculates current seat quantity from `workspace_members`
- maps requested plan to correct Stripe price id
- creates or reuses Stripe customer for the workspace
- creates Stripe Checkout session in subscription mode
- passes workspace metadata into the subscription flow

Recommended metadata:
- workspace id
- plan key
- initiating user id

## 16.2 Who can start checkout
Restrict to workspace owner/admin.

## 16.3 Customer association
Associate one Stripe customer per workspace.

Store Stripe customer id in the workspace billing table, not on `workspaces` directly unless needed.

## 16.4 Seat quantity
Set Checkout subscription quantity equal to current `workspace_members` count.

## 16.5 Success/cancel behavior
Return the Checkout URL or redirect server-side, depending on your existing pattern.
After return from Checkout:
- do **not** trust client success alone for access changes
- wait for webhook sync

---

# 17. Stripe webhook flow

## 17.1 Add webhook route
Add a dedicated route handler under `app/api/...` for Stripe webhooks.

## 17.2 Verify signature
Use `STRIPE_WEBHOOK_SECRET`.
Reject unsigned/invalid events.

## 17.3 Events to handle
At minimum:
- checkout session completed
- customer subscription created
- customer subscription updated
- customer subscription deleted
- invoice paid
- invoice payment failed

## 17.4 Internal behavior
For each relevant event:
- identify workspace from metadata or customer/subscription lookup
- update workspace billing row
- resolve correct `plan_key`
- update `billing_status`
- update `seat_quantity`
- update billing period fields
- log event in audit table if implemented

## 17.5 Idempotency
The agent must implement webhook idempotency carefully.
That can be done via:
- event log table with unique external event id
- upsert semantics
- safe repeatable updates

Do not assume Stripe sends each event once.

---

# 18. Customer portal flow

Implement a server action or route that:
- requires authenticated user
- verifies owner/admin permission on workspace
- resolves Stripe customer for the workspace
- creates a customer portal session
- returns/redirects to the portal URL

Use this for:
- payment method updates
- invoices
- cancellations
- plan changes if enabled

---

# 19. Seat syncing strategy

## 19.1 Launch rule
A seat = one row in `workspace_members`.

## 19.2 When seats can drift
Seat quantity can drift when:
- a member is invited and accepted
- a member is removed
- roles change into or out of billable status, if you ever support that

## 19.3 Launch implementation
Keep it simple:
- on member add/remove, if workspace is paid, update Stripe subscription quantity to current member count
- do not count pending invites
- do not count public/client users

## 19.4 Relevant integration points
That makes `workspace.ts` the natural place for seat sync hooks when membership changes.

## 19.5 Removal edge cases
If decreasing quantity fails temporarily:
- do not corrupt local entitlements
- log it
- retry or surface an admin warning
- avoid blocking normal user removal unless necessary

---

# 20. UI integration requirements

## 20.1 Pricing page behavior
Each paid plan CTA should:
- know current workspace
- know target plan
- launch checkout

If user is already on a paid plan:
- show Manage Billing / Upgrade / Downgrade appropriately

## 20.2 Workspace settings area
Add a billing/settings surface that shows:
- current plan
- seat count
- billing status
- manage billing button
- upgrade CTA
- maybe renewal date

## 20.3 Limit surfaces
Add lightweight upgrade/limit UX to:
- create project button
- create tab button
- add block button
- AI composer
- Everything nav link
- dashboard customize controls
- chart-scope selectors

## 20.4 Counter UX
Where natural, show counters such as:
- Projects: 2 / 3
- Tabs: 3 / 3
- Blocks: 11 / 15
- AI today: 4 / 5

Do not overdo it.
Use them where users hit friction.

---

# 21. Error-handling contract

Implement a consistent contract for plan-limit errors.

Recommended classes of errors:
- `PLAN_LIMIT_REACHED`
- `FEATURE_NOT_AVAILABLE`
- `BILLING_REQUIRED`
- `AI_QUOTA_EXCEEDED`

Each should include:
- machine-readable code
- user-friendly message
- optional upgrade target plan

This makes UI handling much cleaner than parsing random thrown strings.

---

# 22. Race-condition guidance

For launch:
- enforce in the main server action
- use the cleanest transaction or lock approach available in your current Supabase/Postgres patterns
- if a perfect transactional count+insert flow is awkward, make the action-side check robust first and accept low-probability collisions for launch

But the agent should think carefully about:
- two tabs created simultaneously
- two blocks created simultaneously
- two AI commands consuming quota simultaneously

For AI quota:
- prefer atomic increment/upsert semantics
- avoid read-then-write races where possible

---

# 23. Suggested file-level execution plan

This is the implementation roadmap the coding agent should follow.

## Phase 1 — Foundations
1. Add billing data model
2. Add daily AI usage data model
3. Add billing/entitlements helper modules
4. Add plan constants/config

## Phase 2 — Server enforcement
5. Update `createWorkspace`
6. Update `createProject`
7. Update `createTab`
8. Update `createBlock`
9. Add Everything business-only check
10. Add workspace-scope chart business-only check
11. Add `/api/ai` free quota check
12. Add `/api/ai/stream` free quota check

## Phase 3 — Stripe
13. Add checkout session creation
14. Add webhook route
15. Add customer portal route/action
16. Add seat-sync hooks on membership changes

## Phase 4 — UI
17. Add billing state loader for workspace settings/pricing
18. Hide/show Everything nav
19. Hide dashboard configuration for non-Business
20. Add limit/upgrade prompts for project/tab/block/AI

## Phase 5 — Hardening
21. Add audit/event logging
22. Test webhook idempotency
23. Test seat sync
24. Test downgrade/upgrade behavior

---

# 24. Downgrade/upgrade behavior

## 24.1 Free → Standard
- unlock unlimited projects/tabs/blocks
- keep workspace cap at 1
- no Everything
- no configurable dashboard
- no workspace-scope charts

## 24.2 Standard → Business
- unlock Everything
- unlock configurable dashboard
- unlock workspace-scope charts
- unlock cross-project/business-only surfaces

## 24.3 Business → Standard
- hide Everything
- hide dashboard config
- reject workspace-scope charts
- preserve existing data/configs if possible, but disable access
- if user has multiple workspaces, the agent should define a practical launch policy:
  - either block downgrade until compliant
  - or allow downgrade at billing layer but surface a compliance warning and restrict creation/access accordingly

For launch, prefer clarity over perfection.

---

# 25. Testing requirements for the coding agent

The implementation is not complete unless these are tested.

## 25.1 Free plan tests
- create first workspace succeeds
- create second workspace blocked
- create 4th project blocked
- create 4th top-level tab blocked
- create 16th top-level block blocked
- 6th AI command via `/api/ai` blocked
- 6th AI command via `/api/ai/stream` blocked
- nested blocks do not count against 15
- nested tabs do not count against 3

## 25.2 Standard tests
- one workspace allowed
- second workspace blocked
- unlimited projects/tabs/blocks
- Everything hidden and server-blocked
- workspace-scope chart blocked
- dashboard config hidden

## 25.3 Business tests
- multiple workspaces allowed
- Everything visible and accessible
- dashboard config visible
- workspace-scope charts allowed

## 25.4 Billing tests
- checkout creates paid subscription
- webhook updates billing row
- cancel/update events sync correctly
- portal launches correctly
- member add/remove updates seat quantity

## 25.5 Regression tests
- existing membership/access logic still works
- AI routes still operate normally
- project creation still auto-creates default tab
- block creation still works across current UI/AI flows

---

# 26. Non-goals for this implementation

To keep launch scope sane, do **not** overbuild these now:

- full org-level billing model
- full AI tool-level permission matrix
- counting every LLM path in quota
- moving dashboard config from localStorage to DB
- RLS-based plan enforcement for all limits
- metered AI billing
- annual billing
- coupon systems
- tax/VAT complexity
- invitation-based seat reservations

This implementation should fit the current architecture instead of trying to redesign the product platform mid-launch.

---

# 27. Final instruction block for the coding agent

Use this as the closing directive in the prompt you give them:

Implement this end to end in Trak’s existing architecture. Follow the repo’s established patterns for server actions, Supabase access, migrations, and route handlers. Do not introduce a parallel architecture. Keep plan logic centralized, enforce limits server-side, and keep UI gating as a secondary layer. Use the cleanest production-grade judgment for migrations, transactional safety, webhook idempotency, and error contracts. Do not optimize for minimal diff; optimize for correctness, maintainability, and launch safety. Preserve existing functionality while adding billing and plan enforcement.
