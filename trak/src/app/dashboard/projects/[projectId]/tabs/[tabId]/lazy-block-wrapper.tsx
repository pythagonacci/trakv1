"use client";

import { useEffect, useRef, useState } from "react";
import { type BlockType } from "@/app/actions/block";

// Estimated heights per block type to reserve space before rendering.
// Prevents layout shift (CLS) when lazy-loaded blocks enter the viewport.
const BLOCK_HEIGHT_ESTIMATES: Partial<Record<BlockType, number>> = {
  text: 80,
  task: 320,
  cards: 360,
  table: 240,
  timeline: 300,
  image: 280,
  gallery: 480,
  video: 280,
  file: 120,
  embed: 360,
  section: 400,
  chart: 320,
  pdf: 400,
  link: 100,
  divider: 24,
  doc_reference: 80,
  shopify_product: 200,
};

interface LazyBlockWrapperProps {
  children: React.ReactNode;
  blockId: string;
  blockType: BlockType;
  estimatedHeight?: number; // Override the default estimate for this block
  rootMargin?: string; // How far before viewport to start loading
}

/**
 * Wrapper that only renders block content when it's about to enter viewport
 * Uses Intersection Observer for efficient lazy loading
 */
export default function LazyBlockWrapper({
  children,
  blockId,
  blockType,
  estimatedHeight,
  rootMargin = "400px" // Start loading 400px before block enters viewport
}: LazyBlockWrapperProps) {
  const [hasRendered, setHasRendered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Once rendered, keep it rendered (don't unmount when scrolling away)
    if (hasRendered) return;

    // Check if already in viewport synchronously on mount
    const rect = element.getBoundingClientRect();
    const expandedViewport = (window.innerHeight || document.documentElement.clientHeight) + parseInt(rootMargin);
    if (rect.top < expandedViewport && rect.bottom > -parseInt(rootMargin)) {
      setHasRendered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasRendered) {
            setHasRendered(true);
            // Stop observing once rendered
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin, // Load before entering viewport
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [hasRendered, rootMargin]);

  return (
    <div ref={elementRef} data-block-id={blockId}>
      {hasRendered ? (
        children
      ) : (
        // Placeholder while block is off-screen — sized to estimated block height to prevent CLS
        <div
          style={{ height: estimatedHeight ?? BLOCK_HEIGHT_ESTIMATES[blockType] ?? 96 }}
          className="bg-transparent"
        />
      )}
    </div>
  );
}
