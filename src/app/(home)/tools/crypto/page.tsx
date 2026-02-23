"use client";

import { useState, useCallback } from "react";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { useToast } from "@/components/ui/toast";
import {
  hashAll,
  hashTableToMarkdown,
  aesEncrypt,
  aesDecrypt,
  desEncrypt,
  desDecrypt,
  base64XorEncrypt,
  base64XorDecrypt,
  measurePasswordStrength,
  type StrengthResult,
} from "@/lib/tools-utils";
import {
  ShieldCheck,
  Hash,
  Lock,
  Unlock,
  Copy,
  FileCode2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

type CryptoAlgo = "aes-256-cbc" | "des" | "base64-xor";
type CryptoMode = "encrypt" | "decrypt";

export default function CryptoPage() {
  const { addToast } = useToast();

  // ─── Hashing state ───────────────────────────────────
  const [hashInput, setHashInput] = useState("");
  const [salt, setSalt] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [hashLoading, setHashLoading] = useState(false);

  // ─── Encryption state ────────────────────────────────
  const [cryptoInput, setCryptoInput] = useState("");
  const [cryptoKey, setCryptoKey] = useState("");
  const [cryptoAlgo, setCryptoAlgo] = useState<CryptoAlgo>("aes-256-cbc");
  const [cryptoMode, setCryptoMode] = useState<CryptoMode>("encrypt");
  const [cryptoOutput, setCryptoOutput] = useState("");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // ─── Password Strength ──────────────────────────────
  const strength: StrengthResult = measurePasswordStrength(hashInput);

  // ─── Handlers ───────────────────────────────────────
  const handleHash = useCallback(async () => {
    if (!hashInput.trim()) {
      addToast("Enter a string to hash", "warning");
      return;
    }
    setHashLoading(true);
    try {
      const result = await hashAll(hashInput, salt);
      setHashes(result);
      addToast("Hashes generated", "success");
    } catch (e) {
      addToast(`Hashing failed: ${e}`, "error");
    } finally {
      setHashLoading(false);
    }
  }, [hashInput, salt, addToast]);

  const handleCopyHash = useCallback(
    (algo: string, value: string) => {
      navigator.clipboard.writeText(value);
      addToast(`${algo} hash copied`, "success");
    },
    [addToast],
  );

  const handleCopyMarkdownTable = useCallback(() => {
    if (!Object.keys(hashes).length) {
      addToast("Generate hashes first", "warning");
      return;
    }
    const md = hashTableToMarkdown(hashes, hashInput);
    navigator.clipboard.writeText(md);
    addToast("Markdown table copied to clipboard", "success");
  }, [hashes, hashInput, addToast]);

  const handleCrypto = useCallback(async () => {
    if (!cryptoInput.trim() || !cryptoKey.trim()) {
      addToast("Enter both input and key/password", "warning");
      return;
    }
    setCryptoLoading(true);
    try {
      let result: string;
      if (cryptoMode === "encrypt") {
        switch (cryptoAlgo) {
          case "aes-256-cbc":
            result = await aesEncrypt(cryptoInput, cryptoKey);
            break;
          case "des":
            result = await desEncrypt(cryptoInput, cryptoKey);
            break;
          case "base64-xor":
            result = base64XorEncrypt(cryptoInput, cryptoKey);
            break;
        }
      } else {
        switch (cryptoAlgo) {
          case "aes-256-cbc":
            result = await aesDecrypt(cryptoInput, cryptoKey);
            break;
          case "des":
            result = await desDecrypt(cryptoInput, cryptoKey);
            break;
          case "base64-xor":
            result = base64XorDecrypt(cryptoInput, cryptoKey);
            break;
        }
      }
      setCryptoOutput(result);
      addToast(
        `${cryptoMode === "encrypt" ? "Encrypted" : "Decrypted"} successfully`,
        "success",
      );
    } catch (e) {
      addToast(
        `${cryptoMode === "encrypt" ? "Encryption" : "Decryption"} failed: ${e instanceof Error ? e.message : e}`,
        "error",
      );
    } finally {
      setCryptoLoading(false);
    }
  }, [cryptoInput, cryptoKey, cryptoAlgo, cryptoMode, addToast]);

  const handleCopyCryptoOutput = useCallback(() => {
    navigator.clipboard.writeText(cryptoOutput);
    addToast("Output copied to clipboard", "success");
  }, [cryptoOutput, addToast]);

  return (
    <>
      <Breadcrumb pageName="Hashing & Encryption" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ─── Hashing Section ─────────────────────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white">
              <Hash className="size-5 text-primary" />
              Hashing
            </h2>
            <span className="text-xs text-dark-4 dark:text-dark-6">
              MD5 · SHA-1 · SHA-256 · SHA-512
            </span>
          </div>

          <div className="space-y-4 p-5">
            {/* Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Input String
              </label>
              <textarea
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                rows={3}
                placeholder="Enter text to hash..."
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Password Strength Meter */}
            {hashInput && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-dark-4 dark:text-dark-6">
                    Password Strength
                  </span>
                  <span className="text-xs font-semibold text-dark dark:text-white">
                    {strength.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength.score
                          ? strength.color
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Salt */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Salt{" "}
                <span className="text-xs font-normal text-dark-4 dark:text-dark-6">
                  (optional, prepended to input)
                </span>
              </label>
              <input
                type="text"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                placeholder="e.g. random-salt-value"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleHash}
                disabled={hashLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                <ShieldCheck className="size-4" />
                {hashLoading ? "Hashing..." : "Generate Hashes"}
              </button>
              <button
                onClick={handleCopyMarkdownTable}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <FileCode2 className="size-4" />
                Copy as Markdown Table
              </button>
            </div>

            {/* Hash Results */}
            {Object.keys(hashes).length > 0 && (
              <div className="space-y-2">
                {Object.entries(hashes).map(([algo, hash]) => (
                  <div
                    key={algo}
                    className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary dark:bg-primary/20">
                      {algo}
                    </span>
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-dark-4 dark:text-dark-6">
                      {hash}
                    </code>
                    <button
                      onClick={() => handleCopyHash(algo, hash)}
                      className="shrink-0 opacity-0 transition group-hover:opacity-100"
                      title="Copy"
                    >
                      <Copy className="size-3.5 text-dark-4 hover:text-primary dark:text-dark-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Encryption / Decryption Section ──────────────── */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-gray-700">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white">
              <KeyRound className="size-5 text-primary" />
              Encryption / Decryption
            </h2>
          </div>

          <div className="space-y-4 p-5">
            {/* Algorithm & Mode toggles */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Algorithm
                </label>
                <select
                  value={cryptoAlgo}
                  onChange={(e) => setCryptoAlgo(e.target.value as CryptoAlgo)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-dark focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="aes-256-cbc">AES-256-CBC</option>
                  <option value="des">DES (compat)</option>
                  <option value="base64-xor">Base64-XOR</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                  Mode
                </label>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                  <button
                    onClick={() => setCryptoMode("encrypt")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${
                      cryptoMode === "encrypt"
                        ? "bg-primary text-white"
                        : "bg-white text-dark hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    }`}
                  >
                    <Lock className="size-3.5" />
                    Encrypt
                  </button>
                  <button
                    onClick={() => setCryptoMode("decrypt")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${
                      cryptoMode === "decrypt"
                        ? "bg-primary text-white"
                        : "bg-white text-dark hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    }`}
                  >
                    <Unlock className="size-3.5" />
                    Decrypt
                  </button>
                </div>
              </div>
            </div>

            {/* Input */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                {cryptoMode === "encrypt" ? "Plaintext" : "Ciphertext"}
              </label>
              <textarea
                value={cryptoInput}
                onChange={(e) => setCryptoInput(e.target.value)}
                rows={4}
                placeholder={
                  cryptoMode === "encrypt"
                    ? "Enter plaintext to encrypt..."
                    : "Enter ciphertext to decrypt..."
                }
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Key / Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">
                Key / Password
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={cryptoKey}
                  onChange={(e) => setCryptoKey(e.target.value)}
                  placeholder="Enter encryption key..."
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 pr-10 font-mono text-sm text-dark focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-white"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Go */}
            <button
              onClick={handleCrypto}
              disabled={cryptoLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {cryptoMode === "encrypt" ? (
                <Lock className="size-4" />
              ) : (
                <Unlock className="size-4" />
              )}
              {cryptoLoading
                ? "Processing..."
                : cryptoMode === "encrypt"
                  ? "Encrypt"
                  : "Decrypt"}
            </button>

            {/* Output */}
            {cryptoOutput && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-dark-4 dark:text-dark-6">
                    Result
                  </span>
                  <button
                    onClick={handleCopyCryptoOutput}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-4 hover:text-primary dark:text-dark-6"
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </button>
                </div>
                <pre className="max-h-48 overflow-auto break-all whitespace-pre-wrap font-mono text-xs text-dark dark:text-white">
                  {cryptoOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
