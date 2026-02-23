"use client";

import { useState, useCallback, useMemo } from "react";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { useToast } from "@/components/ui/toast";
import {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  htmlEntitiesEncode,
  htmlEntitiesDecode,
  hexEncode,
  hexDecode,
  rot13,
  decodeJWT,
  detectEncoding,
  toMarkdownCodeBlock,
  type DetectedEncoding,
} from "@/lib/tools-utils";
import {
  Binary,
  Copy,
  ArrowRightLeft,
  FileCode2,
  Scan,
  AlertTriangle,
  ShieldAlert,
  Info,
  KeyRound,
} from "lucide-react";

type EncodingAlgo = "base64" | "url" | "html" | "hex" | "rot13";

const ALGO_OPTIONS: { value: EncodingAlgo; label: string }[] = [
  { value: "base64", label: "Base64" },
  { value: "url", label: "URL Encode" },
  { value: "html", label: "HTML Entities" },
  { value: "hex", label: "Hex" },
  { value: "rot13", label: "ROT13" },
];

export default function EncodingPage() {
  const { addToast } = useToast();

  // ─── Encoder/Decoder state ──────────────────────────
  const [encInput, setEncInput] = useState("");
  const [encOutput, setEncOutput] = useState("");
  const [algo, setAlgo] = useState<EncodingAlgo>("base64");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");

  // ─── JWT state ──────────────────────────────────────
  const [jwtInput, setJwtInput] = useState("");
  const [jwtResult, setJwtResult] = useState<ReturnType<typeof decodeJWT> | null>(null);

  // ─── Auto-detect ────────────────────────────────────
  const detectedType: DetectedEncoding = useMemo(
    () => (encInput.trim() ? detectEncoding(encInput) : "unknown"),
    [encInput],
  );

  const handleEncode = useCallback(() => {
    if (!encInput.trim()) {
      addToast("Enter text first", "warning");
      return;
    }
    try {
      let result: string;
      if (direction === "encode") {
        switch (algo) {
          case "base64":
            result = base64Encode(encInput);
            break;
          case "url":
            result = urlEncode(encInput);
            break;
          case "html":
            result = htmlEntitiesEncode(encInput);
            break;
          case "hex":
            result = hexEncode(encInput);
            break;
          case "rot13":
            result = rot13(encInput);
            break;
        }
      } else {
        switch (algo) {
          case "base64":
            result = base64Decode(encInput);
            break;
          case "url":
            result = urlDecode(encInput);
            break;
          case "html":
            result = htmlEntitiesDecode(encInput);
            break;
          case "hex":
            result = hexDecode(encInput);
            break;
          case "rot13":
            result = rot13(encInput);
            break;
        }
      }
      setEncOutput(result);
      addToast(`${direction === "encode" ? "Encoded" : "Decoded"} successfully`, "success");
    } catch (e) {
      addToast(`Failed: ${e instanceof Error ? e.message : e}`, "error");
    }
  }, [encInput, algo, direction, addToast]);

  const handleSwap = useCallback(() => {
    setEncInput(encOutput);
    setEncOutput(encInput);
    setDirection((d) => (d === "encode" ? "decode" : "encode"));
  }, [encInput, encOutput]);

  const handleCopyOutput = useCallback(() => {
    navigator.clipboard.writeText(encOutput);
    addToast("Copied to clipboard", "success");
  }, [encOutput, addToast]);

  const handleCopyMarkdown = useCallback(() => {
    if (!encOutput) {
      addToast("No output to copy", "warning");
      return;
    }
    const md = toMarkdownCodeBlock(encOutput, `${algo.toUpperCase()} ${direction}`);
    navigator.clipboard.writeText(md);
    addToast("Markdown code block copied", "success");
  }, [encOutput, algo, direction, addToast]);

  const handleDecodeJWT = useCallback(() => {
    if (!jwtInput.trim()) {
      addToast("Enter a JWT token", "warning");
      return;
    }
    const result = decodeJWT(jwtInput);
    setJwtResult(result);
    addToast("JWT decoded", "success");
  }, [jwtInput, addToast]);

  const handleCopyJwtMarkdown = useCallback(() => {
    if (!jwtResult) return;
    const content = [
      "## JWT Header",
      "```json",
      JSON.stringify(jwtResult.header, null, 2),
      "```",
      "",
      "## JWT Payload",
      "```json",
      JSON.stringify(jwtResult.payload, null, 2),
      "```",
      "",
      "## Signature",
      "`" + jwtResult.signature + "`",
    ].join("\n");
    navigator.clipboard.writeText(content);
    addToast("Markdown copied", "success");
  }, [jwtResult, addToast]);

  const detectedBadge = useMemo(() => {
    const labels: Record<DetectedEncoding, string> = {
      base64: "Base64",
      "url-encoded": "URL-Encoded",
      hex: "Hex",
      jwt: "JWT",
      "html-entities": "HTML Entities",
      unknown: "Unknown",
    };
    return labels[detectedType];
  }, [detectedType]);

  return (
    <>
      <Breadcrumb pageName="Encoder & Decoder" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ─── Encoder / Decoder ───────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white">
              <Binary className="size-5 text-primary" />
              Encoder / Decoder
            </h2>
            {encInput.trim() && detectedType !== "unknown" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
                <Scan className="size-3" />
                Detected: {detectedBadge}
              </span>
            )}
          </div>

          <div className="space-y-4 p-5">
            {/* Algorithm & Direction */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Algorithm
                </label>
                <select
                  value={algo}
                  onChange={(e) => setAlgo(e.target.value as EncodingAlgo)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-dark focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {ALGO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Direction
                </label>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                  <button
                    onClick={() => setDirection("encode")}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      direction === "encode"
                        ? "bg-primary text-white"
                        : "bg-white text-dark hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    }`}
                  >
                    Encode
                  </button>
                  <button
                    onClick={() => setDirection("decode")}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      direction === "decode"
                        ? "bg-primary text-white"
                        : "bg-white text-dark hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    }`}
                  >
                    Decode
                  </button>
                </div>
              </div>
            </div>

            {/* Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Input
              </label>
              <textarea
                value={encInput}
                onChange={(e) => setEncInput(e.target.value)}
                rows={5}
                placeholder="Enter text to encode or decode..."
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleEncode}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                <Binary className="size-4" />
                {direction === "encode" ? "Encode" : "Decode"}
              </button>
              <button
                onClick={handleSwap}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <ArrowRightLeft className="size-4" />
                Swap
              </button>
              <button
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <FileCode2 className="size-4" />
                Copy as Markdown
              </button>
            </div>

            {/* Output */}
            {encOutput && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
                    Result
                  </span>
                  <button
                    onClick={handleCopyOutput}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-4 hover:text-primary dark:text-dark-6"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </button>
                </div>
                <pre className="max-h-48 overflow-auto break-all whitespace-pre-wrap font-mono text-xs text-dark dark:text-white">
                  {encOutput}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ─── JWT Decoder ─────────────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white">
              <KeyRound className="size-5 text-primary" />
              JWT Decoder
            </h2>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                JWT Token
              </label>
              <textarea
                value={jwtInput}
                onChange={(e) => setJwtInput(e.target.value)}
                rows={4}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDecodeJWT}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                <Scan className="size-4" />
                Decode JWT
              </button>
              {jwtResult && (
                <button
                  onClick={handleCopyJwtMarkdown}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                >
                  <FileCode2 className="size-4" />
                  Copy to Report
                </button>
              )}
            </div>

            {/* JWT Result */}
            {jwtResult && (
              <div className="space-y-3">
                {/* Warnings */}
                {jwtResult.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {jwtResult.warnings.map((w, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                          w.includes("CRITICAL") || w.includes("EXPIRED")
                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        }`}
                      >
                        {w.includes("CRITICAL") || w.includes("EXPIRED") ? (
                          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                        ) : w.includes("Warning") ? (
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        ) : (
                          <Info className="mt-0.5 size-3.5 shrink-0" />
                        )}
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Header */}
                {jwtResult.header && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Header
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(jwtResult.header, null, 2),
                          );
                          addToast("Header copied", "success");
                        }}
                        className="text-dark-4 hover:text-primary dark:text-dark-6"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-dark dark:text-white">
                      {JSON.stringify(jwtResult.header, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Payload */}
                {jwtResult.payload && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Payload
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(jwtResult.payload, null, 2),
                          );
                          addToast("Payload copied", "success");
                        }}
                        className="text-dark-4 hover:text-primary dark:text-dark-6"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-dark dark:text-white">
                      {JSON.stringify(jwtResult.payload, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Signature */}
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Signature
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(jwtResult.signature);
                        addToast("Signature copied", "success");
                      }}
                      className="text-dark-4 hover:text-primary dark:text-dark-6"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <code className="break-all font-mono text-xs text-dark-4 dark:text-dark-6">
                    {jwtResult.signature || "(empty)"}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
