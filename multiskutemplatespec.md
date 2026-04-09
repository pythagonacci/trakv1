# Trak Template Spec
## Seasonal Drop / Multi-SKU Launch

**Version:** 1.0
**Template category:** Campaign & Marketing
**Template name:** Seasonal Drop / Multi-SKU Launch
**Template description:** Run a limited product drop from brief to sold out. Covers campaign strategy, per-SKU product management, creative direction, outbound rollout, site prep, asset approvals, and post-launch analysis — all in one project.

---

## Overview

This template is built for D2C brand teams launching a limited or seasonal product drop with multiple SKUs. It assumes a small team (2–5 people), a defined launch date, and a window of 4–8 weeks from brief to live.

The template ships with 7 tabs and 1 subtab. Each tab has mild instructional placeholder content so a brand can orient quickly and start filling in. Instructional text appears as italicized placeholder copy inside text blocks. Task blocks ship with pre-populated task rows that the team edits to match their launch.

**All tabs are internal only.** No Magic Link is configured on any tab. The client page is disabled at the project level.

---

## Project Metadata

| Field | Default Value |
|---|---|
| Project name | [Brand Name] — [Drop Name] |
| Status | Not Started |
| Priority | High |
| Due date | [Launch date] |
| Tags | drop, launch, seasonal |
| Client page enabled | false |
| Client comments enabled | false |
| Client editing enabled | false |

---

## Tab Structure

| # | Tab Name | Type | Magic Link | Subtabs |
|---|---|---|---|---|
| 01 | Launch HQ | Standard | No | Launch Day (subtab) |
| 02 | Product Lineup | Parent (container) | No | One per SKU |
| 03 | Creative Direction | Standard | No | No |
| 04 | Campaign Rollout + PR | Standard | No | No |
| 05 | Site + Merchandising | Standard | No | No |
| 06 | Assets + Approvals | Standard | No | No |
| 07 | Post-Launch | Standard | No | No |

---

## Tab 01 — Launch HQ

**Purpose:** The command center for the entire drop. This is the first tab anyone opens. It contains the campaign brief, drop details, target customer, live Shopify product blocks for all SKUs, and the master task tracker broken by phase. The Launch Day subtab lives here and is meant to be the only tab open on launch morning.

**Placeholder instruction (top of tab, text block):**
> *This is your campaign command center. Fill in the brief, pin your Shopify products, and keep the master task tracker updated throughout the launch. The Launch Day subtab is your go-live checklist.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** [Drop Name]
**Subtitle:** [Number] SKUs · Launch [Date] · [Channel strategy in one line]

---

### Block 2 — Text Block
**Type:** `text`
**Label:** Campaign Brief
**Placeholder content:**
> *Write your campaign brief here. Cover: what this drop is, why it exists, what makes it different from your core line, the launch window, and whether you're doing a restock. Keep it to a paragraph — this is what everyone on the team reads to get aligned.*

---

### Block 3 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** Drop Details
**Placeholder content:**
> *Drop name:*
> *Launch date:*
> *Channel priority: (e.g. Email → IG → TikTok)*
> *Price points per SKU:*
> *Unit quantities per SKU:*

---

### Block 4 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** Who We're Talking To
**Placeholder content:**
> *Describe your target customer for this drop. Age, mindset, where they found you, what they respond to. Be specific — this informs copy, creative direction, and channel strategy downstream.*

---

### Block 5 — Divider

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** Products
**Subtitle:** Pinned from Shopify — live inventory and variant status

---

### Blocks 7–9 — Shopify Product Blocks (3-column row)
**Type:** `shopify_product`
**Count:** One per SKU. Template ships with 3 placeholder slots.
**Placeholder instruction (displayed when no product is attached):**
> *Attach your Shopify product here.*

**Layout:** Three-column row. If the brand has 2 SKUs, one column is empty and should be deleted. If the brand has 4+ SKUs, additional blocks are added.

---

### Block 10 — Divider

---

### Block 11 — Section Header
**Type:** `section_header`
**Title:** Master Task Tracker
**Subtitle:** All open tasks across the project, organized by phase

---

### Block 12 — Task Block
**Type:** `task`
**Title:** Pre-Production
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Lock campaign brief | Urgent | To-Do |
| Finalize product names and copy direction | High | To-Do |
| Confirm unit quantities with manufacturer | High | To-Do |
| Brief photographer / creative team | High | To-Do |
| Confirm shoot date | Medium | To-Do |

**Instruction note (block subtitle):**
> *Edit these tasks to match your pre-production phase. Assign owners and due dates.*

