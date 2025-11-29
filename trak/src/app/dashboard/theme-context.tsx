"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// Theme types:
// - "default" / "sarajevo": Light mode inspired by Sarajevo - warm plaster, arts palette
// - "dark": Dark mode variant of Sarajevo theme
// - "brutalist": High contrast dark mode with no rounded corners
type Theme = "default" | "dark" | "brutalist";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean; // Helper to check if current theme is dark
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_THEMES: Theme[] = ["default", "dark", "brutalist"];
const DARK_THEMES: Theme[] = ["dark", "brutalist"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");
  const [isMounted, setIsMounted] = useState(false);

  // Load theme from localStorage and apply on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setIsMounted(true);
    
    const savedTheme = localStorage.getItem("trak-theme") as Theme | null;
    const initialTheme = VALID_THEMES.includes(savedTheme as Theme) ? (savedTheme as Theme) : "default";
    
    // Apply theme immediately
    const html = document.documentElement;
    VALID_THEMES.forEach(t => html.classList.remove(t));
    html.classList.add(initialTheme);
    
    setThemeState(initialTheme);
  }, []);

  // Apply theme class to html element when theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !isMounted) return;
    
    const html = document.documentElement;
    
    // Remove all theme classes
    VALID_THEMES.forEach(t => html.classList.remove(t));
    
    // Add current theme class
    html.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem("trak-theme", theme);
  }, [theme, isMounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const isDark = DARK_THEMES.includes(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

