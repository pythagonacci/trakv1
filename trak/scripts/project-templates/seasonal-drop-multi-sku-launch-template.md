# Trak — Seasonal Drop / Multi-SKU Launch Template

**Project name:** `[Brand Name] — [Drop Name]`
**Suggested tags:** `drop`, `launch`, `seasonal`
**Default status:** `not_started`

# TAB 1 — Launch HQ

**Tab name:** `Launch HQ`

### Block 1 — Drop Overview
**Type:** `section_header`
**Title:** `[Drop Name]`
**Subtitle:** `[Number] SKUs · Launch [Date] · [Channel strategy in one line]`

### Block 2 — Campaign Brief
**Type:** `text`
**Content:**

```
*This is your campaign command center. Fill in the brief, pin your Shopify products, and keep the master task tracker updated throughout the launch. The Launch Day subtab is your go-live checklist.*

Campaign Brief

*Write your campaign brief here. Cover what this drop is, why it exists, what makes it different from your core line, the launch window, and whether you're doing a restock. Keep it to a paragraph so anyone on the team can get aligned fast.*
```

### Block 3 — Drop Details [ROW: left]
**Type:** `text`
**Content:**

```
Drop Details

*Drop name:*
*Launch date:*
*Channel priority: (e.g. Email → IG → TikTok)*
*Price points per SKU:*
*Unit quantities per SKU:*
```

### Block 4 — Who We're Talking To [ROW: right]
**Type:** `text`
**Content:**

```
Who We're Talking To

*Describe your target customer for this drop. Age, mindset, where they found you, and what they respond to. Be specific. This should inform copy, creative direction, and channel strategy downstream.*
```

### Block 5 — Products
**Type:** `section_header`
**Title:** `Products`
**Subtitle:** `Pinned from Shopify — live inventory and variant status`

### Block 6 — SKU 1 [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach your Shopify product here.

### Block 7 — SKU 2 [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach your Shopify product here.

### Block 8 — SKU 3 [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach your Shopify product here.

### Block 9 — Master Task Tracker
**Type:** `section_header`
**Title:** `Master Task Tracker`
**Subtitle:** `All open tasks across the project, organized by phase`

### Block 10 — All Project Tasks
**Type:** `task`
**Title:** `All Project Tasks`
**View:** List view
**Rollup:** `Project-wide live mirror`

### Block 13 — Launch Timeline
**Type:** `section_header`
**Title:** `Launch Timeline`
**Subtitle:** `Add your milestones from brief to drop`

### Block 14 — Launch Timeline
**Type:** `timeline`
**Pre-populated events:**

| Milestone | Notes |
|---|---|
| Brief locked | Start here |
| Photographer / creative team briefed | Work backwards from launch |
| Samples approved |  |
| Shoot day |  |
| Assets delivered |  |
| Copy finalized |  |
| PR packages shipped |  |
| Shopify listings live (hidden) |  |
| Final QA pass |  |
| Email #1 — Teaser |  |
| Email #2 — Countdown |  |
| Drop goes live |  |
| Post-launch debrief |  |

## SUBTAB 1A — Launch Day

**Tab name:** `Launch Day`
**Parent:** Launch HQ

### Block 1 — Go Time
**Type:** `section_header`
**Title:** `[Launch Date] — Go Time`
**Subtitle:** `Run this tab top to bottom before [launch time]`

### Block 2 — Launch Day Checklist
**Type:** `task`
**Title:** `Launch Day Checklist`
**View:** List view
**Pre-populated tasks:**

| Task | Status |
|---|---|
| Confirm all Shopify listings are active | To-Do |
| Confirm inventory counts match plan | To-Do |
| Send or confirm scheduled email — countdown | To-Do |
| Post IG Story — countdown | To-Do |
| Post TikTok — launch content | To-Do |
| Flip listings / collection page to visible | To-Do |
| Send live email | To-Do |
| Monitor Shopify orders — first hour | To-Do |
| Post IG feed — campaign image | To-Do |
| Screenshot sold-out moment | To-Do |
| Send internal recap | To-Do |

### Block 3 — SKU 1 Monitor [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the live Shopify product for SKU 1.

### Block 4 — SKU 2 Monitor [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the live Shopify product for SKU 2.

### Block 5 — SKU 3 Monitor [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the live Shopify product for SKU 3.

# TAB 2 — Product Lineup

**Tab name:** `Product Lineup`

## SUBTAB 2A — SKU 1

**Tab name:** `SKU 1`
**Parent:** Product Lineup

### Block 1 — Product Overview
**Type:** `section_header`
**Title:** `[Product Name]`
**Subtitle:** `[Brief positioning line — e.g. "Hero SKU — limited run of X units"]`

