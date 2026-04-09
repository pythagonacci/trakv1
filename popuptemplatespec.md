# Trak Template Spec — Pop-Up Event

**Template name:** Pop-Up Event  
**Tab count:** 4  
**Description:** For planning and running a physical pop-up or temporary retail event. Covers everything from venue and vendor coordination through to day-of operations.

---

## Tab 1 — Event HQ

The shared overview tab. Every team member references this tab. Contains the event brief, key details, the collection being sold at the event, and the master task tracker broken into three phases.

### Blocks (in order)

**1. Text block — Event Brief**  
Free-form text block. Placeholder copy:  
> Describe the event — what it is, why you're doing it, and what success looks like.

---

**2. Two-column card row — Event Details + Goals**

Left card — label: `Event Details`  
Placeholder fields:
- Dates:
- Address:
- Hours:
- Space size:
- Team on floor:

Right card — label: `Goals`  
Placeholder text:  
> What are you trying to get out of this event? Revenue, awareness, content, customer feedback — write it here.

---

**3. Section header — Collection in the Space**  
Subheader text: `Pinned from Shopify — live inventory`

**4. Shopify product block**  
Empty state — user pins the product(s) being sold at the event.

---

**5. Section header — Master Task Tracker**

**6. Task block — Pre-Event**  
Pre-populated tasks:
- Confirm venue and dates
- Lock all vendors
- File permits
- Finalize merch plan
- Send press/influencer invites
- Confirm Shopify POS hardware

**7. Task block — Event Week**  
Pre-populated tasks:
- Confirm all vendor arrival times
- Complete build-out
- Dress space and merchandise
- Brief floor staff
- Test POS — all readers

**8. Task block — Post-Event**  
Pre-populated tasks:
- Reconcile inventory
- Return or store equipment
- Write post-event recap
- Log learnings for next time

---

## Tab 2 — Space & Logistics

Owned by whoever is running operations. All vendor and venue information lives here. This tab answers every logistical question without anyone needing to dig through email.

### Blocks (in order)

**1. Two-column card row — Venue + Key Contacts**

Left card — label: `Venue`  
Placeholder fields:
- Address:
- Space size:
- Lease contact + phone:
- Access date/time:
- Deposit amount + paid date:

Right card — label: `Key Contacts`  
Placeholder fields:
- Ops lead:
- [Vendor type]: [Name]
- [Vendor type]: [Name]
- [Vendor type]: [Name]

---

**2. Section header — Vendor Tracker**  
Subheader text: `Every vendor from first contact to confirmed`

**3. Table block — Vendors**  
Title: `Vendors`  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Vendor | flex 2 | Vendor/company name |
| Service | flex 1.5 | What they're providing |
| Contact | flex 1.5 | Name + email or phone |
| Quote | flex 1 | Dollar amount |
| Deposit | flex 1 | Paid / Pending / — |
| Status | flex 1 | Confirmed / In Progress / Booked |

Pre-populated with 2 empty rows. Status column uses pill tags: `pill-done` for Confirmed, `pill-in-progress` for In Progress, `pill-todo` for not yet.

---

**3. Section header — Budget**

**4. Table block — Budget**  
Title: `Budget`  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Category | flex 2 | e.g. Venue, Fabrication, Florals |
| Estimated | flex 1 | Budgeted amount |
| Actual | flex 1 | Final cost |
| Variance | flex 1 | Positive or negative vs budget |
| Notes | flex 2 | Free text |

Pre-populated categories:
- Venue / lease deposit
- Rack fabrication / furniture
- Florals / styling
- Lighting
- Signage + printing
- Staffing
- Contingency

---

**5. Section header — Permits & Paperwork**

**6. Task block — Permits**  
Pre-populated tasks:
- Temporary retail permit
- Certificate of insurance — landlord copy
- Confirm Shopify POS hardware (quantity)
- Any other location-specific permits

---

## Tab 3 — Creative & Styling

Owned by whoever is leading the creative vision for the space. Contains the concept direction, moodboard, and the merchandise plan — which products are being displayed, how many units, where they sit in the space.

### Blocks (in order)

**1. Text block — Direction**  
Placeholder copy:  
> Describe how the space should look and feel. What's the aesthetic reference? What materials, lighting, and atmosphere are you going for? What do you want customers to experience when they walk in?

---

**2. Gallery block — Moodboard**  
Title: `Moodboard`  
Empty state. User uploads reference images, inspiration photos, material swatches.

---

**3. Section header — Merchandise Plan**  
Subheader text: `Units per SKU, colorway, and display location`

**4. Table block — Merch Plan**  
Title: `Merch Plan`  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Product | flex 2.5 | Product name |
| Colorway | flex 1.5 | Color / variant |
| Units | flex 1 | Number of units to bring |
| Display | flex 1.5 | Where in the space — rack, folded table, shelf, etc. |
| Status | flex 1 | Confirmed / In Review / TBD |

Pre-populated with 3 empty rows.

---

## Tab 4 — Day-Of

Built out in the week before the event. Handed off to all floor staff. Contains everything needed to run the event from setup through close — run of show, staff assignments, setup checklist, and live Shopify inventory.

### Blocks (in order)

**1. Section header — Run of Show**  
Subheader text: `Timeline for the day — setup through close`

**2. Timeline block — Day-Of Timeline**  
Title: `Day-Of Timeline`  
Pre-populated milestone rows:
- [Time] — Vendor arrivals / setup begins
- [Time] — Merchandise loaded and styled
- [Time] — POS tested
- [Time] — Doors open
- [Time] — Doors close / EOD inventory check

Each row has: time, label, owner (assignee).

---

**3. Section header — Staff**

**4. Table block — Staff Assignments**  
Title: `Staff Assignments`  
Columns:
| Column | Width | Notes |
|--------|-------|-------|
| Name | flex 1.5 | Staff member name |
| Role | flex 2 | What they're responsible for |
| Shift | flex 1 | Start and end time |
| Days | flex 1 | Which event days they're working |

Pre-populated with 3 empty rows.

---

**5. Section header — Setup Checklist**

**6. Task block — Setup**  
Pre-populated tasks:
- Confirm all vendor arrivals
- Racks / furniture in position
- Merchandise loaded and styled per plan
- Signage up
- POS tested — all readers
- Staff briefed

---

**7. Section header — Live Inventory**  
Subheader text: `Shopify — updated in real time`

**8. Shopify product block**  
Same products pinned as in Event HQ. Shows live inventory during the event so floor staff can monitor stock levels and restock from reserves as needed.

---

## Notes for the coding agent

- All task blocks default to list view (☰) with the kanban (⊞) and collapsed (⊟) toggles available
- All table blocks have a header bar with the table title and a row count badge
- Status/pill columns in tables use the standard pill system: `pill-done` (green), `pill-in-progress` (blue), `pill-urgent` (orange), `pill-todo` (grey), `pill-blocked` (red)
- The Shopify blocks in Tab 1 and Tab 4 should be the same pinned products — Tab 1 shows pre-event inventory, Tab 4 shows live inventory during the event
- Magic Links are opt-in only — no tab is pre-configured as public
- The two-column card rows use the standard `trak-col-row cols-2` layout
- All blocks include the standard right-side icon rail (lock, AI, grid, comment, user)