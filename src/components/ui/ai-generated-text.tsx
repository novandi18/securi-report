"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ─── Types ─────────────────────────────────────────── */

interface AIGeneratedTextProps {
  /** The full text to reveal. */
  text: string;
  /** Speed in ms per character (default: 18). */
  speed?: number;
  /** Reveal mode: character-by-character or word-by-word. */
  mode?: "char" | "word";
  /** Called when the full text has been revealed. */
  onComplete?: () => void;
  /** Custom class for the wrapper. */
  className?: string;
  /** If true, show the full text immediately (skip animation). */
  skipAnimation?: boolean;
  /** Render the cursor blinking at the end while typing. */
  showCursor?: boolean;
}

/* ─── Component ─────────────────────────────────────── */

export function AIGeneratedText({
  text,
  speed = 18,
  mode = "char",
  onComplete,
  className,
  skipAnimation = false,
  showCursor = true,
}: AIGeneratedTextProps) {
  const prefersReduced = useReducedMotion();
  const shouldSkip = skipAnimation || prefersReduced;

  const tokens = useMemo(
    () => (mode === "word" ? text.split(/(\s+)/) : text.split("")),
    [text, mode],
  );

  const [visibleCount, setVisibleCount] = useState(shouldSkip ? tokens.length : 0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (shouldSkip) {
      setVisibleCount(tokens.length);
      return;
    }

    // Reset when text changes
    setVisibleCount(0);
    completedRef.current = false;

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= tokens.length) {
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, tokens.length, shouldSkip, onComplete]);

  const isComplete = visibleCount >= tokens.length;

  return (
    <span className={className}>
      {tokens.slice(0, visibleCount).join("")}
      {showCursor && !isComplete && (
        <motion.span
          className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-primary"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        />
      )}
    </span>
  );
}

/* ─── Block variant (multi-line/paragraph) ──────────── */

interface AIGeneratedBlockProps extends Omit<AIGeneratedTextProps, "showCursor"> {
  /** Render as a specific HTML element. */
  as?: "p" | "div" | "span";
}

export function AIGeneratedBlock({
  as: Tag = "div",
  ...props
}: AIGeneratedBlockProps) {
  return (
    <Tag>
      <AIGeneratedText showCursor {...props} />
    </Tag>
  );
}
