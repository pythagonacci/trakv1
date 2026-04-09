# Trak / Saria — Styling audit

Generated for styling refresh. Application root: `trak/`.

---

## 1. Tech stack confirmation
| Item | Value |
|------|--------|
| **Next.js** | `^16.0.7` (`trak/package.json`) |
| **React** | `^19.2.1` |
| **Tailwind CSS** | `^4` with `@tailwindcss/postcss` (no `tailwind.config.js` / `tailwind.config.ts` in repo) |
| **shadcn/ui** | Yes — `components.json` points to shadcn schema, style `new-york`, `cssVariables: true` |
| **Radix UI** | Yes — `@radix-ui/react-*` primitives (checkbox, dialog, dropdown-menu, label, select, slot, tooltip, etc.) |
| **Other** | `class-variance-authority`, `tailwind-merge`, `lucide-react` |
| **CSS modules** | None found (no `*.module.css` / `*.module.scss` under `trak/`) |

Tailwind v4 entry: `@import 'tailwindcss';` in `src/app/globals.css`. PostCSS: `postcss.config.mjs` with `@tailwindcss/postcss`.

## 2. Global styles / design tokens
### 2.1 Tailwind config
There is **no** `tailwind.config.*` file. Theme extension is done via **CSS custom properties** in `globals.css` and Tailwind utility classes.

### 2.2 `components.json` (shadcn)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}
}

```

### 2.3 Design tokens (from `src/app/globals.css`)
**Custom variant:** `@custom-variant dark (&:is(.dark *));` — dark styles apply when an ancestor has class `dark`.

#### Colors (`:root` light — Sarajevo)
| Token | Value |
|-------|--------|
| `--background` | #F8F7F5 |
| `--surface` | #FFFFFF |
| `--surface-hover` | #EBE9E4 |
| `--surface-muted` | #E8E6E1 |
| `--border` | #D1D4D6 |
| `--border-strong` | #3080a6 |
| `--foreground` | #1a1d21 |
| `--muted-foreground` | #232d3a |
| `--tertiary-foreground` | #6b7280 |
| `--primary` | #3080a6 |
| `--primary-foreground` | #FFFFFF |
| `--primary-hover` | #2d789c |
| `--focus-ring` | rgba(48, 128, 166, 0.35) |
| `--ring-offset` | #F2F0EB |
| `--brand-neutral` | #9C7C58 |
| `--success` | #6B827D |
| `--success-foreground` | #FFFFFF |
| `--warning` | #C9A857 |
| `--warning-foreground` | #2D3236 |
| `--error` | #B85C5C |
| `--error-foreground` | #FFFFFF |
| `--info` | #6B8CAE |
| `--info-foreground` | #FFFFFF |
| `--tile-orange` | #C77D63 |
| `--dome-teal` | #4A7A78 |
| `--river-indigo` | #52637A |
| `--tram-yellow` | #D4A353 |
| `--velvet-purple` | #7D6B7D |
| `--nav-icon` | #52637A |
| `--nav-icon-active` | #4A7A78 |
| `--header-bar-bg` | rgba(48, 128, 166, 0.06) |
| `--header-bar-text` | #1a1d21 |
| `--overlay` | rgba(45, 50, 54, 0.4) |

#### Colors (`.dark` — Sarajevo night)
Overrides include `--background` `#181b20`, `--surface` `#1f2329`, adjusted borders, foregrounds, primary `#3f7ea4`, arts palette variants, `--header-bar-*`, `--overlay`, etc. (see full CSS).

#### Colors (`.brutalist` — Cursor-style)
Separate charcoal theme with `--primary` `#007acc`, VS Code-like semantic colors, same radius scale.

#### Fonts (CSS variables)
| Token | Stack / note |
|-------|----------------|
| `--font-sans` | `'Inter', ui-sans-serif, system-ui, ...` (overridden by `next/font` variable on `<html>`) |
| `--font-serif` | `'Newsreader', Georgia, ...` (not loaded via `next/font` in root layout) |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` (not loaded via `next/font` in root layout) |

#### Border radius
| Token | Value |
|-------|--------|
| `--radius-xs` | 2px |
| `--radius-sm` | 4px |
| `--radius-md` | 6px |
| `--radius-lg` | 8px |
| `--radius-xl` | 10px |

#### Spacing / shadows / misc
- **Shadows:** `--shadow-card: none`, `--shadow-modal: 0 4px 24px rgba(0,0,0,0.05)`; utilities `.shadow-card`, `.shadow-popover`, `.shadow-modal`, `.shadow-subtle`.
- **Body:** `font-size: 15px`, `font-weight: 500`, `line-height: 1.6` in `body` rule.
- **Zoom wrapper:** `#app-scale-wrapper` uses `--zoom-scale: 0.85` with CSS transform (global layout zoom).
- **Audit note:** Many components reference `var(--secondary)` for hovers and buttons, but **`--secondary` is not defined** in `:root` / `.dark` / `.brutalist` in `globals.css`. Consider adding it or replacing with `--primary` / a named token.

