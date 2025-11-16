"use client";

import { useState, useEffect } from "react";
import { Search, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAllDocs } from "@/app/actions/doc";
import { useWorkspace } from "@/app/dashboard/workspace-context";

interface DocSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (docId: string, docTitle: string) => void;
}

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

export default function DocSelectorDialog({ isOpen, onClose, onSelectDoc }: DocSelectorDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      loadDocs();
    }
  }, [isOpen, currentWorkspace]);

  useEffect(() => {
    if (search) {
      setFilteredDocs(
        docs.filter((doc) =>
          doc.title.toLowerCase().includes(search.toLowerCase())
        )
      );
    } else {
      setFilteredDocs(docs);
    }
  }, [search, docs]);

  const loadDocs = async () => {
    if (!currentWorkspace) return;
    
    setIsLoading(true);
    const result = await getAllDocs(currentWorkspace.id, {
      is_archived: false,
      sort_by: "updated_at",
      sort_order: "desc",
    });

    if (!result.error && result.data) {
      setDocs(result.data);
      setFilteredDocs(result.data);
    }
    setIsLoading(false);
  };

  const handleSelectDoc = (doc: Doc) => {
    onSelectDoc(doc.id, doc.title);
    setSearch("");
    onClose();
  };

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link a Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              autoFocus
            />
          </div>

          {/* Doc List */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
                Loading documents...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-[var(--muted-foreground)] mx-auto mb-2" />
                <p className="text-sm text-[var(--muted-foreground)]">
                  {search ? "No documents found" : "No documents yet"}
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-left"
                >
                  <div className="p-2 rounded bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)] truncate">
                      {doc.title}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Updated {new Date(doc.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

