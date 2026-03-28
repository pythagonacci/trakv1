# Trak — Product Development & Roadmap Template
## Coding Agent Handoff Document

---

## What This Document Is

This is a complete spec for building the **Product Development & Roadmap** template inside Trak. It includes every tab, every subtab, every block, block types, and full placeholder content — exactly as it should appear when a user instantiates the template.

This document is the single source of truth. Build the template exactly as specified here.

---

## Background: What Trak Is

Trak is a D2C brand operations platform — an all-in-one workspace for Shopify brands that replaces tools like Notion and Asana. It combines task management, content creation, asset management, campaign briefs, and AI-powered operational support in one place.

The core unit of Trak is a **Project**. Each project contains multiple **Tabs**, and each tab is a canvas of **Blocks**. Blocks are modular — they can be text, tasks, timelines, tables, images, galleries, videos, PDFs, files, embeds, section headers, dividers, Shopify product blocks, chart blocks, doc reference blocks, and more.

Templates are pre-built projects with pre-populated tabs and blocks that users can instantiate and immediately start working from.

---

## Who This Template Is For (ICP)

**Primary:** D2C brands building a new physical product for Shopify — skincare, beauty, wellness, food & beverage, fashion accessories, lifestyle. Think Rhode, Rare Beauty, Vacation, Dairy Boy, Topicals, Gorgie. Typically founder-led or small-team (2–20 people), product-obsessed, creative-native, and operationally stretched.

**What they're doing when they use this template:** Taking a product from raw idea to launch-ready. The idea exists — maybe it's a formula direction, a product gap they've spotted, a customer request they keep hearing. Now they need to develop it: refine the concept, get into formulation, work with vendors, name it, design packaging, and build a development roadmap that keeps the whole team aligned. This template ends where the Product Launch template begins.

**Why they love Trak over Notion/Asana:** Trak is built for creative and operational work in the same canvas. They can write a product brief, attach sample iteration notes, track vendor conversations, drop in mood board imagery, and manage development tasks — all in one place, without switching between five tools.

---

## Template Overview

**Project name:** `[Product Name] Development`
**Suggested tags:** `product-dev`, `[season/year]`
**Default status:** `in_progress`

**Total tabs:** 5 parent tabs with 7 subtabs = 12 total canvases (plus the auto-generated Overview tab)

The Overview tab is built into every Trak project automatically. It shows: Due Today, Due Soon, Overdue, and Team Comments & Notifications. Do not build this tab — it already exists.

### Tab Architecture

| # | Tab Name | Subtabs | Purpose |
|---|---|---|---|
| 1 | Product Vision | The Idea · Customer & Market · Competitive Landscape | Where the product concept lives. Strategic, creative, and research-grounded. |
| 2 | Development | Formulation & Specs · Samples & Iteration · Supplier & Vendor | Where the actual product gets made. Technical, iterative, vendor-facing. |
| 3 | Brand & Naming | — | Product naming, tone of voice, and the brand brief for this specific product. |
| 4 | Packaging & Design | Design Direction · Artwork & Files · Regulatory & Claims | From mood board to final dieline to compliance sign-off. |
| 5 | Roadmap | — | Master timeline, phase milestones, and launch-readiness tracking. |

---

## Block Type Reference

| Block Label Used Below | Trak Block Type |
|---|---|
| Text block | `text` |
| Task block | `task` |
| Timeline block | `timeline` |
| Table block | `table` |
| Gallery block | `gallery` |
| Image block | `image` |
| File block | `file` |
| Chart block | `chart` |
| Section header block | `section_header` |
| Shopify product block | `shopify_product` |

**Task block view modes:**
- Default is list view
- Where `(board view, grouped by status)` is noted, instantiate in board/kanban view grouped by status
- Where `(list view)` is noted, instantiate in list view

**Task priority levels:** 🔴 Urgent · 🟠 High · 🟡 Medium · 🟢 Low

---

## Important Notes Before Building

1. **Subtabs are used.** Tabs 1, 2, and 4 each have child subtabs. The parent tab itself does not need blocks — it acts as a container that surfaces its first subtab on load.
2. **No divider blocks.** Visual separation is handled by section header blocks only.
3. **Placeholder content is real.** Every block has placeholder content written below. This is what the user sees on day one — not empty blocks. Write this content into the blocks exactly as specified.
4. **Section header blocks have a title and subtitle.** Format: `Title` / *Subtitle in italics*. Both fields should be populated.
5. **Task blocks:** Pre-populate with the task items listed. Each task should have a title, priority level, and `[Owner]` and `[date]` placeholder where noted.
6. **Table blocks:** Pre-populate with the column structure and the example rows listed. Users will add their own rows.
7. **Shopify product blocks:** These should render as empty product slots with a prompt to connect a Shopify store and select a product — they cannot be pre-populated with real product data.
8. **Row layout:** Blocks marked `[ROW: left]` and `[ROW: right]` share a single row and render side by side (two-column). All other blocks occupy a full row. **Tables always occupy a full row regardless of context — no exceptions.**