### 2.4 Full `globals.css` (entire file)
```css
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));

@layer base {
  :root {
    /* ===== SARAJEVO THEME ===== */
    /* A productivity-focused theme inspired by Sarajevo, Bosnia */
    /* Blends "monumental structure" (Brutalist/Deco) with "airy resilience" */
    /* Features the Sarajevo Arts Palette: Tile Orange, Dome Teal, River Indigo, Tram Yellow, Velvet Purple */
    
    /* Typography - Inter loaded via next/font in layout.tsx sets --font-sans */
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
    --font-serif: 'Newsreader', 'Georgia', 'Cambria', 'Times New Roman', serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

    /* Backgrounds - Warm, matte, no high-glare */
    --background: #F8F7F5; /* Plaster Canvas - lighter warm off-white, matte */
    --surface: #FFFFFF; /* Card White - for active content only */
    --surface-hover: #EBE9E4; /* Slightly darker plaster for hover states */
    --surface-muted: #E8E6E1; /* Muted plaster for secondary surfaces */
    
    /* Borders - Structural, visible but light */
    --border: #D1D4D6; /* River Mist - structural dividers */
    --border-strong: #3080a6; /* Primary color for emphasis */
    
    /* Typography Colors - Dark enough for comfortable reading */
    --foreground: #1a1d21; /* Near-black for primary text */
    --muted-foreground: #232d3a; /* Darker gray for body/paragraph text */
    --tertiary-foreground: #6b7280; /* Medium gray for placeholders, metadata */

    /* Primary Action - True semantic primary (#3080a6) */
    --primary: #3080a6; /* Primary blue for buttons, active tabs, main actions */
    --primary-foreground: #FFFFFF;
    --primary-hover: #2d789c; /* Darkened by ~6% for hover states */
    --focus-ring: rgba(48, 128, 166, 0.35); /* Primary color with transparency */
    --ring-offset: #F2F0EB;
    
    /* Brand Neutral - Demoted coffee tone */
    --brand-neutral: #9C7C58; /* Coffee Patina - available for special use cases */

    /* Semantic Colors - Muted, low saturation */
    --success: #6B827D; /* Oxidized Sage - muted copper green */
    --success-foreground: #FFFFFF;
    --warning: #C9A857; /* Antique Gold - muted amber */
    --warning-foreground: #2D3236;
    --error: #B85C5C; /* Muted Rose - terra-cotta, low saturation */
    --error-foreground: #FFFFFF;
    --info: #6B8CAE; /* Dusty Denim - muted blue */
    --info-foreground: #FFFFFF;
    
    /* ===== SARAJEVO ARTS PALETTE ===== */
    /* Rich, earthy colors inspired by Sarajevo's artistic heritage */
    --tile-orange: #C77D63; /* Terracotta roofs - High Priority, Urgent */
    --dome-teal: #4A7A78; /* Copper oxidation - Done states, folders, icons */
    --river-indigo: #52637A; /* Miljacka at dusk - New tags, nav icons */
    --tram-yellow: #D4A353; /* Electric trams - In Progress, Warning */
    --velvet-purple: #7D6B7D; /* Dried flowers/smoke - Personal, Admin */
    
    /* Navigation icon color */
    --nav-icon: #52637A; /* River Indigo for sidebar icons */
    --nav-icon-active: #4A7A78; /* Dome Teal for active state */

    /* Border Radius - Subtle rounding, more square than rounded */
    --radius-xs: 2px;
    --radius-sm: 4px; /* Subtle rounding */
    --radius-md: 6px; /* Moderate rounding */
    --radius-lg: 8px; /* Slightly more rounding */
    --radius-xl: 10px;
    
    /* Shadows - Minimal, replaced with borders */
    --shadow-card: none;
    --shadow-modal: 0 4px 24px rgba(0, 0, 0, 0.05);
    
    /* Overlay - For dialogs and modals */
    --overlay: rgba(45, 50, 54, 0.4); /* Semantic overlay token */

    /* Dashboard header bar - same blue as primary, very transparent */
    --header-bar-bg: rgba(48, 128, 166, 0.06);
    --header-bar-text: #1a1d21;
  }

  /* Dark Theme - Sarajevo Night (layered charcoals, low-glare) */
  .dark {
    /* Backgrounds: layered charcoals, never pure black */
    --background: #181b20;
    --surface: #1f2329;
    --surface-hover: #252a33;
    --surface-muted: #272d37;

    /* Borders: slightly brighter neutral greys (more visible, not blue) */
    --border: #3f4654;
    --border-strong: #4d5565;

    /* Typography: soft light, no pure white */
    --foreground: #e3e5ec;
    --muted-foreground: #a6abbc;
    --tertiary-foreground: #80869a;

    /* Primary action: desaturated blue, gentle contrast */
    --primary: #3f7ea4;
    --primary-foreground: #f5f6fb;
    --primary-hover: #457fa2;
    --focus-ring: rgba(63, 126, 164, 0.45);
    --ring-offset: #13161a;

    /* Brand neutral */
    --brand-neutral: #a78964;

    /* Sarajevo Arts Palette – softened for dark */
    --tile-orange: #d28a70;
    --dome-teal: #5a8a88;
    --river-indigo: #6b7c94;
    --tram-yellow: #ddb060;
    --velvet-purple: #8d7b8d;

    /* Navigation */
    --nav-icon: #6b7c94;
    --nav-icon-active: #5a8a88;

    /* Header bar */
    --header-bar-bg: rgba(63, 126, 164, 0.10);
    --header-bar-text: #e3e5ec;

    /* Overlay for dialogs/modals */
    --overlay: rgba(12, 14, 18, 0.60);
  }

  /* Brutalist Theme - Cursor Black Midnight dark mode */
  .brutalist {
    --background: #1c1c1c;
    --surface: #252526;
    --surface-hover: #2d2d30;
    --surface-muted: #2a2d2e;
    --border: #3e3e42;
    --border-strong: #464647;
    --foreground: #cccccc;
    --muted-foreground: #a0a0a0; /* Darker for better readability */
    --tertiary-foreground: #808080;
    --primary: #007acc;
    --primary-foreground: #ffffff;
    --primary-hover: #0086e0; /* Lightened for hover */
    --focus-ring: rgba(0, 122, 204, 0.4);
    --ring-offset: #1c1c1c;
    --overlay: rgba(0, 0, 0, 0.5); /* Darker overlay for brutalist */
    --success: #4ec9b0;
    --warning: #dcdcaa;
    --error: #f48771;
    --info: #4ec9b0;
    /* Subtle radius values - more square */
    --radius-xs: 2px;
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 10px;
  }

  * {
    border-color: var(--border);
  }

  /* In dark mode, make structural lines feel slightly bolder */
  @layer utilities {
    .dark * {
      border-width: 1.5px;
    }
  }

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body {
    font-family: var(--font-sans);
    @apply bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-200 ease-out;
    font-feature-settings: "rlig" 1, "calt" 1;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.6;
  }

  /* App-wide zoom scale - adjust to zoom in/out (smaller = more zoomed out) */
  #app-scale-wrapper {
    --zoom-scale: 0.85;
    position: fixed;
    top: 0;
    left: 0;
    width: calc(100vw / var(--zoom-scale));
    height: calc(100vh / var(--zoom-scale));
    transform: scale(var(--zoom-scale));
    transform-origin: top left;
    overflow: hidden;
  }

  /* Ensure all children of the scale wrapper fill height */
  #app-scale-wrapper > * {
    height: 100%;
  }


  /* Headings - Use Inter for consistency */
  h1 {
    font-family: var(--font-sans);
    @apply text-[26px] font-semibold text-[var(--foreground)] leading-tight tracking-tight;
  }

  h2 {
    font-family: var(--font-sans);
    @apply text-[22px] font-semibold text-[var(--foreground)] leading-tight tracking-tight;
  }

  h3 {
    font-family: var(--font-sans);
    @apply text-[18px] font-medium text-[var(--foreground)] leading-snug;
  }

  h4 {
    font-family: var(--font-sans);
    @apply text-[15px] font-semibold text-[var(--foreground)] leading-snug tracking-wide;
    letter-spacing: 0.02em;
  }

  p {
    @apply text-[15px] leading-relaxed text-[var(--muted-foreground)] font-medium;
  }

  label {
    @apply text-[12px] font-medium text-[var(--foreground)] tracking-wide;
    letter-spacing: 0.01em;
  }

  a {
    @apply text-[var(--primary)] underline-offset-4 hover:underline;
  }

  code {
    border-radius: var(--radius-sm);
    background-color: var(--surface-muted);
    padding: 0.15rem 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  /* Form elements - Flat, matte, structural */
  input,
  textarea,
  select {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background-color: var(--surface);
    font-size: 0.875rem;
    color: var(--foreground);
    transition: border-color 0.15s ease-out;
  }
  
  input::placeholder,
  textarea::placeholder,
  select::placeholder {
    color: var(--tertiary-foreground);
  }
  
  input:focus,
  textarea:focus,
  select:focus {
    border-color: var(--border-strong);
  }

  /* Event details modal: inputs and selects are underline-only, no box/shadow (override base form styles) */
  [data-event-details-modal="true"] input,
  [data-event-details-modal="true"] select {
    border-radius: 0 !important;
    border: none !important;
    border-bottom: 1px solid var(--border) !important;
    background-color: transparent !important;
    box-shadow: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
  }
  [data-event-details-modal="true"] select {
    background-image: none !important;
  }
  [data-event-details-modal="true"] input:focus,
  [data-event-details-modal="true"] select:focus {
    border-bottom-color: var(--border-strong) !important;
    box-shadow: none !important;
  }
  /* Assignee dropdown trigger: same underline-only look */
  [data-event-details-modal="true"] .assignee-trigger-btn {
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background-color: transparent;
    box-shadow: none;
  }
  [data-event-details-modal="true"] .assignee-trigger-btn:hover {
    background-color: transparent;
  }

  /* Brutalist theme styling is handled at component level, not via CSS overrides */
}

@layer utilities {
  .text-tertiary {
    color: var(--tertiary-foreground);
  }

  .bg-surface {
    background-color: var(--surface);
  }

  .bg-surface-hover {
    background-color: var(--surface-hover);
  }

  .border-strong {
    border-color: var(--border-strong);
  }

  /* ===== SARAJEVO SHADOWS ===== */
  /* Minimal shadows - prefer borders for structure */
  .shadow-card {
    box-shadow: none;
  }

  .shadow-popover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
  
  /* Modal shadow - very diffuse, low opacity (exception per theme spec) */
  .shadow-modal {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  }

  /* Deco-style divider - double line effect */
  .divider-deco {
    border-top: 2px solid var(--border);
    border-bottom: 1px solid var(--border);
    height: 4px;
    background: transparent;
  }
  
  /* Thick structural divider */
  .divider-structural {
    border-top: 3px solid var(--border);
  }
  
  /* ===== SELECTION STATE UTILITIES (Arts Palette) ===== */
  /* Use these for selected rows, cards, and interactive elements */
  .selected-coffee {
    background-color: rgba(156, 124, 88, 0.05);
    border-color: rgba(156, 124, 88, 0.2);
  }
  
  .selected-teal {
    background-color: rgba(74, 122, 120, 0.05);
    border-color: rgba(74, 122, 120, 0.2);
  }
  
  .selected-indigo {
    background-color: rgba(82, 99, 122, 0.05);
    border-color: rgba(82, 99, 122, 0.2);
  }
  
  /* Row hover to match sidebar: primary tint */
  .row-hover-teal:hover {
    background-color: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  .row-hover-coffee:hover {
    background-color: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  /* Block entrance animation - subtle, structural */
  @keyframes block-swoosh-in {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-block-swoosh-in {
    animation: block-swoosh-in 0.25s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }
  
  /* Focus states - structural, not glowy */
  .focus-structural:focus-visible {
    outline: 2px solid var(--border-strong);
    outline-offset: 2px;
  }

  /* Round legacy sharp utility classes for normalized radius system */
  .rounded-\[2px\] {
    border-radius: var(--radius-sm) !important;
  }

  .rounded-\[4px\] {
    border-radius: var(--radius-md) !important;
  }

  .rounded-sm {
    border-radius: var(--radius-sm) !important;
  }
  
  /* Subtle shadow utility for interactive cards */
  .shadow-subtle {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

}

/* Rich Text Editor Styles */
.ProseMirror {
  outline: none;
}

.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--tertiary-foreground);
  pointer-events: none;
  height: 0;
}

.ProseMirror h1 {
  font-size: 2em;
  font-weight: 700;
  line-height: calc(var(--line-spacing, 1.5) * 1.2);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror h2 {
  font-size: 1.5em;
  font-weight: 600;
  line-height: calc(var(--line-spacing, 1.5) * 1.3);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror h3 {
  font-size: 1.25em;
  font-weight: 600;
  line-height: calc(var(--line-spacing, 1.5) * 1.4);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror p {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
  line-height: var(--line-spacing, 1.5);
  font-size: 1em;
  font-weight: 500;
  color: var(--foreground);
}

.ProseMirror li {
  line-height: var(--line-spacing, 1.5);
}

.ProseMirror blockquote {
  line-height: var(--line-spacing, 1.5);
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5em;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

.ProseMirror ul li {
  list-style-type: disc;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.ProseMirror ol li {
  list-style-type: decimal;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.ProseMirror blockquote {
  border-left: 3px solid var(--border-strong);
  padding-left: 1em;
  margin-left: 0;
  margin-right: 0;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
  color: var(--muted-foreground);
  font-style: italic;
}

  .ProseMirror code {
    background-color: var(--surface-muted);
    padding: 0.2em 0.4em;
    border-radius: var(--radius-sm);
    font-size: 0.9em;
    font-family: monospace;
    color: var(--foreground);
  }

  .ProseMirror pre {
    background-color: var(--surface-muted);
    border-radius: var(--radius-md);
    padding: 1em;
    overflow-x: auto;
    margin-top: 0.75em;
    margin-bottom: 0.75em;
  }

.ProseMirror pre code {
  background-color: transparent;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.5;
}

.ProseMirror a {
  color: var(--primary);
  text-decoration: underline;
  cursor: pointer;
}

.ProseMirror a:hover {
  color: var(--primary-hover);
}

.ProseMirror hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}

/* Print Styles for PDF Export */
@media print {
  /* Hide UI elements */
  body > div:first-child > aside,
  nav,
  button,
  .no-print {
    display: none !important;
  }

  /* Force white background and black text */
  * {
    background: white !important;
    color: black !important;
    border-color: #ccc !important;
  }

  /* Show the document at full width */
  body {
    margin: 0;
    padding: 0;
  }

  /* Adjust page margins */
  @page {
    margin: 1in;
    size: letter;
  }

  /* Make sure editor content is visible */
  .ProseMirror {
    background: white !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* Improve text rendering */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    font-weight: bold !important;
  }

  p {
    orphans: 3;
    widows: 3;
  }

  /* Avoid breaking inside lists */
  ul, ol {
    page-break-inside: avoid;
  }

  /* Remove shadows and borders */
  .shadow-lg,
  .rounded-sm {
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}

/* ===== CUSTOM SCROLLBAR STYLES ===== */
/* Theme-aware scrollbars matching the design system */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
  background-clip: padding-box;
}

/* Always show scrollbar track */
.scrollbar-thin {
  scrollbar-gutter: stable;
}

.scrollbar-thin::-webkit-scrollbar {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
  background-clip: padding-box;
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--surface-muted);
}

```