### Block 2 — Shopify Product
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach this SKU's Shopify product here. This block shows live inventory, variant status, units sold, and price.

### Block 3 — Product Story [ROW: left]
**Type:** `text`
**Content:**

```
Product Story

*What is this product and why does it exist? Write the internal product story here: the ingredient angle, the texture, the use case. This is not PDP copy. This is the version that gives your team context and conviction.*
```

### Block 4 — Key Details [ROW: right]
**Type:** `text`
**Content:**

```
Key Details

*Price:*
*Units available:*
*Variants:*
*Hero ingredients:*
*Packaging:*
*Status:*
```

### Block 5 — Product Tasks
**Type:** `task`
**Title:** `[Product Name] — Product Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Approve product sample | 🔴 Urgent | To-Do |
| Finalize ingredient list for PDP | 🟠 High | To-Do |
| Write PDP copy | 🟠 High | To-Do |
| Approve product photography | 🟠 High | To-Do |
| Build Shopify listing | 🔴 Urgent | To-Do |
| QA listing — copy, images, price, inventory | 🔴 Urgent | To-Do |
| Confirm units received from manufacturer | 🔴 Urgent | To-Do |

### Block 6 — Product Photography
**Type:** `image`
**Placeholder state:** Empty image block — upload final product photography here once delivered. Hero shot, flat lay, on-skin.

### Block 7 — Product Documents
**Type:** `file`
**Placeholder state:** Empty file block — attach manufacturer spec sheet, ingredient INCI list, and safety documentation here.

## SUBTAB 2B — SKU 2

**Tab name:** `SKU 2`
**Parent:** Product Lineup

### Block 1 — Product Overview
**Type:** `section_header`
**Title:** `[Product Name]`
**Subtitle:** `[Brief positioning line — e.g. "Core support SKU — limited run of X units"]`

### Block 2 — Shopify Product
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach this SKU's Shopify product here. This block shows live inventory, variant status, units sold, and price.

### Block 3 — Product Story [ROW: left]
**Type:** `text`
**Content:**

```
Product Story

*What is this product and why does it exist? Write the internal product story here: the ingredient angle, the texture, the use case. This is not PDP copy. This is the version that gives your team context and conviction.*
```

### Block 4 — Key Details [ROW: right]
**Type:** `text`
**Content:**

```
Key Details

*Price:*
*Units available:*
*Variants:*
*Hero ingredients:*
*Packaging:*
*Status:*
```

### Block 5 — Product Tasks
**Type:** `task`
**Title:** `[Product Name] — Product Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Approve product sample | 🔴 Urgent | To-Do |
| Finalize ingredient list for PDP | 🟠 High | To-Do |
| Write PDP copy | 🟠 High | To-Do |
| Approve product photography | 🟠 High | To-Do |
| Build Shopify listing | 🔴 Urgent | To-Do |
| QA listing — copy, images, price, inventory | 🔴 Urgent | To-Do |
| Confirm units received from manufacturer | 🔴 Urgent | To-Do |

### Block 6 — Product Photography
**Type:** `image`
**Placeholder state:** Empty image block — upload final product photography here once delivered. Hero shot, flat lay, on-skin.

### Block 7 — Product Documents
**Type:** `file`
**Placeholder state:** Empty file block — attach manufacturer spec sheet, ingredient INCI list, and safety documentation here.

## SUBTAB 2C — SKU 3

**Tab name:** `SKU 3`
**Parent:** Product Lineup

### Block 1 — Product Overview
**Type:** `section_header`
**Title:** `[Product Name]`
**Subtitle:** `[Brief positioning line — e.g. "Support SKU — limited run of X units"]`

### Block 2 — Shopify Product
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach this SKU's Shopify product here. This block shows live inventory, variant status, units sold, and price.

### Block 3 — Product Story [ROW: left]
**Type:** `text`
**Content:**

```
Product Story

*What is this product and why does it exist? Write the internal product story here: the ingredient angle, the texture, the use case. This is not PDP copy. This is the version that gives your team context and conviction.*
```

### Block 4 — Key Details [ROW: right]
**Type:** `text`
**Content:**

```
Key Details

*Price:*
*Units available:*
*Variants:*
*Hero ingredients:*
*Packaging:*
*Status:*
```