---

---

# TAB 1 — Product Vision (Parent Tab)

**Tab name:** `Product Vision`

*This tab is a parent container. It has three subtabs: The Idea, Customer & Market, and Competitive Landscape. The parent tab itself has no blocks — it loads the first subtab by default.*

---

## SUBTAB 1A — The Idea

**Tab name:** `The Idea`
**Parent:** Product Vision

*The origin document. Where the product was born and why it has to exist.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `The Product Concept`
**Subtitle:** `What we're building and why it has to exist`

---

### Block 2 — Text Block `[ROW: left]`
**Type:** `text`
**Content:**

```
The Idea

What is this product, in one sentence:
[e.g. "A barrier-repair serum built specifically for skin that's been over-processed by actives — no fragrance, no fluff, just recovery."]

Why does it need to exist:
[What's the gap? What are customers currently doing that isn't working? What are they asking for that nobody is delivering? Be honest and specific — not "there's whitespace in the market" but "our DMs are full of people asking us what to use after retinol and we don't have an answer for them."]

Why us, why now:
[Why is this brand the right one to make this product? Why is this the right moment — customer behavior shift, ingredient trend, brand evolution, competitive gap?]

What success looks like for this product:
[Not just revenue. What does it mean for the brand? How does it extend or deepen what we stand for?]
```

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Product Parameters`
**Subtitle:** `The non-negotiables we're designing around`

---

### Block 4 — Text Block `[ROW: right]`
**Type:** `text`
**Content:**

```
What we know going in

Category: [e.g. Skincare / Bodycare / Haircare / F&B / Apparel Accessory]
Format: [e.g. Serum / Balm / Powder / Tincture / Candle / etc.]
Price point target: [e.g. "$38–$48 retail — premium but accessible. Not prestige."]
Size / volume: [e.g. "30ml — enough to last 2 months at daily use, hits the right perceived-value weight"]
Hero ingredient or feature: [e.g. "Ceramide NP complex — the thing we're leading with scientifically and in copy"]
What it must NOT do or be: [e.g. "Cannot have fragrance. Cannot be sticky. Cannot read as clinical."]
Regulatory considerations: [e.g. "Cosmetic (not drug) claim territory — stay away from 'treats' or 'heals'"]
Target COGS: [e.g. "$6–$9 — needs to hit 75%+ gross margin at retail"]
```

---

### Block 5 — Section Header
**Type:** `section_header`
**Title:** `Open Questions`
**Subtitle:** `What we need to resolve before development moves forward`

---

### Block 6 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Confirm product format and finalize category positioning | 🔴 Urgent | [Owner] | [date] |
| Align on target retail price and COGS ceiling with ops | 🔴 Urgent | [Owner] | [date] |
| Define hero ingredient or product feature to lead with | 🟠 High | [Owner] | [date] |
| Decide on size / format / variant structure (single SKU vs multi) | 🟠 High | [Owner] | [date] |
| Confirm regulatory lane (cosmetic vs drug claim territory) | 🟠 High | [Owner] | [date] |
| Get founding team / key stakeholder sign-off on the concept | 🟠 High | [Owner] | [date] |

---

---

## SUBTAB 1B — Customer & Market

**Tab name:** `Customer & Market`
**Parent:** Product Vision

*Who this product is for, in enough detail that everyone making decisions can see her.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Who She Is`
**Subtitle:** `The customer this product is built for`

---

### Block 2 — Text Block `[ROW: left]`
**Type:** `text`
**Content:**

```
Customer Portrait

She is: [2–3 sentences painting a picture of this specific customer — not a demographic paragraph but a real person. Her life, her routine, her values, what she buys and why. Make it specific enough that anyone on the team could make a decision in her name.]

What she already uses: [The products currently in her rotation that this product will sit alongside — or displace]

What she's frustrated by: [The problem she's actively experiencing and the language she uses to describe it — ideally pulled from DMs, reviews, comments]

What she's looking for: [The outcome she wants — not the product but the feeling or result]

Where she finds new products: [TikTok? IG? Reddit skincare communities? Sephora shelves? Word of mouth? A founder she follows? Be honest.]

