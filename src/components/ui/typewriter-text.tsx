"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─── Props ─────────────────────────────────────────── */

interface TypewriterTextProps {
  /** The full text to reveal. */
  text: string;
  /** Speed in ms per token (default: 20). */
  speed?: number;
  /** Reveal mode: character-by-character or word-by-word. */
  mode?: "char" | "word";
  /** Called when the entire text has been revealed. */
  onComplete?: () => void;
  /** Extra class names for the wrapper span. */
  className?: string;
  /** Skip the animation and show text instantly. */
  skipAnimation?: boolean;
  /** Show a blinking cursor while typing (default true). */
  showCursor?: boolean;
  /** Cursor color class (default: bg-primary). */
  cursorColor?: string;
}

/* ─── Component ─────────────────────────────────────── */

/**
 * Typewriter / word-by-word reveal effect for AI-generated text.
 * Respects `prefers-reduced-motion`.
 */
export function TypewriterText({
  text,
  speed = 20,
  mode = "word",
  onComplete,
  className,
  skipAnimation = false,
  showCursor = true,
  cursorColor = "bg-primary",
}: TypewriterTextProps) {
  const prefersReduced = useReducedMotion();
  const shouldSkip = skipAnimation || prefersReduced;

  const tokens = useMemo(
    () => (mode === "word" ? text.split(/(\s+)/) : text.split("")),
    [text, mode],
  );

  const [visibleCount, setVisibleCount] = useState(
    shouldSkip ? tokens.length : 0,
  );
  const completedRef = useRef(false);

  useEffect(() => {
    if (shouldSkip) {
      setVisibleCount(tokens.length);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    // Reset on text change
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
    <span className={cn("whitespace-pre-wrap", className)}>
      {tokens.slice(0, visibleCount).join("")}
      {showCursor && !isComplete && (
        <motion.span
          className={cn(
            "ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em]",
            cursorColor,
          )}
          animate={{ opacity: [1, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      )}
    </span>
  );
}
