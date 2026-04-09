# Trak Template Spec — Influencer Seeding

**Template name:** Influencer Seeding  
**Tab count:** 2  
**Description:** For tracking a product seeding campaign tied to a specific launch. Covers every influencer from address collected to post live, plus a results summary once the campaign is done.

---

## Tab 1 — Seeding Tracker

The main working tab. Everything needed to run the campaign lives here — what's being sent, to whom, and where each person is in the pipeline. Updated continuously from the moment addresses are being collected through to posts going live.

### Blocks (in order)

**1. Shopify product block**  
Empty state. User pins the product being seeded. Visible at the top of the tab so the product, its price, and its inventory status are always in context while working the list.

---

**2. Three-column card row — Package Contents + Ship Date + Ask**

Left card — label: `What's in the package`  
Placeholder fields:
- [Product name]
- [Any extras — note, branded packaging, etc.]

Center card — label: `Ship date`  
Placeholder text:  
> Set your ship date and the address deadline. e.g. Ship Sept 5 — all addresses needed by Sept 3.

Right card — label: `Ask`  
Placeholder text:  
> What are you asking influencers to do? No obligation, tag us, use a code — write it here.

---

**3. Section header — Influencer List**  
Subheader text: `Track every contact from address confirmed to post live`

**4. Table block — Seeding List**  
Title: `Seeding List`  
Header badge: row count (e.g. `24 total`)  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Handle / Name | flex 2 | Instagram handle, TikTok handle, or full name for editors |
| Platform | flex 1.2 | Instagram / TikTok / YouTube / Editorial |
| Followers | flex 1 | Approximate follower count |
| Address | flex 0.8 | Confirmed ✓ / Pending / — |
| Shipped | flex 0.8 | ✓ / — |
| Posted | flex 0.8 | ✓ / Pending / — |
| Content | flex 1.5 | Link to post or notes on coverage — e.g. "TikTok · 80K views" |

Address, Shipped, and Posted columns use pill tags:  
- `pill-done` (green) for confirmed/shipped/posted  
- `pill-in-progress` (blue) for pending  
- `pill-todo` (grey) for not yet / —

Pre-populated with 5 empty rows.

---

**5. Task block — Campaign Tasks**  
Pre-populated tasks:
- Finalize seeding list
- Collect all addresses by [date]
- Confirm package contents + quantities
- Ship all packages
- Follow up with anyone who hasn't posted after 2 weeks

---

## Tab 2 — Results

Filled in after the campaign. A summary of reach, post rate, and top performers — plus the Shopify product block updated with live sales numbers. Becomes the reference point for future seeding decisions.

### Blocks (in order)

**1. Three-column card row — Reach + Top Performer + Post Rate**

Left card — label: `Reach`  
Placeholder fields:
- Total reach:
- Posts published:
- [Platform] views:
- [Platform] views:

Center card — label: `Top performer`  
Placeholder fields:
- Handle:
- Platform + views:
- Notes (link in bio, story, etc.):

Right card — label: `Post rate`  
Placeholder text:  
> X of Y seeded posted within Z weeks. Note any pending or non-posters.

---

**2. Section header — Performance by Platform**

**3. Chart block — Reach by Platform**  
Title: `Reach by Platform`  
Chart badge: `Chart`  
Chart type: donut  
Breakdown rows:
- Instagram
- TikTok
- YouTube
- Editorial

Footer stats: Posts / Seeded / Post rate

Empty state by default — user populates once campaign data is available or uses AI to generate from the seeding list table.

---

**4. Section header — Product — Post-Launch**

**5. Shopify product block**  
Same product pinned as in Tab 1. Now shows live sales numbers, units remaining, and rating — the post-campaign view of the product compared to the pre-launch view in the tracker tab.

---

**6. Section header — Notes**

**7. Text block — What worked / What to change**  
Placeholder copy:  
> Which influencers drove the most traffic? Which platform performed best? What would you do differently next time? Write it here before the next campaign starts.

---

## Notes for the coding agent

- The Shopify block appears in both tabs — Tab 1 shows the product pre-launch (draft or active, units reserved for seeding), Tab 2 shows the product post-launch with live sales data. Same product pinned, different point in time.
- The Address, Shipped, and Posted columns in the seeding list table are narrow — they function as status indicators, not text fields. Use pill tags only, no free text in these columns.
- The Content column is the only free-text column in the table — it holds a link to the post or a short note on coverage.
- The chart block in Tab 2 starts empty. The user populates it manually or prompts AI to generate a breakdown from the seeding list data.
- All task blocks default to list view (☰).
- All blocks include the standard right-side icon rail (lock, AI, grid, comment, user).
- Magic Links are opt-in only — no tab is pre-configured as public.
- This template is intentionally minimal — two tabs, no subtabs. Resist adding complexity.