### Block 5 — Product Tasks
**Type:** `task`
**Title:** `[Product Name] — Product Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Approve product sample | 🔴 Urgent | To-Do |
| Finalize ingredient list for PDP | 🟠 High | To-Do |
| Write PDP copy | 🟠 High | To-Do |
| Approve product photography | 🟠 High | To-Do |
| Build Shopify listing | 🔴 Urgent | To-Do |
| QA listing — copy, images, price, inventory | 🔴 Urgent | To-Do |
| Confirm units received from manufacturer | 🔴 Urgent | To-Do |

### Block 6 — Product Photography
**Type:** `image`
**Placeholder state:** Empty image block — upload final product photography here once delivered. Hero shot, flat lay, on-skin.

### Block 7 — Product Documents
**Type:** `file`
**Placeholder state:** Empty file block — attach manufacturer spec sheet, ingredient INCI list, and safety documentation here.

# TAB 3 — Creative Direction

**Tab name:** `Creative Direction`

### Block 1 — Creative Direction
**Type:** `section_header`
**Title:** `Creative Direction — [Drop Name]`
**Subtitle:** `Visual identity, shoot brief, and asset direction`

### Block 2 — Creative Vision
**Type:** `text`
**Content:**

```
*This tab is your creative brief and shoot direction. Capture the visual vision, build the moodboard, write the shoot brief, and track all creative tasks from here.*

Creative Vision

*Describe the visual world of this drop. What does it feel like? What are your reference points? What's the light, the surface, the mood? Be specific enough that a photographer could walk into a shoot without asking questions.*

*Palette:*
*Mood:*
*References:*
*What to avoid:*
```

### Block 3 — Moodboard
**Type:** `section_header`
**Title:** `Moodboard`
**Subtitle:** `Visual references for shoot direction and overall campaign feel`

### Block 4 — Campaign Moodboard
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload 8–12 reference images here. Campaign imagery, texture references, skin references, packaging inspiration.

### Block 5 — Shoot Brief
**Type:** `section_header`
**Title:** `Shoot Brief`
**Subtitle:** `Everything the photographer needs before arriving on set`

### Block 6 — Shoot Details [ROW: left]
**Type:** `text`
**Content:**

```
Shoot Details

*Shoot date:*
*Location:*
*Photographer:*
*Creative lead on set:*
*Call time:*
*Wrap:*
*Deliverables due:*
*File format and delivery method:*
```

### Block 7 — Dos and Don'ts [ROW: right]
**Type:** `text`
**Content:**

```
Dos and Don'ts

*Do:*
*(List 4–5 specific creative directions)*

*Don't:*
*(List 4–5 things to avoid)*
```

### Block 8 — Shot List
**Type:** `section_header`
**Title:** `Shot List`
**Subtitle:** `Required deliverables per SKU — minimum selects noted`

### Block 9 — Shot List
**Type:** `table`
**Columns:** Shot Type | SKU | Setting | Min. Selects | Shot Status (Not Started / In Shoot / In Review / Approved)
**Pre-populated rows:**

| Shot Type | SKU | Setting | Min. Selects | Shot Status (Not Started / In Shoot / In Review / Approved) |
|---|---|---|---|---|
| Hero flat lay | SKU 1 | [Surface / backdrop] | 1 | Not Started |
| On-skin application | SKU 1 | [Location] | 2 | Not Started |
| Lifestyle / context shot | SKU 1 | [Location] | 1 | Not Started |
| Hero flat lay | SKU 2 | [Surface / backdrop] | 1 | Not Started |
| On-skin application | SKU 2 | [Location] | 2 | Not Started |
| Lifestyle / context shot | SKU 2 | [Location] | 1 | Not Started |
| Hero flat lay | SKU 3 | [Surface / backdrop] | 1 | Not Started |
| On-skin application | SKU 3 | [Location] | 2 | Not Started |
| Lifestyle / context shot | SKU 3 | [Location] | 1 | Not Started |
| Full collection flat lay | All | [Location] | 1 | Not Started |
| Campaign hero | All | [Location] | 1 | Not Started |

### Block 10 — Reference Assets
**Type:** `section_header`
**Title:** `Reference Assets`
**Subtitle:** `Files for the creative team and photographer`

### Block 11 — Shoot Prep Files
**Type:** `file`
**Placeholder state:** Empty file block — attach brand guidelines, packaging spec sheets, prop list, and any reference files the creative team needs before shoot day.

### Block 12 — Raw Selects — Post Shoot
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload raw selects here after shoot. The creative lead can review and mark hero selects before editing begins.

### Block 13 — Final Edited Assets
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload final edited campaign images here once delivered. These move into Assets + Approvals for sign-off.

### Block 14 — Creative Tasks
**Type:** `section_header`
**Title:** `Creative Tasks`
**Subtitle:** `Track the work required to get from moodboard to approved assets`

### Block 15 — Creative Direction Tasks
**Type:** `task`
**Title:** `Creative Direction Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Finalize moodboard and upload | 🟠 High | To-Do |
| Send creative brief to photographer | 🔴 Urgent | To-Do |
| Confirm shot list with photographer | 🟠 High | To-Do |
| Ship products to shoot location | 🔴 Urgent | To-Do |
| Attend shoot — creative direction on set | 🔴 Urgent | To-Do |
| Review raw selects | 🟠 High | To-Do |
| Request edits from photographer | 🟡 Medium | To-Do |
| Approve final edited assets | 🔴 Urgent | To-Do |
| Move approved assets to Assets + Approvals | 🟠 High | To-Do |