---

### Block 13 — Task Block
**Type:** `task`
**Title:** Production
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Product shoot | Urgent | To-Do |
| Edit and deliver final assets | Urgent | To-Do |
| Write PDP copy — all SKUs | High | To-Do |
| Write email sequence | High | To-Do |
| Write social captions | Medium | To-Do |
| Finalize PR seeding list | Medium | To-Do |

---

### Block 14 — Task Block
**Type:** `task`
**Title:** Pre-Launch
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Build Shopify listings — all SKUs | Urgent | To-Do |
| Upload and QA product images | High | To-Do |
| Schedule email sequence | High | To-Do |
| Send PR packages | High | To-Do |
| Final review — site, copy, images | Urgent | To-Do |
| Set inventory limits in Shopify | Urgent | To-Do |

---

### Block 15 — Section Header
**Type:** `section_header`
**Title:** Launch Timeline
**Subtitle:** Add your milestones from brief to drop

---

### Block 16 — Timeline Block
**Type:** `timeline`
**View config:** Start and end dates default to blank — team fills in at project creation.

**Pre-populated milestone labels (dates left blank):**

- Brief locked
- Photographer / creative team briefed
- Samples approved
- Shoot day
- Assets delivered
- Copy finalized
- PR packages shipped
- Shopify listings live (hidden)
- Final QA pass
- Email #1 — Teaser
- Email #2 — Countdown
- Drop goes live
- Post-launch debrief

**Instruction note:**
> *Set your launch date first, then work backwards to fill in milestone dates.*

---

### Subtab: Launch Day

**Parent tab:** Launch HQ
**Type:** Standard canvas, internal
**Purpose:** A single-focus tab for launch morning. One checklist. Nothing else. The team runs through it top to bottom before the drop goes live.

**Placeholder instruction (top of tab, text block):**
> *This tab is for launch morning only. Run the checklist top to bottom before your drop goes live. Keep your Shopify blocks open here to monitor inventory in real time.*

---

#### Launch Day — Block 1 — Section Header
**Type:** `section_header`
**Title:** [Launch Date] — Go Time
**Subtitle:** Run this tab top to bottom before [launch time]

---

#### Launch Day — Block 2 — Task Block
**Type:** `task`
**Title:** Launch Day Checklist
**View mode:** List

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

---

#### Launch Day — Blocks 3–5 — Shopify Product Blocks (3-column row)
**Type:** `shopify_product`
**Note:** Same products as Launch HQ blocks 7–9. Team attaches the same SKUs here. These are the live inventory monitors during launch.

---

## Tab 02 — Product Lineup

**Purpose:** A parent tab that contains one subtab per SKU. No content lives on the parent tab itself — landing on it auto-navigates to the first subtab. Each subtab follows an identical block structure. A brand with 2 SKUs uses 2 subtabs; a brand with 5 uses 5.

**Parent tab content:** None. Tab renders subtab sidebar immediately on open.

---

### Subtab structure — applies to every SKU subtab

The template ships with 3 subtabs by default (matching the 3-SKU case study). Each subtab is named after the product. The structure below repeats identically across all subtabs.

---

#### Block 1 — Section Header
**Type:** `section_header`
**Title:** [Product Name]
**Subtitle:** [Brief positioning line — e.g. "Hero SKU — limited run of X units"]

---

#### Block 2 — Shopify Product Block
**Type:** `shopify_product`
**Placeholder instruction:**
> *Attach this SKU's Shopify product here. This block shows live inventory, variant status, units sold, and price.*

---

#### Block 3 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** Product Story
**Placeholder content:**
> *What is this product and why does it exist? Write the internal product story — the ingredient angle, the texture, the use case. This isn't PDP copy; it's the version that gives your team context and conviction.*

---

#### Block 4 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** Key Details
**Placeholder content:**
> *Price:*
> *Units available:*
> *Variants:*
> *Hero ingredients:*
> *Packaging:*
> *Status:*

---

#### Block 5 — Task Block
**Type:** `task`
**Title:** [Product Name] — Product Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Approve product sample | Urgent | To-Do |
| Finalize ingredient list for PDP | High | To-Do |
| Write PDP copy | High | To-Do |
| Approve product photography | High | To-Do |
| Build Shopify listing | Urgent | To-Do |
| QA listing — copy, images, price, inventory | Urgent | To-Do |
| Confirm units received from manufacturer | Urgent | To-Do |

---

