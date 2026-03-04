"use server";

import * as XLSX from "xlsx";
import type { Issa1Target, Issa2Target, Issa3Target } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────

export interface ParsedWorksheet {
  issa1: Issa1Target[];
  issa2: Issa2Target[];
  issa3: Issa3Target[];
}

export interface ParseWorksheetResult {
  success: boolean;
  data?: ParsedWorksheet;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────

function sanitize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every(
    (cell) => cell === null || cell === undefined || String(cell).trim() === "",
  );
}

/** Skip instruction / placeholder rows (e.g. "AB Isi dibagian kolom ini") */
const INSTRUCTION_RE = /^ab\s+isi|^isi\s+di|^contoh|^catatan|^note|^silakan/i;

/** A row is valid only if the No. cell is a valid positive number. */
function isValidNo(raw: string): boolean {
  if (!raw) return false;
  const n = Number(raw);
  return !isNaN(n) && n > 0;
}

/**
 * Find a column index whose header matches any of the given patterns.
 * Searches among the first `maxRows` rows and returns { rowIdx, colIdx }.
 */
function findHeader(
  rows: unknown[][],
  patterns: RegExp[],
  maxRows = 15,
): { rowIdx: number; colIdx: number } | null {
  for (let r = 0; r < Math.min(rows.length, maxRows); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = sanitize(row[c]);
      if (patterns.some((p) => p.test(cell))) return { rowIdx: r, colIdx: c };
    }
  }
  return null;
}

/** Find the first row that contains a "No." header and return its index & column position. */
function findNoHeader(rows: unknown[][], maxRows = 15) {
  return findHeader(rows, [/^no\.?$/i], maxRows);
}

// ─── Sheet-specific parsers ───────────────────────────────

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) ?? []) as unknown[][];
}

/**
 * ISSA-1 — Exploitation Targets
 * Headers: No. | Sistem / Endpoint | IP Address | Link URL
 */
function parseIssa1(workbook: XLSX.WorkBook, sheetName: string): Issa1Target[] {
  const rows = getSheetRows(workbook, sheetName);
  if (rows.length === 0) return [];

  const noH = findNoHeader(rows);
  const sysH = findHeader(rows, [/sistem\s*\/\s*endpoint/i]);
  const ipH = findHeader(rows, [/ip\s*address/i]);
  const linkH = findHeader(rows, [/link\s*url/i, /url/i]);

  // Determine header row = max row index among found headers
  const headerRow = Math.max(noH?.rowIdx ?? 0, sysH?.rowIdx ?? 0, ipH?.rowIdx ?? 0, linkH?.rowIdx ?? 0);
  const noCol = noH?.colIdx ?? 0;
  const sysCol = sysH?.colIdx ?? noCol + 1;
  const ipCol = ipH?.colIdx ?? sysCol + 1;
  const linkCol = linkH?.colIdx ?? ipCol + 1;

  const targets: Issa1Target[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || isEmptyRow(row)) continue;

    const rawNo = sanitize(row[noCol]);
    if (!isValidNo(rawNo)) continue;

    const sistemEndpoint = sanitize(row[sysCol]);
    const ipAddress = sanitize(row[ipCol]);
    const linkUrl = sanitize(row[linkCol]);

    if (!sistemEndpoint && !ipAddress && !linkUrl) continue;
    if (INSTRUCTION_RE.test(sistemEndpoint) || INSTRUCTION_RE.test(ipAddress)) continue;

    targets.push({
      no: Number(rawNo),
      sistemEndpoint: sistemEndpoint || "—",
      ipAddress: ipAddress || "—",
      linkUrl: linkUrl || "—",
    });
  }
  return targets;
}

/**
 * ISSA-2 — VA Public Targets
 * Headers: No. | IP Public | Link URL
 */
