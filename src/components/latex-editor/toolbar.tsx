"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ChevronDown,
  Sigma,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorState } from "@/lib/latex-helpers";
import {
  wrapInlineCommand,
  insertSection,
  insertList,
  insertCodeBlock,
  insertQuote,
  insertAlignment,
  insertLink,
  insertInlineMath,
  insertDisplayMath,
  insertTable,
  wrapSelection,
} from "@/lib/latex-helpers";


/* ───── Types ─────────────────────────────────────── */

export interface ToolbarProps {
  getState: () => EditorState;
  applyState: (next: EditorState) => void;
}

interface ToolbarBtnProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  className?: string;
}

/* ───── Small button component ────────────────────── */

function ToolbarBtn({ icon, tooltip, onClick, className }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded",
        "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
        "dark:text-slate-400 dark:hover:bg-slate-600/50 dark:hover:text-white",
        "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/* ───── Divider ───────────────────────────────────── */

function Divider() {
  return <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-slate-600/60" />;
}

/* ───── Format Dropdown ───────────────────────────── */

const SECTION_OPTIONS = [
  { label: "Normal Text", value: "normal" },
  { label: "Section", value: "section" },
  { label: "Subsection", value: "subsection" },
  { label: "Subsubsection", value: "subsubsection" },
] as const;

function FormatDropdown({
  getState,
  applyState,
}: {
  getState: () => EditorState;
  applyState: (s: EditorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);
      if (value === "normal") return;
      const s = getState();
      applyState(insertSection(s, value as "section" | "subsection" | "subsubsection"));
    },
    [getState, applyState],
  );

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-7 items-center gap-1 rounded px-2 text-xs",
          "text-gray-600 hover:bg-gray-200 hover:text-gray-800",
          "dark:text-slate-300 dark:hover:bg-slate-600/50 dark:hover:text-white",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
        )}
      >
        <span className="min-w-[4.5rem]">Format</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {SECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───── Math Dropdown ─────────────────────────────── */

function MathDropdown({
  getState,
  applyState,
}: {
  getState: () => EditorState;
  applyState: (s: EditorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn
        icon={<Sigma size={15} />}
        tooltip="Math"
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              applyState(insertInlineMath(getState()));
            }}
            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            Inline Math <span className="ml-auto text-gray-400 dark:text-slate-500">$…$</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              applyState(insertDisplayMath(getState()));
            }}
            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            Display Math <span className="ml-auto text-gray-400 dark:text-slate-500">$$…$$</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── Link Dialog (inline) ──────────────────────── */

function LinkButton({
  getState,
  applyState,
}: {
  getState: () => EditorState;
  applyState: (s: EditorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    const s = getState();
    const sel = s.text.slice(s.selectionStart, s.selectionEnd);
    if (sel) setLabel(sel);
    setOpen(true);
  };

  const handleInsert = () => {
    const u = url.trim() || "https://";
    const l = label.trim() || "link text";
    applyState(insertLink(getState(), u, l));
    setOpen(false);
    setUrl("");
    setLabel("");
  };

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn icon={<Link2 size={15} />} tooltip="Hyperlink" onClick={handleOpen} />
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <div className="mb-2">
            <label className="mb-1 block text-[10px] font-medium text-gray-500 dark:text-slate-400">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-[10px] font-medium text-gray-500 dark:text-slate-400">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Click here"
              className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={handleInsert}
            className="w-full rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Insert Link
          </button>
        </div>
      )}
    </div>
  );
}

/* ───── Table Button ──────────────────────────────── */

