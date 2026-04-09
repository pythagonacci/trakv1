# Trak — Influencer Seeding Template

**Project name:** `[Launch Name] Influencer Seeding`
**Suggested tags:** `seeding`, `influencer`, `launch`
**Default status:** `in_progress`

# TAB 1 — Seeding Tracker

**Tab name:** `Seeding Tracker`

### Block 1 — Seeded Product

**Type:** `shopify_product`
**Placeholder state:** Empty product slot — pin the product being seeded here so the team can keep price, inventory, and launch context in view while working the list.

### Block 2 — What's in the package [ROW: left]

**Type:** `text`
**Content:**

```
What's in the package

Product:
Extras:
```

### Block 3 — Ship date [ROW: right]

**Type:** `text`
**Content:**

```
Ship date

Set your ship date and the address deadline here.

Example:
Ship Sept 5
All addresses needed by Sept 3
```

### Block 4 — Ask

**Type:** `text`
**Content:**

```
Ask

What are you asking influencers to do?

No obligation, tag us, use a code — write the ask here.
```

### Block 5 — Influencer List

**Type:** `section_header`
**Title:** `Influencer List`
**Subtitle:** `Track every contact from address confirmed to post live`

### Block 6 — Seeding List

**Type:** `table`
**Columns:** Handle / Name | Platform | Followers | Address Status | Shipped Status | Posted Status | Content

| Handle / Name | Platform | Followers | Address Status | Shipped Status | Posted Status | Content |
| ------------- | -------- | --------- | -------------- | -------------- | ------------- | ------- |
|               |          |           |                |                |               |         |
|               |          |           |                |                |               |         |
|               |          |           |                |                |               |         |
|               |          |           |                |                |               |         |
|               |          |           |                |                |               |         |

### Block 7 — Campaign Tasks

**Type:** `task`
**Title:** `Campaign Tasks`
**View:** `List view`
**Pre-populated tasks:**

| Task                                                  |
| ----------------------------------------------------- |
| Finalize seeding list                                 |
| Collect all addresses by [date]                       |
| Confirm package contents + quantities                 |
| Ship all packages                                     |
| Follow up with anyone who hasn't posted after 2 weeks |

# TAB 2 — Results

**Tab name:** `Results`

### Block 1 — Reach [ROW: left]

**Type:** `text`
**Content:**

```
Reach

Total reach:
Posts published:
[Platform] views:
[Platform] views:
```

### Block 2 — Top performer [ROW: center]

**Type:** `text`
**Content:**

```
Top performer

Handle:
Platform + views:
Notes (link in bio, story, etc.):
```

### Block 3 — Post rate [ROW: right]

**Type:** `text`
**Content:**

```
Post rate

X of Y seeded posted within Z weeks.

Note any pending or non-posters here.
```

### Block 4 — Performance by Platform

**Type:** `section_header`
**Title:** `Performance by Platform`
**Subtitle:** `Summarize reach, volume, and conversion by channel`

### Block 5 — Reach by Platform

**Type:** `table`
**Columns:** Platform | Reach | Posts | Seeded | Post Rate (%)

| Platform  | Reach | Posts | Seeded | Post Rate (%) |
| --------- | ----- | ----- | ------ | ------------- |
| Instagram |       |       |        |               |
| TikTok    |       |       |        |               |
| YouTube   |       |       |        |               |
| Editorial |       |       |        |               |

### Block 6 — Reach by Platform

**Type:** `chart`
**Chart type:** `doughnut`
**Purpose:** `Visual summary of reach by platform based on the results table above.`
**Source table:** `Reach by Platform`
**Breakdown field:** `Platform`
**Measure:** `sum(Reach)`

### Block 7 — Product — Post-Launch

**Type:** `section_header`
**Title:** `Product — Post-Launch`
**Subtitle:** `Pin the same product here to review the post-campaign view`

### Block 8 — Product — Post-Launch

**Type:** `shopify_product`
**Placeholder state:** Empty product slot — pin the same product here to compare its post-campaign sales, inventory, and rating after the seeding push.

### Block 9 — Notes

**Type:** `section_header`
**Title:** `Notes`
**Subtitle:** `Capture learnings before the next send`

### Block 10 — What worked / What to change

**Type:** `text`
**Content:**

```
What worked / What to change

Which influencers drove the most traffic? Which platform performed best? What would you do differently next time? Write it here before the next campaign starts.
```