## 3. Font setup
### 3.1 Imports
- **`src/app/layout.tsx`:** `Inter` from `next/font/google` with `variable: '--font-sans'` and `display: 'swap'`.
- **`globals.css`:** Documents that Inter sets `--font-sans`; serif/mono stacks are declared but **not** loaded with `next/font` in the root layout.
- **No `pages/_document.tsx`** (App Router only).

### 3.2 Usage
- `<html className={inter.variable}>` exposes the CSS variable for Inter.
- `body` uses `font-family: var(--font-sans)` in `globals.css`.

## 4. Component library (`src/components/ui/`)
**Files:**
- `components/ui/badge.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/checkbox.tsx`
- `components/ui/dialog.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/select.tsx`
- `components/ui/switch.tsx`
- `components/ui/table.tsx`
- `components/ui/tooltip.tsx`

### 4.1 `button.tsx`
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* 
 * BUTTON STYLING - Apollo-style operational structure
 * - Normalized radius using CSS variables
 * - True semantic primary color (#3080a6)
 * - Standardized heights for consistency
 * - Token-based colors only
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ring-offset)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: True semantic primary color
        default:
          "rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] active:opacity-90",
        // Secondary: Flat with structural border
        secondary:
          "rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]",
        // Ghost: Minimal, text-only appearance
        ghost:
          "rounded-[var(--radius-sm)] bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        // Outline: Structural border, transparent bg
        outline:
          "rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--primary)]",
        // Destructive: Semantic error color
        destructive:
          "rounded-[var(--radius-sm)] bg-[var(--error)] text-[var(--error-foreground)] hover:opacity-90 active:opacity-80",
        // Success: Semantic success color
        success:
          "rounded-[var(--radius-sm)] bg-[var(--success)] text-[var(--success-foreground)] hover:opacity-90 active:opacity-80",
        // Light: Surface with subtle border (no shadow)
        light:
          "rounded-[var(--radius-sm)] bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-strong)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

