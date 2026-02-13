"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  calculateScore,
  parseVector,
  buildVector,
  getSeverityColor,
  METRIC_TOOLTIPS,
  type CvssMetrics,
  type SeverityLabel,
} from "@/lib/cvss4";
import { Info } from "lucide-react";

/* ─── Metric Definitions ────────────────────────── */

interface MetricDef {
  key: keyof CvssMetrics;
  label: string;
  group: string;
  options: { value: string; label: string }[];
}

const METRIC_GROUPS = [
  {
    name: "Exploitability",
    description: "How easy it is to exploit the vulnerability",
  },
  {
    name: "Vulnerable System Impact",
    description: "Impact on the directly vulnerable component",
  },
  {
    name: "Subsequent System Impact",
    description: "Impact on systems beyond the vulnerable component",
  },
];

const METRICS: MetricDef[] = [
  {
    key: "AV", label: "Attack Vector", group: "Exploitability",
    options: [
      { value: "N", label: "Network" },
      { value: "A", label: "Adjacent" },
      { value: "L", label: "Local" },
      { value: "P", label: "Physical" },
    ],
  },
  {
    key: "AC", label: "Attack Complexity", group: "Exploitability",
    options: [
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "AT", label: "Attack Requirements", group: "Exploitability",
    options: [
      { value: "N", label: "None" },
      { value: "P", label: "Present" },
    ],
  },
  {
    key: "PR", label: "Privileges Required", group: "Exploitability",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "UI", label: "User Interaction", group: "Exploitability",
    options: [
      { value: "N", label: "None" },
      { value: "P", label: "Passive" },
      { value: "A", label: "Active" },
    ],
  },
  {
    key: "VC", label: "Confidentiality", group: "Vulnerable System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "VI", label: "Integrity", group: "Vulnerable System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "VA", label: "Availability", group: "Vulnerable System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SC", label: "Confidentiality", group: "Subsequent System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SI", label: "Integrity", group: "Subsequent System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
  {
    key: "SA", label: "Availability", group: "Subsequent System Impact",
    options: [
      { value: "N", label: "None" },
      { value: "L", label: "Low" },
      { value: "H", label: "High" },
    ],
  },
];

/* ─── Tooltip Component ─────────────────────────── */

function MetricTooltip({ metricKey }: { metricKey: string }) {
  const [show, setShow] = useState(false);
  const tooltip = METRIC_TOOLTIPS[metricKey];
  if (!tooltip) return null;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-1 inline-flex items-center text-dark-5 transition-colors hover:text-primary dark:text-dark-6 dark:hover:text-primary"
        aria-label={`Info about ${metricKey}`}
      >
        <Info size={13} />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-stroke bg-white px-3 py-2 text-xs leading-relaxed text-dark-5 shadow-lg dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
          {tooltip}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-dark-2" />
        </div>
      )}
    </div>
  );
}

/* ─── Score Display Badge ───────────────────────── */

function ScoreBadge({ score, severity }: { score: number; severity: SeverityLabel }) {
  const colorClass = getSeverityColor(severity);

  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold", colorClass)}>
        {score.toFixed(1)}
      </div>
      <div>
        <div className={cn("inline-block rounded-full px-3 py-1 text-xs font-semibold", colorClass)}>
          {severity}
        </div>
        <p className="mt-0.5 text-xs text-dark-5 dark:text-dark-6">CVSS 4.0 Base Score</p>
      </div>
    </div>
  );
}

/* ─── Main CVSS 4.0 Input Component ─────────────── */

const CVSS_DEFAULT = "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:N/SC:N/SI:N/SA:N";

interface CvssInputProps {
  name: string;
  defaultValue?: string;
  error?: string;
}

export function CvssInput({ name, defaultValue, error }: CvssInputProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);

  const initial = defaultValue || CVSS_DEFAULT;
  const [metrics, setMetrics] = useState<CvssMetrics>(() => parseVector(initial));

  const vectorString = useMemo(() => buildVector(metrics), [metrics]);
  const result = useMemo(() => calculateScore(metrics), [metrics]);

  function handleChange(key: keyof CvssMetrics, value: string) {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  }

  // Group metrics
  const groupedMetrics = METRIC_GROUPS.map((group) => ({
    ...group,
    metrics: METRICS.filter((m) => m.group === group.name),
  }));

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-body-sm font-medium text-dark dark:text-white"
      >
        CVSS 4.0 Vector
      </label>

      <input type="hidden" name={name} value={vectorString} />

      {/* Score display & vector string */}
      <div className="flex flex-col gap-4 rounded-lg border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2 sm:flex-row sm:items-center sm:justify-between">
        <ScoreBadge score={result.score} severity={result.severity} />

        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <code className="rounded-md border border-stroke bg-white px-3 py-2 font-mono text-[10px] text-dark dark:border-dark-3 dark:bg-dark-3 dark:text-white sm:text-xs">
            {vectorString}
          </code>
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="shrink-0 rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            {expanded ? "Collapse" : "Edit Metrics"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Expandable metric editors grouped by category */}
      {expanded && (
        <div className="space-y-4 rounded-lg border border-stroke bg-gray-1 p-4 dark:border-dark-3 dark:bg-dark-2">
          {groupedMetrics.map((group) => (
            <div key={group.name}>
              <div className="mb-3 border-b border-stroke pb-2 dark:border-dark-3">
                <h4 className="text-sm font-semibold text-dark dark:text-white">
                  {group.name}
                </h4>
                <p className="text-xs text-dark-5 dark:text-dark-6">
                  {group.description}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.metrics.map((metric) => (
                  <div key={metric.key}>
                    <label className="mb-1 flex items-center text-xs font-medium text-dark-5 dark:text-dark-6">
                      {metric.label} ({metric.key})
                      <MetricTooltip metricKey={metric.key} />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {metric.options.map((opt) => {
                        const isSelected = metrics[metric.key] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleChange(metric.key, opt.value)}
                            className={cn(
                              "rounded px-2.5 py-1.5 text-xs font-medium transition-all",
                              isSelected
                                ? "bg-primary text-white shadow-sm ring-1 ring-primary/30"
                                : "bg-white text-dark-5 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-6 dark:hover:bg-dark-4",
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
