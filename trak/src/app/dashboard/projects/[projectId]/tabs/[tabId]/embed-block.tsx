"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, Link2, Loader2, AlertCircle, Maximize2 } from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { parseEmbedUrl, isValidUrl, type EmbedType } from "@/lib/embed-parser";

interface EmbedBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: () => void;
}

type DisplayMode = "inline" | "linked";
type SaveStatus = "idle" | "saving" | "saved";

interface EmbedContent {
  url: string;
  embedType?: EmbedType;
  embedUrl?: string;
  displayMode?: DisplayMode;
  caption?: string;
}

export default function EmbedBlock({ block, onUpdate }: EmbedBlockProps) {
  const content = (block.content || {}) as EmbedContent;
  const [isEditing, setIsEditing] = useState(!content.url || content.url === "");
  const [url, setUrl] = useState(content.url || "");
  const [embedConfig, setEmbedConfig] = useState<ReturnType<typeof parseEmbedUrl>>(
    content.url ? parseEmbedUrl(content.url) : null
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>(content.displayMode || "inline");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [embedError, setEmbedError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [caption, setCaption] = useState(content.caption || "");
  const [savingCaption, setSavingCaption] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize embed config from block content
  useEffect(() => {
    if (content.url && !embedConfig) {
      const config = parseEmbedUrl(content.url);
      setEmbedConfig(config);
      setDisplayMode(content.displayMode || "inline");
    }
  }, [block.id]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Auto-detect embed when URL changes
  useEffect(() => {
    if (url && isValidUrl(url)) {
      const config = parseEmbedUrl(url);
      setEmbedConfig(config);
      setEmbedError(false);
    } else {
      setEmbedConfig(null);
    }
  }, [url]);

  // Handle paste detection
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text').trim();
    if (pastedText && isValidUrl(pastedText)) {
      setUrl(pastedText);
      // Auto-save on paste if it's a valid URL
      setTimeout(() => {
        handleSave(pastedText);
      }, 100);
    }
  };

  // Save content
  const handleSave = async (urlToSave?: string) => {
    const finalUrl = urlToSave || url;
    
    if (!finalUrl || !isValidUrl(finalUrl)) {
      return;
    }

    setSaveStatus("saving");
    try {
      const config = parseEmbedUrl(finalUrl);
      await updateBlock({
        blockId: block.id,
        content: {
          url: finalUrl,
          embedType: config?.type,
          embedUrl: config?.embedUrl,
          displayMode,
        },
      });
      setSaveStatus("saved");
      setEmbedConfig(config);
      setIsEditing(false);
      onUpdate?.();
      setTimeout(() => setSaveStatus("idle"), 1000);
    } catch (error) {
      console.error("Failed to save embed block:", error);
      setSaveStatus("idle");
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (isEditing && url && isValidUrl(url)) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        handleSave();
      }, 2000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [url, displayMode, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (url && isValidUrl(url)) {
        handleSave();
      }
    } else if (e.key === "Escape") {
      setUrl(content.url || "");
      setIsEditing(false);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  const handleBlur = () => {
    if (url && isValidUrl(url)) {
      handleSave();
    } else {
      setIsEditing(false);
    }
  };

  const handleDisplayModeChange = async (newMode: DisplayMode) => {
    setDisplayMode(newMode);
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        displayMode: newMode,
      },
    });
    onUpdate?.();
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setEmbedError(false);
  };

  // Get embed URL for use in effects
  const embedUrl = embedConfig?.embedUrl || content.embedUrl || content.url;

  // Use timeout as fallback since iframe onError doesn't always fire
  useEffect(() => {
    if (!isEditing && embedConfig && embedUrl && displayMode === "inline") {
      setIsLoading(true);
      setEmbedError(false);
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000); // 5 second timeout
      return () => clearTimeout(timeout);
    }
  }, [embedConfig, embedUrl, displayMode, isEditing]);

  // Ensure editing mode if no URL (must be before any conditional returns)
  useEffect(() => {
    if ((!content.url || content.url === "") && !isEditing) {
      setIsEditing(true);
    }
  }, [content.url, isEditing]);

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    
    // Clear existing timeout
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current);
    }
    
    // Debounce save
    setSavingCaption(true);
    captionTimeoutRef.current = setTimeout(async () => {
      await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          caption: value,
        },
      });
      setSavingCaption(false);
      onUpdate?.();
    }, 1000);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Editing mode
  if (isEditing) {
    return (
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Embed URL
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Paste a Figma, Google Docs, YouTube, Loom, Calendly, or any URL... (Google Sheets must be published to web)"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          {url && !isValidUrl(url) && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Please enter a valid URL
            </p>
          )}
          {embedConfig && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                Detected: {embedConfig.type === "generic" ? "Web Page" : embedConfig.type}
              </p>
              {embedConfig.type === "google-sheets" && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Tip: If embedding fails, paste the exact URL from File → Publish to web → Embed tab
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDisplayMode("inline")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                displayMode === "inline"
                  ? "bg-blue-500 text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              Inline
            </button>
            <button
              onClick={() => setDisplayMode("linked")}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                displayMode === "linked"
                  ? "bg-blue-500 text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              Linked
            </button>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
          </div>
        </div>
      </div>
    );
  }

  // Linked mode - show as a link card
  if (displayMode === "linked" || !embedConfig || embedError) {
    return (
      <div className="p-5">
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
        >
          <div className="w-10 h-10 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {embedConfig?.type === "generic" ? "Web Page" : embedConfig?.type || "Link"}
              </span>
              <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-500 font-mono truncate">
              {content.url}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            Edit
          </button>
        </a>
      </div>
    );
  }

  // Inline mode - show iframe
  return (
    <div className="p-5 space-y-3">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase">
            {embedConfig.type}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Edit URL
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDisplayModeChange("linked")}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Show as link
          </button>
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        </div>
      </div>

      {/* Embed container */}
      <div className="relative w-full border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              <span className="text-xs text-neutral-500">Loading embed...</span>
            </div>
          </div>
        )}

        {embedError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">
                Failed to load embed. Showing as link instead.
              </span>
              {embedConfig?.type === "google-sheets" && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 max-w-sm">
                  Make sure the sheet is published to web: File → Publish to web → Publish
                </p>
              )}
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open in new tab
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Responsive iframe container */}
        <div className="relative w-full" style={{ paddingBottom: embedConfig.type === "youtube" ? "56.25%" : "600px" }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="absolute top-0 left-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            onLoad={handleIframeLoad}
            style={{ minHeight: embedConfig.type === "calendly" ? "700px" : "400px" }}
          />
        </div>
      </div>
      
      {/* Caption Input */}
      <div>
        <input
          type="text"
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Add caption..."
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-600 focus:outline-none bg-transparent text-neutral-600 dark:text-neutral-400"
        />
        {savingCaption && (
          <span className="text-xs text-neutral-500 ml-2">Saving...</span>
        )}
      </div>
    </div>
  );
}