function TableButton({
  getState,
  applyState,
}: {
  getState: () => EditorState;
  applyState: (s: EditorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<[number, number]>([0, 0]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn
        icon={<Table size={15} />}
        tooltip="Table"
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <p className="mb-1.5 text-[10px] font-medium text-gray-500 dark:text-slate-400">
            {hover[0] > 0 ? `${hover[0]} × ${hover[1]}` : "Select size"}
          </p>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }, (_, r) =>
              Array.from({ length: 5 }, (_, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onMouseEnter={() => setHover([c + 1, r + 1])}
                  onClick={() => {
                    applyState(insertTable(getState(), c + 1, r + 1));
                    setOpen(false);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-sm border transition-colors",
                    c < hover[0] && r < hover[1]
                      ? "border-blue-400 bg-blue-500/30"
                      : "border-gray-300 bg-gray-100 dark:border-slate-600 dark:bg-slate-700",
                  )}
                />
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Alignment Dropdown ────────────────────────── */

function AlignDropdown({
  getState,
  applyState,
}: {
  getState: () => EditorState;
  applyState: (s: EditorState) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items: { icon: React.ReactNode; label: string; value: "flushleft" | "center" | "flushright" }[] = [
    { icon: <AlignLeft size={14} />, label: "Left", value: "flushleft" },
    { icon: <AlignCenter size={14} />, label: "Center", value: "center" },
    { icon: <AlignRight size={14} />, label: "Right", value: "flushright" },
  ];

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn
        icon={<AlignLeft size={15} />}
        tooltip="Alignment"
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {items.map((it) => (
            <button
              key={it.value}
              type="button"
              onClick={() => {
                setOpen(false);
                applyState(insertAlignment(getState(), it.value));
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Toolbar
   ═══════════════════════════════════════════════════ */

export default function Toolbar({ getState, applyState }: ToolbarProps) {
  const act = useCallback(
    (fn: (s: EditorState) => EditorState) => {
      applyState(fn(getState()));
    },
    [getState, applyState],
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-gray-300 bg-gray-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/90">
      {/* Format dropdown */}
      <FormatDropdown getState={getState} applyState={applyState} />

      <Divider />

      {/* Inline text styles */}
      <ToolbarBtn
        icon={<Bold size={15} />}
        tooltip="Bold (\\textbf)"
        onClick={() => act((s) => wrapInlineCommand(s, "textbf"))}
      />
      <ToolbarBtn
        icon={<Italic size={15} />}
        tooltip="Italic (\\textit)"
        onClick={() => act((s) => wrapInlineCommand(s, "textit"))}
      />
      <ToolbarBtn
        icon={<Underline size={15} />}
        tooltip="Underline (\\underline)"
        onClick={() => act((s) => wrapInlineCommand(s, "underline"))}
      />
      <ToolbarBtn
        icon={<Strikethrough size={15} />}
        tooltip="Strikethrough (\\sout)"
        onClick={() => act((s) => wrapInlineCommand(s, "sout"))}
      />

      <Divider />

      {/* Lists */}
      <ToolbarBtn
        icon={<List size={15} />}
        tooltip="Bullet List"
        onClick={() => act((s) => insertList(s, "itemize"))}
      />
      <ToolbarBtn
        icon={<ListOrdered size={15} />}
        tooltip="Numbered List"
        onClick={() => act((s) => insertList(s, "enumerate"))}
      />

      <Divider />

      {/* Code & Quote */}
      <ToolbarBtn
        icon={<Code size={15} />}
        tooltip="Code Block"
        onClick={() => act((s) => insertCodeBlock(s))}
      />
      <ToolbarBtn
        icon={<Quote size={15} />}
        tooltip="Block Quote"
        onClick={() => act((s) => insertQuote(s))}
      />

      {/* Inline code */}
      <ToolbarBtn
        icon={
          <span className="font-mono text-[11px] leading-none">{"{}"}</span>
        }
        tooltip="Inline Code (\\texttt)"
        onClick={() => act((s) => wrapInlineCommand(s, "texttt"))}
      />

      <Divider />

      {/* Math */}
      <MathDropdown getState={getState} applyState={applyState} />

      {/* Table */}
      <TableButton getState={getState} applyState={applyState} />

      {/* Alignment */}
      <AlignDropdown getState={getState} applyState={applyState} />

      {/* Link */}
      <LinkButton getState={getState} applyState={applyState} />
    </div>
  );
}