#### Block 6 — Image Block
**Type:** `image`
**Label:** Product Photography
**Placeholder instruction:**
> *Upload final product photography here once delivered. Hero shot, flat lay, on-skin.*

---

#### Block 7 — File Block
**Type:** `file`
**Label:** Product Documents
**Placeholder instruction:**
> *Attach manufacturer spec sheet, ingredient INCI list, and safety documentation here.*

---

## Tab 03 — Creative Direction

**Magic Link:** None
**Purpose:** Everything the creative team needs to execute the visual identity of the drop. Fully internal. Contains the creative vision, moodboard, shoot brief, shot list, file references, and creative tasks.

**Placeholder instruction (top of tab, text block):**
> *This tab is your creative brief and shoot direction. Capture the visual vision, build the moodboard, write the shoot brief, and track all creative tasks from here.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** Creative Direction — [Drop Name]
**Subtitle:** Visual identity, shoot brief, and asset direction

---

### Block 2 — Text Block
**Type:** `text`
**Label:** Creative Vision
**Placeholder content:**
> *Describe the visual world of this drop. What does it feel like? What are your reference points? What's the light, the surface, the mood? Be specific enough that a photographer could walk into a shoot without asking questions.*
>
> *Palette:*
> *Mood:*
> *References:*
> *What to avoid:*

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** Moodboard
**Subtitle:** Visual references for shoot direction and overall campaign feel

---

### Block 4 — Gallery Block
**Type:** `gallery`
**Label:** Campaign Moodboard
**Placeholder instruction:**
> *Upload 8–12 reference images here. Campaign imagery, texture references, skin references, packaging inspiration.*

---

### Block 5 — Section Header
**Type:** `section_header`
**Title:** Shoot Brief
**Subtitle:** Everything the photographer needs before arriving on set

---

### Block 6 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** Shoot Details
**Placeholder content:**
> *Shoot date:*
> *Location:*
> *Photographer:*
> *Creative lead on set:*
> *Call time:*
> *Wrap:*
> *Deliverables due:*
> *File format and delivery method:*

---

### Block 7 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** Dos and Don'ts
**Placeholder content:**
> *Do:*
> *(List 4–5 specific creative directions)*
>
> *Don't:*
> *(List 4–5 things to avoid)*

---

### Block 8 — Section Header
**Type:** `section_header`
**Title:** Shot List
**Subtitle:** Required deliverables per SKU — minimum selects noted

---

### Block 9 — Table Block
**Type:** `table`
**Label:** Shot List

**Pre-populated columns:**

| Column | Type |
|---|---|
| Shot Type | Text |
| SKU | Text |
| Setting | Text |
| Min. Selects | Number |
| Status | Select (Not Started / In Shoot / In Review / Approved) |

**Pre-populated rows (3 rows per SKU × 3 SKUs + 2 collection-wide shots = 11 rows):**

Rows ship with placeholder shot types:
- Hero flat lay
- On-skin application
- Lifestyle / context shot
- Texture / detail shot (for hero SKU)
- Full collection flat lay
- Campaign hero

All Status cells default to "Not Started".

**Instruction note:**
> *Edit this table to match your shot list. Add or remove rows per SKU. Update Status as selects come in — your photographer can see this table via the Magic Link.*

---

### Block 10 — Section Header
**Type:** `section_header`
**Title:** Reference Assets
**Subtitle:** Files for the creative team and photographer

---

### Block 11 — File Block
**Type:** `file`
**Label:** Shoot Prep Files
**Placeholder instruction:**
> *Attach your brand guidelines, packaging spec sheets, prop list, and any reference files the creative team needs before shoot day.*

---

### Block 12 — Gallery Block
**Type:** `gallery`
**Label:** Raw Selects — Post Shoot
**Placeholder instruction:**
> *Photographer uploads raw selects here after shoot. Creative lead reviews and marks hero selects before editing begins.*

---

### Block 13 — Gallery Block
**Type:** `gallery`
**Label:** Final Edited Assets
**Placeholder instruction:**
> *Final edited campaign images go here once delivered. These feed into the Assets + Approvals tab for sign-off.*

---

### Block 14 — Section Header
**Type:** `section_header`
**Title:** Creative Tasks
**Subtitle:** Internal only — not visible on Magic Link

---