### Block 16 — Design Files
**Type:** `embed`
**Placeholder:** Paste your Figma, Canva, or other design file link here. Moodboard comps, typography direction, packaging mockups.

# TAB 4 — Campaign Rollout + PR

**Tab name:** `Campaign Rollout + PR`

### Block 1 — Campaign Rollout + PR
**Type:** `section_header`
**Title:** `Campaign Rollout + PR`
**Subtitle:** `Channel strategy, email sequence, social calendar, seeding`

### Block 2 — Rollout Strategy
**Type:** `text`
**Content:**

```
*This tab is your outbound engine. Plan your email sequence, build your social calendar, and manage your seeding list. Tasks at the bottom are broken out by email, social, and PR.*

Rollout Strategy

*Describe your channel strategy for this drop in a paragraph. Which channel goes first? What's the timing between channels? Are you doing a list-first window before social? No paid ads, or paid support? Write this once so the team is aligned.*
```

### Block 3 — Email Sequence
**Type:** `section_header`
**Title:** `Email Sequence`
**Subtitle:** `Map out every email before you write them`

### Block 4 — Email Sequence
**Type:** `table`
**Columns:** Email | Subject Line | Send Date | Send Time | Segment | Send State (Not Started / Draft / Approved / Scheduled / Sent)
**Pre-populated rows:**

| Email | Subject Line | Send Date | Send Time | Segment | Send State (Not Started / Draft / Approved / Scheduled / Sent) |
|---|---|---|---|---|---|
| #1 — Teaser | [Write your subject line] |  |  | [Segment] | Not Started |
| #2 — Countdown | [Write your subject line] |  |  | [Segment] | Not Started |
| #3 — We're Live | [Write your subject line] |  |  | [Segment] | Not Started |
| #4 — Sold Out | [Write your subject line] |  |  | [Segment] | Not Started |
| #5 — Waitlist | [Write your subject line] |  |  | [Segment] | Not Started |

### Block 5 — Email Copy Drafts
**Type:** `file`
**Placeholder state:** Empty file block — upload email copy drafts here as they're written. Final approved versions go in Assets + Approvals.

### Block 6 — Social Content Calendar
**Type:** `section_header`
**Title:** `Social Content Calendar`
**Subtitle:** `Instagram and TikTok — organic rollout`

### Block 7 — Social Calendar
**Type:** `table`
**Columns:** Platform | Content Type | Caption Direction | Post Date | Content State (Not Started / In Production / Ready / Posted) | Asset Needed
**Pre-populated rows:**

| Platform | Content Type | Caption Direction | Post Date | Content State (Not Started / In Production / Ready / Posted) | Asset Needed |
|---|---|---|---|---|---|
| Instagram | Feed — campaign hero | [Caption direction] |  | Not Started | [Asset] |
| Instagram | Story — countdown | [Caption direction] |  | Not Started | [Asset] |
| TikTok | Launch video | [Caption direction] |  | Not Started | [Asset] |
| Instagram | Feed — collection flat lay | [Caption direction] |  | Not Started | [Asset] |
| Instagram | Story — link live | [Caption direction] |  | Not Started | [Asset] |
| TikTok | Sold out moment | [Caption direction] |  | Not Started | [Asset] |
| Instagram | Feed — sold out post | [Caption direction] |  | Not Started | [Asset] |

### Block 8 — PR + Seeding
**Type:** `section_header`
**Title:** `PR + Seeding`
**Subtitle:** `Packages should ship at least 10 days before launch`

### Block 9 — Seeding Strategy
**Type:** `text`
**Content:**

```
Seeding Strategy

*How many packages are you sending? Who are you targeting — micro-creators, editors, both? What's the profile you're looking for? Write your seeding criteria here so the list stays focused.*
```

### Block 10 — Seeding List
**Type:** `table`
**Columns:** Name | Contact Type (Creator / Editor / Press) | Platform | Followers | Address Confirmed | Package Shipped | Posted
**Pre-populated rows:**

