# Trak Chart Styling Guidelines

These rules define how chart blocks must look to match native Trak blocks.

## Base Block Styling (Match BlockWrapper)
- Use the same container styling as native blocks:
  - Background: `var(--surface)` (no gradients)
  - Border: `1px solid var(--border)`
  - Radius: `rounded-lg` (`var(--radius-md)`)
  - Shadow: `0 1px 2px rgba(0,0,0,0.02)`
  - Padding: `px-3 py-2.5`
  - Transition: `transition-all duration-150 ease-out`
- Hover state (if used): `border-color: color-mix(in srgb, var(--foreground) 20%, transparent)`

## Typography
- Default font is Trak’s sans stack (already set globally). Do not override.
- Title text:
  - Size: `text-sm` or `text-base`
  - Weight: `font-semibold`
  - Color: `var(--foreground)`
- Secondary labels / axis titles:
  - Size: `text-xs`
  - Color: `var(--muted-foreground)`

## Spacing & Layout
- Keep content compact and readable.
- Use `gap-3` or `space-y-2` between title, legend, and chart.
- Provide a minimum chart height of ~240–320px for readability.

## Colors (Use CSS Variables Only)
Use Trak’s theme variables so charts adapt to themes:
- Primary palette (cycle through in order):
  - `var(--dome-teal)`
  - `var(--tram-yellow)`
  - `var(--tile-orange)`
  - `var(--river-indigo)`
  - `var(--velvet-purple)`
- Text colors:
  - Labels and titles: `var(--foreground)`
  - Secondary labels: `var(--muted-foreground)`
- Gridlines / borders:
  - `var(--border)` at low opacity (`0.4`–`0.6`)

## Chart.js Options
- Always set `responsive: true` and `maintainAspectRatio: false`.
- Use subtle gridlines and ticks:
  - `grid.color` should be `var(--border)` with low opacity.
  - `ticks.color` should be `var(--muted-foreground)`.
- Legends should be unobtrusive:
  - Use `labels.color = var(--muted-foreground)`.
  - Place legends at the bottom when space is tight.

## Simulation Badge (If Applicable)
- Simulations must include a small badge inside the chart container:
  - Text: “Simulation”
  - Use `var(--warning)` or `var(--info)` for emphasis.
  - Keep it subtle and consistent with the rest of the UI.

## Do Not
- Do not hardcode hex colors or fonts.
- Do not use loud shadows, neon colors, or thick borders.
- Do not use chart themes that clash with Trak’s muted palette.
