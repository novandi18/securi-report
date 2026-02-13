"use client";

import { useEffect, useRef, useState } from "react";
import { useClientFilter } from "@/hooks/use-client-filter";
import { useClickOutside } from "@/hooks/use-click-outside";

export function HeaderClientSelector() {
  const { customerId, setCustomerId, customers } = useClientFilter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedName =
    customers.find((c) => c.id === customerId)?.name ?? "All Clients";

  if (customers.length === 0) return null;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm transition hover:border-primary dark:border-dark-3 dark:hover:border-primary"
      >
        <svg
          className="h-4 w-4 shrink-0 text-dark-4 dark:text-dark-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="max-w-[140px] truncate text-dark dark:text-white">
          {selectedName}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-dark-4 transition dark:text-dark-6 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200/60 bg-white p-2 shadow-lg dark:border-white/[0.06] dark:bg-[#1C2434]">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="mb-1.5 w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
          />
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setCustomerId("");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                customerId === ""
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.06]"
              }`}
            >
              All Clients
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCustomerId(c.id);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  customerId === c.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-dark hover:bg-gray-100 dark:text-white dark:hover:bg-white/[0.06]"
                }`}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-dark-4 dark:text-dark-6">
                No clients found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
