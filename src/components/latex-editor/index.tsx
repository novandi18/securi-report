"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LatexPreview } from "./preview";
import Toolbar from "./toolbar";
import type { EditorState } from "@/lib/latex-helpers";
import { wrapInlineCommand } from "@/lib/latex-helpers";

/* ─── Props ─────────────────────────────────────────── */

interface LatexEditorProps {
  label: string;
  name: string;
  defaultValue?: string;
  /** Controlled value — when provided, component is controlled. */
  value?: string;
  /** Called on every change (controlled mode). */
  onChange?: (value: string) => void;
  height?: string;
  placeholder?: string;
  error?: string;
}

/* ─── Constants ─────────────────────────────────────── */

const MIN_HEIGHT = 150;
const MAX_HEIGHT = 800;

/* ─── Component ─────────────────────────────────────── */

export function LatexEditor({
  label,
  name,
  defaultValue = "",
  value: controlledValue,
  onChange,
  height = "300px",
  placeholder = "Enter LaTeX content...",
  error,
}: LatexEditorProps) {
  // Support both controlled and uncontrolled usage
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = isControlled ? controlledValue : internalValue;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"editor" | "preview" | "split">("split");

  // Resizing state
  const initialHeight = parseInt(height, 10);
  const [editorHeight, setEditorHeight] = useState(
    isNaN(initialHeight) ? 300 : Math.max(MIN_HEIGHT, initialHeight),
  );

  const updateValue = useCallback(
    (next: string) => {
      if (isControlled) {
        onChange?.(next);
      } else {
        setInternalValue(next);
      }
    },
    [isControlled, onChange],
  );

  /* ── Toolbar integration ──────────────────────────── */

  const getEditorState = useCallback((): EditorState => {
    const ta = textareaRef.current;
    if (!ta)
      return { text: currentValue, selectionStart: currentValue.length, selectionEnd: currentValue.length };
    return {
      text: ta.value,
      selectionStart: ta.selectionStart,
      selectionEnd: ta.selectionEnd,
    };
  }, [currentValue]);

  const applyEditorState = useCallback(
    (next: EditorState) => {
      updateValue(next.text);
      // Restore cursor/selection after React renders
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(next.selectionStart, next.selectionEnd);
        }
      });
    },
    [updateValue],
  );

  /* ── Keyboard shortcuts ───────────────────────────── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const ta = textareaRef.current;
      if (!ta) return;

      const state: EditorState = {
        text: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      };

      let result: EditorState | null = null;

      switch (e.key.toLowerCase()) {
        case "b":
          result = wrapInlineCommand(state, "textbf");
          break;
        case "i":
          result = wrapInlineCommand(state, "textit");
          break;
        case "u":
          result = wrapInlineCommand(state, "underline");
          break;
      }

      if (result) {
        e.preventDefault();
        applyEditorState(result);
      }
    },
    [applyEditorState],
  );

  /* ── Tab handling in textarea ─────────────────────── */

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Insert tab character instead of moving focus
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        const next = val.slice(0, start) + "  " + val.slice(end);
        updateValue(next);
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2);
        });
        return;
      }
      handleKeyDown(e);
    },
    [handleKeyDown, updateValue],
  );

  /* ── Custom resize handle (drag) ──────────────────── */

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = editorHeight;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        setEditorHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [editorHeight],
  );

  // Textarea height = container height minus toolbar (~42px)
  const textareaHeight = Math.max(editorHeight - 42, 100);

  return (
    <div>
      {/* Label + tab toggle row */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-body-sm font-medium text-dark dark:text-white">
          {label}
        </label>
        <div className="flex gap-1 rounded-md border border-stroke p-0.5 dark:border-dark-3">
          <button
            type="button"
            onClick={() => setTab("editor")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              tab === "editor"
                ? "bg-primary text-white"
                : "text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white",
            )}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setTab("split")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              tab === "split"
                ? "bg-primary text-white"
                : "text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white",
            )}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              tab === "preview"
                ? "bg-primary text-white"
                : "text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white",
            )}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={currentValue} readOnly />

      {tab === "editor" && (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-gray-300 dark:border-slate-700"
        >
          <Toolbar getState={getEditorState} applyState={applyEditorState} />
          <textarea
            ref={textareaRef}
            value={currentValue}
            onChange={(e) => updateValue(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(
              "w-full resize-none px-4 py-3 font-mono text-sm leading-relaxed",
              "bg-white text-dark placeholder:text-gray-400",
              "dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600",
              "outline-none border-t border-gray-300 dark:border-slate-700",
            )}
            style={{ height: `${textareaHeight}px` }}
          />
          <div
            onMouseDown={handleResizeMouseDown}
            className={cn(
              "flex h-2 cursor-row-resize items-center justify-center",
              "border-t border-gray-300 bg-gray-100 hover:bg-gray-200 transition-colors",
              "dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700",
            )}
          >
            <div className="h-0.5 w-8 rounded-full bg-gray-400 dark:bg-slate-600" />
          </div>
        </div>
      )}

      {tab === "split" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-gray-300 dark:border-slate-700">
            <Toolbar getState={getEditorState} applyState={applyEditorState} />
            <textarea
              ref={textareaRef}
              value={currentValue}
              onChange={(e) => updateValue(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={placeholder}
              spellCheck={false}
              className={cn(
                "w-full resize-none px-4 py-3 font-mono text-sm leading-relaxed",
                "bg-white text-dark placeholder:text-gray-400",
                "dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-600",
                "outline-none border-t border-gray-300 dark:border-slate-700",
              )}
              style={{ height: `${textareaHeight}px` }}
            />
            <div
              onMouseDown={handleResizeMouseDown}
              className={cn(
                "flex h-2 cursor-row-resize items-center justify-center",
                "border-t border-gray-300 bg-gray-100 hover:bg-gray-200 transition-colors",
                "dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700",
              )}
            >
              <div className="h-0.5 w-8 rounded-full bg-gray-400 dark:bg-slate-600" />
            </div>
          </div>
          <LatexPreview content={currentValue} height={`${editorHeight}px`} />
        </div>
      )}

      {tab === "preview" && (
        <LatexPreview content={currentValue} height={`${editorHeight}px`} />
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
