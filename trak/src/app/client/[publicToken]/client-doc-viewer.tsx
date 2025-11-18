"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import { getDocForClientPage } from "@/app/actions/client-page";

interface ClientDocViewerProps {
  docId: string;
  docTitle: string;
  publicToken: string;
}

export default function ClientDocViewer({ docId, docTitle, publicToken }: ClientDocViewerProps) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchDoc() {
      setLoading(true);
      setError(null);
      
      const result = await getDocForClientPage(docId, publicToken);
      
      if (result.error || !result.data) {
        setError(result.error || "Failed to load document");
      } else {
        setDoc(result.data);
      }
      
      setLoading(false);
    }

    if (isExpanded) {
      fetchDoc();
    }
  }, [docId, publicToken, isExpanded]);

  // Convert TipTap JSON content to readable text/HTML
  const renderDocContent = (content: any) => {
    if (!content || !content.content) return null;

    const renderNode = (node: any): string => {
      if (node.type === "text") {
        let text = node.text;
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === "bold") text = `<strong>${text}</strong>`;
            if (mark.type === "italic") text = `<em>${text}</em>`;
            if (mark.type === "code") text = `<code class="px-1 py-0.5 bg-gray-100 rounded text-sm">${text}</code>`;
          });
        }
        return text;
      }
      
      if (node.type === "paragraph") {
        const inner = node.content ? node.content.map(renderNode).join("") : "";
        return `<p class="mb-3">${inner}</p>`;
      }
      
      if (node.type === "heading") {
        const level = node.attrs?.level || 1;
        const inner = node.content ? node.content.map(renderNode).join("") : "";
        const className = level === 1 ? "text-2xl font-bold mb-4" 
                        : level === 2 ? "text-xl font-bold mb-3"
                        : level === 3 ? "text-lg font-bold mb-2"
                        : "text-base font-bold mb-2";
        return `<h${level} class="${className}">${inner}</h${level}>`;
      }
      
      if (node.type === "bulletList") {
        const inner = node.content ? node.content.map(renderNode).join("") : "";
        return `<ul class="list-disc pl-6 mb-3 space-y-1">${inner}</ul>`;
      }
      
      if (node.type === "orderedList") {
        const inner = node.content ? node.content.map(renderNode).join("") : "";
        return `<ol class="list-decimal pl-6 mb-3 space-y-1">${inner}</ol>`;
      }
      
      if (node.type === "listItem") {
        const inner = node.content ? node.content.map(renderNode).join("") : "";
        return `<li>${inner}</li>`;
      }
      
      if (node.content) {
        return node.content.map(renderNode).join("");
      }
      
      return "";
    };

    const html = content.content.map(renderNode).join("");
    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full border border-[var(--border)] rounded-lg p-4 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] text-left"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-[var(--foreground)] truncate">
              {docTitle}
            </h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Click to view document
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--surface-muted)] border-b border-[var(--border)] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h4 className="text-sm font-medium text-[var(--foreground)]">{docTitle}</h4>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Collapse
        </button>
      </div>

      {/* Content */}
      <div className="p-4 bg-[var(--surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        ) : doc ? (
          <div className="space-y-2">
            {doc.content ? (
              renderDocContent(doc.content)
            ) : (
              <p className="text-sm text-[var(--muted-foreground)] italic">
                This document is empty.
              </p>
            )}
            
            <div className="pt-4 mt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)]">
                Last updated: {new Date(doc.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

