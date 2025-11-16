"use client";

import { useState, useEffect } from "react";
import { Search, FileText, X, Copy, Table, CheckSquare, Link2, Calendar, Upload, Image, Video, Maximize2, Layout } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTemplateBlocks } from "@/app/actions/block-templates";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import { createBlock } from "@/app/actions/block";
import { useRouter } from "next/navigation";

interface BlockReferenceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  tabId: string;
  onBlockCreated?: () => void;
}

interface TemplateBlock {
  id: string;
  type: string;
  template_name: string;
  updated_at: string;
  tab: {
    name: string;
    project: {
      name: string;
    };
  };
}

const blockIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  timeline: <Calendar className="h-4 w-4" />,
  file: <Upload className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  embed: <Maximize2 className="h-4 w-4" />,
  section: <Layout className="h-4 w-4" />,
};

const blockTypeLabels: Record<string, string> = {
  text: "Text",
  task: "Tasks",
  link: "Link",
  table: "Table",
  timeline: "Timeline",
  file: "File",
  image: "Image",
  video: "Video",
  embed: "Embed",
  section: "Section",
};

export default function BlockReferenceSelector({ isOpen, onClose, tabId, onBlockCreated }: BlockReferenceSelectorProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [blocks, setBlocks] = useState<TemplateBlock[]>([]);
  const [filteredBlocks, setFilteredBlocks] = useState<TemplateBlock[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      loadBlocks();
    }
  }, [isOpen, currentWorkspace]);

  useEffect(() => {
    if (search) {
      setFilteredBlocks(
        blocks.filter((block) =>
          block.template_name.toLowerCase().includes(search.toLowerCase()) ||
          blockTypeLabels[block.type]?.toLowerCase().includes(search.toLowerCase())
        )
      );
    } else {
      setFilteredBlocks(blocks);
    }
  }, [search, blocks]);

  const loadBlocks = async () => {
    if (!currentWorkspace) return;
    
    setIsLoading(true);
    const result = await getTemplateBlocks(currentWorkspace.id);

    if (!result.error && result.data) {
      setBlocks(result.data as TemplateBlock[]);
      setFilteredBlocks(result.data as TemplateBlock[]);
    }
    setIsLoading(false);
  };

  const handleSelectBlock = async (block: TemplateBlock) => {
    setIsCreating(true);
    
    const result = await createBlock({
      tabId,
      type: block.type as any,
      content: {},
      originalBlockId: block.id, // This marks it as a reference
    });

    if (!result.error) {
      setSearch("");
      onClose();
      
      if (onBlockCreated) {
        onBlockCreated();
      } else {
        router.refresh();
      }
    }
    
    setIsCreating(false);
  };

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Reference a Reusable Block</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search reusable blocks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              autoFocus
            />
          </div>

          {/* Block List */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
                Loading reusable blocks...
              </div>
            ) : filteredBlocks.length === 0 ? (
              <div className="text-center py-12">
                <Copy className="h-10 w-10 text-[var(--muted-foreground)] mx-auto mb-3" />
                <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                  {search ? "No blocks found" : "No reusable blocks yet"}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Mark any block as reusable from its menu to use it across projects
                </p>
              </div>
            ) : (
              filteredBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleSelectBlock(block)}
                  disabled={isCreating}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-left disabled:opacity-50"
                >
                  <div className="p-2 rounded bg-[var(--surface-muted)] text-[var(--foreground)] mt-0.5">
                    {blockIcons[block.type] || <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[var(--foreground)] truncate">
                        {block.template_name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                        {blockTypeLabels[block.type] || block.type}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      From {block.tab.project.name} → {block.tab.name}
                    </div>
                  </div>
                  <Copy className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

