// URL parser for detecting embed types and extracting IDs
// Supports: Figma, Google Docs/Sheets/Slides, YouTube, Loom, Calendly

export type EmbedType = 
  | "figma" 
  | "google-docs" 
  | "google-sheets" 
  | "google-slides" 
  | "youtube" 
  | "loom" 
  | "calendly" 
  | "generic";

export interface EmbedConfig {
  type: EmbedType;
  embedUrl: string;
  originalUrl: string;
  title?: string;
}

/**
 * Detects embed type from URL and returns embed configuration
 */
export function parseEmbedUrl(url: string): EmbedConfig | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  // Clean and normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  try {
    const urlObj = new URL(normalizedUrl);

    // 1. Figma
    // Examples: https://www.figma.com/file/abc123/Project-Name
    //          https://www.figma.com/proto/abc123/Project-Name
    //          https://figma.com/file/abc123/Project-Name?node-id=1%3A2
    const figmaMatch = normalizedUrl.match(/figma\.com\/(file|proto|design)\/([a-zA-Z0-9]+)/);
    if (figmaMatch) {
      const fileId = figmaMatch[2];
      const embedUrl = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(normalizedUrl)}`;
      return {
        type: "figma",
        embedUrl,
        originalUrl: normalizedUrl,
        title: urlObj.pathname.split("/").pop() || "Figma Design",
      };
    }

    // 2. Google Docs/Sheets/Slides
    // Docs: https://docs.google.com/document/d/DOC_ID/edit
    // Sheets: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
    // Slides: https://docs.google.com/presentation/d/SLIDE_ID/edit
    const googleDocsMatch = normalizedUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (googleDocsMatch) {
      const docId = googleDocsMatch[1];
      // Use embed URL format for Google Docs
      const embedUrl = `https://docs.google.com/document/d/${docId}/preview?usp=sharing`;
      return {
        type: "google-docs",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    const googleSheetsMatch = normalizedUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (googleSheetsMatch) {
      const sheetId = googleSheetsMatch[1];
      // Use embed URL format for Google Sheets
      const embedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/preview?usp=sharing`;
      return {
        type: "google-sheets",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    const googleSlidesMatch = normalizedUrl.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (googleSlidesMatch) {
      const slideId = googleSlidesMatch[1];
      // Use embed URL format for Google Slides
      const embedUrl = `https://docs.google.com/presentation/d/${slideId}/preview?usp=sharing`;
      return {
        type: "google-slides",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    // 3. YouTube
    // Examples: https://www.youtube.com/watch?v=VIDEO_ID
    //          https://youtu.be/VIDEO_ID
    //          https://www.youtube.com/embed/VIDEO_ID
    const youtubeWatchMatch = normalizedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (youtubeWatchMatch) {
      const videoId = youtubeWatchMatch[1];
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      return {
        type: "youtube",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    // 4. Loom
    // Examples: https://www.loom.com/share/VIDEO_ID
    const loomMatch = normalizedUrl.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
      const videoId = loomMatch[1];
      const embedUrl = `https://www.loom.com/embed/${videoId}`;
      return {
        type: "loom",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    // 5. Calendly
    // Examples: https://calendly.com/username
    //          https://calendly.com/username/30min
    const calendlyMatch = normalizedUrl.match(/calendly\.com\/([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/);
    if (calendlyMatch) {
      const path = calendlyMatch[1];
      const embedUrl = `https://calendly.com/${path}`;
      return {
        type: "calendly",
        embedUrl,
        originalUrl: normalizedUrl,
      };
    }

    // 6. Generic fallback - try iframe
    // For other URLs, we'll try a generic iframe
    return {
      type: "generic",
      embedUrl: normalizedUrl,
      originalUrl: normalizedUrl,
    };
  } catch (error) {
    // Invalid URL
    return null;
  }
}

/**
 * Checks if a URL string is valid
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    new URL(normalizedUrl);
    return true;
  } catch {
    return false;
  }
}
