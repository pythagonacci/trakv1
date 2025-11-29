"use client";

import { type Block } from "@/app/actions/block";

interface DividerBlockProps {
  block: Block;
}

export default function DividerBlock({ block }: DividerBlockProps) {
  return (
    <div className="h-px bg-neutral-200 dark:bg-neutral-800" />
  );
}

