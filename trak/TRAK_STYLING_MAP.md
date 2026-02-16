# Trak Styling Map

## 1. Styling Stack Overview

**Tailwind CSS**: v4 (`tailwindcss: ^4`, `@tailwindcss/postcss: ^4`)
- Uses PostCSS plugin (`postcss.config.mjs`)
- No traditional `tailwind.config.ts` (v4 uses CSS-first config)

**Dark Mode**: Custom class-based strategy
- Theme classes applied to `<html>`: `.default`, `.dark`, `.brutalist`
- Custom variant: `@custom-variant dark (&:is(.dark *))`
- Theme context: `src/app/dashboard/theme-context.tsx`
- Persisted in localStorage (`trak-theme` key)
- No next-themes library

**Component Primitives**: shadcn/ui (Radix UI)
- Config: `components.json` (style: "new-york", RSC: true)
- Base components in `src/components/ui/`
- Radix UI primitives: Dialog, DropdownMenu, Select, Checkbox, Label, Tooltip, Slot
- Icon library: lucide-react

**cn() utility**: `src/lib/utils.ts`
- Uses `clsx` + `tailwind-merge`
- Standard shadcn pattern: `cn(...inputs: ClassValue[])`

**cva (Class Variance Authority)**: Used for variants
- `class-variance-authority: ^0.7.1`
- Used in: Button, Badge, Label
- Variants defined inline with cva()

---

## 2. Token Sources

**Primary**: `src/app/globals.css`
- All CSS variables defined in `@layer base`
- Three theme blocks: `:root` (default), `.dark`, `.brutalist`
- Custom utilities in `@layer utilities`

**No separate theme files** - everything in globals.css

**PostCSS config**: `postcss.config.mjs` (Tailwind v4 plugin)

---

## 3. Token Inventory

### Light Theme (`:root`)

**Backgrounds**
- `--background`: `#F2F0EB` (Plaster Canvas)
- `--surface`: `#FFFFFF` (Card White)
- `--surface-hover`: `#EBE9E4`
- `--surface-muted`: `#E8E6E1`

**Borders**
- `--border`: `#D1D4D6` (River Mist)
- `--border-strong`: `#3080a6` (Secondary color)

**Typography**
- `--foreground`: `#1a1d21` (Near-black)
- `--muted-foreground`: `#374151` (Dark gray)
- `--tertiary-foreground`: `#6b7280` (Medium gray)

**Primary Actions**
- `--primary`: `#9C7C58` (Coffee Patina)
- `--primary-foreground`: `#FFFFFF`
- `--primary-hover`: `#8A6D4C`
- `--focus-ring`: `rgba(38, 91, 82, 0.3)`
- `--ring-offset`: `#F2F0EB`

**Secondary**
- `--secondary`: `#3080a6`

**Semantic Colors**
- `--success`: `#6B827D` (Oxidized Sage)
- `--success-foreground`: `#FFFFFF`
- `--warning`: `#C9A857` (Antique Gold)
- `--warning-foreground`: `#2D3236`
- `--error`: `#B85C5C` (Muted Rose)
- `--error-foreground`: `#FFFFFF`
- `--info`: `#6B8CAE` (Dusty Denim)
- `--info-foreground`: `#FFFFFF`

**Sarajevo Arts Palette**
- `--tile-orange`: `#C77D63`
- `--dome-teal`: `#4A7A78`
- `--river-indigo`: `#52637A`
- `--tram-yellow`: `#D4A353`
- `--velvet-purple`: `#7D6B7D`
- `--nav-icon`: `#52637A`
- `--nav-icon-active`: `#4A7A78`

**Radius**
- `--radius-xs`: `4px`
- `--radius-sm`: `6px`
- `--radius-md`: `10px`
- `--radius-lg`: `14px`
- `--radius-xl`: `18px`

**Shadows**
- `--shadow-card`: `none`
- `--shadow-modal`: `0 4px 24px rgba(0, 0, 0, 0.05)`

### Dark Theme (`.dark`)

**Backgrounds**
- `--background`: `#1A1918` (Dark plaster)
- `--surface`: `#242321` (Dark card)
- `--surface-hover`: `#2D2C2A`
- `--surface-muted`: `#323130`

**Borders**
- `--border`: `#3D3B39`
- `--border-strong`: `#3890b6`

**Typography**
- `--foreground`: `#E8E6E1`
- `--muted-foreground`: `#9CA3AF`
- `--tertiary-foreground`: `#6B7280`
- `--ring-offset`: `#1A1918`

**Primary Actions**
- `--primary`: `#B89A74` (Lighter coffee)
- `--primary-hover`: `#C9AB85`

**Secondary**
- `--secondary`: `#3890b6`