| Name | Contact Type (Creator / Editor / Press) | Platform | Followers | Address Confirmed | Package Shipped | Posted |
|---|---|---|---|---|---|---|
| — | Creator | — |  | ☐ | ☐ | ☐ |
| — | Creator | — |  | ☐ | ☐ | ☐ |
| — | Creator | — |  | ☐ | ☐ | ☐ |
| — | Creator | — |  | ☐ | ☐ | ☐ |
| — | Creator | — |  | ☐ | ☐ | ☐ |
| — | Editor | — |  | ☐ | ☐ | ☐ |
| — | Editor | — |  | ☐ | ☐ | ☐ |
| — | Press | — |  | ☐ | ☐ | ☐ |
| — | Press | — |  | ☐ | ☐ | ☐ |
| — | Creator | — |  | ☐ | ☐ | ☐ |

### Block 11 — PR Files
**Type:** `file`
**Placeholder state:** Empty file block — attach press release, pitch email template, package insert copy, and shipping label sheet here.

### Block 12 — Rollout Tasks
**Type:** `section_header`
**Title:** `Rollout Tasks`
**Subtitle:** `Execution work across email, social, and PR`

### Block 13 — Email Tasks
**Type:** `task`
**Title:** `Email Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all email drafts | 🟠 High | To-Do |
| Design email templates | 🟠 High | To-Do |
| Upload to email platform and QA | 🔴 Urgent | To-Do |
| Schedule teaser and countdown emails | 🔴 Urgent | To-Do |
| Confirm live email send on launch morning | 🔴 Urgent | To-Do |
| Send sold-out email | 🔴 Urgent | To-Do |
| Build waitlist form and segment | 🟠 High | To-Do |

### Block 14 — Social Tasks
**Type:** `task`
**Title:** `Social Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all captions | 🟠 High | To-Do |
| Edit launch video | 🟠 High | To-Do |
| Schedule feed posts | 🟠 High | To-Do |
| Prepare Story assets | 🟡 Medium | To-Do |
| Go live on launch morning | 🔴 Urgent | To-Do |
| Post sold-out content | 🟠 High | To-Do |

### Block 15 — PR + Seeding Tasks
**Type:** `task`
**Title:** `PR + Seeding Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Finalize seeding list | 🟠 High | To-Do |
| Collect all shipping addresses | 🔴 Urgent | To-Do |
| Write press release | 🟠 High | To-Do |
| Assemble and ship packages | 🔴 Urgent | To-Do |
| Follow up with editors | 🟡 Medium | To-Do |
| Track creator posts post-launch | 🟡 Medium | To-Do |

# TAB 5 — Site + Merchandising

**Tab name:** `Site + Merchandising`

### Block 1 — Site + Merchandising
**Type:** `section_header`
**Title:** `Site + Merchandising`
**Subtitle:** `Shopify storefront, PDP copy, collection setup, pre-launch QA`

### Block 2 — Merchandising Strategy
**Type:** `text`
**Content:**

```
*This tab owns the customer-facing site experience. Write and approve your PDP copy here, plan your collection page and homepage setup, and run the pre-launch QA checklist before you flip listings live.*

Merchandising Strategy

*Describe how the drop will be merchandised on your site. Will it have its own collection page? What order will products appear in? Will it be hidden until launch and flipped live at a specific time? What homepage and nav changes are needed? Write the plan here.*
```

### Block 3 — PDP Copy
**Type:** `section_header`
**Title:** `PDP Copy`
**Subtitle:** `Written, approved, and ready to paste into Shopify`

### Block 4 — SKU 1 PDP Copy [ROW: left]
**Type:** `text`
**Content:**

```
[Product Name] — PDP Copy

*Product Title:*
*Subtitle / tagline:*

*Description:*
*[Write your full PDP description here. Include the hero ingredient story, texture, how to use, and the one thing that makes this product worth buying.]*

*How to use:*
*Key ingredients:*
*Size / Price:*
```

### Block 5 — SKU 2 PDP Copy [ROW: center]
**Type:** `text`
**Content:**

```
[Product Name] — PDP Copy

*Product Title:*
*Subtitle / tagline:*

*Description:*
*[Write your full PDP description here. Include the hero ingredient story, texture, how to use, and the one thing that makes this product worth buying.]*

*How to use:*
*Key ingredients:*
*Size / Price:*
```

### Block 6 — SKU 3 PDP Copy [ROW: right]
**Type:** `text`
**Content:**

```
[Product Name] — PDP Copy

*Product Title:*
*Subtitle / tagline:*

*Description:*
*[Write your full PDP description here. Include the hero ingredient story, texture, how to use, and the one thing that makes this product worth buying.]*

