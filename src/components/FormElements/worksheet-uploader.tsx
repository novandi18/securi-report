"use client";

import { useCallback, useRef, useState } from "react";
import { parseWorksheetAction } from "@/lib/actions/worksheet-actions";
import type { Issa1Target, Issa2Target, Issa3Target } from "@/lib/db/schema";
import type { ParsedWorksheet } from "@/lib/actions/worksheet-actions";

// ─── Types ────────────────────────────────────────────────

interface WorksheetUploaderProps {
  /** Initial data (for edit mode) */
  initialData?: ParsedWorksheet | null;
  /** Called when data changes (parsed or cleared) */
  onChange?: (data: ParsedWorksheet | null) => void;
  /** Error message from form validation */
  error?: string;
}

// ─── Row Action Buttons ───────────────────────────────────

function DeleteRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-dark-5 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-dark-6 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      title="Remove this item"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

function EditRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-dark-5 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:text-dark-6 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
      title="Edit this item"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

function SaveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-green-500 transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
      title="Save changes"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

function CancelRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-dark-5 transition-colors hover:bg-gray-100 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-3 dark:hover:text-white"
      title="Cancel editing"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

/** Shared inline-edit input style */
const editInputClass =
  "w-full rounded border border-stroke bg-white px-2 py-1 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary";

// ─── Accordion Section ───────────────────────────────────