**Arts Palette** (lighter variants)
- `--tile-orange`: `#D98E74`
- `--dome-teal`: `#5A8A88`
- `--river-indigo`: `#6B7C94`
- `--tram-yellow`: `#E4B363`
- `--velvet-purple`: `#8D7B8D`
- `--nav-icon`: `#6B7C94`
- `--nav-icon-active`: `#5A8A88`

### Brutalist Theme (`.brutalist`)

**Backgrounds**
- `--background`: `#1c1c1c`
- `--surface`: `#252526`
- `--surface-hover`: `#2d2d30`
- `--surface-muted`: `#2a2d2e`

**Borders**
- `--border`: `#3e3e42`
- `--border-strong`: `#464647`

**Typography**
- `--foreground`: `#cccccc`
- `--muted-foreground`: `#858585`
- `--tertiary-foreground`: `#6a6a6a`
- `--ring-offset`: `#1c1c1c`

**Primary**
- `--primary`: `#007acc`
- `--primary-foreground`: `#ffffff`
- `--focus-ring`: `rgba(0, 122, 204, 0.4)`

**Semantic**
- `--success`: `#4ec9b0`
- `--warning`: `#dcdcaa`
- `--error`: `#f48771`
- `--info`: `#4ec9b0`

---

## 4. Primitive Component Inventory

### Button (`src/components/ui/button.tsx`)
- **Variants**: default, secondary, ghost, outline, destructive, success, light
- **Sizes**: default, sm, lg, icon
- **Uses**: cva(), Radix Slot
- **Tokens**: `--secondary`, `--surface`, `--border`, `--foreground`, `--error`, `--success`
- **Radius**: `rounded-[2px]` (hardcoded)

### Badge (`src/components/ui/badge.tsx`)
- **Variants**: default, secondary, destructive, success, warning, info, outline
- **Uses**: cva()
- **Tokens**: `--border`, `--surface`, `--error`, `--success`, `--tram-yellow`, `--river-indigo`
- **Shape**: `rounded-full`

### Card (`src/components/ui/card.tsx`)
- **Components**: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **No variants** - base component
- **Tokens**: `--border`, `--surface`, `--foreground`, `--muted-foreground`
- **Radius**: `rounded-[2px]`

### Input (`src/components/ui/input.tsx`)
- **No variants** - base input styling
- **Tokens**: `--border`, `--surface`, `--foreground`, `--tertiary-foreground`, `--border-strong`, `--focus-ring`
- **Radius**: `rounded-[2px]`
- **Height**: `h-10`

### Textarea
- **Not found** - likely uses Input styles or native

### Select (`src/components/ui/select.tsx`)
- **Radix Select** primitives
- **Components**: Select, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectSeparator
- **Tokens**: `--border`, `--surface`, `--foreground`, `--muted-foreground`, `--focus-ring`, `--ring-offset`
- **Radius**: `rounded-[2px]`

### Combobox
- **Not found** - may use Select or custom

### Checkbox (`src/components/ui/checkbox.tsx`)
- **Radix Checkbox**
- **Tokens**: `--border`, `--surface`, `--primary`, `--primary-foreground`, `--focus-ring`, `--ring-offset`
- **Radius**: `rounded-[2px]`
- **Size**: `h-4 w-4`

### Radio
- **Not found** - may use DropdownMenuRadioItem

### Switch (`src/components/ui/switch.tsx`)
- **Custom implementation** (not Radix)
- **Tokens**: `--border`, `--surface`, `--primary`, `--focus-ring`, `--ring-offset`
- **Shape**: `rounded-full`
- **Size**: `h-5 w-9`

### Table (`src/components/ui/table.tsx`)
- **Components**: Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption
- **Tokens**: `--border`, `--surface`, `--secondary`, `--tertiary-foreground`, `--foreground`, `--dome-teal`
- **Radius**: `rounded-[2px]` (wrapper)
- **Row hover**: `hover:bg-[var(--dome-teal)]/[0.04]`

### Tabs
- **Not found** - may be custom or missing

### Dialog (`src/components/ui/dialog.tsx`)
- **Radix Dialog**
- **Components**: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogOverlay
- **Tokens**: `--border`, `--surface`, `--foreground`, `--muted-foreground`
- **Radius**: `rounded-[4px]` (content), `rounded-[2px]` (close button)
- **Overlay**: `bg-[#2D3236]/40` (hardcoded)

### Dropdown/Menu (`src/components/ui/dropdown-menu.tsx`)
- **Radix DropdownMenu**
- **Components**: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator
- **Tokens**: `--border`, `--surface`, `--surface-hover`, `--foreground`, `--muted-foreground`, `--primary`
- **Radius**: `rounded-[2px]`
- **Shadow**: `shadow-[0_4px_16px_rgba(0,0,0,0.04)]` (hardcoded)

