"use client";

import { useId, useState, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const FRAMEWORK_SUGGESTIONS = [
  "OWASP Top 10",
  "OWASP ASVS",
  "OWASP WSTG",
  "OWASP MSTG",
  "CVE",
  "CWE",
  "NIST SP 800-53",
  "NIST CSF",
  "NIST SP 800-115",
  "PTES",
  "OSSTMM",
  "ISO 27001",
  "PCI DSS",
  "SANS Top 25",
  "MITRE ATT&CK",
];

interface ReferencesInputProps {
  name: string;
  defaultValue?: string;
  error?: string;
}

export function ReferencesInput({
  name,
  defaultValue,
  error,
}: ReferencesInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse comma-separated stored value into tags array
  const [tags, setTags] = useState<string[]>(() => {
    if (!defaultValue) return [];
    return defaultValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  });
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Serialize for form submission
  const serialized = tags.join(", ");

  const filteredSuggestions = FRAMEWORK_SUGGESTIONS.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(s),
  );

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInputValue("");
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-body-sm font-medium text-dark dark:text-white"
      >
        References / Framework
      </label>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={serialized} />

      {/* Tags + input container */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border border-stroke bg-transparent px-4 py-2.5 transition focus-within:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus-within:border-primary",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 text-primary/60 transition-colors hover:text-primary"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Type or select references..." : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-dark outline-none placeholder:text-dark-5 dark:text-white dark:placeholder:text-dark-6"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-stroke bg-white p-1 shadow-lg dark:border-dark-3 dark:bg-dark-2">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="w-full rounded px-3 py-2 text-left text-sm text-dark transition-colors hover:bg-gray-2 dark:text-white dark:hover:bg-dark-3"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <p className="text-xs text-dark-5 dark:text-dark-6">
        Press Enter or comma to add a tag. You can also type custom references
        like CVE-2024-1234.
      </p>
    </div>
  );
}