function AccordionSection({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-stroke dark:border-dark-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-dark transition-colors hover:bg-gray-1 dark:text-white dark:hover:bg-dark-3"
      >
        <span className="flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {count}
          </span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-dark-5 transition-transform duration-200 dark:text-dark-6 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-stroke dark:border-dark-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── ISSA-1 Preview Table (4 columns + edit/delete) ──────

function Issa1Table({
  targets,
  onDelete,
  onEdit,
}: {
  targets: Issa1Target[];
  onDelete: (index: number) => void;
  onEdit: (index: number, updated: Issa1Target) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<Issa1Target, "no">>({ sistemEndpoint: "", ipAddress: "", linkUrl: "" });

  function startEdit(i: number) {
    const t = targets[i];
    setDraft({ sistemEndpoint: t.sistemEndpoint, ipAddress: t.ipAddress, linkUrl: t.linkUrl });
    setEditIdx(i);
  }

  function saveEdit() {
    if (editIdx === null) return;
    onEdit(editIdx, { no: targets[editIdx].no, ...draft });
    setEditIdx(null);
  }

  function cancelEdit() {
    setEditIdx(null);
  }

  if (targets.length === 0) {
    return (
      <p className="px-4 py-3 text-sm italic text-dark-5 dark:text-dark-6">
        No data found in this sheet.
      </p>
    );
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-1 dark:bg-dark-3">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">No.</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">Sistem / Endpoint</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">IP Address</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">Link URL</th>
            <th className="w-16 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {targets.map((t, i) =>
            editIdx === i ? (
              <tr key={`edit-${i}`} className="border-t border-primary/30 bg-primary/5 dark:bg-primary/10">
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.sistemEndpoint} onChange={(e) => setDraft((d) => ({ ...d, sistemEndpoint: e.target.value }))} />
                </td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.ipAddress} onChange={(e) => setDraft((d) => ({ ...d, ipAddress: e.target.value }))} />
                </td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.linkUrl} onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <SaveRowButton onClick={saveEdit} />
                    <CancelRowButton onClick={cancelEdit} />
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={`${t.no}-${i}`}
                className="group border-t border-stroke/50 dark:border-dark-3/50"
              >
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-2 font-medium text-dark dark:text-white">{t.sistemEndpoint}</td>
                <td className="px-4 py-2 font-mono text-xs text-dark-5 dark:text-dark-6">{t.ipAddress}</td>
                <td className="px-4 py-2 font-mono text-xs text-dark-5 dark:text-dark-6">{t.linkUrl}</td>
                <td className="px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <EditRowButton onClick={() => startEdit(i)} />
                    <DeleteRowButton onClick={() => onDelete(i)} />
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── ISSA-2 Preview Table (3 columns + edit/delete) ──────

function Issa2Table({
  targets,
  onDelete,
  onEdit,
}: {
  targets: Issa2Target[];
  onDelete: (index: number) => void;
  onEdit: (index: number, updated: Issa2Target) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<Issa2Target, "no">>({ ipPublic: "", linkUrl: "" });

  function startEdit(i: number) {
    const t = targets[i];
    setDraft({ ipPublic: t.ipPublic, linkUrl: t.linkUrl });
    setEditIdx(i);
  }

  function saveEdit() {
    if (editIdx === null) return;
    onEdit(editIdx, { no: targets[editIdx].no, ...draft });
    setEditIdx(null);
  }

  function cancelEdit() {
    setEditIdx(null);
  }

  if (targets.length === 0) {
    return (
      <p className="px-4 py-3 text-sm italic text-dark-5 dark:text-dark-6">
        No data found in this sheet.
      </p>
    );
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-1 dark:bg-dark-3">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">No.</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">IP Public</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">Link URL</th>
            <th className="w-16 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {targets.map((t, i) =>
            editIdx === i ? (
              <tr key={`edit-${i}`} className="border-t border-primary/30 bg-primary/5 dark:bg-primary/10">
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.ipPublic} onChange={(e) => setDraft((d) => ({ ...d, ipPublic: e.target.value }))} />
                </td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.linkUrl} onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <SaveRowButton onClick={saveEdit} />
                    <CancelRowButton onClick={cancelEdit} />
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={`${t.no}-${i}`}
                className="group border-t border-stroke/50 dark:border-dark-3/50"
              >
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-2 font-mono text-xs text-dark-5 dark:text-dark-6">{t.ipPublic}</td>
                <td className="px-4 py-2 font-mono text-xs text-dark-5 dark:text-dark-6">{t.linkUrl}</td>
                <td className="px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <EditRowButton onClick={() => startEdit(i)} />
                    <DeleteRowButton onClick={() => onDelete(i)} />
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── ISSA-3 Preview Table (2 columns + edit/delete) ──────

function Issa3Table({
  targets,
  onDelete,
  onEdit,
}: {
  targets: Issa3Target[];
  onDelete: (index: number) => void;
  onEdit: (index: number, updated: Issa3Target) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<Issa3Target, "no">>({ ipInternal: "" });

  function startEdit(i: number) {
    const t = targets[i];
    setDraft({ ipInternal: t.ipInternal });
    setEditIdx(i);
  }

  function saveEdit() {
    if (editIdx === null) return;
    onEdit(editIdx, { no: targets[editIdx].no, ...draft });
    setEditIdx(null);
  }

  function cancelEdit() {
    setEditIdx(null);
  }

  if (targets.length === 0) {
    return (
      <p className="px-4 py-3 text-sm italic text-dark-5 dark:text-dark-6">
        No data found in this sheet.
      </p>
    );
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-1 dark:bg-dark-3">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">No.</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-dark-5 dark:text-dark-6">IP Internal</th>
            <th className="w-16 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {targets.map((t, i) =>
            editIdx === i ? (
              <tr key={`edit-${i}`} className="border-t border-primary/30 bg-primary/5 dark:bg-primary/10">
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-1.5">
                  <input className={editInputClass} value={draft.ipInternal} onChange={(e) => setDraft((d) => ({ ...d, ipInternal: e.target.value }))} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <SaveRowButton onClick={saveEdit} />
                    <CancelRowButton onClick={cancelEdit} />
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={`${t.no}-${i}`}
                className="group border-t border-stroke/50 dark:border-dark-3/50"
              >
                <td className="px-4 py-2 text-dark-5 dark:text-dark-6">{t.no}</td>
                <td className="px-4 py-2 font-mono text-xs text-dark-5 dark:text-dark-6">{t.ipInternal}</td>
                <td className="px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center justify-center gap-0.5">
                    <EditRowButton onClick={() => startEdit(i)} />
                    <DeleteRowButton onClick={() => onDelete(i)} />
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Renumber helper ──────────────────────────────────────

function renumber<T extends { no: number }>(items: T[]): T[] {
  return items.map((item, idx) => ({ ...item, no: idx + 1 }));
}

// ─── Main Component ───────────────────────────────────────

export function WorksheetUploader({
  initialData,
  onChange,
  error,
}: WorksheetUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ParsedWorksheet | null>(initialData ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setParsing(true);

      const formData = new FormData();
      formData.append("worksheet", file);

      const result = await parseWorksheetAction(formData);

      if (result.success && result.data) {
        setData(result.data);
        setFileName(file.name);
        onChange?.(result.data);
      } else {
        setParseError(result.error || "Failed to parse file.");
        setData(null);
        setFileName(null);
        onChange?.(null);
      }

      setParsing(false);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  function handleClear() {
    setData(null);
    setFileName(null);
    setParseError(null);
    onChange?.(null);
  }

  // ─── Delete handlers (remove item & renumber) ───────────

  function handleDeleteIssa1(index: number) {
    if (!data) return;
    const updated: ParsedWorksheet = {
      ...data,
      issa1: renumber(data.issa1.filter((_, i) => i !== index)),
    };
    setData(updated);
    onChange?.(updated);
  }

  function handleDeleteIssa2(index: number) {
    if (!data) return;
    const updated: ParsedWorksheet = {
      ...data,
      issa2: renumber(data.issa2.filter((_, i) => i !== index)),
    };
    setData(updated);
    onChange?.(updated);
  }

  function handleDeleteIssa3(index: number) {
    if (!data) return;
    const updated: ParsedWorksheet = {
      ...data,
      issa3: renumber(data.issa3.filter((_, i) => i !== index)),
    };
    setData(updated);
    onChange?.(updated);
  }

  // ─── Edit handlers (update item in place) ─────────────────

  function handleEditIssa1(index: number, updated: Issa1Target) {
    if (!data) return;
    const newData: ParsedWorksheet = {
      ...data,
      issa1: data.issa1.map((item, i) => (i === index ? updated : item)),
    };
    setData(newData);
    onChange?.(newData);
  }

  function handleEditIssa2(index: number, updated: Issa2Target) {
    if (!data) return;
    const newData: ParsedWorksheet = {
      ...data,
      issa2: data.issa2.map((item, i) => (i === index ? updated : item)),
    };
    setData(newData);
    onChange?.(newData);
  }

  function handleEditIssa3(index: number, updated: Issa3Target) {
    if (!data) return;
    const newData: ParsedWorksheet = {
      ...data,
      issa3: data.issa3.map((item, i) => (i === index ? updated : item)),
    };
    setData(newData);
    onChange?.(newData);
  }

  const totalIssa1 = data?.issa1.length ?? 0;
  const totalIssa2 = data?.issa2.length ?? 0;
  const totalIssa3 = data?.issa3.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Hidden inputs to serialize scope data to form */}
      <input
        type="hidden"
        name="scopeIssa1"
        value={data?.issa1 ? JSON.stringify(data.issa1) : ""}
      />
      <input
        type="hidden"
        name="scopeIssa2"
        value={data?.issa2 ? JSON.stringify(data.issa2) : ""}
      />
      <input
        type="hidden"
        name="scopeIssa3"
        value={data?.issa3 ? JSON.stringify(data.issa3) : ""}
      />

      {/* Upload Zone */}
      {!data && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 ${
            isDragOver
              ? "border-primary bg-primary/5 dark:bg-primary/10"
              : "border-stroke hover:border-primary/50 hover:bg-gray-1 dark:border-dark-3 dark:hover:border-dark-4 dark:hover:bg-dark-3/50"
          } ${parsing ? "pointer-events-none opacity-60" : ""}`}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-dark-5 dark:text-dark-6">
                Parsing worksheet…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 rounded-full bg-primary/10 p-3 dark:bg-primary/20">
                <svg
                  className="h-6 w-6 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-dark dark:text-white">
                Drop ISSA Worksheet here or{" "}
                <span className="text-primary">browse</span>
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                Only .xlsx files accepted • Max 10MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Error */}
      {(parseError || error) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {parseError || error}
          </p>
        </div>
      )}

      {/* Parsed results */}
      {data && (
        <div className="space-y-3">
          {/* File info bar */}
          <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3 dark:bg-green-900/20">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {fileName}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {totalIssa1 + totalIssa2 + totalIssa3} total endpoints parsed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/40"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Accordion previews */}
          <AccordionSection
            title="BAB IV — Exploitation Targets (ISSA-1)"
            icon=""
            count={totalIssa1}
            defaultOpen={totalIssa1 > 0}
          >
            <Issa1Table targets={data.issa1} onDelete={handleDeleteIssa1} onEdit={handleEditIssa1} />
          </AccordionSection>

          <AccordionSection
            title="BAB V — VA Public Targets (ISSA-2)"
            icon=""
            count={totalIssa2}
            defaultOpen={totalIssa2 > 0 && totalIssa1 === 0}
          >
            <Issa2Table targets={data.issa2} onDelete={handleDeleteIssa2} onEdit={handleEditIssa2} />
          </AccordionSection>

          <AccordionSection
            title="BAB V — VA Workstation Targets (ISSA-3)"
            icon=""
            count={totalIssa3}
            defaultOpen={totalIssa3 > 0 && totalIssa1 === 0 && totalIssa2 === 0}
          >
            <Issa3Table targets={data.issa3} onDelete={handleDeleteIssa3} onEdit={handleEditIssa3} />
          </AccordionSection>
        </div>
      )}
    </div>
  );
}
