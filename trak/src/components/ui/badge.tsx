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