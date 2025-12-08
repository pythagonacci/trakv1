"use client";

import { useEffect, useRef, useState } from "react";

interface LazyBlockWrapperProps {
  children: React.ReactNode;
  blockId: string;
  rootMargin?: string; // How far before viewport to start loading
}

/**
 * Wrapper that only renders block content when it's about to enter viewport
 * Uses Intersection Observer for efficient lazy loading
 */
export default function LazyBlockWrapper({ 
  children, 
  blockId,
  rootMargin = "400px" // Start loading 400px before block enters viewport
}: LazyBlockWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Once rendered, keep it rendered (don't unmount when scrolling away)
    if (hasRendered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasRendered) {
            setIsVisible(true);
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
      {isVisible || hasRendered ? (
        children
      ) : (
        // Placeholder while block is off-screen
        <div className="h-24 bg-transparent" />
      )}
    </div>
  );
}