### Block 15 — Task Block
**Type:** `task`
**Title:** Creative Direction Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Finalize moodboard and upload | High | To-Do |
| Send creative brief to photographer via Magic Link | Urgent | To-Do |
| Confirm shot list with photographer | High | To-Do |
| Ship products to shoot location | Urgent | To-Do |
| Attend shoot — creative direction on set | Urgent | To-Do |
| Review raw selects | High | To-Do |
| Request edits from photographer | Medium | To-Do |
| Approve final edited assets | Urgent | To-Do |
| Move approved assets to Assets + Approvals tab | High | To-Do |

---

### Block 16 — Embed Block
**Type:** `embed`
**Label:** Design Files
**Placeholder instruction:**
> *Paste your Figma, Canva, or other design file link here. Moodboard comps, typography direction, packaging mockups.*

---

## Tab 04 — Campaign Rollout + PR

**Purpose:** The outbound execution tab. Email sequence, social content calendar, PR seeding list, and all associated tasks. Everything that touches the outside world is tracked here.

**Placeholder instruction (top of tab, text block):**
> *This tab is your outbound engine. Plan your email sequence, build your social calendar, and manage your seeding list. Tasks at the bottom are broken out by email, social, and PR.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** Campaign Rollout + PR
**Subtitle:** Channel strategy, email sequence, social calendar, seeding

---

### Block 2 — Text Block
**Type:** `text`
**Label:** Rollout Strategy
**Placeholder content:**
> *Describe your channel strategy for this drop in a paragraph. Which channel goes first? What's the timing between channels? Are you doing a list-first window before social? No paid ads, or paid support? Write this once so the team is aligned.*

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** Email Sequence
**Subtitle:** Map out every email before you write them

---

### Block 4 — Table Block
**Type:** `table`
**Label:** Email Sequence

**Pre-populated columns:**

| Column | Type |
|---|---|
| Email | Text |
| Subject Line | Text |
| Send Date | Date |
| Send Time | Text |
| Segment | Text |
| Status | Select (Not Started / Draft / Approved / Scheduled / Sent) |

**Pre-populated rows:**

| Email | Subject Line |
|---|---|
| #1 — Teaser | [Write your subject line] |
| #2 — Countdown | [Write your subject line] |
| #3 — We're Live | [Write your subject line] |
| #4 — Sold Out | [Write your subject line] |
| #5 — Waitlist | [Write your subject line] |

All Status cells default to "Not Started". Send dates left blank.

---

### Block 5 — File Block
**Type:** `file`
**Label:** Email Copy Drafts
**Placeholder instruction:**
> *Upload email copy drafts here as they're written. Final approved versions go in the Assets + Approvals tab.*

---

### Block 6 — Section Header
**Type:** `section_header`
**Title:** Social Content Calendar
**Subtitle:** Instagram and TikTok — organic rollout

---

### Block 7 — Table Block
**Type:** `table`
**Label:** Social Calendar

**Pre-populated columns:**

| Column | Type |
|---|---|
| Platform | Select (Instagram / TikTok / Both) |
| Content Type | Text |
| Caption Direction | Text |
| Post Date | Date |
| Status | Select (Not Started / In Production / Ready / Posted) |
| Asset Needed | Text |

**Pre-populated rows (7 rows):**

| Platform | Content Type |
|---|---|
| Instagram | Feed — campaign hero |
| Instagram | Story — countdown |
| TikTok | Launch video |
| Instagram | Feed — collection flat lay |
| Instagram | Story — link live |
| TikTok | Sold out moment |
| Instagram | Feed — sold out post |

All Status cells default to "Not Started". Post dates left blank.

---

### Block 8 — Section Header
**Type:** `section_header`
**Title:** PR + Seeding
**Subtitle:** Packages should ship at least 10 days before launch

---

### Block 9 — Text Block
**Type:** `text`
**Label:** Seeding Strategy
**Placeholder content:**
> *How many packages are you sending? Who are you targeting — micro-creators, editors, both? What's the profile you're looking for? Write your seeding criteria here so the list stays focused.*

---

### Block 10 — Table Block
**Type:** `table`
**Label:** Seeding List

**Pre-populated columns:**

| Column | Type |
|---|---|
| Name | Text |
| Type | Select (Creator / Editor / Press) |
| Platform | Text |
| Followers | Number |
| Address Confirmed | Checkbox |
| Package Shipped | Checkbox |
| Posted | Checkbox |

**Pre-populated rows:** 10 blank rows.

**Instruction note:**
> *Fill in your seeding list here. Track address confirmation, shipping, and whether they posted — all in one place.*

---

### Block 11 — File Block
**Type:** `file`
**Label:** PR Files
**Placeholder instruction:**
> *Attach press release, pitch email template, package insert copy, and shipping label sheet here.*

---