function parseIssa2(workbook: XLSX.WorkBook, sheetName: string): Issa2Target[] {
  const rows = getSheetRows(workbook, sheetName);
  if (rows.length === 0) return [];

  const noH = findNoHeader(rows);
  const ipH = findHeader(rows, [/ip\s*public/i]);
  const linkH = findHeader(rows, [/link\s*url/i]);

  const headerRow = Math.max(noH?.rowIdx ?? 0, ipH?.rowIdx ?? 0, linkH?.rowIdx ?? 0);
  const noCol = noH?.colIdx ?? 0;
  const ipPublicCol = ipH?.colIdx ?? noCol + 1;
  const linkUrlCol = linkH?.colIdx ?? ipPublicCol + 1;

  const targets: Issa2Target[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || isEmptyRow(row)) continue;

    const rawNo = sanitize(row[noCol]);
    if (!isValidNo(rawNo)) continue;

    const ipPublic = sanitize(row[ipPublicCol]);
    const linkUrl = sanitize(row[linkUrlCol]);

    if (!ipPublic && !linkUrl) continue;
    if (INSTRUCTION_RE.test(ipPublic) || INSTRUCTION_RE.test(linkUrl)) continue;

    targets.push({ no: Number(rawNo), ipPublic: ipPublic || "—", linkUrl: linkUrl || "—" });
  }
  return targets;
}

/**
 * ISSA-3 — VA Workstation Targets
 * Headers: No. | IP Internal
 */
function parseIssa3(workbook: XLSX.WorkBook, sheetName: string): Issa3Target[] {
  const rows = getSheetRows(workbook, sheetName);
  if (rows.length === 0) return [];

  const noH = findNoHeader(rows);
  const ipH = findHeader(rows, [/ip\s*internal/i, /internal/i]);

  const headerRow = Math.max(noH?.rowIdx ?? 0, ipH?.rowIdx ?? 0);
  const noCol = noH?.colIdx ?? 0;
  const ipCol = ipH?.colIdx ?? noCol + 1;

  const targets: Issa3Target[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || isEmptyRow(row)) continue;

    const rawNo = sanitize(row[noCol]);
    if (!isValidNo(rawNo)) continue;

    const ip = sanitize(row[ipCol]);
    if (!ip) continue;
    if (INSTRUCTION_RE.test(ip)) continue;

    targets.push({ no: Number(rawNo), ipInternal: ip });
  }
  return targets;
}

// ─── Sheet name finder ────────────────────────────────────

function findSheetName(sheetNames: string[], ...targets: string[]): string | undefined {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const target of targets) {
    const found = sheetNames.find((name) => norm(name) === norm(target));
    if (found) return found;
  }
  // Partial match fallback
  for (const target of targets) {
    const found = sheetNames.find((name) => norm(name).includes(norm(target)));
    if (found) return found;
  }
  return undefined;
}

// ─── Main parse function ──────────────────────────────────

export async function parseWorksheetAction(
  formData: FormData,
): Promise<ParseWorksheetResult> {
  try {
    const file = formData.get("worksheet") as File | null;
    if (!file) {
      return { success: false, error: "No file uploaded." };
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx")) {
      return {
        success: false,
        error: "Invalid file type. Please upload an .xlsx file.",
      };
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "File size exceeds 10MB limit." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const names = workbook.SheetNames;

    const issa1Sheet = findSheetName(names, "ISSA-1", "ISSA1");
    const issa2Sheet = findSheetName(names, "ISSA-2", "ISSA2");
    const issa3Sheet = findSheetName(names, "ISSA-3", "ISSA3");

    if (!issa1Sheet && !issa2Sheet && !issa3Sheet) {
      return {
        success: false,
        error: `No recognized sheets found. Available: ${names.join(", ")}. Expected: ISSA-1, ISSA-2, ISSA-3.`,
      };
    }

    const issa1 = issa1Sheet ? parseIssa1(workbook, issa1Sheet) : [];
    const issa2 = issa2Sheet ? parseIssa2(workbook, issa2Sheet) : [];
    const issa3 = issa3Sheet ? parseIssa3(workbook, issa3Sheet) : [];

    return {
      success: true,
      data: { issa1, issa2, issa3 },
    };
  } catch (error) {
    console.error("Worksheet parse error:", error);
    return {
      success: false,
      error: "Failed to parse the Excel file. Please check the file format.",
    };
  }
}