### 4.2 `card.tsx`
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * CARD STYLING - Apollo-style operational structure
 * - Normalized radius using CSS variables
 * - No shadows by default - depth from borders
 * - Structural borders for visual hierarchy
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2 px-6 py-5", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 
      ref={ref} 
      className={cn(
        "text-lg font-semibold leading-tight text-[var(--foreground)]",
        className
      )} 
      {...props} 
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-[var(--muted-foreground)] leading-relaxed", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 py-5", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-3 px-6 py-4",
        "border-t border-[var(--border)]", // Structural divider
        className
      )}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```

### 4.3 `badge.tsx`
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * SARAJEVO BADGE STYLING
 * - Small, pill-shaped indicators for tags/status
 * - Subtle backgrounds with borders
 * - Color-coded variants for different states
 * - Compact typography for inline use
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--ring-offset)]",
  {
    variants: {
      variant: {
        // Default: Subtle gray for neutral states
        default:
          "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        // Secondary: Slightly more prominent
        secondary:
          "border-[var(--border-strong)] bg-[var(--surface-hover)] text-[var(--muted-foreground)]",
        // Destructive: Muted Rose for errors/warnings
        destructive:
          "border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20",
        // Success: Oxidized Sage for positive states
        success:
          "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20",
        // Warning: Tram Yellow for attention
        warning:
          "border-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] hover:bg-[var(--tram-yellow)]/20",
        // Info: River Indigo for information
        info:
          "border-[var(--river-indigo)] bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/20",
        // Outline: Just border, no background
        outline:
          "border-[var(--border-strong)] bg-transparent text-[var(--foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

### 4.4 `input.tsx`
```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * INPUT STYLING - Apollo-style operational structure
 * - Normalized radius using CSS variables
 * - Consistent h-10 height
 * - Token-based focus rings
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2",
          "text-sm text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)]",
          "transition-colors duration-150",
          "hover:bg-[var(--surface-hover)]",
          "focus-visible:outline-none focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--surface-muted)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