*How to use:*
*Key ingredients:*
*Size / Price:*
```

### Block 7 — Shopify Setup
**Type:** `section_header`
**Title:** `Shopify Setup`
**Subtitle:** `Live product status — pulled directly from Shopify`

### Block 8 — SKU 1 Shopify Setup [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach each SKU here to track listing status as you build toward launch.

### Block 9 — SKU 2 Shopify Setup [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach each SKU here to track listing status as you build toward launch.

### Block 10 — SKU 3 Shopify Setup [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach each SKU here to track listing status as you build toward launch.

### Block 11 — Collection Page + Site Setup
**Type:** `section_header`
**Title:** `Collection Page + Site Setup`
**Subtitle:** `Homepage, nav, collection details, and launch timing`

### Block 12 — Collection Page Details [ROW: left]
**Type:** `text`
**Content:**

```
Collection Page Details

*Collection name:*
*URL handle:*
*Status (hidden until launch / live):*
*Product order on collection page:*
*Collection hero image:*
*SEO title:*
*SEO description:*
```

### Block 13 — Homepage + Nav Updates [ROW: right]
**Type:** `text`
**Content:**

```
Homepage + Nav Updates

*Homepage banner: [goes live when? what image? what CTA?]*
*Navigation: [add drop to nav? when? where?]*
*Announcement bar: [what copy? when does it go live?]*
*Post-sellout changes: [swap banner, add waitlist link, etc.]*
```

### Block 14 — Pre-Launch QA Checklist
**Type:** `section_header`
**Title:** `Pre-Launch QA Checklist`
**Subtitle:** `Run this two days before launch`

### Block 15 — Site QA
**Type:** `task`
**Title:** `Site QA`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Confirm all PDPs live in draft mode | 🔴 Urgent | To-Do |
| QA PDP copy — all products | 🔴 Urgent | To-Do |
| QA product images — correct per SKU | 🔴 Urgent | To-Do |
| Confirm inventory counts match plan | 🔴 Urgent | To-Do |
| QA collection page order and layout | 🟠 High | To-Do |
| Test add to cart — all SKUs | 🔴 Urgent | To-Do |
| Test checkout flow end to end | 🔴 Urgent | To-Do |
| Confirm collection page is hidden | 🔴 Urgent | To-Do |
| QA announcement bar copy and link | 🟠 High | To-Do |
| QA homepage banner (scheduled) | 🟠 High | To-Do |
| QA on mobile — all PDPs and collection page | 🟠 High | To-Do |

### Block 16 — Site Build Tasks
**Type:** `task`
**Title:** `Site Build Tasks`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all PDP copy | 🟠 High | To-Do |
| Get PDP copy approved | 🟠 High | To-Do |
| Build all Shopify listings in draft | 🔴 Urgent | To-Do |
| Upload product images to all PDPs | 🟠 High | To-Do |
| Write collection page SEO copy | 🟡 Medium | To-Do |
| Build collection page in Shopify | 🟠 High | To-Do |
| Upload collection hero image | 🟠 High | To-Do |
| Schedule homepage banner | 🟠 High | To-Do |
| Schedule announcement bar | 🟡 Medium | To-Do |
| Set inventory limits in Shopify | 🔴 Urgent | To-Do |

# TAB 6 — Assets + Approvals

**Tab name:** `Assets + Approvals`

### Block 1 — Assets + Approvals
**Type:** `section_header`
**Title:** `Assets + Approvals`
**Subtitle:** `Every deliverable for the drop. Nothing goes live without passing through here.`

### Block 2 — Approval Process
**Type:** `text`
**Content:**

```
*This tab is your approval gate. Assets come in from Creative Direction and copy comes in from the team. Mark each deliverable Approved, Needs Revision, or Rejected in the tracker tables. Set a hard approval deadline and make sure everything upstream is pointed at hitting it.*

Approval Process

