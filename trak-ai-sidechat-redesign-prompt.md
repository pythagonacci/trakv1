# Trak AI Sidechat UI/UX Redesign

## Objective

Redesign Trak’s current AI sidechat UI to feel more native to Trak’s product language.

This is a **UI/UX and layout refactor**, not a logic rewrite.

Preserve all existing functionality and behavior. The goal is to make the sidechat feel:

- flatter
- sharper
- denser
- cleaner
- more premium
- less bubbly
- less generic “AI chat app”
- more like a native Trak workspace tool

The sidechat should feel like an integrated operational surface for D2C teams, not a consumer chatbot.

---

## Very Important Constraints

### Do not break or rewrite existing behavior
Preserve all current functionality, including but not limited to:

- assistant / file / search modes
- search submodes
- route scoping resets
- streaming
- abort / stop streaming
- auto-scroll
- textarea auto-resize
- drag/drop file upload
- attachment chips
- file mentions
- write confirmation flows
- undo flows
- add-to-page actions
- clear chat semantics per mode
- keyboard shortcuts
- workflow-page mounted-while-collapsed behavior
- dashboard command-palette behavior
- all current API wiring and state logic

This should be treated as a **presentation-layer redesign** of the existing sidechat.

### Do not blindly copy reference code
Below I am including **design reference code** that shows the visual direction I want.

That code is **not** meant to be copied literally.

Do **not** transplant it directly into the codebase.

Instead:
- study the proportions
- study the visual hierarchy
- study the spacing/radius/shadow treatment
- study the overall feel
- then implement the same design language using the **actual structure, state, and best practices of the Trak codebase**

You must use real codebase context and production-quality implementation decisions.

---

## Relevant Existing Files

Use the actual codebase structure. The primary file is:

- `src/components/ai/ai-panel.tsx` — main sidechat UI + behavior
- `src/components/ai/ai-command-palette.tsx`
- `src/components/ai/ai-context.tsx`
- `src/app/dashboard/workflow/[workflowPageId]/workflow-page-layout.tsx`
- `src/app/dashboard/layout-client.tsx`
- `src/app/globals.css`

The current implementation is highly coupled, so keep changes careful and localized where possible.

---

## Core Design Direction

The current panel feels too bubbly and generic. The redesign should move toward:

- tighter spacing
- smaller radii
- softer, lighter shadows
- flatter surfaces
- cleaner borders
- more intentional alignment
- calmer empty states
- less “pill everywhere”
- more polished hierarchy
- more Trak-native visual language

It should feel closer to a premium internal workspace tool than a floating AI consumer product.

---

## Specific Visual Goals

### 1. Outer panel shell
Refine the panel shell so it feels more structured and less soft.

Current issues:
- too bubbly
- too much “chat app” energy
- too much reliance on rounded surfaces and pill controls
- hardcoded `bg-[#fbfcfd]` usage feels inconsistent

Target direction:
- flatter overall shell
- smaller corner radii
- subtle border and restrained shadow
- cleaner use of surface tokens where appropriate
- more polished top-to-bottom hierarchy

Important:
- do not break the modal/sidebar variants
- do not break workflow width transition behavior
- preserve drag/drop affordances and dragging highlight

---

### 2. Header redesign
Redesign the header to feel cleaner and more premium.

Current issues:
- mode tabs feel too much like generic segmented pills
- hierarchy is weak
- overall header feels utilitarian rather than designed

Target direction:
- title/subtitle treatment should feel more refined
- keep mode switching clear, but visually flatter and sharper
- reduce pill-like softness
- improve spacing/alignment between icon, title, subtitle, tabs, and close button
- make the entire header feel more intentional and less crowded

You may reorganize the visual hierarchy of:
- icon
- title
- subtitle
- mode tabs
- close button
- context bar

But preserve functionality.

### Preferred header copy direction
Use:
- Title: `What would you like to work on?`
- Subtitle for empty state: `Ask questions or have Trak take action anywhere in your workspace.`

Do **not** change the product mode labels unless there is a strong reason:
- AI Assistant
- File Analysis
- Search

