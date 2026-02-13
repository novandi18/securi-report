"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const CVSS_DEFAULT =
  "CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N";

interface CvssMetric {
  key: string;
  label: string;
  options: { value: string; label: string; color?: string }[];
}

const METRICS: CvssMetric[] = [
  {
    key: "AV",
    label: "Attack Vector",
    options: [
      { value: "N", label: "Network" },
      { value: "A", label: "Adjacent" },
      { value: "L", label: "Local" },
      { value: "P", label: "Physical" },
    ],
  },
  {
    key: "AC",
    label: "Attack Complexity",
    options: [
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "AT",
    label: "Attack Requirements",
    options: [
      { value: "N", label: "None" },
      { value: "P", label: "Present" },
    ],
  },
  {
    key: "PR",
    label: "Privileges Required",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "UI",
    label: "User Interaction",
    options: [
      { value: "N", label: "None" },
      { value: "P", label: "Passive" },
      { value: "A", label: "Active" },
    ],
  },
  {
    key: "VC",
    label: "Confidentiality (Vulnerable)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "VI",
    label: "Integrity (Vulnerable)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "VA",
    label: "Availability (Vulnerable)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SC",
    label: "Confidentiality (Subsequent)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SI",
    label: "Integrity (Subsequent)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SA",
    label: "Availability (Subsequent)",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
];

function parseVector(vector: string): Record<string, string> {
  const parts = vector.replace("CVSS:4.0/", "").split("/");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split(":");
    if (k && v) map[k] = v;
  }
  return map;
}

function buildVector(values: Record<string, string>): string {
  const parts = METRICS.map((m) => `${m.key}:${values[m.key] ?? "N"}`);
  return `CVSS:4.0/${parts.join("/")}`;
}

interface CvssInputProps {
  name: string;
  defaultValue?: string;
  error?: string;
}

export function CvssInput({ name, defaultValue, error }: CvssInputProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);

  const initial = defaultValue || CVSS_DEFAULT;
  const [values, setValues] = useState<Record<string, string>>(() =>
    parseVector(initial),
  );

  const vectorString = useMemo(() => buildVector(values), [values]);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-body-sm font-medium text-dark dark:text-white"
      >
        CVSS 4.0 Vector
      </label>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={vectorString} />

      {/* Vector string display */}
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-stroke bg-gray-1 px-4 py-2.5 font-mono text-xs text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
          {vectorString}
        </code>
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="shrink-0 rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
        >
          {expanded ? "Collapse" : "Edit Metrics"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Expandable metric selectors */}
      {expanded && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2 sm:grid-cols-2 lg:grid-cols-3">
          {METRICS.map((metric) => (
            <div key={metric.key}>
              <label className="mb-1 block text-xs font-medium text-dark-5 dark:text-dark-6">
                {metric.label} ({metric.key})
              </label>
              <div className="flex gap-1">
                {metric.options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange(metric.key, opt.value)}
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium transition-colors",
                      values[metric.key] === opt.value
                        ? "bg-primary text-white"
                        : "bg-white text-dark-5 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-6 dark:hover:bg-dark-4",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
