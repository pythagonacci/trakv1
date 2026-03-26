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
        // Secondary: Flat semantic secondary surface
        secondary:
          "rounded-[var(--radius-sm)] bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--surface-hover)]",
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
