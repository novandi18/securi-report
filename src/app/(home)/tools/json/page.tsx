"use client";

import { useState, useCallback, useMemo } from "react";
import { Breadcrumb } from "@/components/Breadcrumbs/Breadcrumb";
import { useToast } from "@/components/ui/toast";
import {
  prettifyJSON,
  minifyJSON,
  validateJSON,
  getJSONPaths,
  jsonToLatexListing,
} from "@/lib/tools-utils";
import {
  Braces,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  FileCode2,
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <div className="animate-pulse text-sm text-dark-4 dark:text-dark-6">Loading editor...</div>
    </div>
  ),
});

const SAMPLE_JSON = `{
  "pentest": {
    "target": "https://example.com",
    "scope": ["api", "web"],
    "findings": [
      {
        "id": "VULN-001",
        "title": "SQL Injection",
        "severity": "Critical",
        "cvss": 9.8
      }
    ]
  }
}`;

export default function JSONFormatterPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState(SAMPLE_JSON);
  const [output, setOutput] = useState("");
  const [showPaths, setShowPaths] = useState(false);

  const validation = useMemo(() => validateJSON(input), [input]);

  const handlePrettify = useCallback(() => {
    try {
      setOutput(prettifyJSON(input));
      addToast("JSON prettified", "success");
    } catch {
      addToast("Invalid JSON — cannot prettify", "error");
    }
  }, [input, addToast]);

  const handleMinify = useCallback(() => {
    try {
      setOutput(minifyJSON(input));
      addToast("JSON minified", "success");
    } catch {
      addToast("Invalid JSON — cannot minify", "error");
    }
  }, [input, addToast]);

  const handleCopyLatex = useCallback(() => {
    try {
      const latex = jsonToLatexListing(input);
      navigator.clipboard.writeText(latex);
      addToast("LaTeX listing copied to clipboard", "success");
    } catch {
      addToast("Invalid JSON — cannot convert to LaTeX", "error");
    }
  }, [input, addToast]);

  const handleCopyOutput = useCallback(() => {
    navigator.clipboard.writeText(output);
    addToast("Output copied to clipboard", "success");
  }, [output, addToast]);

  const paths = useMemo(() => {
    if (!showPaths || !validation.valid) return [];
    try {
      return getJSONPaths(JSON.parse(input));
    } catch {
      return [];
    }
  }, [input, showPaths, validation.valid]);

  const handlePathClick = useCallback(
    (path: string) => {
      navigator.clipboard.writeText(path);
      addToast(`Path copied: ${path}`, "success");
    },
    [addToast],
  );

  return (
    <>
      <Breadcrumb pageName="JSON Formatter" />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handlePrettify}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
        >
          <Maximize2 className="size-4" />
          Prettify
        </button>
        <button
          onClick={handleMinify}
          className="inline-flex items-center gap-2 rounded-lg bg-dark-2 px-4 py-2 text-sm font-medium text-white transition hover:bg-dark-3 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          <Minimize2 className="size-4" />
          Minify
        </button>
        <button
          onClick={handleCopyLatex}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-dark transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          <FileCode2 className="size-4" />
          Copy as LaTeX
        </button>
        <button
          onClick={() => setShowPaths(!showPaths)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
            showPaths
              ? "border-primary bg-primary/10 text-primary dark:border-primary dark:bg-primary/20"
              : "border-gray-300 bg-white text-dark hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          }`}
        >
          <MousePointerClick className="size-4" />
          Path Finder
        </button>

        {/* Validation status */}
        <div className="ml-auto flex items-center gap-2">
          {validation.valid ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              Valid JSON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
              <AlertTriangle className="size-4" />
              {validation.error?.slice(0, 60)}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side editors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Input */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
            <span className="flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
              <Braces className="size-4 text-primary" />
              Input
            </span>
          </div>
          <MonacoEditor
            height="500px"
            language="json"
            theme="vs-dark"
            value={input}
            onChange={(v) => setInput(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>

        {/* Output */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
            <span className="flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
              <Check className="size-4 text-green-500" />
              Output
            </span>
            {output && (
              <button
                onClick={handleCopyOutput}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-dark-4 transition hover:bg-gray-100 hover:text-dark dark:text-dark-6 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <Copy className="size-3.5" />
                Copy
              </button>
            )}
          </div>
          <MonacoEditor
            height="500px"
            language="json"
            theme="vs-dark"
            value={output}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Path Finder Panel */}
      {showPaths && validation.valid && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-dark">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
            <MousePointerClick className="size-4 text-primary" />
            JSON Paths — click to copy
          </h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium text-dark-4 dark:text-dark-6">
                    Path
                  </th>
                  <th className="pb-2 font-medium text-dark-4 dark:text-dark-6">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {paths.map(({ path, value }) => (
                  <tr
                    key={path}
                    onClick={() => handlePathClick(path)}
                    className="cursor-pointer border-b border-gray-100 transition hover:bg-primary/5 dark:border-gray-800 dark:hover:bg-primary/10"
                  >
                    <td className="py-1.5 pr-4 font-mono text-xs text-primary">
                      {path}
                    </td>
                    <td className="truncate py-1.5 font-mono text-xs text-dark-4 dark:text-dark-6">
                      {typeof value === "object"
                        ? JSON.stringify(value).slice(0, 80)
                        : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