```

> There is **no** `sidebar.tsx` under `components/ui`. The dashboard sidebar lives in `layout-client.tsx`.

## 5. Root layout
`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import P2AWarmup from '@/components/ai/p2a-warmup';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Saria',
  description: 'Project management made simple',
  icons: {
    icon: '/LOGO.png',
    apple: '/LOGO.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`bg-[var(--background)] text-[var(--foreground)]`}>
        <div id="app-scale-wrapper">
          {children}
          <P2AWarmup />
        </div>
      </body>
    </html>
  );
}

```

## 6. Dashboard route: page shell + home UI

`src/app/dashboard/layout.tsx` wraps authenticated dashboard routes with `ThemeProvider`, `ReactQueryProvider`, `WorkspaceProvider`, `AIProvider`, and `DashboardLayoutClient` (sidebar + header + main). See `layout-client.tsx` for chrome implementation.

### 6.1 `src/app/dashboard/page.tsx`
```tsx
import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardClient from "./dashboard-client";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  return <DashboardClient workspaceId={workspaceId} />;
}

```

### 6.2 `src/app/dashboard/dashboard-client.tsx`
```tsx
"use client";

import { useDashboardData } from "@/lib/hooks/use-dashboard-queries";
import DashboardOverview from "./dashboard-overview";
import DashboardLoading from "./loading";
import DashboardConfigModal from "./dashboard-config-modal";

export default function DashboardClient({
    workspaceId,
}: {
    workspaceId: string;
}) {
    const { data, isLoading, error } = useDashboardData(workspaceId);

    if (isLoading) {
        return <DashboardLoading />;
    }

    if (error || !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                        {error instanceof Error ? error.message : "An unknown error occurred"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <DashboardOverview {...data} />
            <DashboardConfigModal workspaceId={workspaceId} />
        </>
    );
}

```

### 6.3 `src/app/dashboard/dashboard-overview.tsx` (main home content)
```tsx
"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ArrowRight,
  Flag,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseDateSafe } from "@/lib/due-date";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import { useDashboardConfig } from "./use-dashboard-config";
import {
  isBuiltInWidget,
  isProjectCardWidget,
  isProjectGroupWidget,
  isTaskListWidget,
  isChartWidget,
} from "./dashboard-config-types";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import AIOverviewBlock from "./ai-overview-block";
import DashboardProjectCard from "./widgets/dashboard-project-card";
import DashboardProjectGroup from "./widgets/dashboard-project-group";
import DashboardTaskWidget from "./widgets/dashboard-task-widget";
import DashboardChartWidget from "./widgets/dashboard-chart-widget";
import type { DashboardInsight } from "@/app/actions/dashboard-insights";

interface Project {
  id: string;
  name: string;
  status: string;
  project_type: string;
  updated_at: string;
}

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

interface Task {
  id: string;
  text: string;
  projectName: string;
  tabName: string;
  projectId?: string | null;
  tabId?: string | null;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDate?: string;
  dueTime?: string;
  /** When set, navigate to this URL instead of project/tab?taskId= */
  sourceUrl?: string;
}

interface DashboardOverviewProps {
  projects: Project[];
  docs: Doc[];
  tasks: Task[];
  /** Items with due dates from everything (tasks, timeline, table rows, blocks) for Due today / Upcoming / Past due blocks */
  dueAwareItems?: Array<{
    id: string;
    text: string;
    projectName: string;
    tabName: string;
    projectId: string | null;
    tabId: string | null;
    priority: string | null;
    dueDate: string;
    sourceUrl: string;
    type: string;
  }>;
  workspaceId: string;
  clientFeedback: ClientFeedback[];
  teamUpdates: ClientFeedback[];
  aiInsights?: DashboardInsight | null;
  userId: string;
  userName?: string;
}

interface ClientFeedback {
  id: string;
  text: string;
  author: string;
  projectName: string;
  tabName: string;
  projectId?: string | null;
  tabId?: string | null;
  blockId: string;
  timestamp?: string;
}