### Block 12 — Section Header
**Type:** `section_header`
**Title:** Rollout Tasks

---

### Block 13 — Task Block
**Type:** `task`
**Title:** Email Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all email drafts | High | To-Do |
| Design email templates | High | To-Do |
| Upload to email platform and QA | Urgent | To-Do |
| Schedule teaser and countdown emails | Urgent | To-Do |
| Confirm live email send on launch morning | Urgent | To-Do |
| Send sold-out email | Urgent | To-Do |
| Build waitlist form and segment | High | To-Do |

---

### Block 14 — Task Block
**Type:** `task`
**Title:** Social Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all captions | High | To-Do |
| Edit launch video | High | To-Do |
| Schedule feed posts | High | To-Do |
| Prepare Story assets | Medium | To-Do |
| Go live on launch morning | Urgent | To-Do |
| Post sold-out content | High | To-Do |

---

### Block 15 — Task Block
**Type:** `task`
**Title:** PR + Seeding Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Finalize seeding list | High | To-Do |
| Collect all shipping addresses | Urgent | To-Do |
| Write press release | High | To-Do |
| Assemble and ship packages | Urgent | To-Do |
| Follow up with editors | Medium | To-Do |
| Track creator posts post-launch | Medium | To-Do |

---

## Tab 05 — Site + Merchandising

**Purpose:** Everything that touches the storefront. PDP copy lives here as finished text blocks — ready to paste directly into Shopify. Collection page setup, homepage and nav changes, and the full pre-launch QA checklist.

**Placeholder instruction (top of tab, text block):**
> *This tab owns the customer-facing site experience. Write and approve your PDP copy here, plan your collection page and homepage setup, and run the pre-launch QA checklist before you flip listings to live.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** Site + Merchandising
**Subtitle:** Shopify storefront, PDP copy, collection setup, pre-launch QA

---

### Block 2 — Text Block
**Type:** `text`
**Label:** Merchandising Strategy
**Placeholder content:**
> *Describe how The drop will be merchandised on your site. Will it have its own collection page? What order will products appear in? Will it be hidden until launch and flipped live at a specific time? What homepage and nav changes are needed? Write the plan here.*

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** PDP Copy
**Subtitle:** Written, approved, and ready to paste into Shopify

---

### Blocks 4–6 — Text Blocks (one per SKU)
**Type:** `text`
**Label:** [Product Name] — PDP Copy
**Count:** One block per SKU. Template ships with 3.

**Placeholder content (identical structure for each):**
> *Product Title:*
> *Subtitle / tagline:*
>
> *Description:*
> *[Write your full PDP description here. Include the hero ingredient story, texture, how-to-use, and the one thing that makes this product worth buying.]*
>
> *How to use:*
> *Key ingredients:*
> *Size / Price:*

---

### Block 7 — Section Header
**Type:** `section_header`
**Title:** Shopify Setup
**Subtitle:** Live product status — pulled directly from Shopify

---

### Blocks 8–10 — Shopify Product Blocks (3-column row)
**Type:** `shopify_product`
**Note:** Same SKUs as Launch HQ and Product Lineup. Here the context is operational — is the listing built, is it in draft, is inventory set.
**Placeholder instruction:**
> *Attach each SKU here to track listing status as you build toward launch.*

---

### Block 11 — Section Header
**Type:** `section_header`
**Title:** Collection Page + Site Setup

---

### Block 12 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** Collection Page Details
**Placeholder content:**
> *Collection name:*
> *URL handle:*
> *Status (hidden until launch / live):*
> *Product order on collection page:*
> *Collection hero image:*
> *SEO title:*
> *SEO description:*

---

### Block 13 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** Homepage + Nav Updates
**Placeholder content:**
> *Homepage banner: [goes live when? what image? what CTA?]*
> *Navigation: [add drop to nav? when? where?]*
> *Announcement bar: [what copy? when does it go live?]*
> *Post-sellout changes: [swap banner, add waitlist link, etc.]*

---

### Block 14 — Section Header
**Type:** `section_header`
**Title:** Pre-Launch QA Checklist
**Subtitle:** Run this 2 days before launch

---

### Block 15 — Task Block
**Type:** `task`
**Title:** Site QA
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Confirm all PDPs live in draft mode | Urgent | To-Do |
| QA PDP copy — all products | Urgent | To-Do |
| QA product images — correct per SKU | Urgent | To-Do |
| Confirm inventory counts match plan | Urgent | To-Do |
| QA collection page order and layout | High | To-Do |
| Test add to cart — all SKUs | Urgent | To-Do |
| Test checkout flow end to end | Urgent | To-Do |
| Confirm collection page is hidden | Urgent | To-Do |
| QA announcement bar copy and link | High | To-Do |
| QA homepage banner (scheduled) | High | To-Do |
| QA on mobile — all PDPs and collection page | High | To-Do |

