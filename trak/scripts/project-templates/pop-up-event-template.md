# Trak — Pop-Up Event Template

**Project name:** `[Pop-Up Event Name]`
**Suggested tags:** `popup`, `retail`, `event`
**Default status:** `in_progress`

# TAB 1 — Event HQ

**Tab name:** `Event HQ`

### Block 1 — Event Brief
**Type:** `text`
**Content:**

```
Event Brief

Describe the event — what it is, why you're doing it, and what success looks like.
```

### Block 2 — Event Details + Goals
**Type:** `cards`
**Title:** `Event Details + Goals`
**View:** `Grid view`
**Card variant:** `Text`
**Pre-populated cards:**

| Card | Notes | Width | Height |
|---|---|---|---|
| Event Details | Dates:\nAddress:\nHours:\nSpace size:\nTeam on floor: | half | tall |
| Goals | Revenue goal:\nAwareness goal:\nContent goal:\nCustomer feedback goal: | half | tall |

### Block 3 — Collection in the Space
**Type:** `section_header`
**Title:** `Collection in the Space`
**Subtitle:** `Pinned from Shopify — live inventory`

### Block 4 — Product 1 [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a Shopify product being sold at the event.

### Block 5 — Product 2 [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a Shopify product being sold at the event.

### Block 6 — Product 3 [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a Shopify product being sold at the event.

### Block 7 — Master Task Tracker
**Type:** `section_header`
**Title:** `Master Task Tracker`
**Subtitle:** `Project-wide live rollup of every open task`

### Block 8 — All Project Tasks
**Type:** `task`
**Title:** `All Project Tasks`
**View:** `List view`
**Rollup:** `Project-wide live mirror`

# TAB 2 — Space & Logistics

**Tab name:** `Space & Logistics`

### Block 1 — Venue + Key Contacts
**Type:** `cards`
**Title:** `Venue + Key Contacts`
**View:** `Grid view`
**Card variant:** `Text`
**Pre-populated cards:**

| Card | Notes | Width | Height |
|---|---|---|---|
| Venue | Address:\nSpace size:\nLease contact + phone:\nAccess date/time:\nDeposit amount + paid date: | half | tall |
| Key Contacts | Ops lead:\nVendor type: Name\nVendor type: Name\nVendor type: Name | half | tall |

### Block 2 — Vendor Tracker
**Type:** `section_header`
**Title:** `Vendor Tracker`
**Subtitle:** `Every vendor from first contact to confirmed`

### Block 3 — Vendors
**Type:** `table`
**Columns:** Vendor | Service | Contact | Quote Amount | Deposit Status | Vendor Status

| Vendor | Service | Contact | Quote Amount | Deposit Status | Vendor Status |
|---|---|---|---|---|---|
|  |  |  |  | Pending | Not Started |
|  |  |  |  | Pending | Not Started |

### Block 4 — Budget
**Type:** `section_header`
**Title:** `Budget`
**Subtitle:** `Estimated versus actual event spend`

### Block 5 — Budget
**Type:** `table`
**Columns:** Category | Estimated Cost | Actual Cost | Variance Amount | Notes

| Category | Estimated Cost | Actual Cost | Variance Amount | Notes |
|---|---|---|---|---|
| Venue / lease deposit |  |  |  |  |
| Rack fabrication / furniture |  |  |  |  |
| Florals / styling |  |  |  |  |
| Lighting |  |  |  |  |
| Signage + printing |  |  |  |  |
| Staffing |  |  |  |  |
| Contingency |  |  |  |  |

### Block 6 — Pre-Event Logistics
**Type:** `section_header`
**Title:** `Pre-Event Logistics`
**Subtitle:** `Lock the space, vendors, and ops requirements early`

### Block 7 — Pre-Event Logistics
**Type:** `task`
**Title:** `Pre-Event Logistics`
**View:** `List view`
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Confirm venue and dates | 🔴 Urgent | [Owner] | [date] |
| Lock all vendors | 🔴 Urgent | [Owner] | [date] |
| Confirm Shopify POS hardware | 🟠 High | [Owner] | [date] |

### Block 8 — Permits & Paperwork
**Type:** `section_header`
**Title:** `Permits & Paperwork`
**Subtitle:** `Everything that needs approval before doors open`

