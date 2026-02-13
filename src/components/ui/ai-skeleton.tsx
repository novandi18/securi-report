"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import type { HTMLAttributes } from "react";

/* ─── AI Shimmer Skeleton ───────────────────────────── */

interface AISkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width class (e.g. "w-full", "w-3/4"). */
  width?: string;
  /** Height class. Defaults to "h-4". */
  height?: string;
  /** Number of skeleton lines to render. */
  lines?: number;
}

/**
 * Skeleton loader with a slow, premium shimmer effect.
 * Used as a placeholder while AI is generating content.
 */
export function AISkeleton({
  width = "w-full",
  height = "h-4",
  lines = 3,
  className,
  ...props
}: AISkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "relative overflow-hidden rounded-md bg-slate-200/60 dark:bg-slate-700/40",
            height,
            i === lines - 1 ? "w-2/3" : width,
          )}
        >
          <div className="ai-shimmer absolute inset-0" />
        </div>
      ))}
    </div>
  );
}

/* ─── Processing Shimmer Bar ────────────────────────── */

interface AIShimmerBarProps {
  className?: string;
}

/**
 * A thin shimmer progress bar shown at the top of a container
 * while AI is processing.
 */
export function AIShimmerBar({ className }: AIShimmerBarProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return (
      <div className={cn("h-0.5 w-full bg-primary/40", className)} />
    );
  }

  return (
    <div className={cn("relative h-0.5 w-full overflow-hidden rounded-full", className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ─── Error Shake Wrapper ───────────────────────────── */

interface AIErrorShakeProps {
  trigger: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps content and shakes it when `trigger` flips to true.
 * Used to indicate an AI error or interruption.
 */
export function AIErrorShake({
  trigger,
  children,
  className,
}: AIErrorShakeProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={
        trigger && !prefersReduced
          ? { x: [0, -6, 6, -4, 4, -2, 2, 0] }
          : {}
      }
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Wave Shimmer Overlay ──────────────────────────── */

interface AIWaveShimmerProps {
  /** Whether to show the shimmer wave. */
  active: boolean;
  className?: string;
}

/**
 * An overlay shimmer wave that passes through the parent container
 * (used on the AI form when generating).
 */
export function AIWaveShimmer({ active, className }: AIWaveShimmerProps) {
  const prefersReduced = useReducedMotion();

  if (!active || prefersReduced) return null;

  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl",
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ["-100%", "400%"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