*Who has final sign-off? What's the approval deadline? What happens if something misses the deadline? Write it here so everyone knows the rules.*
```

### Block 3 — Campaign Imagery
**Type:** `section_header`
**Title:** `Campaign Imagery`
**Subtitle:** `Final edited assets from photographer`

### Block 4 — Hero Campaign Images
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload final hero campaign shots here: full collection flat lay, campaign lifestyle image, and any homepage or email-header selects.

### Block 5 — SKU 1 Product Shots [ROW: left]
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload all final selects for SKU 1 here: flat lay, on-skin, and lifestyle.

### Block 6 — SKU 2 Product Shots [ROW: center]
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload all final selects for SKU 2 here: flat lay, on-skin, and lifestyle.

### Block 7 — SKU 3 Product Shots [ROW: right]
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload all final selects for SKU 3 here: flat lay, on-skin, and lifestyle.

### Block 8 — Social + Story Assets
**Type:** `gallery`
**Placeholder state:** Empty gallery — upload cropped and formatted versions of campaign images for Instagram feed, Stories, and TikTok thumbnails here.

### Block 9 — Image Approval Tracker
**Type:** `table`
**Columns:** Asset | SKU | Usage | Delivered | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes
**Pre-populated rows:**

| Asset | SKU | Usage | Delivered | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes |
|---|---|---|---|---|---|---|
| Hero flat lay | All | Collection page, homepage | ☐ |  | Pending |  |
| Campaign lifestyle | All | Email header, IG feed | ☐ |  | Pending |  |
| Flat lay | SKU 1 | PDP, email | ☐ |  | Pending |  |
| On-skin | SKU 1 | PDP, social | ☐ |  | Pending |  |
| Lifestyle | SKU 1 | Social | ☐ |  | Pending |  |
| Flat lay | SKU 2 | PDP, email | ☐ |  | Pending |  |
| On-skin | SKU 2 | PDP, social | ☐ |  | Pending |  |
| Flat lay | SKU 3 | PDP, email | ☐ |  | Pending |  |
| On-skin | SKU 3 | PDP, social | ☐ |  | Pending |  |
| IG feed crop — hero | All | Instagram | ☐ |  | Pending |  |
| IG Story crop | All | Instagram Stories | ☐ |  | Pending |  |
| TikTok thumbnail | SKU 3 | TikTok | ☐ |  | Pending |  |

### Block 10 — Video Assets
**Type:** `section_header`
**Title:** `Video Assets`
**Subtitle:** `Raw cuts, finals, and approval tracking`

### Block 11 — Launch Video — Final Cut
**Type:** `video`
**Placeholder state:** Empty video block — upload the final edited launch video here for approval. It must be approved before scheduling.

### Block 12 — Launch Video — Raw Cut
**Type:** `video`
**Placeholder state:** Empty video block — upload raw footage or the raw cut here after shoot day. Editing starts from here.

### Block 13 — Video Approval Tracker
**Type:** `table`
**Columns:** Asset | Platform | Length | Delivered | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes
**Pre-populated rows:**

| Asset | Platform | Length | Delivered | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes |
|---|---|---|---|---|---|---|
| Launch video — raw cut | TikTok | [Length] | ☐ |  | Pending |  |
| Launch video — final cut | TikTok | [Length] | ☐ |  | Pending |  |
| Sold out moment | TikTok / IG | [Length] | ☐ |  | Pending |  |

### Block 14 — Copy Approvals
**Type:** `section_header`
**Title:** `Copy Approvals`
**Subtitle:** `Final copy files and approval tracker`

### Block 15 — Copy Deck — Final Versions
**Type:** `file`
**Placeholder state:** Empty file block — attach final approved versions of all copy here: PDP copy, email sequence, social captions, press release, and package insert.

### Block 16 — Copy Approval Tracker
**Type:** `table`
**Columns:** Deliverable | Channel | Written By | Due | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes
**Pre-populated rows:**

| Deliverable | Channel | Written By | Due | Approved By | Approval Status (Pending / Approved / Needs Revision / Rejected) | Notes |
|---|---|---|---|---|---|---|
| PDP copy — SKU 1 | Shopify |  |  |  | Pending |  |
| PDP copy — SKU 2 | Shopify |  |  |  | Pending |  |
| PDP copy — SKU 3 | Shopify |  |  |  | Pending |  |
| Email #1 — Teaser | Email |  |  |  | Pending |  |
| Email #2 — Countdown | Email |  |  |  | Pending |  |
| Email #3 — We're Live | Email |  |  |  | Pending |  |
| Email #4 — Sold Out | Email |  |  |  | Pending |  |
| Email #5 — Waitlist | Email |  |  |  | Pending |  |
| IG captions | Instagram |  |  |  | Pending |  |
| TikTok captions | TikTok |  |  |  | Pending |  |
| Press release | PR |  |  |  | Pending |  |
| Package insert copy | PR |  |  |  | Pending |  |
| Announcement bar copy | Site |  |  |  | Pending |  |

### Block 17 — Approval Tasks — Hard Deadlines
**Type:** `task`
**Title:** `Approval Tasks — Hard Deadlines`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Review raw photo selects | 🔴 Urgent | To-Do |
| Request photo revisions if needed | 🟠 High | To-Do |
| Approve final edited campaign images | 🔴 Urgent | To-Do |
| Approve final edited product shots — all SKUs | 🔴 Urgent | To-Do |
| Approve social and story crops | 🟠 High | To-Do |
| Approve all PDP copy | 🔴 Urgent | To-Do |
| Approve full email sequence | 🔴 Urgent | To-Do |
| Approve social captions | 🟠 High | To-Do |
| Approve press release | 🟠 High | To-Do |
| Approve TikTok raw cut | 🟠 High | To-Do |
| Approve TikTok final cut | 🔴 Urgent | To-Do |
| Final all-clear — assets ready for site build | 🔴 Urgent | To-Do |

# TAB 7 — Post-Launch

**Tab name:** `Post-Launch`

### Block 1 — Post-Launch
**Type:** `section_header`
**Title:** `Post-Launch`
**Subtitle:** `Results, learnings, and next steps`

### Block 2 — What Happened
**Type:** `text`
**Content:**

```
*Fill this tab within 48 hours of your drop. Write what happened, pull your numbers, and be honest about what worked and what didn't. This tab becomes the input for your next drop brief.*

