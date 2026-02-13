"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Wand2, FileText, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorState } from "@/lib/latex-helpers";

/* ─── Types ─────────────────────────────────────────── */

export interface AISparkleButtonProps {
  getState: () => EditorState;
  applyState: (next: EditorState) => void;
}

type AIAction = "refine" | "expand" | "summarize" | "proofread";

interface AIOption {
  id: AIAction;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const AI_OPTIONS: AIOption[] = [
  {
    id: "refine",
    label: "Refine Writing",
    description: "Improve clarity & grammar",
    icon: <Wand2 size={14} />,
  },
  {
    id: "expand",
    label: "Expand Content",
    description: "Add more detail & depth",
    icon: <FileText size={14} />,
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Condense selected text",
    icon: <CheckCheck size={14} />,
  },
  {
    id: "proofread",
    label: "Proofread LaTeX",
    description: "Fix syntax & formatting",
    icon: <Sparkles size={14} />,
  },
];

/* ─── Popover animations ────────────────────────────── */

const popoverVariants = {
  hidden: { opacity: 0, scale: 0.9, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

/* ─── Component ─────────────────────────────────────── */

export function AISparkleButton({ getState, applyState }: AISparkleButtonProps) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAction = async (action: AIAction) => {
    setOpen(false);
    setProcessing(true);

    const state = getState();
    const selectedText = state.text.slice(state.selectionStart, state.selectionEnd);

    // Simulate AI processing (replace with real API call)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Placeholder: in a real implementation, send `selectedText` + `action`
    // to an AI endpoint, then apply the result.
    const placeholder = selectedText
      ? `% AI ${action}: ${selectedText}`
      : `% AI ${action}: No text selected. Select text and try again.`;

    applyState({
      text:
        state.text.slice(0, state.selectionStart) +
        placeholder +
        state.text.slice(state.selectionEnd),
      selectionStart: state.selectionStart,
      selectionEnd: state.selectionStart + placeholder.length,
    });

    setProcessing(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* ── Sparkle Button ── */}
      <motion.button
        type="button"
        title="AI Assistant"
        onClick={() => !processing && setOpen(!open)}
        disabled={processing}
        className={cn(
          "relative flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium",
          "border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500",
          processing
            ? "cursor-wait border-purple-300 bg-purple-50 text-purple-400 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
            : "border-purple-200 bg-purple-50 text-purple-600 hover:border-purple-400 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:border-purple-600 dark:hover:bg-purple-900/40",
        )}
        /* Subtle pulsing glow on hover */
        whileHover={
          !prefersReduced && !processing
            ? { scale: [1, 1.05, 1], transition: { duration: 1.2, repeat: Infinity } }
            : undefined
        }
        whileTap={!prefersReduced ? { scale: 0.95 } : undefined}
      >
        {processing ? (
          <motion.span
            animate={!prefersReduced ? { rotate: 360 } : undefined}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={13} />
          </motion.span>
        ) : (
          <Sparkles size={13} />
        )}
        <span>AI Assist</span>
      </motion.button>

      {/* ── Popover Menu ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute right-0 top-full z-[99999] mt-2 w-56 origin-top-right",
              "rounded-xl border border-white/20 p-1.5 shadow-xl",
              /* Glassmorphism */
              "bg-white/80 backdrop-blur-md dark:bg-slate-800/80 dark:border-slate-600/40",
            )}
          >
            <div className="mb-1.5 px-2 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                AI Assistant
              </p>
            </div>

            {AI_OPTIONS.map((opt) => (
              <motion.button
                key={opt.id}
                type="button"
                onClick={() => handleAction(opt.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left",
                  "text-sm text-slate-700 dark:text-slate-200",
                  "hover:bg-purple-50 dark:hover:bg-purple-900/20",
                  "transition-colors",
                )}
                whileHover={!prefersReduced ? { x: 2 } : undefined}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                  {opt.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{opt.label}</p>
                  <p className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                    {opt.description}
                  </p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