export default function DashboardOverview(props: DashboardOverviewProps) {
  const {
    tasks,
    dueAwareItems = [],
    clientFeedback,
    teamUpdates,
    aiInsights,
    workspaceId,
    userId,
    userName,
  } = props;
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { config: dashboardConfig } = useDashboardConfig(workspaceId);

  const clientFeedbackItems = clientFeedback.slice(0, 4);
  const teamUpdatesItems = teamUpdates.slice(0, 6);

  const { pastDueTasks, dueTodayTasks, upcomingTasks } = useMemo((): {
    pastDueTasks: Task[];
    dueTodayTasks: Task[];
    upcomingTasks: Task[];
  } => {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pastDue: Task[] = [];
    const dueToday: Task[] = [];
    const upcoming: Task[] = [];

    const itemsToBucket = dueAwareItems.length > 0
      ? dueAwareItems.map((item) => ({
          id: item.id,
          text: item.text,
          projectName: item.projectName,
          tabName: item.tabName,
          projectId: item.projectId,
          tabId: item.tabId,
          priority: (item.priority as Task["priority"]) ?? undefined,
          dueDate: item.dueDate,
          dueTime: undefined,
          sourceUrl: item.sourceUrl,
        }))
      : tasks.map((t) => ({ ...t, sourceUrl: undefined }));

    for (const task of itemsToBucket) {
      const due = task.dueDate?.slice(0, 10);
      if (!due) {
        upcoming.push(task);
        continue;
      }
      if (due < todayStr) pastDue.push(task);
      else if (due === todayStr) dueToday.push(task);
      else upcoming.push(task);
    }
    return { pastDueTasks: pastDue, dueTodayTasks: dueToday, upcomingTasks: upcoming };
  }, [tasks, dueAwareItems]);
  const formatRelativeTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };


  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = parseDateSafe(dueDate);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    let dateLabel = "";
    if (taskDate.getTime() === today.getTime()) {
      dateLabel = "Today";
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (dueTime) {
      const time = new Date(`2000-01-01T${dueTime}`);
      const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${dateLabel} ${timeStr}`;
    }
    return dateLabel;
  };

  const getPriorityColor = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high": return "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium": return "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low": return "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
      default: return "";
    }
  };

  const getPriorityLabel = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 px-6 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
            {currentWorkspace?.name ?? "Workspace"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Get Up to Speed and Start Working
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => router.push("/dashboard/projects")}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--secondary)] hover:bg-[var(--secondary)]/90 rounded-[2px] transition-colors"
          >
            New project
          </button>
        </div>
      </div>

      {dashboardConfig.widgets.map((widget) => {
        if (isBuiltInWidget(widget)) {
          if (widget.type === "notifications") {
            return (
              <NotificationsCard
                key={widget.id}
                clientFeedbackItems={clientFeedbackItems}
                teamUpdatesItems={teamUpdatesItems}
                formatRelativeTime={formatRelativeTime}
                onNavigate={(projectId, tabId, projectName, tabName) => {
                  if (projectId && tabId && projectName && tabName) {
                    router.push(buildProjectTabPath(projectId, tabId, projectName, tabName));
                  }
                }}
              />
            );
          }
          if (widget.type === "ai_overview") {
            return (
              <AIOverviewBlock
                key={widget.id}
                insights={aiInsights ?? null}
                workspaceId={workspaceId}
                userId={userId}
                userName={userName}
              />
            );
          }
          if (widget.type === "today") {
            return (
              <Card key={widget.id} className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <div>
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      What matters now and coming up.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push("/dashboard/projects")}>
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3 px-4 pb-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Due today</p>
                    {dueTodayTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {dueTodayTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing due today.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Upcoming</p>
                    {upcomingTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {upcomingTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing upcoming.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Past due</p>
                    {pastDueTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {pastDueTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">No past due tasks.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        }
        if (isProjectCardWidget(widget)) {
          return <DashboardProjectCard key={widget.id} config={widget} workspaceId={workspaceId} />;
        }
        if (isProjectGroupWidget(widget)) {
          return <DashboardProjectGroup key={widget.id} config={widget} workspaceId={workspaceId} />;
        }
        if (isTaskListWidget(widget)) {
          return (
            <DashboardTaskWidget
              key={widget.id}
              config={widget}
              tasks={tasks}
              dueAwareItems={dueAwareItems}
              userId={userId}
            />
          );
        }
        if (isChartWidget(widget)) {
          return <DashboardChartWidget key={widget.id} config={widget} />;
        }
        return null;
      })}
    </div>
  );
}

function TaskRowButton({
  task,
  getPriorityColor,
  getPriorityLabel,
  formatDueDate,
  onNavigate,
}: {
  task: Task;
  getPriorityColor: (priority?: Task["priority"]) => string;
  getPriorityLabel: (priority?: Task["priority"]) => string;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  onNavigate: () => void;
}) {
  return (
    <button
      onClick={onNavigate}
      className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-left text-xs transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30 text-[var(--foreground)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[13px] line-clamp-1">{task.text}</p>
        <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
          {task.tabName}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <p className="line-clamp-1 text-[11px] text-[var(--muted-foreground)]">
          {task.projectName}
        </p>
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              "border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]"
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {formatDueDate(task.dueDate, task.dueTime)}
          </span>
        )}
      </div>
    </button>
  );
}

function NotificationsCard({
  clientFeedbackItems,
  teamUpdatesItems,
  formatRelativeTime,
  onNavigate,
}: {
  clientFeedbackItems: ClientFeedback[];
  teamUpdatesItems: ClientFeedback[];
  formatRelativeTime: (value?: string) => string;
  onNavigate: (
    projectId?: string | null,
    tabId?: string | null,
    projectName?: string,
    tabName?: string
  ) => void;
}) {
  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="h-4 w-4 text-[var(--foreground)]" />
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
          <span className="text-xs text-[var(--muted-foreground)]">
            Client and teammate updates in one place.
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 pb-4 pt-0 text-xs md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--foreground)]">
            Client Feedback
          </p>
          {clientFeedbackItems.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">No client feedback yet.</p>
          ) : (
            clientFeedbackItems.map((feedback) => (
              <UpdateRow
                key={feedback.id}
                title={`“${feedback.text}”`}
                subtitle={`${feedback.author} · ${feedback.projectName} · ${feedback.tabName} · ${formatRelativeTime(
                  feedback.timestamp
                )}`}
                icon={<MessageSquare className="h-3.5 w-3.5 text-[var(--foreground)]" />}
                onClick={() =>
                  onNavigate(feedback.projectId, feedback.tabId, feedback.projectName, feedback.tabName)
                }
              />
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--foreground)]">
            Team Updates
          </p>
          {teamUpdatesItems.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">No comments from teammates yet.</p>
          ) : (
            teamUpdatesItems.map((feedback) => (
              <UpdateRow
                key={feedback.id}
                title={`“${feedback.text}”`}
                subtitle={`${feedback.author} · ${feedback.projectName} · ${feedback.tabName} · ${formatRelativeTime(
                  feedback.timestamp
                )}`}
                icon={<MessageSquare className="h-3.5 w-3.5 text-[var(--foreground)]" />}
                onClick={() =>
                  onNavigate(feedback.projectId, feedback.tabId, feedback.projectName, feedback.tabName)
                }
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UpdateRowProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
  icon?: ReactNode;
  priority?: Task["priority"];
  dueDate?: string;
  dueTime?: string;
  getPriorityColor?: (priority?: Task["priority"]) => string;
  getPriorityLabel?: (priority?: Task["priority"]) => string;
  formatDueDate?: (dueDate?: string, dueTime?: string) => string | null;
}

function UpdateRow({ 
  title, 
  subtitle, 
  onClick, 
  icon, 
  priority, 
  dueDate, 
  dueTime,
  getPriorityColor,
  getPriorityLabel,
  formatDueDate,
}: UpdateRowProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
    >
      {icon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--foreground)]">
          {icon}
        </span>
      ) : (
        <span className="flex h-3 w-3 flex-shrink-0 rounded-full border border-[var(--border)]" />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)] line-clamp-1">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-[var(--muted-foreground)]">{subtitle}</p>
          {/* Priority Badge */}
          {priority && priority !== "none" && getPriorityColor && getPriorityLabel && (
            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${getPriorityColor(priority)}`}>
              <Flag className="h-2.5 w-2.5" />
              {getPriorityLabel(priority)}
            </span>
          )}
          {/* Due Date Badge */}
          {dueDate && formatDueDate && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              "border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]"
            )}>
              <Calendar className="h-2.5 w-2.5" />
              {formatDueDate(dueDate, dueTime)}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