### Block 9 — Permits
**Type:** `task`
**Title:** `Permits`
**View:** `List view`
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Temporary retail permit | 🔴 Urgent | [Owner] | [date] |
| Certificate of insurance — landlord copy | 🔴 Urgent | [Owner] | [date] |
| File permits | 🔴 Urgent | [Owner] | [date] |
| Any other location-specific permits | 🟠 High | [Owner] | [date] |

# TAB 3 — Creative & Styling

**Tab name:** `Creative & Styling`

### Block 1 — Direction
**Type:** `text`
**Content:**

```
Direction

Describe how the space should look and feel. What's the aesthetic reference? What materials, lighting, and atmosphere are you going for? What do you want customers to experience when they walk in?
```

### Block 2 — Moodboard
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload reference images, inspiration photos, and material swatches for the space.

### Block 3 — Merchandise Plan
**Type:** `section_header`
**Title:** `Merchandise Plan`
**Subtitle:** `Units per SKU, colorway, and display location`

### Block 4 — Merch Plan
**Type:** `table`
**Columns:** Product | Colorway | Units | Display Location | Merch Status

| Product | Colorway | Units | Display Location | Merch Status |
|---|---|---|---|---|
|  |  |  |  | Not Started |
|  |  |  |  | Not Started |
|  |  |  |  | Not Started |

### Block 5 — Creative Prep
**Type:** `section_header`
**Title:** `Creative Prep`
**Subtitle:** `Merch, styling, and promotion before event week`

### Block 6 — Creative Prep
**Type:** `task`
**Title:** `Creative Prep`
**View:** `List view`
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Finalize merch plan | 🔴 Urgent | [Owner] | [date] |
| Send press / influencer invites | 🟠 High | [Owner] | [date] |

# TAB 4 — Day-Of

**Tab name:** `Day-Of`

### Block 1 — Run of Show
**Type:** `section_header`
**Title:** `Run of Show`
**Subtitle:** `Timeline for the day — setup through close`

### Block 2 — Day-Of Timeline
**Type:** `timeline`
**Pre-populated events:**

| Event Name | Date | Notes |
|---|---|---|
| Vendor arrivals / setup begins | [Event date] | Add the day-of timing here. |
| Merchandise loaded and styled | [Event date] |  |
| POS tested | [Event date] |  |
| Doors open | [Event date] |  |
| Doors close / end-of-day inventory check | [Event date] |  |

### Block 3 — Staff
**Type:** `section_header`
**Title:** `Staff`
**Subtitle:** `Assignments for every event day`

### Block 4 — Staff Assignments
**Type:** `table`
**Columns:** Staff Member | Role | Shift | Days

| Staff Member | Role | Shift | Days |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

### Block 5 — Event Week Setup
**Type:** `section_header`
**Title:** `Event Week Setup`
**Subtitle:** `Everything that must be ready before doors open`

### Block 6 — Event Week Setup
**Type:** `task`
**Title:** `Event Week Setup`
**View:** `List view`
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Confirm all vendor arrival times | 🔴 Urgent | [Owner] | [date] |
| Complete build-out | 🔴 Urgent | [Owner] | [date] |
| Dress space and merchandise | 🔴 Urgent | [Owner] | [date] |
| Brief floor staff | 🟠 High | [Owner] | [date] |
| Test POS — all readers | 🔴 Urgent | [Owner] | [date] |

### Block 7 — Post-Event Follow-Up
**Type:** `section_header`
**Title:** `Post-Event Follow-Up`
**Subtitle:** `Close the loop after the event ends`

### Block 8 — Post-Event Follow-Up
**Type:** `task`
**Title:** `Post-Event Follow-Up`
**View:** `List view`
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Reconcile inventory | 🔴 Urgent | [Owner] | [date] |
| Return or store equipment | 🟠 High | [Owner] | [date] |
| Write post-event recap | 🟠 High | [Owner] | [date] |
| Log learnings for next time | 🟠 High | [Owner] | [date] |

### Block 9 — Live Inventory
**Type:** `section_header`
**Title:** `Live Inventory`
**Subtitle:** `Shopify — updated in real time`

### Block 10 — Live Product 1 [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a live Shopify product for floor staff monitoring.

### Block 11 — Live Product 2 [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a live Shopify product for floor staff monitoring.

### Block 12 — Live Product 3 [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach a live Shopify product for floor staff monitoring.