---

### Block 16 — Task Block
**Type:** `task`
**Title:** Site Build Tasks
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Write all PDP copy | High | To-Do |
| Get PDP copy approved | High | To-Do |
| Build all Shopify listings in draft | Urgent | To-Do |
| Upload product images to all PDPs | High | To-Do |
| Write collection page SEO copy | Medium | To-Do |
| Build collection page in Shopify | High | To-Do |
| Upload collection hero image | High | To-Do |
| Schedule homepage banner | High | To-Do |
| Schedule announcement bar | Medium | To-Do |
| Set inventory limits in Shopify | Urgent | To-Do |

---

## Tab 06 — Assets + Approvals

**Purpose:** The final gate before anything goes live. Every creative deliverable — photography, video, copy — lands here for review and sign-off. Nothing is marked approved until it passes through this tab. The approval tracker tables are the operational core.

**Placeholder instruction (top of tab, text block):**
> *This tab is your approval gate. Assets come in from Creative Direction and copy comes in from the team. Mark each deliverable Approved, Needs Revision, or Rejected in the tracker tables. Set a hard approval deadline and make sure everything upstream is oriented toward hitting it.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** Assets + Approvals
**Subtitle:** Every deliverable for the drop. Nothing goes live without passing through here.

---

### Block 2 — Text Block
**Type:** `text`
**Label:** Approval Process
**Placeholder content:**
> *Who has final sign-off? What's the approval deadline? What happens if something misses the deadline? Write it here so everyone knows the rules.*

---

### Block 3 — Section Header
**Type:** `section_header`
**Title:** Campaign Imagery
**Subtitle:** Final edited assets from photographer

---

### Block 4 — Gallery Block
**Type:** `gallery`
**Label:** Hero Campaign Images
**Placeholder instruction:**
> *Upload final hero campaign shots here — full collection flat lay, campaign lifestyle image. These go on the collection page, homepage, and email headers.*

---

### Blocks 5–7 — Gallery Blocks (one per SKU)
**Type:** `gallery`
**Label:** [Product Name] — Product Shots
**Count:** One per SKU. Template ships with 3.
**Placeholder instruction:**
> *Upload all final selects for this SKU here — flat lay, on-skin, lifestyle.*

---

### Block 8 — Gallery Block
**Type:** `gallery`
**Label:** Social + Story Assets
**Placeholder instruction:**
> *Cropped and formatted versions of campaign images for Instagram feed, Stories, and TikTok thumbnails. Delivered after photography is approved.*

---

### Block 9 — Table Block
**Type:** `table`
**Label:** Image Approval Tracker

**Pre-populated columns:**

| Column | Type |
|---|---|
| Asset | Text |
| SKU | Text |
| Usage | Text |
| Delivered | Checkbox |
| Approved By | Text |
| Status | Select (Pending / Approved / Needs Revision / Rejected) |
| Notes | Text |

**Pre-populated rows (12 rows):**

| Asset | SKU | Usage |
|---|---|---|
| Hero flat lay | All | Collection page, homepage |
| Campaign lifestyle | All | Email header, IG feed |
| Flat lay | SKU 1 | PDP, email |
| On-skin | SKU 1 | PDP, social |
| Lifestyle | SKU 1 | Social |
| Flat lay | SKU 2 | PDP, email |
| On-skin | SKU 2 | PDP, social |
| Flat lay | SKU 3 | PDP, email |
| On-skin | SKU 3 | PDP, social |
| IG feed crop — hero | All | Instagram |
| IG Story crop | All | Instagram Stories |
| TikTok thumbnail | SKU 3 | TikTok |

All Status cells default to "Pending". Delivered defaults to unchecked.

---

### Block 10 — Section Header
**Type:** `section_header`
**Title:** Video Assets

---

### Block 11 — Video Block
**Type:** `video`
**Label:** Launch Video — Final Cut
**Placeholder instruction:**
> *Upload the final edited launch video here for approval. Must be approved before scheduling.*

---

### Block 12 — Video Block
**Type:** `video`
**Label:** Launch Video — Raw Cut
**Placeholder instruction:**
> *Upload raw footage here after shoot day. Editor pulls from here.*

---

