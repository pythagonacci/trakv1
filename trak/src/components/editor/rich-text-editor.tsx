"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { Extension } from "@tiptap/core";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: any;
  onChange: (content: any) => void;
  placeholder?: string;
  className?: string;
  pinnedToolbar?: boolean;
  floatingToolbarVisible?: boolean;
  onToolbarHoverStart?: () => void;
  onToolbarHoverEnd?: () => void;
  pinnedToolbarOffset?: number;
  autoFocus?: boolean;
  lineSpacing?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  pinnedToolbar = false,
  floatingToolbarVisible = false,
  onToolbarHoverStart,
  onToolbarHoverEnd,
  pinnedToolbarOffset,
  autoFocus = false,
  lineSpacing = "1.5",
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Allow Tab / Shift+Tab for indenting lists and inserting spaces in the editor
  const TabShortcut = Extension.create({
    name: "customTab",
    addKeyboardShortcuts() {
      return {
        Tab: () => {
          if (this.editor.commands.sinkListItem("listItem")) {
            return true;
          }
          return this.editor.commands.insertContent("    ");
        },
        "Shift-Tab": () => {
          return this.editor.commands.liftListItem("listItem");
        },
      };
    },
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TabShortcut,
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 underline cursor-pointer",
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[1000px] px-16 py-12",
        style: `--line-spacing: ${lineSpacing};`,
      },
    },
  });

  // Auto-focus the editor when it's ready
  useEffect(() => {
    if (autoFocus && editor && isMounted) {
      // Small delay to ensure the editor is fully rendered and DOM is ready
      const timer = setTimeout(() => {
        try {
          // Check if document is empty (only has empty paragraph)
          const isEmpty = editor.state.doc.content.childCount === 1 && 
                          editor.state.doc.content.firstChild?.type.name === 'paragraph' &&
                          editor.state.doc.content.firstChild?.content.size === 0;
          
          // Focus the editor first
          editor.commands.focus();
          
          // Place cursor at the start for empty docs, or at the end for docs with content
          if (isEmpty) {
            editor.commands.setTextSelection(1); // Position after the paragraph node
          } else {
            // For documents with content, place cursor at the end
            const docSize = editor.state.doc.content.size;
            editor.commands.setTextSelection(docSize);
          }
          
          // Ensure the DOM element receives focus and cursor is visible
          const editorElement = editor.view.dom as HTMLElement;
          if (editorElement) {
            editorElement.focus();
            
            // Force cursor to be visible by ensuring contentEditable has focus
            const editableElement = editorElement.querySelector('[contenteditable]') as HTMLElement;
            if (editableElement) {
              editableElement.focus();
            }
          }
        } catch (error) {
          console.error('Error focusing editor:', error);
          // Fallback: just focus
          try {
            editor.commands.focus();
            const editorElement = editor.view.dom as HTMLElement;
            editorElement?.focus();
          } catch (e) {
            // Silent fail
          }
        }
      }, 200); // Delay to ensure everything is rendered
      return () => clearTimeout(timer);
    }
  }, [editor, isMounted, autoFocus]);

  if (!isMounted || !editor) {
    return (
      <div className={cn("bg-[var(--background)] min-h-[1000px] flex items-center justify-center", className)}>
        <div className="text-[var(--muted-foreground)] text-sm">Loading editor...</div>
      </div>
    );
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors",
        active && "bg-[var(--surface-hover)] text-[var(--foreground)]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-5 bg-[var(--border)]" />
  );

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div 
      className={cn("bg-[var(--background)]", className)}
      style={{ "--line-spacing": lineSpacing } as React.CSSProperties}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 px-6 py-2 border-b border-[var(--border)] bg-[var(--surface)]",
          pinnedToolbar && "sticky z-20 shadow-sm",
          !pinnedToolbar && floatingToolbarVisible && "fixed left-1/2 -translate-x-1/2 z-30 w-[min(900px,calc(100%-24px))] rounded-xl shadow-lg border bg-[var(--surface)]/95 backdrop-blur",
          !pinnedToolbar && !floatingToolbarVisible && "relative z-0"
        )}
        onMouseEnter={onToolbarHoverStart}
        onMouseLeave={onToolbarHoverEnd}
        style={
          pinnedToolbar
            ? { top: pinnedToolbarOffset ?? 0 }
            : floatingToolbarVisible
            ? { top: (pinnedToolbarOffset ?? 0) + 8 }
            : undefined
        }
      >
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Cmd+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Quote */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive("link")}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Cmd+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <div style={{ "--line-spacing": lineSpacing } as React.CSSProperties}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