What she needs to believe before she buys: [The specific claim or proof point that gets her over the line]
```

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Market Context`
**Subtitle:** `The landscape this product is entering`

---

### Block 4 — Text Block `[ROW: right]`
**Type:** `text`
**Content:**

```
Market Snapshot

Category size & trajectory: [Is this category growing, peaking, or saturating? What's driving it? e.g. "Barrier repair is having a moment driven by the anti-over-exfoliation backlash on TikTok. Search volume up 40% YoY. Mainstream is just catching on."]

Where the demand is coming from: [Trend-driven? Community-driven? Founder-audience-driven? Clinical evidence-driven?]

The price tier we're entering: [Who's in our price bracket? How do we sit relative to them?]

What's overserved in this market: [Where there are too many products already — what everyone is doing that we're not going to do]

What's underserved: [The gap. Where customer reviews are negative, where searches go unanswered, where brands are making promises they're not keeping]

The timing argument: [Why launch this now vs. 12 months from now?]
```

---

---

## SUBTAB 1C — Competitive Landscape

**Tab name:** `Competitive Landscape`
**Parent:** Product Vision

*Know the field. Know what we're up against and what we're doing differently.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Competitor Map`
**Subtitle:** `Who's in the space and where we fit`

---

### Block 2 — Table Block
**Type:** `table`
**Columns:** Brand / Product | Price | Hero Claim | Format | Strengths | Weaknesses | Differentiation Opportunity
**Pre-populated rows:**