### Block 13 — Table Block
**Type:** `table`
**Label:** Video Approval Tracker

**Pre-populated columns:**

| Column | Type |
|---|---|
| Asset | Text |
| Platform | Text |
| Length | Text |
| Delivered | Checkbox |
| Approved By | Text |
| Status | Select (Pending / Approved / Needs Revision / Rejected) |
| Notes | Text |

**Pre-populated rows:**

| Asset | Platform |
|---|---|
| Launch video — raw cut | TikTok |
| Launch video — final cut | TikTok |
| Sold out moment | TikTok / IG |

---

### Block 14 — Section Header
**Type:** `section_header`
**Title:** Copy Approvals

---

### Block 15 — File Block
**Type:** `file`
**Label:** Copy Deck — Final Versions
**Placeholder instruction:**
> *Attach final approved versions of all copy here: PDP copy, email sequence, social captions, press release, package insert.*

---

### Block 16 — Table Block
**Type:** `table`
**Label:** Copy Approval Tracker

**Pre-populated columns:**

| Column | Type |
|---|---|
| Deliverable | Text |
| Channel | Text |
| Written By | Text |
| Due | Date |
| Approved By | Text |
| Status | Select (Pending / Approved / Needs Revision / Rejected) |
| Notes | Text |

**Pre-populated rows:**

| Deliverable | Channel |
|---|---|
| PDP copy — SKU 1 | Shopify |
| PDP copy — SKU 2 | Shopify |
| PDP copy — SKU 3 | Shopify |
| Email #1 — Teaser | Email |
| Email #2 — Countdown | Email |
| Email #3 — We're Live | Email |
| Email #4 — Sold Out | Email |
| Email #5 — Waitlist | Email |
| IG captions | Instagram |
| TikTok captions | TikTok |
| Press release | PR |
| Package insert copy | PR |
| Announcement bar copy | Site |

All Status cells default to "Pending".

---

### Block 17 — Task Block
**Type:** `task`
**Title:** Approval Tasks — Hard Deadlines
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Review raw photo selects | Urgent | To-Do |
| Request photo revisions if needed | High | To-Do |
| Approve final edited campaign images | Urgent | To-Do |
| Approve final edited product shots — all SKUs | Urgent | To-Do |
| Approve social and story crops | High | To-Do |
| Approve all PDP copy | Urgent | To-Do |
| Approve full email sequence | Urgent | To-Do |
| Approve social captions | High | To-Do |
| Approve press release | High | To-Do |
| Approve TikTok raw cut | High | To-Do |
| Approve TikTok final cut | Urgent | To-Do |
| Final all-clear — assets ready for site build | Urgent | To-Do |

**Instruction note:**
> *Set due dates on these tasks. The "Final all-clear" task is the gate — nothing downstream starts until this is marked done.*

---

## Tab 07 — Post-Launch

**Purpose:** Written after the drop. Results, channel performance, SKU-level analysis, honest debrief, and next steps. This tab is also the input for the next drop brief.

**Placeholder instruction (top of tab, text block):**
> *Fill this tab within 48 hours of your drop. Write what happened, pull your numbers, and be honest about what worked and what didn't. This tab is the input for your next drop brief.*

---

### Block 1 — Section Header
**Type:** `section_header`
**Title:** Post-Launch
**Subtitle:** Results, learnings, and next steps

---

### Block 2 — Text Block
**Type:** `text`
**Label:** What Happened
**Placeholder content:**
> *Write a short narrative of how the launch went. When did it sell out? Which channel drove the most orders? What surprised you? What was calmer than expected? Write it in plain language within 48 hours while it's still fresh.*

---

### Block 3 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** Revenue + Sales
**Placeholder content:**
> *Total revenue:*
> *Units sold:*
> *Time to sell out (or sell-through % if not sold out):*
> *Average order value:*
> *Orders with 2+ SKUs:*
> *Refunds / chargebacks:*
> *Waitlist signups:*

---

### Block 4 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** Channel Performance
**Placeholder content:**
> *Email → first-hour orders (%):*
> *Social → first-hour orders (%):*
> *Email open rate — live email:*
> *Email CTR — live email:*
> *Top social post reach:*
> *Creator posts from seeding:*

---

### Block 5 — Section Header
**Type:** `section_header`
**Title:** SKU Performance

---

### Block 6 — Chart Block
**Type:** `chart`
**Label:** Units Sold by SKU
**Chart type:** Bar
**Instruction note:**
> *Add your SKU names and units sold. If you sold out all SKUs, all bars hit ceiling — which is the goal.*

