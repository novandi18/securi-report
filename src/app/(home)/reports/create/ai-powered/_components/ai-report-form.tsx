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
import { markdownToHtml } from "@/lib/markdown-to-html";

/** Resolve ![upload]["filename"] references using pocImages for preview */
function resolveUploadRefs(
  content: string,
  images: { fileName: string; fileUrl: string }[],
): string {
  if (!images.length) return content;
  return content.replace(
    /!\[upload\]\["([^"]+)"\]/g,
    (_match, fileName: string) => {
      const img = images.find((a) => a.fileName === fileName);
      return img ? `![${fileName}](${img.fileUrl})` : `![⚠ File not found: ${fileName}]()`;
    },
  );
}
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/FormElements/select";
import InputGroup from "@/components/FormElements/InputGroup";
import { AIAttachmentZone, type PoCImage } from "@/components/FormElements/ai-attachment-zone";
import { CvssInput } from "@/components/FormElements/cvss-calculator";
import { MagicButton } from "@/components/ui/magic-button";
import {
  AISkeleton,
  AIShimmerBar,
  AIErrorShake,
  AIWaveShimmer,
} from "@/components/ui/ai-skeleton";
import { generateReportWithAI, saveAIReport } from "@/lib/actions/ai-generate";
import { isDevClient } from "@/lib/env";

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

  // ─── Dev dummy data (same as manual finding form) ───
  const devDefaults = isDevClient ? {
    title: "Sensitive Information Disclosure via Unauthenticated SMB Null Session",
    serviceAffected: "SMB",
    findingSequence: "1",
    severity: "High",
    scopeName: "192.1.2.95 - H2H/API Server CIRT KSEI",
    cvssVector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    customerName: "PT Profindo Sekuritas Indonesia",
    aiContext: "Berdasarkan hasil Pemindaian menggunakan Nmap mengungkap adanya port 445 (microsoft-ds) yang aktif.\n\nMelakukan pengujian untuk melihat apakah server memberikan izin kepada siapa pun untuk melihat daftar folder di dalamnya tanpa perlu melakukan proses login.\n\nSetelah mendapatkan list direktori, tim mencoba masuk ke salah satu share yang terdeteksi untuk membuktikan bahwa file dapat diakses dan dibaca. Dengan perintah ls menampilkan ratusan file instalasi, dokumen backup, dan data operasional internal.",
    status: "Open",
  } : null;

  // Auto-select customer by name in dev mode
  const devCustomerId = devDefaults
    ? customers.find((c) => c.name === devDefaults.customerName)?.id ?? ""
    : "";

  /* ── State ── */
  const [step, setStep] = useState<GenerationStep>("idle");
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [markdownReport, setMarkdownReport] = useState("");
  const [saving, setSaving] = useState(false);

  // Structured AI output fields (matching manual finding form)
  const [aiDescription, setAiDescription] = useState("");
  const [aiImpact, setAiImpact] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiCvssVector, setAiCvssVector] = useState("");
  const [aiCvssScore, setAiCvssScore] = useState("");
  const [aiSeverity, setAiSeverity] = useState("");
  const [aiLocation, setAiLocation] = useState("");
  const [aiReferencesList, setAiReferencesList] = useState("");

  // Identity & Metadata
  const [title, setTitle] = useState(devDefaults?.title ?? "");
  const [reportId] = useState(generatePenDocId);
  const [selectedCustomerId, setSelectedCustomerId] = useState(devCustomerId);
  const [selectedStatus, setSelectedStatus] = useState(devDefaults?.status ?? "Open");

  // AI Raw Input
  const [aiContext, setAiContext] = useState(devDefaults?.aiContext ?? "");
  const [pocImages, setPocImages] = useState<PoCImage[]>([]);

  // Scope / Affected Module
  const [scopeName, setScopeName] = useState(devDefaults?.scopeName ?? "");

  // CVSS Vector (user input from CvssInput component)
  const [cvssVector, setCvssVector] = useState(devDefaults?.cvssVector ?? "");
  const [cvssScore, setCvssScore] = useState("");
  const [cvssSeverity, setCvssSeverity] = useState("");

  // Issue Reference Builder
  const customerCodeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) map[c.id] = c.code;
    return map;
  }, [customers]);
  const clientCode = selectedCustomerId ? (customerCodeMap[selectedCustomerId] ?? "") : "";
  const [refPrefix, setRefPrefix] = useState<"HTPT" | "HTVA">("HTPT");
  const [refSeverity, setRefSeverity] = useState(devDefaults?.severity ?? "Info");
  const [serviceAffected, setServiceAffected] = useState(devDefaults?.serviceAffected ?? "");
  const [findingSeq, setFindingSeq] = useState(devDefaults?.findingSequence ?? "");

  const handleCvssChange = useCallback((vector: string, score: string, severity: string) => {
    setCvssVector(vector);
    setCvssScore(score);
    setCvssSeverity(severity);
    // Sync severity to issue reference builder
    if (severity) setRefSeverity(severity);
  }, []);

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
    return `${refPrefix}-${cc || "XX"}-${sl}-${svc || "SVC"}-${seq}`;
  }, [clientCode, refSeverity, serviceAffected, findingSeq, refPrefix]);

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const outputsRef = useRef<HTMLDivElement>(null);

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
    setAiDescription("");
    setAiImpact("");
    setAiRecommendation("");
    setAiCvssVector("");
    setAiCvssScore("");
    setAiSeverity("");
    setAiLocation("");
    setAiReferencesList("");
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
      setAiDescription(result.data.description);
      setAiImpact(result.data.impact);
      setAiRecommendation(result.data.recommendation);
      setAiCvssVector(result.data.cvssVector);
      setAiCvssScore(result.data.cvssScore);
      setAiSeverity(result.data.severity);
      setAiLocation(result.data.location);
      setAiReferencesList(result.data.referencesList);

      // Update severity in the issue reference builder
      if (result.data.severity) {
        setRefSeverity(result.data.severity);
      }

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
    if ((!markdownReport && !aiDescription) || saving) return;

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
        severity: cvssSeverity || aiSeverity || refSeverity,
        // Individual finding fields from AI (user CVSS input takes priority)
        description: aiDescription || undefined,
        location: aiLocation || scopeName || undefined,
        cvssVector: cvssVector || aiCvssVector || undefined,
        cvssScore: cvssScore || aiCvssScore || undefined,
        impact: aiImpact || undefined,
        recommendation: aiRecommendation || undefined,
        referencesList: aiReferencesList || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to save finding.");
      }

      addToast("Finding saved successfully!", "success");
      router.push(`/findings?highlight=${result.reportId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [markdownReport, aiDescription, saving, title, reportId, selectedCustomerId, selectedStatus, pocImages, addToast, router, clientCode, serviceAffected, findingSeq, issueReferenceNumber, refSeverity, cvssSeverity, aiSeverity, aiLocation, scopeName, cvssVector, cvssScore, aiCvssVector, aiCvssScore, aiImpact, aiRecommendation, aiReferencesList]);

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
              defaultValue={devCustomerId}
              onChange={setSelectedCustomerId}
            />

            {/* Finding ID */}
            <InputGroup
              label="Finding ID"
              name="reportIdCustom"
              type="text"
              placeholder="PEN-DOC-YYYYMMDDHHmm"
              defaultValue={reportId}
            />

            {/* Issue Title */}
            <InputGroup
              label="Issue Title"
              name="title"
              type="text"
              placeholder="e.g. SQL Injection on Login Page"
              required
              value={title}
              handleChange={(e) => setTitle(e.target.value)}
            />

            {/* Status */}
            <Select
              label="Status"
              name="status"
              defaultValue={devDefaults?.status ?? "Open"}
              onChange={setSelectedStatus}
              items={[
                { value: "Open", label: "Open" },
                { value: "Closed", label: "Closed" },
              ]}
            />

            {/* CVSS 4.0 Score */}
            <CvssInput
              name="cvssVector"
              defaultValue={devDefaults?.cvssVector}
              onChange={handleCvssChange}
            />

            {/* Affected Module */}
            <InputGroup
              label="Affected Module"
              name="scope"
              type="text"
              placeholder="e.g. 192.1.2.95 - H2H/API Server CIRT KSEI"
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
                {issueReferenceNumber || `${refPrefix}-XX-I-SVC-001`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dark dark:text-white">
                  Prefix
                </label>
                <select
                  value={refPrefix}
                  onChange={(e) => setRefPrefix(e.target.value as "HTPT" | "HTVA")}
                  className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-xs text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="HTPT">HTPT — Pentest</option>
                  <option value="HTVA">HTVA — VA Scan</option>
                </select>
              </div>

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
                  AI is analyzing your findings{pocImages.length > 0 ? ` and ${pocImages.length} PoC image(s)` : ""} and generating structured output…
                </span>
              </div>
              <div className="space-y-4">
                {[
                  "Description & Location",
                  "CVSS & Severity",
                  "Impact Analysis",
                  "Recommendations & References",
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
        {step === "done" && (markdownReport || aiDescription) && (
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
                AI-Generated Finding
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent dark:via-purple-600/40" />
            </div>

            {/* Structured fields preview */}
            <div className={cn(glassCard)}>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <FileText size={16} />
                </div>
                <h3 className="text-base font-semibold text-dark dark:text-white">
                  Generated Finding — Preview
                </h3>
              </div>

              <div className="space-y-4">
                {/* Severity & CVSS */}
                <div className="flex flex-wrap gap-3">
                  {aiSeverity && (
                    <span className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      aiSeverity === "Critical" && "bg-red-900/20 text-red-600 dark:text-red-400",
                      aiSeverity === "High" && "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
                      aiSeverity === "Medium" && "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
                      aiSeverity === "Low" && "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                      aiSeverity === "Info" && "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
                    )}>
                      Severity: {aiSeverity}
                    </span>
                  )}
                  {aiCvssScore && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-dark-5 dark:bg-dark-3 dark:text-dark-6">
                      CVSS: {aiCvssScore}
                    </span>
                  )}
                  {aiLocation && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-dark-5 dark:bg-dark-3 dark:text-dark-6">
                      Location: {aiLocation}
                    </span>
                  )}
                </div>

                {aiCvssVector && (
                  <div className="rounded-lg bg-gray-1 p-3 dark:bg-dark-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-dark-5 dark:text-dark-6 mb-1">CVSS Vector</p>
                    <p className="font-mono text-xs text-dark dark:text-white break-all">{aiCvssVector}</p>
                  </div>
                )}

                {/* Description */}
                {aiDescription && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">Deskripsi</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-stroke/50 bg-white/50 p-4 dark:border-dark-3/50 dark:bg-white/[0.02]">
                      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(resolveUploadRefs(aiDescription, pocImages)) }} />
                    </div>
                  </div>
                )}

                {/* Impact */}
                {aiImpact && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">Dampak</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-stroke/50 bg-white/50 p-4 dark:border-dark-3/50 dark:bg-white/[0.02]">
                      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(resolveUploadRefs(aiImpact, pocImages)) }} />
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {aiRecommendation && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">Rekomendasi</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-stroke/50 bg-white/50 p-4 dark:border-dark-3/50 dark:bg-white/[0.02]">
                      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(resolveUploadRefs(aiRecommendation, pocImages)) }} />
                    </div>
                  </div>
                )}

                {/* References */}
                {aiReferencesList && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-dark dark:text-white">Referensi</h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-stroke/50 bg-white/50 p-4 dark:border-dark-3/50 dark:bg-white/[0.02]">
                      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(resolveUploadRefs(aiReferencesList, pocImages)) }} />
                    </div>
                  </div>
                )}
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
                  setAiDescription("");
                  setAiImpact("");
                  setAiRecommendation("");
                  setAiCvssVector("");
                  setAiCvssScore("");
                  setAiSeverity("");
                  setAiLocation("");
                  setAiReferencesList("");
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
                    Save Finding
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