```

## 7. Sidebar + nav link helpers
From `src/app/dashboard/layout-client.tsx` — `Sidebar` and `NavLink`:
```tsx
function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { data: currentUser } = useUser();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const { theme, setTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name?: string | null) => {
    if (!name) return "W";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserInitials = () => {
    if (!currentUser || !currentUser.name) return "U";
    return currentUser.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    await switchWorkspace(workspace);
    setUserDropdownOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside
      className={cn(
        // Sidebar slightly lighter than page background
        "flex h-full flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 ease-out flex-shrink-0 relative z-50 font-semibold",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center py-3",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--foreground)]">
            Saria
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed();
          }}
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--primary)] z-50 relative"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-3">
            <GlobalSearch />
          </div>
        )}

        {/* AI Command Button */}
        <AICommandButton collapsed={collapsed} />

        <nav className={cn("space-y-0.5 px-2", collapsed ? "pt-2" : "pt-2 pb-2")}
        >
          <NavLink
            href="/dashboard"
            icon={<Home className="h-4 w-4" />}
            active={pathname === "/dashboard"}
            collapsed={collapsed}
          >
            Home
          </NavLink>
          <NavLink
            href="/dashboard/projects"
            icon={<Folder className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/projects")}
            collapsed={collapsed}
          >
            Projects
          </NavLink>
          {billingSummary?.entitlements.allowEverythingPage && (
            <NavLink
              href="/dashboard/workspace/everything"
              icon={<Database className="h-4 w-4" />}
              active={pathname?.startsWith("/dashboard/workspace/everything")}
              collapsed={collapsed}
            >
              Everything
            </NavLink>
          )}
          <NavLink
            href="/dashboard/workflow"
            icon={<Square className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/workflow")}
            collapsed={collapsed}
          >
            Workflow
          </NavLink>
          <NavLink
            href="/dashboard/clients"
            icon={<Users className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/clients")}
            collapsed={collapsed}
          >
            Clients
          </NavLink>
          <NavLink
            href="/dashboard/internal"
            icon={<BookOpen className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/internal")}
            collapsed={collapsed}
          >
            Internal
          </NavLink>
          <NavLink
            href="/dashboard/docs"
            icon={<FileText className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/docs")}
            collapsed={collapsed}
          >
            Docs
          </NavLink>
          <NavLink
            href="/dashboard/calendar"
            icon={<CalendarIcon className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/calendar")}
            collapsed={collapsed}
          >
            Calendar
          </NavLink>
          <NavLink
            href="/dashboard/shopify/products"
            icon={<Package className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/shopify/products")}
            collapsed={collapsed}
          >
            Products
          </NavLink>
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/settings")}
            collapsed={collapsed}
          >
            Settings
          </NavLink>
        </nav>
      </div>

      {/* Theme toggle – Sarajevo light / dark */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <Palette className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex w-full items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-xs font-semibold transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{currentUser?.name || "User"}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{currentUser?.email}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform duration-150",
                userDropdownOpen && "rotate-180"
              )}
            />
          </button>
        )}

        {userDropdownOpen && (
          <div className="mt-2 space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {/* Workspace switcher */}
            {workspaces.length > 0 && (
              <div className="space-y-1">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-xs font-semibold">
                      {isSwitching && currentWorkspace?.id === workspace.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        getInitials(workspace.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-[var(--foreground)]">{workspace.name}</p>
                      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        {workspace.role}
                      </p>
                    </div>
                    {currentWorkspace?.id === workspace.id && <Check className="h-3.5 w-3.5 text-[var(--dome-teal)]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* View All Workspaces */}
            <Link
              href="/profile"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              onClick={() => setUserDropdownOpen(false)}
            >
              <User className="h-3.5 w-3.5" />
              View All Workspaces
            </Link>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  collapsed,
  prefetch,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        // Nav links with primary accent for active/hover
        "group flex w-full items-center rounded-md text-base font-medium transition-colors duration-150",
        collapsed ? "justify-center px-2 py-1.5" : "gap-3 px-3 py-1.5",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)] border-l-2 border-[var(--primary)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
          active
            ? "bg-[var(--primary)]/15 text-[var(--primary)]"
            : "text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate font-medium">{children}</span>}
    </Link>
  );
}
```

## 8. Top navigation / header bar
Same file — `Header` (not a separate `Topbar.tsx`):
```tsx
function Header() {
  const pathname = usePathname();
  const { data: currentUser, isLoading } = useUser();
  const { headerHidden } = useDashboardHeader();
  const configModal = useDashboardConfigModal();
  const { currentWorkspace } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isDashboardHome = pathname === "/dashboard";
  const isProjectsPage = pathname === "/dashboard/projects";
  const isProjectOrClientDetail =
    (pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects") ||
    (pathname?.startsWith("/dashboard/clients/") && pathname !== "/dashboard/clients");
  const hideBar = headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail;

  if (hideBar) return null;

  const rawName = isLoading ? "…" : (currentUser?.name || "User");
  const displayName = rawName === "…" ? rawName : normalizeUserName(rawName);
  const displayDate = formatHeaderDate(new Date());

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--header-bar-bg)] px-2 py-2 md:px-3 lg:px-4">
      <p className="text-sm text-[var(--header-bar-text)]">
        <span className="font-medium">{displayName}</span>
        <span className="mx-2 opacity-70">|</span>
        <span className="opacity-90">{displayDate}</span>
      </p>
      <div className="flex items-center gap-2">
        <NotificationBell workspaceId={currentWorkspace?.id} />
        {isDashboardHome && configModal && billingSummary?.entitlements.allowDashboardConfiguration && (
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--border)] text-[var(--header-bar-text)] hover:bg-[var(--surface-hover)]"
            onClick={() => configModal.open()}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Configure dashboard
          </Button>
        )}
        {isProjectsPage ? (
          <Button
            size="sm"
            className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT))}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        ) : (
          <Link href="/dashboard/projects">
            <Button
              size="sm"
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
```

## 9. Other sidebar-like components
- `src/app/dashboard/projects/[projectId]/tabs/[tabId]/subtab-sidebar.tsx`
- `doc-sidebar.tsx`, `subtab-sidebar-wrapper.tsx` (project tab context, not app chrome).

## 10. Class pattern frequency (approximate)
Counted non-overlapping matches across `trak/src/**/*.{ts,tsx,js,jsx,css}` with a small Node-style scan (literal Tailwind class tokens).

| Approx. count | Token / pattern |
|---------------|-----------------|
| 2737 | `text-[var(--…)]` (any `--` inside var) |
| 2553 | `flex` |
| 1545 | `bg-[var(--…)]` |
| 1401 | `items-center` |
| 1283 | `border-[var(--…)]` |
| 928 | `text-sm` |
| 816 | `font-medium` |
| 640 | `hover:bg-*` (prefix) |
| 490 | `text-neutral-*` (all shades) |
| 486 | `transition-colors` |
| 380 | `font-semibold` |
| 330 | `bg-neutral-*` |
| 316 | `justify-between` |
| 306 | `rounded-md` |
| 257 | `rounded-lg` |
| 219 | `border-neutral-*` |
| 192 | `rounded-full` |
| 188 | `text-white` |
| 168 | `bg-white` |
| 113 | `text-gray-*` |

**Additional samples:** `bg-gray-50` (~23), `bg-gray-100` (~17), `border-gray-*` rare (~7 total). Many layout tokens use **CSS variables** (`var(--primary)`, etc.) rather than `gray-*`.

## 11. Dark mode
- **Toggle:** Dashboard sidebar footer — Theme button toggles `default` vs `dark` via `ThemeProvider` (`src/app/dashboard/theme-context.tsx`). Persists `localStorage` key `trak-theme`. Applies class `dark` or `default` on `document.documentElement`.
- **CSS:** `.dark { … }` in `globals.css` redefines semantic variables; `@custom-variant dark` supports `dark:` utilities when `.dark` is an ancestor.
- **`dark:` Tailwind classes:** Present in many files (e.g. Everything views, timeline, media blocks, calendar). Rough total substring count for `dark:` in `src/`: **~675** (includes all `dark:bg-…` style prefixes).
- **Legacy:** `brutalist` class still stripped when switching themes but is not selectable in current `Theme` type.

## 12. Status / priority pills & badges
| Location | Role |
|----------|------|
| `src/components/properties/property-badge.tsx` | **`StatusBadge`**, **`PriorityBadge`**, plus assignee/due/tag badges. Uses `STATUS_COLORS` / `PRIORITY_COLORS` from `types/properties.ts`. |
| `src/types/properties.ts` | Maps status/priority to Tailwind + `var(--*)` classes. |
| `src/app/dashboard/projects/status-badge.tsx` | Project-style statuses: Not Started / In Progress / Complete (arts palette). |
| `src/components/tasks/task-rollup-bar.tsx` | Labels like “In Progress”, “High”, segment colors. |
| `src/app/dashboard/dashboard-overview.tsx` | Inline priority chips via `getPriorityColor` / `getPriorityLabel`. |

### 12.1 `types/properties.ts` (color maps)
```ts
// Saria Universal Properties - Simplified Implementation
// Fixed properties (not database-driven property definitions)

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'block' | 'task' | 'subtask' | 'timeline_event' | 'table_row' | 'card';

// ============================================================================
// Property Values
// ============================================================================

export type Status = 'todo' | 'in_progress' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type FieldType = 'priority' | 'status' | 'assignee' | 'due_date' | 'tags';
export interface DueDateRange {
  start: string | null;
  end: string | null;
}

export const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: 'todo', label: 'To-Do', color: 'gray' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'done', label: 'Done', color: 'green' },
  { value: 'blocked', label: 'Blocked', color: 'red' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
];

export const STATUS_COLORS: Record<Status, string> = {
  todo: 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
  in_progress: 'bg-[var(--primary)]/10 text-[var(--primary)]',
  done: 'bg-[var(--success)]/10 text-[var(--success)]',
  blocked: 'bg-[var(--error)]/10 text-[var(--error)]',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-[var(--surface-muted)] text-[var(--tertiary-foreground)]',
  medium: 'bg-[var(--warning)]/10 text-[var(--warning)]',
  high: 'bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]',
  urgent: 'bg-[var(--error)]/10 text-[var(--error)]',
};

```

### 12.2 `property-badge.tsx` — `StatusBadge` & `PriorityBadge` (excerpt)
```tsx
/**
 * Status badge
 */
export function StatusBadge({
  status,
  label,
  inherited = false,
  onClick,
}: {
  status: Status;
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  if (!option) return null;
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "status"
      ? `${fieldLabel}: ${option.label}`
      : option.label;
  const StatusIcon =
    status === "done" ? CheckCircle2
    : status === "blocked" ? XCircle
    : status === "in_progress" ? Clock
    : Circle;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        STATUS_COLORS[status],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      <StatusIcon className="h-3 w-3 flex-shrink-0" />
      <span>{text}</span>
    </button>
  );
}

/**
 * Priority badge
 */
export function PriorityBadge({
  priority,
  label,
  inherited = false,
  onClick,
}: {
  priority: Priority;
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = PRIORITY_OPTIONS.find((o) => o.value === priority);
  if (!option) return null;
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "priority"
      ? `${fieldLabel}: ${option.label}`
      : option.label;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-fit max-w-full self-start items-start justify-start gap-0.5 rounded px-1 py-0.5 text-left text-xs font-medium leading-tight transition-colors",
        PRIORITY_COLORS[priority],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      <Flag className="mt-px h-3 w-3 flex-shrink-0" />
      <span className="min-w-0 break-words leading-tight">{text}</span>
    </button>
  );
```

### 12.3 `projects/status-badge.tsx` (full)
```tsx
"use client";

import { useThemeOptional } from "@/app/dashboard/theme-context";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { theme } = useThemeOptional();
  
  // SARAJEVO ARTS PALETTE for status badges (single light theme)
  const styles = {
    not_started: "bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/20",
    in_progress: "bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] border border-[var(--tram-yellow)]/20",
    complete: "bg-[var(--dome-teal)]/10 text-[var(--dome-teal)] border border-[var(--dome-teal)]/20",
  } as const;

  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[2px] px-2 py-0.5 text-[10px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

```
