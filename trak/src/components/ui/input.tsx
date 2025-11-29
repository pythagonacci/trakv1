import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * SARAJEVO INPUT STYLING
 * - Flat/matte appearance, no shadows
 * - 2px border radius ("cut stone" look)
 * - Structural borders for clarity
 * - Focus states use border change, not glowy rings
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2",
          "text-sm text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-[var(--border-strong)] focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]",
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
