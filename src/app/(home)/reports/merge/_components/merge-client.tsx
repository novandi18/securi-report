"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-editor/preview";
import { mergeReportsAction } from "@/lib/actions/merge";
import { cn } from "@/lib/utils";
import {
  ResizableTable,
  ResizableTableBody,
  ResizableTableCell,
  ResizableTableHead,
  ResizableTableHeader,
  ResizableTableRow,
} from "@/components/ui/resizable-table";
import { GitMerge, Users, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

/* ─── Types ─────────────────────────────────────── */

interface Contribution {
  id: string;
  customerId: string;
  reportIdCustom: string | null;
  title: string;
  executiveSummary: string | null;
  scope: string | null;
  methodology: string | null;
  impact: string | null;
  recommendationSummary: string | null;
  cvssVector: string | null;
  status: "Open" | "Closed" | "Draft" | null;
  isMaster: boolean | null;
  parentReportId: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  customerName: string;
  creatorUsername: string | null;
}

interface ContributionGroup {
  customerId: string;
  customerName: string;
  contributions: Contribution[];
}

interface MergeClientProps {
  groups: ContributionGroup[];
}

/* ─── Steps ─────────────────────────────────────── */

type MergeStep = "select" | "resolve" | "review";

const STEPS: { key: MergeStep; label: string; number: number }[] = [
  { key: "select", label: "Select Contributions", number: 1 },
  { key: "resolve", label: "Resolve Conflicts", number: 2 },
  { key: "review", label: "Review & Merge", number: 3 },
];

/* ═══════════════════════════════════════════════════
   Merge Client Component
   ═══════════════════════════════════════════════════ */

export default function MergeClient({ groups }: MergeClientProps) {
  const { addToast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<MergeStep>("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map((g) => g.customerId)),
  );
  const [merging, setMerging] = useState(false);

  // Conflict resolution fields
  const [masterTitle, setMasterTitle] = useState("");
  const [masterExecSummary, setMasterExecSummary] = useState("");
  const [masterScope, setMasterScope] = useState("");
  const [masterMethodology, setMasterMethodology] = useState("");
  const [masterImpact, setMasterImpact] = useState("");
  const [masterRecommendation, setMasterRecommendation] = useState("");

  // All selected contributions across groups
  const selectedContributions = useMemo(() => {
    const all: Contribution[] = [];
    for (const g of groups) {
      for (const c of g.contributions) {
        if (selectedIds.has(c.id)) all.push(c);
      }
    }
    return all;
  }, [groups, selectedIds]);

  // Check all selected belong to same customer
  const selectedCustomerIds = useMemo(
    () => new Set(selectedContributions.map((c) => c.customerId)),
    [selectedContributions],
  );
  const sameCustomer = selectedCustomerIds.size <= 1;
  const canProceed = selectedIds.size >= 2 && sameCustomer;

  /* ─── Handlers ─────────────────────────────────── */

  function toggleGroup(customerId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllInGroup(customerId: string) {
    const group = groups.find((g) => g.customerId === customerId);
    if (!group) return;

    const allSelected = group.contributions.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of group.contributions) {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  function proceedToResolve() {
    if (!canProceed) return;

    // Pre-fill from first contribution
    const first = selectedContributions[0];
    if (first) {
      setMasterTitle(`[Merged] ${first.title}`);
      setMasterExecSummary(first.executiveSummary ?? "");
      setMasterScope(first.scope ?? "");
      setMasterMethodology(first.methodology ?? "");
      setMasterImpact(first.impact ?? "");
      setMasterRecommendation(first.recommendationSummary ?? "");
    }
    setStep("resolve");
  }

  function pickField(
    field: "executiveSummary" | "scope" | "methodology" | "impact" | "recommendationSummary",
    value: string,
  ) {
    if (field === "executiveSummary") setMasterExecSummary(value);
    else if (field === "scope") setMasterScope(value);
    else if (field === "methodology") setMasterMethodology(value);
    else if (field === "impact") setMasterImpact(value);
    else if (field === "recommendationSummary") setMasterRecommendation(value);
  }

  async function handleMerge() {
    if (!masterTitle.trim()) {
      addToast("Please provide a title for the master report.", "error");
      return;
    }

    const customerId = selectedContributions[0]?.customerId;
    if (!customerId) return;

    setMerging(true);
    try {
      const result = await mergeReportsAction({
        selectedReportIds: Array.from(selectedIds),
        title: masterTitle,
        executiveSummary: masterExecSummary,
        scope: masterScope,
        methodology: masterMethodology,
        impact: masterImpact,
        recommendationSummary: masterRecommendation,
        customerId,
      });

      if (result.success) {
        addToast("Reports merged successfully! Master report created.", "success");
        router.push("/reports");
        router.refresh();
      } else {
        addToast(result.error || "Merge failed.", "error");
      }
    } catch {
      addToast("An unexpected error occurred.", "error");
    } finally {
      setMerging(false);
    }
  }

  /* ─── Render ───────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-dark dark:text-white">
            <GitMerge size={24} className="text-primary" />
            Merge Contributions
          </h2>
          <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
            Select submitted (Open) contributions from the same customer and merge them into a single Master Report.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors",
                step === s.key
                  ? "bg-primary text-white"
                  : STEPS.findIndex((x) => x.key === step) > idx
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-dark-5 dark:bg-dark-3 dark:text-dark-6",
              )}
            >
              {STEPS.findIndex((x) => x.key === step) > idx ? (
                <CheckCircle2 size={16} />
              ) : (
                s.number
              )}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                step === s.key
                  ? "text-dark dark:text-white"
                  : "text-dark-5 dark:text-dark-6",
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-gray-300 dark:bg-dark-3" />
            )}
          </div>
        ))}
      </div>

      {/* ─── Step 1: Select ─── */}
      {step === "select" && (
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-stroke bg-white p-12 text-center dark:border-dark-3 dark:bg-gray-dark">
              <Users size={48} className="mx-auto mb-4 text-dark-5 dark:text-dark-6" />
              <p className="text-lg font-medium text-dark dark:text-white">
                No contributions available
              </p>
              <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
                Only submitted contributions (status: Open) appear here. Pentesters must change their report status from Draft to Open before they can be merged.
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedGroups.has(group.customerId);
              const allSelected = group.contributions.every((c) =>
                selectedIds.has(c.id),
              );
              const someSelected = group.contributions.some((c) =>
                selectedIds.has(c.id),
              );

              return (
                <div
                  key={group.customerId}
                  className="overflow-hidden rounded-xl border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark"
                >
                  {/* Group header */}
                  <div
                    className="flex cursor-pointer items-center gap-3 border-b border-stroke px-5 py-3 hover:bg-gray-1 dark:border-dark-3 dark:hover:bg-dark-2"
                    onClick={() => toggleGroup(group.customerId)}
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-dark-5" />
                    ) : (
                      <ChevronRight size={18} className="text-dark-5" />
                    )}
                    <div className="flex-1">
                      <span className="font-semibold text-dark dark:text-white">
                        {group.customerName}
                      </span>
                      <span className="ml-2 text-xs text-dark-5 dark:text-dark-6">
                        {group.contributions.length} contribution(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllInGroup(group.customerId);
                      }}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                        allSelected
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-dark-5 hover:bg-gray-200 dark:bg-dark-3 dark:text-dark-6 dark:hover:bg-dark-4",
                      )}
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Contributions table */}
                  {isExpanded && (
                    <ResizableTable>
                      <ResizableTableHeader>
                        <ResizableTableRow>
                          <ResizableTableHead resizable={false} className="w-12" />
                          <ResizableTableHead minWidth={120}>Report ID</ResizableTableHead>
                          <ResizableTableHead minWidth={200}>Title</ResizableTableHead>
                          <ResizableTableHead minWidth={100}>Author</ResizableTableHead>
                          <ResizableTableHead minWidth={80}>Status</ResizableTableHead>
                          <ResizableTableHead minWidth={120}>Created</ResizableTableHead>
                        </ResizableTableRow>
                      </ResizableTableHeader>
                      <ResizableTableBody>
                        {group.contributions.map((c) => {
                          const isSelected = selectedIds.has(c.id);
                          return (
                            <ResizableTableRow
                              key={c.id}
                              className={cn(
                                "cursor-pointer",
                                isSelected && "bg-primary/5 dark:bg-primary/10",
                              )}
                              onClick={() => toggleSelection(c.id)}
                            >
                              <ResizableTableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(c.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                              </ResizableTableCell>
                              <ResizableTableCell>
                                <code className="text-xs">
                                  {c.reportIdCustom ?? "—"}
                                </code>
                              </ResizableTableCell>
                              <ResizableTableCell>
                                <span className="font-medium text-dark dark:text-white">
                                  {c.title}
                                </span>
                              </ResizableTableCell>
                              <ResizableTableCell>
                                {c.creatorUsername ?? "—"}
                              </ResizableTableCell>
                              <ResizableTableCell>
                                <span
                                  className={cn(
                                    "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                    c.status === "Draft"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                                      : c.status === "Open"
                                        ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
                                  )}
                                >
                                  {c.status}
                                </span>
                              </ResizableTableCell>
                              <ResizableTableCell className="text-xs text-dark-5 dark:text-dark-6">
                                {c.createdAt
                                  ? new Date(c.createdAt).toLocaleDateString()
                                  : "—"}
                              </ResizableTableCell>
                            </ResizableTableRow>
                          );
                        })}
                      </ResizableTableBody>
                    </ResizableTable>
                  )}
                </div>
              );
            })
          )}

          {/* Selection summary & proceed */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 dark:bg-primary/10">
              <div>
                <p className="font-medium text-dark dark:text-white">
                  {selectedIds.size} contribution(s) selected
                </p>
                {!sameCustomer && (
                  <p className="mt-0.5 text-xs text-red-500">
                    All selected contributions must belong to the same customer.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!canProceed}
                onClick={proceedToResolve}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Next: Resolve Conflicts
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: Conflict Resolution ─── */}
      {step === "resolve" && (
        <div className="space-y-6">
          {/* Master title */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              Master Report Title
            </h3>
            <input
              type="text"
              value={masterTitle}
              onChange={(e) => setMasterTitle(e.target.value)}
              placeholder="Enter the merged report title"
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* Executive Summary conflict */}
          <ConflictSection
            label="Executive Summary"
            contributions={selectedContributions}
            field="executiveSummary"
            currentValue={masterExecSummary}
            onPick={(val) => pickField("executiveSummary", val)}
            onEdit={(val) => setMasterExecSummary(val)}
          />

          {/* Scope conflict */}
          <ConflictSection
            label="Scope"
            contributions={selectedContributions}
            field="scope"
            currentValue={masterScope}
            onPick={(val) => pickField("scope", val)}
            onEdit={(val) => setMasterScope(val)}
          />

          {/* Methodology conflict */}
          <ConflictSection
            label="Methodology"
            contributions={selectedContributions}
            field="methodology"
            currentValue={masterMethodology}
            onPick={(val) => pickField("methodology", val)}
            onEdit={(val) => setMasterMethodology(val)}
          />

          {/* Impact conflict */}
          <ConflictSection
            label="Impact"
            contributions={selectedContributions}
            field="impact"
            currentValue={masterImpact}
            onPick={(val) => pickField("impact", val)}
            onEdit={(val) => setMasterImpact(val)}
          />

          {/* Recommendation conflict */}
          <ConflictSection
            label="Recommendation Summary"
            contributions={selectedContributions}
            field="recommendationSummary"
            currentValue={masterRecommendation}
            onPick={(val) => pickField("recommendationSummary", val)}
            onEdit={(val) => setMasterRecommendation(val)}
          />

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("select")}
              className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("review")}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Review & Merge ─── */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
              Review Before Merging
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">Title</span>
                <p className="mt-1 text-dark dark:text-white">{masterTitle}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                  Customer
                </span>
                <p className="mt-1 text-dark dark:text-white">
                  {selectedContributions[0]?.customerName ?? "—"}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                  Contributions being merged ({selectedContributions.length})
                </span>
                <ul className="mt-1 space-y-1">
                  {selectedContributions.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 text-sm text-dark dark:text-white"
                    >
                      <CheckCircle2 size={14} className="text-green-500" />
                      {c.title}
                      <span className="text-xs text-dark-5 dark:text-dark-6">
                        by {c.creatorUsername ?? "unknown"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke p-4 dark:border-dark-3 md:grid-cols-3">
                <div>
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    Executive Summary
                  </span>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {masterExecSummary ? (
                      <MarkdownPreview content={masterExecSummary} height="auto" />
                    ) : (
                      <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    Scope
                  </span>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {masterScope ? (
                      <MarkdownPreview content={masterScope} height="auto" />
                    ) : (
                      <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    Methodology
                  </span>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {masterMethodology ? (
                      <MarkdownPreview content={masterMethodology} height="auto" />
                    ) : (
                      <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke p-4 dark:border-dark-3 md:grid-cols-2">
                <div>
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    Impact
                  </span>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {masterImpact ? (
                      <MarkdownPreview content={masterImpact} height="auto" />
                    ) : (
                      <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    Recommendation Summary
                  </span>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {masterRecommendation ? (
                      <MarkdownPreview content={masterRecommendation} height="auto" />
                    ) : (
                      <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep("resolve")}
              className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
            >
              Back
            </button>
            <button
              type="button"
              disabled={merging}
              onClick={handleMerge}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
            >
              <GitMerge size={16} />
              {merging ? "Merging..." : "Create Master Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Conflict Resolution Section
   ═══════════════════════════════════════════════════ */

interface ConflictSectionProps {
  label: string;
  contributions: Contribution[];
  field: "executiveSummary" | "scope" | "methodology" | "impact" | "recommendationSummary";
  currentValue: string;
  onPick: (value: string) => void;
  onEdit: (value: string) => void;
}

function ConflictSection({
  label,
  contributions,
  field,
  currentValue,
  onPick,
  onEdit,
}: ConflictSectionProps) {
  const [mode, setMode] = useState<"pick" | "edit">("pick");

  return (
    <div className="rounded-xl border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark dark:text-white">
          {label}
        </h3>
        <div className="flex gap-1 rounded-md border border-stroke p-0.5 dark:border-dark-3">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              mode === "pick"
                ? "bg-primary text-white"
                : "text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white",
            )}
          >
            Pick From Source
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              mode === "edit"
                ? "bg-primary text-white"
                : "text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white",
            )}
          >
            Edit Combined
          </button>
        </div>
      </div>

      {mode === "pick" ? (
        <div className="space-y-3">
          {contributions.map((c) => {
            const value = c[field] ?? "";
            const isSelected = currentValue === value && value !== "";
            return (
              <div
                key={c.id}
                onClick={() => onPick(value)}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-stroke hover:border-primary/50 dark:border-dark-3",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-dark-5 dark:text-dark-6">
                    From: {c.creatorUsername ?? "Unknown"} — {c.title}
                  </span>
                  {isSelected && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">
                      Selected
                    </span>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {value ? (
                    <MarkdownPreview content={value} height="auto" />
                  ) : (
                    <p className="text-xs text-dark-5 dark:text-dark-6">(empty)</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <MarkdownEditor
          label=""
          name={`master_${field}`}
          value={currentValue}
          onChange={onEdit}
          height="200px"
          placeholder={`Edit combined ${label.toLowerCase()}...`}
        />
      )}
    </div>
  );
}
