import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* 
 * ATELIER STONE BUTTON STYLING
 * - Solid backgrounds, flat (no heavy shadows)
 * - 2px border radius ("cut stone" look)
 * - Coffee Patina (#9C7C58) as primary action color
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ring-offset)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: Coffee Patina - bronze/brown for main actions
        default:
          "rounded-[2px] bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] active:bg-[#7A6348]",
        // Secondary: Flat with structural border
        secondary:
          "rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
        // Ghost: Minimal, text-only appearance
        ghost:
          "rounded-[2px] bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        // Outline: Structural border, transparent bg
        outline:
          "rounded-[2px] border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
        // Destructive: Muted Rose (#B85C5C) - terra-cotta
        destructive:
          "rounded-[2px] bg-[var(--error)] text-[var(--error-foreground)] hover:bg-[#A54F4F] active:bg-[#944545]",
        // Success: Oxidized Sage (#6B827D)
        success:
          "rounded-[2px] bg-[var(--success)] text-[var(--success-foreground)] hover:bg-[#5D746F] active:bg-[#4F6661]",
        // Light: Surface with subtle border (no shadow)
        light:
          "rounded-[2px] bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-strong)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5 text-base",
        icon: "h-9 w-9",
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
