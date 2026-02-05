"use client";

import { useState } from "react";
import type { TableView } from "@/types/table";

interface Props {
  tableTitle?: string;
  views: TableView[];
  activeViewId?: string;
  onCreateView: () => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onSetDefault: (viewId: string) => void;
  onSwitchView: (viewId: string) => void;
}

export function TableHeader({
  tableTitle,
  views,
  activeViewId,
  onCreateView,
  onRenameView,
  onDeleteView,
  onSetDefault,
  onSwitchView,
}: Props) {
  const [editingView, setEditingView] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between px-3 py-1 border-b border-white/10 bg-white/5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-white">{tableTitle ?? "Table"}</div>
        <div className="flex items-center gap-1">
          {views.map((view) => {
            const isActive = view.id === activeViewId;
            return (
              <div
                key={view.id}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer ${isActive ? "bg-white/20 text-white" : "text-slate-200 hover:bg-white/10"}`}
                onClick={() => onSwitchView(view.id)}
              >
                {editingView === view.id ? (
                  <input
                    className="bg-transparent outline-none text-white text-xs"
                    defaultValue={view.name}
                    onBlur={(e) => {
                      setEditingView(null);
                      if (e.target.value && e.target.value !== view.name) {
                        onRenameView(view.id, e.target.value);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span onDoubleClick={() => setEditingView(view.id)}>{view.name}</span>
                )}
                {view.is_default && <span className="text-[10px] text-emerald-200">★</span>}
                <button
                  className="text-[10px] text-slate-400 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault(view.id);
                  }}
                  title="Set default"
                >
                  ☆
                </button>
                <button
                  className="text-[10px] text-slate-500 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteView(view.id);
                  }}
                  title="Delete view"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            className="px-2 py-1 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20"
            onClick={onCreateView}
          >
            + New view
          </button>
        </div>
      </div>
    </div>
  );
}