| Brand / Product | Price | Hero Claim | Format | Strengths | Weaknesses | Differentiation Opportunity |
|---|---|---|---|---|---|---|
| [Competitor 1] | $[X] | [Their lead claim] | [Format] | [What they do well] | [Where they fall short] | [What we can own that they can't] |
| [Competitor 2] | $[X] | [Their lead claim] | [Format] | [What they do well] | [Where they fall short] | [What we can own that they can't] |
| [Competitor 3] | $[X] | [Their lead claim] | [Format] | [What they do well] | [Where they fall short] | [What we can own that they can't] |
| [Competitor 4] | $[X] | [Their lead claim] | [Format] | [What they do well] | [Where they fall short] | [What we can own that they can't] |

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Our Positioning`
**Subtitle:** `Where we sit and what we own`

---

### Block 4 — Text Block
**Type:** `text`
**Content:**

```
Positioning Statement (internal, not for copy)

For [customer description] who [problem or desire], [Product Name] is the [category] that [key differentiator]. Unlike [main competitor or category norm], we [the thing that makes this impossible to copy or ignore].

What we own that nobody else does:
- [Specific differentiator #1 — ingredient, format, philosophy, brand equity, community, proof point]
- [Specific differentiator #2]
- [Specific differentiator #3]

What we're deliberately not competing on:
- [e.g. "We're not competing on price — we don't need to be the cheapest in the tier"]
- [e.g. "We're not competing on clinical dermatologist endorsement — that's a crowded lane"]
```

---

### Block 5 — Gallery Block
**Type:** `gallery`
**Placeholder:** Empty gallery — upload competitor product imagery, packaging references, and market visual landscape here. Use this to understand the visual field your product is entering.

---

---

# TAB 2 — Development (Parent Tab)

**Tab name:** `Development`

*This tab is a parent container. It has three subtabs: Formulation & Specs, Samples & Iteration, and Supplier & Vendor. The parent tab itself has no blocks — it loads the first subtab by default.*

---

## SUBTAB 2A — Formulation & Specs

**Tab name:** `Formulation & Specs`
**Parent:** Development

*The technical brief. What this product is made of, how it performs, and what it needs to do.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Product Brief`
**Subtitle:** `The technical and sensorial specification for this product`

---

### Block 2 — Text Block
**Type:** `text`
**Content:**

```
Formulation Brief

Product type: [e.g. Water-based serum / Oil-based balm / Powder-to-foam cleanser]

Desired texture & sensory experience: [How should it feel on application? Absorb speed? Finish? e.g. "Lightweight, absorbs in under 30 seconds, no residue, no tackiness — can go straight under SPF"]

Key functional claims we need to support:
1. [Claim #1 — e.g. "Visibly reduces redness within 4 weeks"]
2. [Claim #2 — e.g. "Strengthens skin barrier with daily use"]
3. [Claim #3 — e.g. "Safe for use immediately post-actives"]

Must-have ingredients: [The non-negotiables — what this formula needs to contain]

Must-NOT-have ingredients: [The exclusion list — fragrance, certain preservatives, actives that conflict with claims, allergens, customer sensitivities]

Stability requirements: [e.g. "24-month shelf life, stable at 40°C / 104°F, no color or scent change over time"]

Packaging compatibility: [e.g. "Must work in a 30ml glass dropper — no formula reactions with borosilicate glass"]

Regulatory lane: [Cosmetic only — stay within cosmetic claim territory, no drug claims]

COGS target: [$X–$X per unit at [MOQ] units]
```

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Specification Sheet`
**Subtitle:** `Technical documents — upload and maintain here`

---

### Block 4 — File Block `[ROW: left]`
**Type:** `file`
**Placeholder:** Empty file slot — upload technical product specification sheet here once drafted. This should include full INCI list, percentages, pH range, viscosity, preservative system, and stability data.

---

### Block 5 — File Block `[ROW: right]`
**Type:** `file`
**Placeholder:** Empty file slot — upload safety data sheet (SDS) and any stability or challenge test results here as they become available.

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** `Formulation Development Tasks`
**Subtitle:** `From brief to approved formula`

---

### Block 7 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Write and send formulation brief to lab / manufacturer | 🔴 Urgent | [Owner] | [date] |
| Confirm must-have and must-not-have ingredient list with founder | 🔴 Urgent | [Owner] | [date] |
| Align on COGS ceiling and MOQ with ops before lab engagement | 🔴 Urgent | [Owner] | [date] |
| Request first formula prototype from lab | 🟠 High | [Owner] | [date] |
| Review initial formula — sensory and texture evaluation | 🟠 High | [Owner] | [date] |
| Commission stability testing once formula is close to final | 🟠 High | [Owner] | [date] |
| Confirm INCI list and verify regulatory compliance | 🟠 High | [Owner] | [date] |
| Sign off on final approved formula | 🔴 Urgent | [Owner] | [date] |

---

---

## SUBTAB 2B — Samples & Iteration

**Tab name:** `Samples & Iteration`
**Parent:** Development

*The iterative log. Every sample round, every piece of feedback, every decision — tracked in one place.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Sample Rounds`
**Subtitle:** `Log every iteration — what came in, what we thought, what we changed`

---

### Block 2 — Table Block
**Type:** `table`
**Columns:** Round | Date Received | Sample Description | Who Evaluated | Texture / Sensory Feedback | Performance Feedback | Changes Requested | Decision
**Pre-populated rows:**

| Round | Date Received | Sample Description | Who Evaluated | Texture / Sensory Feedback | Performance Feedback | Changes Requested | Decision |
|---|---|---|---|---|---|---|---|
| Round 1 | [Date] | [e.g. "Initial prototype — 3% ceramide, no fragrance, glycerin base"] | [Names] | [e.g. "Too thick, sticky on dry-down, leaves slight film"] | [e.g. "Good absorption eventually but tacky phase is a dealbreaker"] | [e.g. "Reduce glycerin, add lightweight emollient, adjust pH"] | 🔄 Revise |
| Round 2 | [Date] | [e.g. "Reformulation — glycerin reduced, added squalane"] | [Names] | [e.g. "Much better. Absorbs cleanly. Slight oily finish still."] | [e.g. "Improved. Still one texture note to resolve."] | [e.g. "Reduce squalane by 1%, retest"] | 🔄 Revise |
| Round 3 | [Date] | [Describe] | [Names] | — | — | — | ⏳ Pending |

*Decision options: ✅ Approved · 🔄 Revise · ❌ Reject · ⏳ Pending*

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Sample Assets`
**Subtitle:** `Photos, videos, and documentation from each round`

---

### Block 4 — Gallery Block `[ROW: left]`
**Type:** `gallery`
**Placeholder:** Empty gallery — upload sample imagery here as rounds come in. Include photos of texture, application on skin, and any visual comparisons between rounds.

---

### Block 5 — File Block `[ROW: right]`
**Type:** `file`
**Placeholder:** Empty file slot — upload lab feedback documents, updated INCI lists, and iteration notes from the manufacturer here after each round.

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** `Sample Round Tasks`
**Subtitle:** `Actions tied to each review cycle`

---

### Block 7 — Task Block
**Type:** `task`
**View:** Board view, grouped by status
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Evaluate Round 1 sample — full team sensory review | 🔴 Urgent | [Owner] | [date] |
| Document Round 1 feedback and send revision brief to lab | 🔴 Urgent | [Owner] | [date] |
| Evaluate Round 2 sample | 🟠 High | [Owner] | [date] |
| Document Round 2 feedback and send revision brief | 🟠 High | [Owner] | [date] |
| Confirm final approved sample with lab | 🔴 Urgent | [Owner] | [date] |
| Request pre-production sample (PPS) for final sign-off | 🟠 High | [Owner] | [date] |
| Sign off on pre-production sample | 🔴 Urgent | [Owner] | [date] |
| Commission consumer perception study or panel if needed | 🟡 Medium | [Owner] | [date] |

---

---

## SUBTAB 2C — Supplier & Vendor

**Tab name:** `Supplier & Vendor`
**Parent:** Development

*Every manufacturer, lab, and supplier relationship in one place. Contacts, terms, timelines, and open items.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Supplier Directory`
**Subtitle:** `Everyone we're working with to build this product`

---

### Block 2 — Table Block
**Type:** `table`
**Columns:** Supplier / Vendor | Role | Primary Contact | Email | MOQ | Lead Time | Status | Notes
**Pre-populated rows:**

| Supplier / Vendor | Role | Primary Contact | Email | MOQ | Lead Time | Status | Notes |
|---|---|---|---|---|---|---|---|
| [Lab / CM name] | Contract manufacturer | [Name] | [email] | [X] units | [X] weeks | Active | Primary formulation partner |
| [Packaging supplier] | Bottles / closures | [Name] | [email] | [X] units | [X] weeks | Quoting | — |
| [Secondary packaging] | Boxes / cartons | [Name] | [email] | [X] units | [X] weeks | Quoting | — |
| [Testing lab] | Stability + safety testing | [Name] | [email] | — | [X] weeks | Active | — |
| [Fulfillment / 3PL] | Pick, pack, ship | [Name] | [email] | — | — | Active | — |

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Supplier Documents`
**Subtitle:** `Agreements, quotes, and key correspondence`

---

### Block 4 — File Block
**Type:** `file`
**Placeholder:** Empty file slot — upload manufacturer agreements, NDAs, quality agreements, and production quotes here. Keep the most current version of each document.

---

### Block 5 — Section Header
**Type:** `section_header`
**Title:** `Open Supplier Actions`
**Subtitle:** `What needs to happen with vendors this week`

---

### Block 6 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Send finalized formulation brief to contract manufacturer | 🔴 Urgent | [Owner] | [date] |
| Request packaging quotes from 2–3 suppliers | 🟠 High | [Owner] | [date] |
| Confirm MOQ and unit pricing with CM | 🔴 Urgent | [Owner] | [date] |
| Review and sign quality agreement with CM | 🟠 High | [Owner] | [date] |
| Align fulfillment partner on timeline and inbound expectations | 🟠 High | [Owner] | [date] |
| Confirm lead times with all active suppliers | 🟠 High | [Owner] | [date] |
| Review stability testing timeline and confirm delivery date | 🟡 Medium | [Owner] | [date] |

---

---

# TAB 3 — Brand & Naming

**Tab name:** `Brand & Naming`

*No subtabs. The product's identity — what it's called, how it sounds, what it stands for within the brand.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Product Naming`
**Subtitle:** `Candidates, criteria, and the path to a decision`

---

### Block 2 — Text Block `[ROW: left]`
**Type:** `text`
**Content:**

```
Naming Brief

What this product needs to communicate through its name:
- [e.g. "Recovery / restoration — the idea that this brings skin back to itself"]
- [e.g. "Simplicity — it's not trying to be clever, it's trying to be useful"]
- [e.g. "Fits within our existing naming architecture — [Brand]'s names follow [pattern]"]

What the name must NOT do:
- [e.g. "No clinical or pharmaceutical sound — we're not a lab brand"]
- [e.g. "No ingredient-forward naming — we don't lead with what's in it, we lead with what it does"]
- [e.g. "No generic descriptors — 'Hydrating Serum' is not a name"]

Naming territory we're exploring:
[e.g. "Something tactile and sensory — words that feel like what the product does. Barrier. Silk. Repair. Still. Restore."]

Trademark check required before any name is final: [Yes / No — note who is handling this]
```

---

### Block 3 — Text Block `[ROW: right]`
**Type:** `text`
**Content:**

```
Tone of Voice for [Product Name]

The brand already sounds like: [Describe the master brand voice briefly]

This product, specifically, should sound like: [Where does this product sit within that voice? Warmer? More direct? More technical? More poetic? What's the specific register?]

Words and phrases we're reaching for:
[List 8–12 words or phrases that should feel native to this product's copy — the words you'd use in a caption, an email, a PDP headline]

Words and phrases we're avoiding:
[List 8–12 words that feel wrong for this product — the things other brands say that we'd never say]

Reference copy — write the product in one sentence as if it appeared on our site today:
[This is your north star. If this sentence is right, the whole tone is right.]
```

---

### Block 4 — Section Header
**Type:** `section_header`
**Title:** `Name Candidates`
**Subtitle:** `Every option on the table — scored and tracked`

---

### Block 5 — Table Block
**Type:** `table`
**Columns:** Name Candidate | Rationale | Trademark Clear | Team Rating (1–5) | Status
**Pre-populated rows:**

| Name Candidate | Rationale | Trademark Clear | Team Rating (1–5) | Status |
|---|---|---|---|---|
| [Name Option 1] | [Why this name, what it communicates] | [Yes / No / TBD] | — | Under consideration |
| [Name Option 2] | [Why this name, what it communicates] | [Yes / No / TBD] | — | Under consideration |
| [Name Option 3] | [Why this name, what it communicates] | [Yes / No / TBD] | — | Under consideration |
| [Name Option 4] | [Why this name, what it communicates] | [Yes / No / TBD] | — | Under consideration |
| [Name Option 5] | [Why this name, what it communicates] | [Yes / No / TBD] | — | Under consideration |

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** `Naming & Brand Tasks`
**Subtitle:** `Decisions that need to get made`

---

### Block 7 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Generate first round of name candidates (minimum 10) | 🟠 High | [Owner] | [date] |
| Run trademark availability check on top 3 names | 🔴 Urgent | [Owner] | [date] |
| Review name candidates with founding team — score and narrow to 3 | 🟠 High | [Owner] | [date] |
| Test final 2 name candidates with a small group of target customers | 🟡 Medium | [Owner] | [date] |
| Lock final product name | 🔴 Urgent | [Owner] | [date] |
| Write tone of voice brief for this product | 🟠 High | [Owner] | [date] |
| Confirm name fits within existing product naming architecture | 🟠 High | [Owner] | [date] |

---

---

# TAB 4 — Packaging & Design (Parent Tab)

**Tab name:** `Packaging & Design`

*This tab is a parent container. It has three subtabs: Design Direction, Artwork & Files, and Regulatory & Claims. The parent tab itself has no blocks — it loads the first subtab by default.*

---

## SUBTAB 4A — Design Direction

**Tab name:** `Design Direction`
**Parent:** Packaging & Design

*The visual world of this product. The brief that all packaging design derives from.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Packaging Design Brief`
**Subtitle:** `The world this packaging lives in`

---

### Block 2 — Text Block
**Type:** `text`
**Content:**

```
Packaging Design Direction

The feeling this packaging should communicate on shelf / on a bathroom counter:
[Not "premium" — that's too vague. Something like: "Quiet confidence. The kind of product you put on your counter because it looks like it belongs there. Not loud. Not clinical. Considered."]

Visual direction:
- Primary color: [e.g. "Warm off-white — not pure white, not cream. The white of an unbleached cotton t-shirt."]
- Typography direction: [e.g. "Serif-leaning. Feels editorial, not pharmaceutical. Something like the masthead of a well-designed magazine."]
- Finish: [e.g. "Matte. No high-gloss. Consider soft-touch if within budget."]
- Logo treatment: [e.g. "Centered, small, confident. Not trying to dominate the package."]
- Label size and placement: [e.g. "Full wrap, top to bottom — use the space, don't leave it empty"]

Packaging format:
- Primary container: [e.g. "30ml amber glass dropper bottle"]
- Secondary packaging: [e.g. "Rigid kraft-lined box, custom insert"]
- Sustainability considerations: [e.g. "FSC-certified paper, recyclable glass, no plastic components where avoidable"]

Reference brands / packaging we love:
[Name 3–5 specific packaging references and why — be specific about what you love about them, not just that they're beautiful]

What we're explicitly avoiding:
[e.g. "The over-designed wellness aesthetic — too many icons, ingredient callouts crowding the label", "Anything that reads as 'clean beauty 2019' — we've moved on"]
```

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Mood Board`
**Subtitle:** `The visual world — references, palette, and packaging inspiration`

---

### Block 4 — Gallery Block `[ROW: left]`
**Type:** `gallery`
**Placeholder:** Empty gallery — upload packaging reference imagery, color palette swatches, material and finish references, and typography references. This is the visual brief for your designer.

---

### Block 5 — Image Block `[ROW: right]`
**Type:** `image`
**Placeholder:** Empty image slot — upload a sketch or rough mockup of the packaging structure here if one exists. Label: *"Initial packaging concept / structural sketch"*

---

---

## SUBTAB 4B — Artwork & Files

**Tab name:** `Artwork & Files`
**Parent:** Packaging & Design

*Every file, every proof, every version — tracked from first draft to print-ready.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Dielines & Structural Files`
**Subtitle:** `The technical foundation — supplied by packaging manufacturer`

---

### Block 2 — File Block `[ROW: left]`
**Type:** `file`
**Placeholder:** Empty file slot — upload manufacturer-supplied dieline files here (AI, PDF, or EPS format). These are the templates your designer works on. Label: *"Primary container dieline — [supplier name]"*

---

### Block 3 — File Block `[ROW: right]`
**Type:** `file`
**Placeholder:** Empty file slot — upload secondary packaging dieline here. Label: *"Outer carton / secondary packaging dieline — [supplier name]"*

---

### Block 4 — Section Header
**Type:** `section_header`
**Title:** `Design Versions`
**Subtitle:** `Every proof, every round — keep the history`

---

### Block 5 — Table Block
**Type:** `table`
**Columns:** Version | Date | Designer | Description of Changes | Status | Feedback
**Pre-populated rows:**

| Version | Date | Designer | Description of Changes | Status | Feedback |
|---|---|---|---|---|---|
| v0.1 | [Date] | [Designer] | Initial concept — layout and typography | In review | [Add feedback here] |
| v0.2 | [Date] | [Designer] | Revised typography, adjusted color | In review | — |
| v0.3 | [Date] | [Designer] | — | — | — |
| Final | [Date] | [Designer] | Print-ready — approved for production | Approved | — |

---

### Block 6 — Gallery Block
**Type:** `gallery`
**Placeholder:** Empty gallery — upload design mockups and proof images here as they come in. Add each new version as it's received so the evolution is visible.

---

### Block 7 — File Block
**Type:** `file`
**Placeholder:** Empty file slot — upload final print-ready artwork files here once approved. Label: *"FINAL PRINT FILES — [date approved]"* — this should be the version that goes to the manufacturer.

---

### Block 8 — Section Header
**Type:** `section_header`
**Title:** `Artwork Tasks`
**Subtitle:** `From first brief to print-ready`

---

### Block 9 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Send packaging design brief and dielines to designer | 🔴 Urgent | [Owner] | [date] |
| Review initial design concept (v0.1) — full team feedback | 🟠 High | [Owner] | [date] |
| Send consolidated feedback to designer after Round 1 review | 🟠 High | [Owner] | [date] |
| Review revised design (v0.2) | 🟠 High | [Owner] | [date] |
| Request physical mock-up / printed proof from manufacturer | 🟠 High | [Owner] | [date] |
| Review physical mock-up — color accuracy, finish, structure | 🔴 Urgent | [Owner] | [date] |
| Approve final artwork — sign off for production | 🔴 Urgent | [Owner] | [date] |
| Send print-ready files to manufacturer | 🔴 Urgent | [Owner] | [date] |

---

---

## SUBTAB 4C — Regulatory & Claims

**Tab name:** `Regulatory & Claims`
**Parent:** Packaging & Design

*Everything that has to be on the label — and everything that can't be. Compliance before it goes to print.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Required Label Elements`
**Subtitle:** `What must appear on the packaging — legal and regulatory requirements`

---

### Block 2 — Text Block
**Type:** `text`
**Content:**

```
Label Requirements Checklist

The following must be confirmed before artwork goes to print:

United States (FDA — Cosmetic):
- Product identity statement (what the product is)
- Net quantity of contents (weight or volume — must be in both metric and US customary)
- Name and address of responsible party (brand / manufacturer)
- Ingredient list (INCI names, in descending order of concentration)
- Any required warnings (if applicable)

International (if selling internationally — note markets):
- [EU: CPNP registration, responsible person designation, EU address on label]
- [UK: UK Responsible Person post-Brexit]
- [Canada: Bilingual labeling requirements (English/French), Cosmetic Notification Form]

Claims compliance:
- All claims on packaging have been reviewed against FDA OTC/Cosmetic distinction
- No drug claims present (e.g. "treats", "heals", "cures")
- All clinically-supported claims have data or testing to back them up

Certifications to include (if applicable):
- [e.g. Leaping Bunny / Cruelty Free]
- [e.g. EWG Verified]
- [e.g. COSMOS Organic / USDA Organic]
- [e.g. FSC-certified packaging symbol]
```

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Claims Review`
**Subtitle:** `Every claim on the label and packaging — reviewed and approved`

---

### Block 4 — Table Block
**Type:** `table`
**Columns:** Claim | Where It Appears | Claim Type | Evidence / Basis | Regulatory Review | Approved
**Pre-populated rows:**

| Claim | Where It Appears | Claim Type | Evidence / Basis | Regulatory Review | Approved |
|---|---|---|---|---|---|
| [e.g. "Clinically tested"] | Front label | Cosmetic claim | [3rd party study / consumer panel] | [Reviewer name] | ⏳ Pending |
| [e.g. "Strengthens skin barrier"] | Front label + PDP | Cosmetic claim | [Study / data reference] | [Reviewer name] | ⏳ Pending |
| [e.g. "Fragrance free"] | Back label | Factual | INCI list confirmation | [Reviewer name] | ⏳ Pending |
| [e.g. "Dermatologist tested"] | Front label | Cosmetic claim | [Testing lab / dermatologist name] | [Reviewer name] | ⏳ Pending |

---

### Block 5 — File Block
**Type:** `file`
**Placeholder:** Empty file slot — upload regulatory review documents, claims substantiation files, and any certifications here. Label: *"Regulatory & Claims Documentation"*

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** `Regulatory Tasks`
**Subtitle:** `Must be complete before artwork is finalized`

---

### Block 7 — Task Block
**Type:** `task`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Owner | Due |
|---|---|---|---|
| Confirm all required label elements are present in artwork | 🔴 Urgent | [Owner] | [date] |
| Review all claims on packaging for regulatory compliance | 🔴 Urgent | [Owner] | [date] |
| Verify INCI list is correct, complete, and in correct order | 🔴 Urgent | [Owner] | [date] |
| Confirm net quantity is in correct format (metric + US customary) | 🟠 High | [Owner] | [date] |
| Obtain certifications / logos needed for label (Leaping Bunny, etc.) | 🟠 High | [Owner] | [date] |
| If selling internationally — confirm market-specific requirements | 🟠 High | [Owner] | [date] |
| Legal / regulatory sign-off on final label before print | 🔴 Urgent | [Owner] | [date] |

---

---

# TAB 5 — Roadmap

**Tab name:** `Roadmap`

*No subtabs. The full product development timeline — one view, from concept to launch-ready.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** `Development Roadmap`
**Subtitle:** `Every phase from concept to launch-ready — in one view`

---

### Block 2 — Timeline Block
**Type:** `timeline`
**Pre-populated events:**

| Milestone | Date | Notes |
|---|---|---|
| Concept Signed Off | [Date] | Product brief approved, development begins |
| Formulation Brief to Lab | [Date] | Brief sent, first prototype in motion |
| Round 1 Sample Received | [Date] | First product sample in hand for review |
| Round 2 Sample Received | [Date] | Revised formulation — texture and performance review |
| Formula Approved | [Date] | Final formulation locked — no more changes |
| Pre-Production Sample Approved | [Date] | PPS signed off — cleared for production |
| Product Name Locked | [Date] | Final name confirmed, trademark cleared |
| Packaging Design Brief Issued | [Date] | Designer briefed, dielines shared |
| Artwork v1 Received | [Date] | First design proof in review |
| Artwork Final Approved | [Date] | Print-ready files signed off |
| Regulatory Sign-Off | [Date] | All claims and label elements approved |
| Print Files to Manufacturer | [Date] | Final files sent — production begins |
| Production Complete | [Date] | Finished goods ready — hands off to Product Launch |

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** `Phase Overview`
**Subtitle:** `Where we are across each workstream`

---

### Block 4 — Chart Block `[ROW: left]`
**Type:** `chart`
**Purpose:** Task completion by phase — show percentage of tasks completed per development phase (Formulation, Sampling, Branding, Packaging, Regulatory). Pulled from task blocks across the template. Gives a bird's-eye view of which phases are ahead and which are blocked.

---

### Block 5 — Section Header
**Type:** `section_header`
**Title:** `Launch Readiness`
**Subtitle:** `The checklist that says we're done here and ready to launch`

---

### Block 6 — Task Block `[ROW: right]`
**Type:** `task`
**View:** List view — all tasks set to 🔴 Urgent
**Pre-populated tasks:**

| Task | Owner |
|---|---|
| Final formula approved and PPS signed off | [Owner] |
| Supplier agreements and production POs confirmed | [Owner] |
| Product name finalized and trademark cleared | [Owner] |
| Packaging artwork approved and print files sent | [Owner] |
| All label claims reviewed and regulatory sign-off obtained | [Owner] |
| COGS confirmed at or below target | [Owner] |
| Production timeline confirmed with manufacturer | [Owner] |
| 3PL / fulfillment partner aligned on inbound timeline | [Owner] |
| Product brief and all key documents filed and organized in Drive | [Owner] |
| Handoff to Product Launch template — campaign work begins | [Owner] |

---

---

*End of template spec. Build exactly as documented above. All placeholder content should be pre-populated on instantiation so users can start working immediately.*
