"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ─── Props ─────────────────────────────────────────── */

interface MagicButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: "button" | "submit";
}

/* ─── Component ─────────────────────────────────────── */

/**
 * An animated gradient button (Deep Purple → Electric Blue).
 * Moving gradient background with hover/tap micro-interactions.
 */
export function MagicButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className,
  type = "button",
}: MagicButtonProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "relative overflow-hidden rounded-lg px-6 py-2.5 text-sm font-medium text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-dark-2",
        "ai-gradient-btn",
        className,
      )}
      whileHover={
        prefersReduced || disabled
          ? undefined
          : { scale: 1.02, transition: { duration: 0.2 } }
      }
      whileTap={
        prefersReduced || disabled
          ? undefined
          : { scale: 0.98, transition: { duration: 0.1 } }
      }
      animate={
        loading && !prefersReduced
          ? {
              scale: [1, 0.98, 1],
              transition: { duration: 0.8, repeat: Infinity },
            }
          : undefined
      }
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
