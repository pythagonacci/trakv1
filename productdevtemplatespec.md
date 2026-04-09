# Trak Template Spec — Product Development & Design

**Template name:** Product Development & Design  
**Tab count:** 4  
**Description:** For taking a physical product from initial brief through to production-ready. Covers concept and specs, design and sampling, manufacturer coordination, and launch prep.

---

## Tab 1 — Product Brief

Where the product starts. The concept, target customer, dimensions, materials, and commercial targets are all written out before any design work begins. This tab is the source of truth for what the product is supposed to be — referenced throughout the entire development process.

### Blocks (in order)

**1. Text block — Product Concept**  
Placeholder copy:  
> Describe the product. What is it, who is it for, and why are you making it? What problem does it solve or gap does it fill in your line?

---

**2. Three-column card row — Dimensions + Materials + Commercial**

Left card — label: `Dimensions (target)`  
Placeholder fields:
- H:
- W:
- D:
- [Any other relevant dimension]:

Center card — label: `Materials`  
Placeholder fields:
- [Component]:
- [Component]:
- [Component]:
- [Component]:

Right card — label: `Commercial`  
Placeholder fields:
- Target retail price:
- Target COGS:
- First run quantity:
- Colorways / variants:

---

**3. Section header — Related Product**  
Subheader text: `Pinned from Shopify — for reference`

**4. Shopify product block**  
Empty state. User pins an existing product from their line that is most relevant to the new product being developed — for sizing reference, price point comparison, or customer context.

---

**5. Section header — Tasks**

**6. Task block — Brief & Kick-Off**  
Pre-populated tasks:
- Write product brief
- Align on dimensions and colorways
- Confirm target COGS
- Identify manufacturer / factory
- Set development timeline

---

## Tab 2 — Design & Samples

The core development tab. Contains all design references, the technical spec sheet, and a sample round block for logging feedback and revision status on each sample received. This tab is the running record of every decision made during development.

### Blocks (in order)

**1. Gallery block — Sketches + References**  
Title: `Sketches + References`  
Empty state. User uploads sketches, technical drawings, reference images, material swatches, and inspiration photos.

---

**2. Section header — Spec Sheet**

**3. Table block — Technical Spec**  
Title: `Technical Spec`  
Sub-label in header: `v1`  (updates as spec is revised — v1, v2, v3)  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Component | flex 2 | Part of the product — e.g. Body, Handle, Lining, Hardware |
| Specification | flex 2.5 | Exact detail — material, weight, dimensions, finish, stitch type |
| Material / Supplier | flex 1.5 | Where this component is sourced from |
| Status | flex 1 | Confirmed / Sourcing / TBD |

Pre-populated with 4 empty rows.  
Status column uses pill tags: `pill-done` for Confirmed, `pill-in-progress` for Sourcing, `pill-todo` for TBD.

---

**4. Section header — Sample Rounds**  
Subheader text: `Feedback and revision status per round`

**5. Sample round block**  
Title: `Sample Rounds`  
This is a structured block — not a standard table. Each sample round is a sub-section with:
- Round name (Sample 1, Sample 2, Sample 3)
- Date received
- Feedback text field — free text for logging what needs to change
- Change tags — each revision item is tagged as either `open` (orange) or `resolved` (green)

Pre-populated with Sample 1 as an open round. Sample 2 and Sample 3 are collapsed/empty until needed.

**6. Task block — Sample Tasks**  
Pre-populated tasks:
- Send spec sheet to factory
- Receive and review Sample 1
- Log feedback and send revision notes
- Receive and review Sample 2
- Sign off on final sample

---

## Tab 3 — Manufacturer

Owned by whoever manages production and sourcing. Contains factory details, cost breakdown, production timeline, and all tasks between sample sign-off and shipment. This tab means the design lead and the ops lead are always looking at the same numbers.

### Blocks (in order)

**1. Two-column card row — Factory + Order**

Left card — label: `Factory`  
Placeholder fields:
- Factory name:
- Contact name + email:
- Lead time:
- MOQ:
- Prior relationship:

Right card — label: `Order`  
Placeholder fields:
- Units:
- Colorways / variants:
- Order placed:
- Est. ship date:
- Incoterms:
- Status:

---

**2. Section header — Costing**

**3. Table block — Cost Breakdown**  
Title: `Cost Breakdown — per unit`  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Item | flex 2.5 | Cost category |
| Cost | flex 1 | Per unit dollar amount |
| Notes | flex 1.5 | Quoted vs estimated, assumptions |

Pre-populated rows:
- Materials
- Labour (cut, sew, finish)
- Packaging + tags
- Freight + duties
- **Total COGS** (summary row, styled differently)

---

**4. Section header — Production Timeline**

**5. Timeline block — Production Timeline**  
Title: `Production Timeline`  
Pre-populated milestone rows:
- Sample sign-off
- Production order placed
- Materials sourced / cut
- Production complete
- QC at factory
- Shipment departs
- Stock lands

Each row has: milestone name, target date, owner.

---

**6. Section header — Production Tasks**

**7. Task block — Post Sign-Off**  
Pre-populated tasks:
- Send final spec sheet to factory
- Confirm unit order + pay deposit
- Confirm packaging spec
- Book freight forwarder
- QC check at factory before shipment
- Confirm delivery details to warehouse / 3PL

---

## Tab 4 — Launch Prep

Opened once the final sample is signed off. Built out while production runs so everything is ready the day stock lands. Contains product copy, photography brief, and the Shopify listing checklist.

### Blocks (in order)

**1. Two-column card row — Product Copy + Photography Brief**

Left card — label: `Product Copy — Draft`  
Placeholder text:  
> Write the first draft of your product description here. Keep it close to the brief — lead with what makes this product different.

Right card — label: `Photography Brief`  
Placeholder fields:
- Shots needed:
- Photographer:
- Shoot date:
- Style notes:

---

**2. Section header — Shopify Listing**

**3. Task block — Pre-Launch Checklist**  
Pre-populated tasks:
- Create Shopify product draft — all variants
- Finalize product copy
- Upload approved photography
- Set pricing and inventory per variant
- Write meta description + SEO title
- QA listing on mobile
- Publish listing

---

## Notes for the coding agent

- The sample round block (Tab 2) is a custom block type — not a standard table. Each round is a collapsible sub-section. Change tags within each round toggle between `open` (orange, `pill-urgent`) and `resolved` (green, `pill-done`) as revisions are addressed.
- The Technical Spec table version label in the header bar (v1, v2, v3) should update manually — it is not auto-versioned.
- The Total COGS row in the cost breakdown table is a summary row — styled with a slightly different background (`#FAFAF9`) and bold text to distinguish it from line items.
- The Shopify block in Tab 1 is for an existing product used as reference — not the new product being developed.
- The timeline block in Tab 3 uses the standard timeline block with milestone name, target date, and assignee columns.
- All task blocks default to list view (☰).
- All blocks include the standard right-side icon rail (lock, AI, grid, comment, user).
- Magic Links are opt-in only — no tab is pre-configured as public.
- Block comments are available on all blocks — particularly useful on the spec sheet table and product copy card for team feedback.