If there is an existing title region that still needs mode-specific labeling, keep that practical and grounded. But the overall UI should visually support the empty-state direction above.

---

### 3. Add a true empty state
Right now there is effectively no designed empty state.

Implement a polished empty state in the messages area when the current mode has no content yet.

Requirements:
- visually centered within the empty message area
- calm, premium, minimal
- should not interfere with scroll behavior
- should not create auto-scroll jank
- should work cleanly for the empty assistant state at minimum
- ideally should be adaptable for other modes if appropriate

Preferred empty-state content:
- Heading: `What would you like to work on?`
- Body: `Ask questions or have Trak take action anywhere in your workspace.`

Visual direction:
- small subtle icon/glyph above
- centered text block
- restrained width
- soft muted supporting text
- no oversized illustration
- no playful onboarding style
- should feel like an elegant idle workspace state

---

### 4. Messages area styling
Refine the message area so it feels more premium and less bubbly.

Current issues:
- bubble feel is too soft
- spacing and surface treatment can feel generic
- panel background is visually flat in an inconsistent way

Target direction:
- cleaner background/surface hierarchy
- message surfaces should feel sharper and more intentional
- reduce over-rounding where possible
- improve vertical rhythm and spacing consistency
- preserve readability and alignment
- do not break existing markdown / HTML rendering / action affordances

Do not break:
- assistant messages
- file-analysis message rendering
- search entries
- loading rows
- write confirmation UI
- undo/add-to-page controls
- source lists
- dangerous HTML container behavior in file mode

---

### 5. Composer redesign
Redesign the bottom composer so it feels much more native to Trak and less like a generic AI chat input.

Current issues:
- too bubbly
- controls feel detached
- composer feels more like a floating consumer chat input than a workspace command surface

Target direction:
- flatter
- tighter
- sharper
- more compact
- more premium
- better integrated with panel chrome

Keep:
- attach button
- textarea
- send/stop behavior
- routing chips
- file chips
- mentions dropdown
- upload list
- hidden file input
- clear chat action

Improve:
- button shapes
- spacing
- borders
- input container treatment
- overall density
- alignment and compositional balance

The composer should feel like a serious command/action surface for work.

---

### 6. Reduce “bubbliness” systematically
Across the entire AI panel, audit and reduce:
- `rounded-full`
- `rounded-lg`
- oversized radii
- heavy soft shadows
- overly padded pills
- overly soft chips

Move toward:
- smaller radii
- tighter chip/button proportions
- lighter shadows
- flatter surfaces
- sharper segmentation

This should apply consistently across:
- outer panel
- header controls
- mode tabs
- message surfaces where appropriate
- chips
- buttons
- composer
- empty state icon container

---

### 7. Keep it production-grade
Implementation must meet production standards.

That means:
- preserve accessibility
- preserve keyboard interaction
- do not introduce layout regressions
- do not break overflow behavior
- do not break responsive behavior
- do not break route-specific behavior
- do not break mounted-but-collapsed workflow sidebar behavior
- keep code clean and maintainable
- avoid unnecessary rewrites
- use existing tokens/utilities where appropriate
- reduce hardcoded styling where sensible, but do not do a massive token refactor unless required for the redesign

---

## Design Reference Code (Inspiration Only — Do Not Copy Literally)

This code is here only to communicate the visual direction I want.

You may reference:
- general shell feel
- spacing
- hierarchy
- emptystate composition
- flatter/sharper styling language

You may **not** treat it as implementation code to copy/paste.