### Tooltip (`src/components/ui/tooltip.tsx`)
- **Radix Tooltip**
- **Components**: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider
- **Tokens**: `--border`, `--surface`, `--foreground`
- **Radius**: `rounded-[2px]`

### Toast (`src/app/dashboard/projects/toast.tsx`)
- **Location**: `src/app/dashboard/projects/toast.tsx`
- **Note**: May be custom implementation

### Label (`src/components/ui/label.tsx`)
- **Radix Label**
- **Uses**: cva() (no variants)
- **Tokens**: `--foreground`

---

## 5. Top 10 Styling Hotspots

1. **`src/app/dashboard/layout-client.tsx`**
   - Hardcoded `#3080a6` colors throughout sidebar (20+ instances)
   - Should use `--secondary` token
   - Lines: 308, 323, 390, 412, 515, 519, 527, 535, 539, 546, 549, 661

2. **`src/components/ai/ai-command-palette.tsx`**
   - Hardcoded `#3080a6` colors
   - Should use `--secondary` or semantic tokens
   - Lines: 1223, 1322, 1356, 1408

3. **`src/app/dashboard/workflow/[workflowPageId]/workflow-page-layout.tsx`**
   - Hardcoded `#3080a6` colors in borders/backgrounds
   - Should use `--secondary` token
   - Lines: 90, 104, 117, 128, 139

4. **`src/app/dashboard/projects/[projectId]/create-tab-dialog.tsx`**
   - Hardcoded `#3080a6` color
   - Should use `--secondary` token
   - Line: 333

5. **`src/app/dashboard/projects/[projectId]/client-page-toggle.tsx`**
   - Hardcoded `#3080a6` colors
   - Should use `--secondary` token
   - Lines: 226, 284

6. **`src/app/dashboard/workflow/workflow-pages-table.tsx`**
   - Hardcoded `#3080a6` colors
   - Should use `--secondary` token
   - Line: 139

7. **`src/app/client/[publicToken]/client-account-header.tsx`**
   - Hardcoded `#3080a6` color
   - Should use `--secondary` token
   - Line: 7

8. **`src/components/tables/table-timeline-view.tsx`**
   - Hardcoded `gray-*` Tailwind colors (15+ instances)
   - Should use CSS variables: `--foreground`, `--muted-foreground`, `--border`, `--surface`
   - Lines: 302, 310, 312, 325, 331, 340, 345, 388, 389, 516, 519, 542

9. **`src/types/properties.ts`**
   - Hardcoded `gray-*` colors with dark mode variants
   - Should use CSS variables
   - Lines: 36, 43

10. **`src/components/tables/table-view.tsx`**
    - Hardcoded `gray-500` color
    - Should use `--muted-foreground` or `--tertiary-foreground`
    - Line: 1785

---

## 6. 10 Key Screens/Routes to Regression-Test

1. **`/dashboard`** - Dashboard overview/home
   - File: `src/app/dashboard/page.tsx`
   - Components: DashboardOverview, stat cards, AI insights

2. **`/dashboard/projects`** - Projects list
   - File: `src/app/dashboard/projects/page.tsx`
   - Tables, filters, project cards

3. **`/dashboard/projects/[projectId]`** - Project detail
   - File: `src/app/dashboard/projects/[projectId]/page.tsx`
   - Project header, tabs, sidebar

4. **`/dashboard/projects/[projectId]/tabs/[tabId]`** - Project tab canvas
   - File: `src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx`
   - Block renderer, canvas, inline editing

5. **`/dashboard/workspace/everything`** - Everything view
   - File: `src/app/dashboard/workspace/everything/page.tsx`
   - Unified data view, tables

6. **`/dashboard/workflow`** - Workflow pages
   - File: `src/app/dashboard/workflow/[workflowPageId]/workflow-page-layout.tsx`
   - AI chat panel, workflow UI

7. **`/dashboard/clients/[clientId]`** - Client detail
   - File: `src/app/dashboard/clients/[clientId]/page.tsx`
   - Client tabs, project relationships

8. **`/dashboard/docs/[docId]`** - Document editor
   - File: `src/app/dashboard/docs/[docId]/doc-editor.tsx`
   - Rich text editor (ProseMirror), formatting

9. **`/dashboard/calendar`** - Calendar view
   - File: `src/app/dashboard/calendar/calendar-view.tsx`
   - Event rendering, date navigation, theme-aware colors

10. **`/client/[publicToken]/[tabId]`** - Public client view
    - File: `src/app/client/[publicToken]/[tabId]/page.tsx`
    - Client-facing interface, different header styling

---

**Note**: All components use `rounded-[2px]` or `rounded-[4px]` hardcoded values instead of CSS variables. Consider migrating to `var(--radius-sm)` / `var(--radius-md)` for consistency.