What Happened

*Write a short narrative of how the launch went. When did it sell out? Which channel drove the most orders? What surprised you? What was calmer than expected? Write it in plain language while it's still fresh.*
```

### Block 3 — Revenue + Sales [ROW: left]
**Type:** `text`
**Content:**

```
Revenue + Sales

*Total revenue:*
*Units sold:*
*Time to sell out (or sell-through % if not sold out):*
*Average order value:*
*Orders with 2+ SKUs:*
*Refunds / chargebacks:*
*Waitlist signups:*
```

### Block 4 — Channel Performance [ROW: right]
**Type:** `text`
**Content:**

```
Channel Performance

*Email → first-hour orders (%):*
*Social → first-hour orders (%):*
*Email open rate — live email:*
*Email CTR — live email:*
*Top social post reach:*
*Creator posts from seeding:*
```

### Block 5 — SKU Performance
**Type:** `section_header`
**Title:** `SKU Performance`
**Subtitle:** `Use this to compare volume and revenue by product`

### Block 6 — Units Sold by SKU
**Type:** `chart`
**Chart type:** `Bar`
**Purpose:** Add your SKU names and units sold. If you sold out all SKUs, all bars hit ceiling — which is the goal.

### Block 7 — Revenue by SKU
**Type:** `chart`
**Chart type:** `Doughnut`
**Purpose:** Add your SKU names and revenue figures. The SKU with the highest price point usually drives the most revenue share even on lower unit counts.

### Block 8 — SKU 1 Final Stats [ROW: left]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the final Shopify product for SKU 1 to review ending inventory and sales.

### Block 9 — SKU 2 Final Stats [ROW: center]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the final Shopify product for SKU 2 to review ending inventory and sales.

### Block 10 — SKU 3 Final Stats [ROW: right]
**Type:** `shopify_product`
**Placeholder state:** Empty product slot — attach the final Shopify product for SKU 3 to review ending inventory and sales.

### Block 11 — What Worked. What Didn't.
**Type:** `section_header`
**Title:** `What Worked. What Didn't.`
**Subtitle:** `Write this within 48 hours`

### Block 12 — What Worked [ROW: left]
**Type:** `text`
**Content:**

```
What Worked

*List 3–5 specific things that worked. Be concrete. Not "marketing was good," but "email list-first window drove 70% of first-hour orders." These become inputs for the next drop brief.*
```

### Block 13 — What To Fix Next Time [ROW: right]
**Type:** `text`
**Content:**

```
What To Fix Next Time

*List 3–5 specific things to fix. Assign a recommendation to each. Not "PR timing was bad," but "ship PR packages 3 weeks out, not 1." These become standing operating improvements.*
```

### Block 14 — Post-Launch Actions
**Type:** `task`
**Title:** `Post-Launch Actions`
**View:** List view
**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Send waitlist email — restock update | 🔴 Urgent | To-Do |
| Decide restock quantity per SKU | 🟠 High | To-Do |
| Contact manufacturer — restock inquiry | 🟠 High | To-Do |
| Repurpose launch video for IG Reels | 🟡 Medium | To-Do |
| Write post-launch recap email to full list | 🟠 High | To-Do |
| Pull full Shopify sales report | 🟠 High | To-Do |
| Document launch learnings in Trak | 🟠 High | To-Do |
| Brief PR on editorial follow-up | 🟡 Medium | To-Do |
| Evaluate drop as permanent line | 🟡 Medium | To-Do |
| Start brief for next drop | 🟡 Medium | To-Do |

### Block 15 — Post-Launch Documents
**Type:** `file`
**Placeholder state:** Empty file block — attach Shopify sales report, email performance export, social analytics exports, creator post screenshots, and waitlist CSV here.

### Block 16 — Launch Retrospective
**Type:** `file`
**Placeholder state:** Empty file block — attach the full retrospective doc, deck, or export here so the written record of this launch is easy to reference when briefing the next drop.
