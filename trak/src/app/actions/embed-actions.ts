"use server";

import { parseEmbedUrl, getEmbedThumbnailUrl } from "@/lib/embed-parser";

export interface EmbedMetadata {
  title: string | null;
  thumbnailUrl: string | null;
}

/**
 * Fetches title and thumbnail for an embed URL using oEmbed where available,
 * and derived thumbnail URLs for YouTube. Runs on server to avoid CORS.
 */
export async function fetchEmbedMetadata(url: string): Promise<EmbedMetadata> {
  const config = parseEmbedUrl(url);
  if (!config) {
    return { title: null, thumbnailUrl: null };
  }

  // YouTube: oEmbed gives title + thumbnail
  if (config.type === "youtube") {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(config.originalUrl)}&format=json`;
      const res = await fetch(oembedUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; thumbnail_url?: string };
        return {
          title: data.title ?? null,
          thumbnailUrl: data.thumbnail_url ?? getEmbedThumbnailUrl(config),
        };
      }
    } catch {
      // ignore
    }
    return {
      title: null,
      thumbnailUrl: getEmbedThumbnailUrl(config),
    };
  }

  // Loom: oEmbed gives title + thumbnail
  if (config.type === "loom") {
    try {
      const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(config.originalUrl)}`;
      const res = await fetch(oembedUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = (await res.json()) as { title?: string; thumbnail_url?: string };
        return {
          title: data.title ?? null,
          thumbnailUrl: data.thumbnail_url ?? null,
        };
      }
    } catch {
      // ignore
    }
    return { title: null, thumbnailUrl: null };
  }

  // Figma / Google / Calendly / generic: use parser title if any, thumbnail from helper only for types that support it
  const thumbnailUrl = getEmbedThumbnailUrl(config);
  return {
    title: config.title ?? null,
    thumbnailUrl,
  };
}
