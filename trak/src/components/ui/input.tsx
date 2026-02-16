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
