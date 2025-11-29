"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, CheckSquare, Folder, File, Layers, X, Loader2 } from "lucide-react";
import { searchWorkspaceContent, type SearchResult, type SearchResultType } from "@/app/actions/search";
import { cn } from "@/lib/utils";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      const result = await searchWorkspaceContent(query.trim(), 10); // Reduced limit for faster results
      if (result.data) {
        setResults(result.data);
        setIsOpen(result.data.length > 0);
      } else if (result.error) {
        console.error("Search error:", result.error);
        setResults([]);
        setIsOpen(false);
      }
      setIsSearching(false);
    }, 200); // Reduced debounce from 300ms to 200ms

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Focus search on Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-search-container]')) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  // SARAJEVO ARTS PALETTE for search result icons
  const getResultIcon = (type: SearchResultType) => {
    switch (type) {
      case "project":
        return <Folder className="h-4 w-4 text-[var(--dome-teal)]" />;
      case "task":
        return <CheckSquare className="h-4 w-4 text-[var(--river-indigo)]" />;
      case "doc":
        return <FileText className="h-4 w-4 text-[var(--tram-yellow)]" />;
      case "text_block":
        return <File className="h-4 w-4 text-[var(--velvet-purple)]" />;
      case "tab":
        return <Layers className="h-4 w-4 text-[var(--tile-orange)]" />;
      default:
        return <FileText className="h-4 w-4 text-[var(--tram-yellow)]" />;
    }
  };

  const getResultTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case "project":
        return "Project";
      case "task":
        return "Task";
      case "doc":
        return "Doc";
      case "text_block":
        return "Text";
      case "tab":
        return "Tab";
      default:
        return "Item";
    }
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<SearchResultType, SearchResult[]>);

  const flatResults = Object.values(groupedResults).flat();

  return (
    <div className="relative" data-search-container>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            if (e.target.value.length >= 2) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search projects, tasks, docs... (Cmd+K)"
          className="w-full max-w-md rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-10 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
              searchInputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 max-h-[600px] overflow-y-auto rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_16px_rgba(0,0,0,0.04)] z-50">
          {query.length < 2 ? (
            <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
              Type at least 2 characters to search...
            </div>
          ) : isSearching ? (
            <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : flatResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">
              No results found for "{query}"
            </div>
          ) : (
            <div ref={resultsRef} className="py-2">
              {/* Group results by type */}
              {Object.entries(groupedResults).map(([type, typeResults]) => (
                <div key={type} className="mb-2">
                  <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--surface-muted)]">
                    {getResultTypeLabel(type as SearchResultType)} ({typeResults.length})
                  </div>
                  {typeResults.map((result, idx) => {
                    const flatIndex = flatResults.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          "w-full px-4 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors flex items-start gap-3",
                          flatIndex === selectedIndex && "bg-[var(--surface-hover)]"
                        )}
                      >
                        <div className="mt-0.5 text-[var(--muted-foreground)] flex-shrink-0">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--foreground)] truncate">
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                              {result.subtitle}
                            </div>
                          )}
                          {result.highlightedPreview ? (
                            <div 
                              className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2 [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-700 [&_mark]:px-0.5 [&_mark]:rounded [&_mark]:font-medium"
                              dangerouslySetInnerHTML={{ __html: result.highlightedPreview }}
                            />
                          ) : result.preview && (
                            <div className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2">
                              {result.preview}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

