"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type Theme = "default" | "brutalist";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");
  const [isMounted, setIsMounted] = useState(false);

  // Load theme from localStorage and apply on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setIsMounted(true);
    
    const savedTheme = localStorage.getItem("trak-theme") as Theme | null;
    const initialTheme = (savedTheme === "default" || savedTheme === "brutalist") ? savedTheme : "default";
    
    // Apply theme immediately
    const html = document.documentElement;
    html.classList.remove("default", "brutalist");
    html.classList.add(initialTheme);
    
    setThemeState(initialTheme);
  }, []);

  // Apply theme class to html element when theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !isMounted) return;
    
    const html = document.documentElement;
    
    // Remove all theme classes
    html.classList.remove("default", "brutalist");
    
    // Add current theme class
    html.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem("trak-theme", theme);
  }, [theme, isMounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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