---

### Block 7 — Chart Block
**Type:** `chart`
**Label:** Revenue by SKU
**Chart type:** Doughnut
**Instruction note:**
> *Add your SKU names and revenue figures. The SKU with the highest price point usually drives the most revenue share even on lower unit counts — use this to inform unit quantities on the next drop.*

---

### Blocks 8–10 — Shopify Product Blocks (3-column row)
**Type:** `shopify_product`
**Note:** Same SKUs as previous tabs. Post-launch context: inventory should show 0, units sold shows final count.

---

### Block 11 — Section Header
**Type:** `section_header`
**Title:** What Worked. What Didn't.
**Subtitle:** Write this within 48 hours

---

### Block 12 — Text Block (left column of 2-column row)
**Type:** `text`
**Label:** What Worked
**Placeholder content:**
> *List 3–5 specific things that worked. Be concrete — not "marketing was good" but "email list first window drove 70% of first-hour orders." These go into the next drop brief.*

---

### Block 13 — Text Block (right column of 2-column row)
**Type:** `text`
**Label:** What To Fix Next Time
**Placeholder content:**
> *List 3–5 specific things to fix. Assign a recommendation to each — not just "PR timing was bad" but "ship PR packages 3 weeks out, not 1." These are your standing operating improvements.*

---

### Block 14 — Task Block
**Type:** `task`
**Title:** Post-Launch Actions
**View mode:** List

**Pre-populated tasks:**

| Task | Priority | Status |
|---|---|---|
| Send waitlist email — restock update | Urgent | To-Do |
| Decide restock quantity per SKU | High | To-Do |
| Contact manufacturer — restock inquiry | High | To-Do |
| Repurpose launch video for IG Reels | Medium | To-Do |
| Write post-launch recap email to full list | High | To-Do |
| Pull full Shopify sales report | High | To-Do |
| Document launch learnings in Trak | High | To-Do |
| Brief PR on editorial follow-up | Medium | To-Do |
| Evaluate drop as permanent line | Medium | To-Do |
| Start brief for next drop | Medium | To-Do |

---

### Block 15 — File Block
**Type:** `file`
**Label:** Post-Launch Documents
**Placeholder instruction:**
> *Attach Shopify sales report, email performance export, social analytics exports, creator post screenshots, and waitlist CSV.*

---

### Block 16 — Doc Reference Block
**Type:** `doc_reference`
**Label:** Launch Retrospective
**Placeholder instruction:**
> *Link to or create a full retrospective doc here. The written record of how this launch ran — to be referenced when briefing the next drop.*

---

## Design Notes

**Consistent patterns across all tabs:**

- Every tab opens with a `section_header` block as the first element.
- Instructional placeholder text in text blocks is written in italics and removed when the brand fills in real content.
- Task blocks always use list view as default. Board view is available but not the default.
- Two-column rows are used consistently for paired content (brief + details, what worked + what to fix, etc.).
- Shopify product blocks repeat intentionally across tabs — same data, different operational context per tab.
- The right icon strip (lock, sparkle, layout, comment, person) is present on all canvases as standard chrome.

**Block count summary:**

| Tab | Blocks |
|---|---|
| Launch HQ | 16 blocks + Launch Day subtab (8 blocks) |
| Product Lineup | 7 blocks × 3 subtabs = 21 blocks |
| Creative Direction | 16 blocks |
| Campaign Rollout + PR | 15 blocks |
| Site + Merchandising | 16 blocks |
| Assets + Approvals | 17 blocks |
| Post-Launch | 16 blocks |
| **Total** | **~109 blocks** |

---

## Template Cloning Behavior

When a team clones this template:

- All tab names, block labels, and section headers carry over as-is.
- Instructional placeholder text inside text blocks carries over and is replaced by the team.
- Task blocks carry over with all pre-populated tasks. Assignees and due dates are blank and filled in by the team.
- Table blocks carry over with column definitions and pre-populated rows. Row content is edited by the team.
- Shopify product blocks carry over as empty slots — no product is pre-attached. The team attaches their own SKUs.
- Gallery and image blocks carry over as empty — no assets pre-loaded.
- File blocks carry over as empty — no files pre-attached.
- Video blocks carry over as empty.
- Timeline block carries over with milestone labels but no dates set.
- The client page is disabled at the project level. No Magic Link is configured on any tab.
- Chart blocks carry over as empty — no data pre-loaded.

---

*Spec version 1.0 — Trak Seasonal Drop / Multi-SKU Launch Template*