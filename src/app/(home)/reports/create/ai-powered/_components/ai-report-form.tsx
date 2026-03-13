"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import {
  Sparkles,
  Wand2,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Brain,
  ImageIcon,
  Building2,
  Save,
  Loader2,
} from "lucide-react";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/FormElements/select";
import InputGroup from "@/components/FormElements/InputGroup";
import { AIAttachmentZone, type PoCImage } from "@/components/FormElements/ai-attachment-zone";
import { MagicButton } from "@/components/ui/magic-button";
import {
  AISkeleton,
  AIShimmerBar,
  AIErrorShake,
  AIWaveShimmer,
} from "@/components/ui/ai-skeleton";
import { generateReportWithAI, saveAIReport } from "@/lib/actions/ai-generate";

/* ─── Types ─────────────────────────────────────────── */

interface AIReportFormProps {
  customers: { id: string; name: string; code: string }[];
}

type GenerationStep = "idle" | "generating" | "done" | "error";

/* ─── Helpers ───────────────────────────────────────── */

function generatePenDocId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PEN-DOC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** Build a full styled HTML document for the report preview iframe (srcdoc). */
function buildPreviewHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a2e;
      padding: 24px 32px;
    }
    h1 { font-size: 18pt; color: #1a1a2e; margin-top: 28px; margin-bottom: 12px; border-bottom: 2px solid #5750F1; padding-bottom: 6px; }
    h2 { font-size: 15pt; color: #1a1a2e; margin-top: 22px; margin-bottom: 10px; }
    h3 { font-size: 13pt; color: #334155; margin-top: 18px; margin-bottom: 8px; }
    h4 { font-size: 11pt; color: #475569; margin-top: 14px; margin-bottom: 6px; font-weight: 600; }
    p { margin-bottom: 8px; text-align: justify; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
    th { background: #f8fafc; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; }
    pre { background: #1e1e2e; color: #cdd6f4; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-size: 9pt; margin: 8px 0; }
    code:not(pre code) { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
    blockquote { border-left: 3px solid #5750F1; padding: 8px 16px; margin: 12px 0; color: #475569; background: #f8fafc; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
    a { color: #5750F1; text-decoration: underline; }
    img { max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    div[style*="page-break"] { margin: 24px 0; border-top: 2px dashed #e2e8f0; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/* ─── Animation Variants ────────────────────────────── */

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: "easeOut" as const },
  }),
};

const outputRevealVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto" as const,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

/* ─── Main Component ────────────────────────────────── */

export default function AIReportForm({ customers }: AIReportFormProps) {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const { isAdmin } = useRole();
  const { addToast } = useToast();

  /* ── State ── */
  const [step, setStep] = useState<GenerationStep>("idle");
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [markdownReport, setMarkdownReport] = useState("");
  const [saving, setSaving] = useState(false);

  // Identity & Metadata
  const [title, setTitle] = useState("");
  const [reportId] = useState(generatePenDocId);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Open");

  // AI Raw Input
  const [aiContext, setAiContext] = useState("");
  const [pocImages, setPocImages] = useState<PoCImage[]>([]);

  // Scope
  const [scopeName, setScopeName] = useState("");

  // Issue Reference Builder
  const customerCodeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) map[c.id] = c.code;
    return map;
  }, [customers]);
  const clientCode = selectedCustomerId ? (customerCodeMap[selectedCustomerId] ?? "") : "";
  const [refSeverity, setRefSeverity] = useState("Info");
  const [serviceAffected, setServiceAffected] = useState("");
  const [findingSeq, setFindingSeq] = useState("");

  const SEVERITY_LETTER: Record<string, string> = {
    Critical: "C", High: "H", Medium: "M", Low: "L", Info: "I",
  };

  const issueReferenceNumber = useMemo(() => {
    const cc = clientCode.toUpperCase().trim();
    const sl = SEVERITY_LETTER[refSeverity] ?? "I";
    const svc = serviceAffected.toUpperCase().trim();
    const seq = findingSeq
      ? String(parseInt(findingSeq, 10) || 0).padStart(3, "0")
      : "001";
    if (!cc && !svc) return "";
    return `HTPT-${cc || "XX"}-${sl}-${svc || "SVC"}-${seq}`;
  }, [clientCode, refSeverity, serviceAffected, findingSeq]);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const outputsRef = useRef<HTMLDivElement>(null);

  /* ── Build styled HTML preview from markdown ── */
  const previewHtml = useMemo(() => {
    if (!markdownReport) return "";
    const bodyHtml = marked.parse(markdownReport, { async: false }) as string;
    return buildPreviewHtml(bodyHtml);
  }, [markdownReport]);

  /* ── Validation ── */
  const isFormValid = title.trim().length > 0;

  /* ── Resolve customer name from selected ID ── */
  const selectedCustomerName =
    customers.find((c) => c.id === selectedCustomerId)?.name ?? "";

  /* ── Generate handler ── */
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;

    setStep("generating");
    setMarkdownReport("");
    setErrorShake(false);
    setErrorMessage("");

    try {
      const result = await generateReportWithAI({
        title,
        customerName: selectedCustomerName,
        rawNotes: scopeName ? `Scope: ${scopeName}` : "",
        aiContext,
        pocImages: pocImages.map((img) => ({
          fileUrl: img.fileUrl,
          fileName: img.fileName,
          mimeType: img.mimeType,
        })),
        scopeIssa1: null,
        scopeIssa2: null,
        scopeIssa3: null,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Unknown generation error.");
      }

      setMarkdownReport(result.data.markdownReport);
      setStep("done");

      // Scroll to outputs
      setTimeout(() => {
        outputsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "AI service error.";
      setErrorMessage(msg);
      setStep("error");
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
    }
  }, [isFormValid, title, selectedCustomerName, scopeName, aiContext, pocImages]);

  /* ── Save Report handler ── */
  const handleSaveReport = useCallback(async () => {
    if (!markdownReport || saving) return;

    setSaving(true);
    try {
      const result = await saveAIReport({
        title,
        reportIdCustom: reportId,
        customerId: selectedCustomerId,
        status: selectedStatus,
        markdownReport,
        pocImages: pocImages.map((img) => ({
          fileUrl: img.fileUrl,
          fileName: img.fileName,
          mimeType: img.mimeType,
        })),
        scopeIssa1: null,
        scopeIssa2: null,
        scopeIssa3: null,
        clientCode: clientCode.trim() || undefined,
        serviceAffected: serviceAffected.trim() || undefined,
        findingSequence: findingSeq ? parseInt(findingSeq, 10) || undefined : undefined,
        issueReferenceNumber: issueReferenceNumber || undefined,
        severity: refSeverity,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save finding.");
      }

      addToast("Finding saved successfully!", "success");
      router.push(`/findings`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [markdownReport, saving, title, reportId, selectedCustomerId, selectedStatus, pocImages, addToast, router, clientCode, serviceAffected, findingSeq, issueReferenceNumber, refSeverity]);

  /* ── Glass card helper ── */
  const glassCard = cn(
    "relative overflow-hidden rounded-xl border p-6 shadow-sm transition-shadow duration-200",
    "bg-white/70 backdrop-blur-md dark:bg-white/[0.03] dark:backdrop-blur-lg",
    "border-stroke/60 dark:border-dark-3/60",
    "hover:shadow-lg hover:border-purple-300/40 dark:hover:border-purple-500/25",
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-dark-5 transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-dark-6 dark:hover:bg-dark-3"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-dark dark:text-white">
            New Finding with AI
          </h2>
          <p className="text-xs text-dark-5 dark:text-dark-6">
            Attach PoC screenshots and let AI draft the finding report
          </p>
        </div>
        <div className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-4 text-xs font-medium text-purple-600 dark:from-purple-500/20 dark:to-blue-500/20 dark:text-purple-400">
          <Sparkles size={14} />
          Powered by Gemini 3
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════
           BENTO GRID — Identity & Metadata + AI Input
         ════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ─── Col 1: Identity & Metadata (4 cols) ─── */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial={prefersReduced ? false : "hidden"}
          animate="visible"
          className={cn(glassCard, "xl:col-span-4")}
        >
          <SectionHeader
            icon={<Building2 size={16} />}
            title="Identity & Metadata"
          />

          <div className="mt-5 space-y-4">
            {/* Customer */}
            <Select
              label="Customer"
              name="customerId"
              placeholder="Select a customer"
              items={customerOptions}
              onChange={setSelectedCustomerId}
            />

            {/* Report ID */}
            <InputGroup
              label="Report ID"
              name="reportIdCustom"
              type="text"
              placeholder="PEN-DOC-YYYYMMDDHHmm"
              defaultValue={reportId}
            />

            {/* Report Title */}
            <InputGroup
              label="Report Title"
              name="title"
              type="text"
              placeholder="e.g. Web App Pentest — Acme Corp"
              required
              value={title}
              handleChange={(e) => setTitle(e.target.value)}
            />

            {/* Status */}
            <Select
              label="Status"
              name="status"
              defaultValue="Open"
              onChange={setSelectedStatus}
              items={[
                { value: "Open", label: "Open" },
                { value: "Closed", label: "Closed" },
              ]}
            />

            {/* Scope */}
            <InputGroup
              label="Scope"
              name="scope"
              type="text"
              placeholder="e.g. Back Office Server (DC)"
              value={scopeName}
              handleChange={(e) => setScopeName(e.target.value)}
            />
          </div>

          {/* ─── Issue Reference Builder ─── */}
          <div className="mt-5 border-t border-stroke/50 pt-5 dark:border-dark-3/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <FileText size={14} />
              </div>
              <h4 className="text-sm font-semibold text-dark dark:text-white">
                Issue Reference Builder
              </h4>
            </div>

            <div className="mb-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-center dark:bg-primary/10">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6">
                Issue Reference Number
              </p>
              <p className="font-mono text-lg font-bold tracking-wide text-primary">
                {issueReferenceNumber || "HTPT-XX-I-SVC-001"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dark dark:text-white">
                  Client Code
                </label>
                <input
                  type="text"
                  readOnly
                  value={clientCode}
                  placeholder="Select a customer"
                  className="w-full rounded-lg border border-stroke bg-gray-1 px-3 py-2 text-xs uppercase text-dark outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white cursor-not-allowed"
                />
                <p className="mt-1 text-[10px] text-dark-5 dark:text-dark-6">Auto-filled from selected customer</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-dark dark:text-white">
                  Severity
                </label>
                <select
                  value={refSeverity}
                  onChange={(e) => setRefSeverity(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-xs text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="Critical">Critical (C)</option>
                  <option value="High">High (H)</option>
                  <option value="Medium">Medium (M)</option>
                  <option value="Low">Low (L)</option>
                  <option value="Info">Info (I)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-dark dark:text-white">
                  Service Affected
                </label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="e.g. SMB"
                  value={serviceAffected}
                  onChange={(e) => setServiceAffected(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-xs uppercase text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-dark dark:text-white">
                  Finding Sequence
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  placeholder="e.g. 3"
                  value={findingSeq}
                  onChange={(e) => setFindingSeq(e.target.value)}
                  className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-xs text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Col 2: AI Input Area (8 cols) ─── */}
        <div className="space-y-5 xl:col-span-8">
          {/* ── AI Context / Strategic Instructions ── */}
          <motion.div
            custom={1}
            variants={cardVariants}
            initial={prefersReduced ? false : "hidden"}
            animate="visible"
            className={cn(glassCard)}
          >
            <AIWaveShimmer active={step === "generating"} />

            <SectionHeader
              icon={<Brain size={16} />}
              title="AI Context & Strategic Instructions"
              badge="Optional"
            />

            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              Provide additional context, methodology notes, or specific
              instructions for the AI (e.g. tone, audience, compliance
              frameworks to reference).
            </p>

            <textarea
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              rows={4}
              placeholder="e.g. 'Use formal tone. OWASP Testing Guide v4.2 methodology. Target audience is CTO-level executives. Include MITRE ATT&CK mapping for each finding.'"
              className={cn(
                "mt-3 w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-sm",
                "text-dark placeholder:text-dark-5/60",
                "dark:border-dark-3 dark:text-white dark:placeholder:text-dark-6/50",
                "outline-none focus:border-primary transition-colors",
                "resize-y",
              )}
            />
          </motion.div>

          {/* ── PoC Attachments ── */}
          <motion.div
            custom={2}
            variants={cardVariants}
            initial={prefersReduced ? false : "hidden"}
            animate="visible"
            className={cn(glassCard)}
          >
            <SectionHeader
              icon={<ImageIcon size={16} />}
              title="PoC Screenshots & Evidence"
            />

            <p className="mb-3 mt-1 text-xs text-dark-5 dark:text-dark-6">
              Upload proof-of-concept screenshots. These will be referenced in
              the generated report as evidence for each finding.
            </p>

            <AIAttachmentZone
              images={pocImages}
              onChange={setPocImages}
              label="PoC Attachments"
            />
          </motion.div>
        </div>
      </div>

      {/* ─── Generate Button (full-width) ─── */}
      <motion.div
        custom={3}
        variants={cardVariants}
        initial={prefersReduced ? false : "hidden"}
        animate="visible"
        className="flex items-center justify-between rounded-xl border border-dashed border-purple-300/60 bg-gradient-to-r from-purple-50/80 via-white to-blue-50/80 p-5 dark:border-purple-500/30 dark:from-purple-900/10 dark:via-transparent dark:to-blue-900/10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Wand2 size={18} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-dark dark:text-white">
              Ready to generate?
            </p>
            <p className="text-xs text-dark-5 dark:text-dark-6">
              {isFormValid
                ? "All required fields filled. Click to start AI generation."
                : "Fill in the Report Title to proceed."}
            </p>
          </div>
        </div>

        <MagicButton
          onClick={handleGenerate}
          disabled={!isFormValid}
          loading={step === "generating"}
        >
          {step === "generating" ? (
            <>
              <motion.span
                animate={!prefersReduced ? { rotate: 360 } : undefined}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <Sparkles size={16} />
              </motion.span>
              Generating…
            </>
          ) : (
            <>
              <Wand2 size={16} />
              Generate with AI
            </>
          )}
        </MagicButton>
      </motion.div>

      {/* ════════════════════════════════════════════════
           GENERATION PROGRESS — Skeleton Cards
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {step === "generating" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={cn(glassCard)}>
              <AIShimmerBar className="mb-4" />
              <div className="mb-4 flex items-center gap-2">
                <motion.span
                  animate={!prefersReduced ? { rotate: 360 } : undefined}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Sparkles size={16} className="text-purple-500" />
                </motion.span>
                <span className="text-sm font-medium text-dark dark:text-white">
                  AI is analyzing your findings{pocImages.length > 0 ? ` and ${pocImages.length} PoC image(s)` : ""} and crafting the report…
                </span>
              </div>
              <div className="space-y-4">
                {[
                  "Title & Document Info",
                  "Executive Summary",
                  "Findings & Analysis",
                  "Recommendations & Appendix",
                ].map((label, i) => (
                  <div
                    key={label}
                    className="rounded-lg border border-stroke/50 bg-white/50 p-4 dark:border-dark-3/50 dark:bg-white/[0.02]"
                  >
                    <p className="mb-3 text-xs font-medium text-dark-5 dark:text-dark-6">
                      {label}
                    </p>
                    <AISkeleton lines={3 + i} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
           ERROR STATE
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {step === "error" && (
          <AIErrorShake trigger={errorShake}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-red-200 bg-red-50/80 p-6 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle
                    size={20}
                    className="text-red-600 dark:text-red-400"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Generation failed
                  </p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/70">
                    {errorMessage || "The AI service encountered an error. Please try again."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          </AIErrorShake>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
           GENERATED OUTPUT — PDF Preview
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {step === "done" && markdownReport && (
          <motion.div
            ref={outputsRef}
            variants={outputRevealVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Output header */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent dark:via-purple-600/40" />
              <span className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                <Sparkles size={12} />
                AI-Generated Report
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent dark:via-purple-600/40" />
            </div>

            {/* PDF Preview card */}
            <div className={cn(glassCard)}>
              {/* Toolbar */}
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <FileText size={16} />
                </div>
                <h3 className="text-base font-semibold text-dark dark:text-white">
                  Generated VAPT Report — PDF Preview
                </h3>
              </div>

              {/* Report Preview (rendered HTML) */}
              <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
                <iframe
                  srcDoc={previewHtml}
                  title="AI Report Preview"
                  className="h-[700px] w-full bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Action buttons */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex justify-end gap-3"
            >
              <button
                type="button"
                onClick={() => {
                  setStep("idle");
                  setMarkdownReport("");
                }}
                className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleSaveReport}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Report
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════════════ */

/* ─── Section Header ────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-dark dark:text-white">
        {title}
      </h3>
      {badge && (
        <span
          className={cn(
            "ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-medium",
            badge === "Required"
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-gray-100 text-dark-5 dark:bg-dark-3 dark:text-dark-6",
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
