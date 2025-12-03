"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, disabled, className, onCheckedChange, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        data-state={checked ? "checked" : "unchecked"}
        ref={ref}
        onClick={handleClick}
        className={cn(
          "inline-flex h-5 w-9 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ring-offset)]",
          checked && "bg-[var(--primary)] border-[var(--primary)]",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ease-out",
            checked && "translate-x-4 bg-white"
          )}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