```tsx
export default function TrakAiChatEmptyStatePreview() {
  return (
    <div className="min-h-screen w-full bg-[#f3f4f6] flex items-center justify-center p-6">
      <div className="w-[440px] h-[900px] rounded-[12px] bg-[#f7f7f8] border border-black/10 shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-black/8 bg-[#f7f7f8]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-4 w-4 rounded-[6px] border border-[#9ec7de] bg-[#e8f4fb]" />
              <div>
                <div className="text-[17px] leading-[1.1] font-semibold text-[#1f2937]">
                  AI Assistant
                </div>
                <div className="mt-0.5 text-[12px] leading-[1.3] text-[#6b7280] max-w-[180px]">
                  Prompt to actions and answers
                </div>
              </div>
            </div>

            <button className="h-7 w-7 rounded-[8px] border border-black/10 text-[#6b7280] flex items-center justify-center text-sm">
              ×
            </button>
          </div>

          <div className="mt-4 flex items-center gap-1">
            <div className="h-8 px-3 rounded-[8px] bg-white border border-black/10 text-[13px] font-medium text-[#111827] flex items-center">
              AI Assistant
            </div>
            <div className="h-8 px-3 rounded-[8px] text-[13px] text-[#6b7280] flex items-center">
              File Analysis
            </div>
            <div className="h-8 px-3 rounded-[8px] text-[13px] text-[#6b7280] flex items-center">
              Search
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-[290px] text-center">
            <div className="mx-auto mb-4 h-9 w-9 rounded-[10px] border border-black/8 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center text-[#6b7280]">
              ✦
            </div>

            <h2 className="text-[20px] leading-tight font-semibold tracking-[-0.01em] text-[#111827]">
              What would you like to work on?
            </h2>

            <p className="mt-2 text-[14px] leading-6 text-[#6b7280]">
              Ask questions or have Trak take action anywhere in your workspace.
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="rounded-[18px] border border-black/10 bg-[#f7f7f8] p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <button className="h-9 w-9 shrink-0 rounded-[10px] border border-black/10 bg-white text-[#6b7280] flex items-center justify-center">
                ⎘
              </button>

              <div className="h-9 flex-1 rounded-[10px] border border-black/10 bg-white px-4 flex items-center text-[14px] text-[#9ca3af]">
                Ask anything or give a command...
              </div>

              <button className="h-9 w-9 shrink-0 rounded-[10px] bg-[#9fc4d8] text-white flex items-center justify-center">
                ↗
              </button>
            </div>
          </div>

          <div className="mt-3 text-center text-[12px] text-[#6b7280] underline underline-offset-2">
            Clear Chat
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Known Current Implementation Details to Respect

Please work with the real implementation constraints:

- `AIPanel` is currently a highly coupled client component handling most layout + logic
- there is no dedicated empty state component right now
- dashboard variant = `variant="modal"`
- workflow page variant = `variant="sidebar"`
- workflow pages keep the panel mounted even when visually collapsed so streaming can continue
- current UI uses Tailwind + CSS variable tokens from `globals.css`
- many bubbly choices are currently hardcoded (`rounded-lg`, `rounded-full`, `bg-[#fbfcfd]`, arbitrary shadows)
- message scroll area auto-scrolls to bottom on changes
- textarea auto-resizes from 40px to 200px
- drag/drop highlight exists on the outer panel
- file mode has mentions dropdown and upload/session-specific behavior
- assistant mode includes write confirmation, undo, add-to-page, routing tags, and streaming stop
- search mode has independent entries and clear behavior

---

## Recommended Implementation Approach

1. Inspect `ai-panel.tsx` and identify the smallest clean refactor path.
2. Separate visual structure from behavioral logic where useful, but do not do a risky rewrite.
3. Introduce a proper empty-state render path for empty modes.
4. Redesign the shell, header, tabs, scroll area styling, and composer styling.
5. Systematically reduce radii / pill treatment / shadow softness.
6. Preserve behavior exactly.
7. Keep all route/layout variants functioning.

---

## Deliverables

Please provide:

### 1. Implementation summary
A concise summary of what you changed and why.

### 2. File list
Which files you changed.

### 3. UI decisions
A brief explanation of:
- shell changes
- header changes
- empty state design
- composer changes
- how you reduced bubbliness

### 4. Validation notes
Confirm that the following were preserved:
- mode switching
- streaming + stop
- route resets
- mounted-while-collapsed workflow behavior
- file upload / mentions
- search behavior
- auto-scroll
- textarea auto-resize
- clear chat behavior

### 5. Final code
Implement the redesign directly in the real codebase.

Do not just describe it.
