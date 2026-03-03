/**
 * CVSS 4.0 Base Score Calculator
 *
 * Implements the official CVSS v4.0 scoring algorithm from FIRST.
 * Uses MacroVector lookup tables and equivalence class interpolation
 * for accurate scoring per the specification.
 *
 * Ported from: https://github.com/akshatvaid/cvss-v4-node-api
 * Reference: https://www.first.org/cvss/v4.0/specification-document
 *
 * Copyright FIRST, Red Hat, and contributors
 * SPDX-License-Identifier: BSD-2-Clause
 */

export interface CvssMetrics {
  AV: string;  // Attack Vector
  AC: string;  // Attack Complexity
  AT: string;  // Attack Requirements
  PR: string;  // Privileges Required
  UI: string;  // User Interaction
  VC: string;  // Confidentiality (Vulnerable System)
  VI: string;  // Integrity (Vulnerable System)
  VA: string;  // Availability (Vulnerable System)
  SC: string;  // Confidentiality (Subsequent System)
  SI: string;  // Integrity (Subsequent System)
  SA: string;  // Availability (Subsequent System)
}

/** Extended metrics including optional Threat/Environmental/Supplemental */
export interface CvssSelectedMetrics {
  [key: string]: string;
}

export type SeverityLabel = "None" | "Low" | "Medium" | "High" | "Critical";

export interface CvssResult {
  score: number;
  severity: SeverityLabel;
  vector: string;
}

const METRIC_ORDER = ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"] as const;

/** Metric descriptions for tooltips */
export const METRIC_TOOLTIPS: Record<string, string> = {
  AV: "Attack Vector (AV) — Reflects how the vulnerability is exploited. Network: remotely exploitable. Adjacent: requires proximity (e.g. Bluetooth, WiFi). Local: requires local access. Physical: requires physical device access.",
  AC: "Attack Complexity (AC) — Describes conditions beyond the attacker's control that must exist to exploit the vulnerability. Low: no special conditions. High: requires specific conditions (race conditions, non-default configs).",
  AT: "Attack Requirements (AT) — Captures prerequisites beyond AC. None: no additional requirements. Present: some pre-condition must be met (e.g. a victim must perform a specific action).",
  PR: "Privileges Required (PR) — Level of privileges an attacker must possess before exploiting. None: no prior access. Low: basic user-level. High: admin/root-level.",
  UI: "User Interaction (UI) — Whether exploitation requires a user to perform some action. None: no interaction needed. Passive: limited interaction (e.g. viewing a page). Active: user must actively interact (e.g. click a link, install software).",
  VC: "Confidentiality Impact to Vulnerable System (VC) — Measures information disclosure impact on the directly vulnerable component. None: no impact. Low: some restricted info disclosed. High: total loss of confidentiality.",
  VI: "Integrity Impact to Vulnerable System (VI) — Measures data modification impact on the vulnerable component. None: no impact. Low: some data can be modified. High: total loss of integrity.",
  VA: "Availability Impact to Vulnerable System (VA) — Measures disruption to the vulnerable component. None: no impact. Low: reduced performance. High: total loss of availability.",
  SC: "Confidentiality Impact to Subsequent System (SC) — Information disclosure impact on systems beyond the vulnerable component (e.g. downstream services). None: no impact. Low: limited disclosure. High: total loss.",
  SI: "Integrity Impact to Subsequent System (SI) — Data modification impact on subsequent systems. None: no impact. Low: limited modification. High: total loss of integrity.",
  SA: "Availability Impact to Subsequent System (SA) — Disruption impact on subsequent systems. None: no impact. Low: limited disruption. High: total loss of availability.",
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Official CVSS v4.0 Lookup Tables (from FIRST specification)
 * ═══════════════════════════════════════════════════════════════════════════ */

const cvssLookup: Record<string, number> = {
  "000000": 10, "000001": 9.9, "000010": 9.8, "000011": 9.5,
  "000020": 9.5, "000021": 9.2, "000100": 10, "000101": 9.6,
  "000110": 9.3, "000111": 8.7, "000120": 9.1, "000121": 8.1,
  "000200": 9.3, "000201": 9, "000210": 8.9, "000211": 8,
  "000220": 8.1, "000221": 6.8, "001000": 9.8, "001001": 9.5,
  "001010": 9.5, "001011": 9.2, "001020": 9, "001021": 8.4,
  "001100": 9.3, "001101": 9.2, "001110": 8.9, "001111": 8.1,
  "001120": 8.1, "001121": 6.5, "001200": 8.8, "001201": 8,
  "001210": 7.8, "001211": 7, "001220": 6.9, "001221": 4.8,
  "002001": 9.2, "002011": 8.2, "002021": 7.2, "002101": 7.9,
  "002111": 6.9, "002121": 5, "002201": 6.9, "002211": 5.5,
  "002221": 2.7, "010000": 9.9, "010001": 9.7, "010010": 9.5,
  "010011": 9.2, "010020": 9.2, "010021": 8.5, "010100": 9.5,
  "010101": 9.1, "010110": 9, "010111": 8.3, "010120": 8.4,
  "010121": 7.1, "010200": 9.2, "010201": 8.1, "010210": 8.2,
  "010211": 7.1, "010220": 7.2, "010221": 5.3, "011000": 9.5,
  "011001": 9.3, "011010": 9.2, "011011": 8.5, "011020": 8.5,
  "011021": 7.3, "011100": 9.2, "011101": 8.2, "011110": 8,
  "011111": 7.2, "011120": 7, "011121": 5.9, "011200": 8.4,
  "011201": 7, "011210": 7.1, "011211": 5.2, "011220": 5,
  "011221": 3, "012001": 8.6, "012011": 7.5, "012021": 5.2,
  "012101": 7.1, "012111": 5.2, "012121": 2.9, "012201": 6.3,
  "012211": 2.9, "012221": 1.7, "100000": 9.8, "100001": 9.5,
  "100010": 9.4, "100011": 8.7, "100020": 9.1, "100021": 8.1,
  "100100": 9.4, "100101": 8.9, "100110": 8.6, "100111": 7.4,
  "100120": 7.7, "100121": 6.4, "100200": 8.7, "100201": 7.5,
  "100210": 7.4, "100211": 6.3, "100220": 6.3, "100221": 4.9,
  "101000": 9.4, "101001": 8.9, "101010": 8.8, "101011": 7.7,
  "101020": 7.6, "101021": 6.7, "101100": 8.6, "101101": 7.6,
  "101110": 7.4, "101111": 5.8, "101120": 5.9, "101121": 5,
  "101200": 7.2, "101201": 5.7, "101210": 5.7, "101211": 5.2,
  "101220": 5.2, "101221": 2.5, "102001": 8.3, "102011": 7,
  "102021": 5.4, "102101": 6.5, "102111": 5.8, "102121": 2.6,
  "102201": 5.3, "102211": 2.1, "102221": 1.3, "110000": 9.5,
  "110001": 9, "110010": 8.8, "110011": 7.6, "110020": 7.6,
  "110021": 7, "110100": 9, "110101": 7.7, "110110": 7.5,
  "110111": 6.2, "110120": 6.1, "110121": 5.3, "110200": 7.7,
  "110201": 6.6, "110210": 6.8, "110211": 5.9, "110220": 5.2,
  "110221": 3, "111000": 8.9, "111001": 7.8, "111010": 7.6,
  "111011": 6.7, "111020": 6.2, "111021": 5.8, "111100": 7.4,
  "111101": 5.9, "111110": 5.7, "111111": 5.7, "111120": 4.7,
  "111121": 2.3, "111200": 6.1, "111201": 5.2, "111210": 5.7,
  "111211": 2.9, "111220": 2.4, "111221": 1.6, "112001": 7.1,
  "112011": 5.9, "112021": 3, "112101": 5.8, "112111": 2.6,
  "112121": 1.5, "112201": 2.3, "112211": 1.3, "112221": 0.6,
  "200000": 9.3, "200001": 8.7, "200010": 8.6, "200011": 7.2,
  "200020": 7.5, "200021": 5.8, "200100": 8.6, "200101": 7.4,
  "200110": 7.4, "200111": 6.1, "200120": 5.6, "200121": 3.4,
  "200200": 7, "200201": 5.4, "200210": 5.2, "200211": 4,
  "200220": 4, "200221": 2.2, "201000": 8.5, "201001": 7.5,
  "201010": 7.4, "201011": 5.5, "201020": 6.2, "201021": 5.1,
  "201100": 7.2, "201101": 5.7, "201110": 5.5, "201111": 4.1,
  "201120": 4.6, "201121": 1.9, "201200": 5.3, "201201": 3.6,
  "201210": 3.4, "201211": 1.9, "201220": 1.9, "201221": 0.8,
  "202001": 6.4, "202011": 5.1, "202021": 2, "202101": 4.7,
  "202111": 2.1, "202121": 1.1, "202201": 2.4, "202211": 0.9,
  "202221": 0.4, "210000": 8.8, "210001": 7.5, "210010": 7.3,
  "210011": 5.3, "210020": 6, "210021": 5, "210100": 7.3,
  "210101": 5.5, "210110": 5.9, "210111": 4, "210120": 4.1,
  "210121": 2, "210200": 5.4, "210201": 4.3, "210210": 4.5,
  "210211": 2.2, "210220": 2, "210221": 1.1, "211000": 7.5,
  "211001": 5.5, "211010": 5.8, "211011": 4.5, "211020": 4,
  "211021": 2.1, "211100": 6.1, "211101": 5.1, "211110": 4.8,
  "211111": 1.8, "211120": 2, "211121": 0.9, "211200": 4.6,
  "211201": 1.8, "211210": 1.7, "211211": 0.7, "211220": 0.8,
  "211221": 0.2, "212001": 5.3, "212011": 2.4, "212021": 1.4,
  "212101": 2.4, "212111": 1.2, "212121": 0.5, "212201": 1,
  "212211": 0.3, "212221": 0.1,
};

/** Max severity distances per equivalence class (from FIRST spec) */
const maxSeverityData: Record<string, Record<number, number | Record<number, number>>> = {
  eq1: { 0: 1, 1: 4, 2: 5 },
  eq2: { 0: 1, 1: 2 },
  eq3eq6: {
    0: { 0: 7, 1: 6 },
    1: { 0: 8, 1: 8 },
    2: { 1: 10 },
  },
  eq4: { 0: 6, 1: 5, 2: 4 },
  eq5: { 0: 1, 1: 1, 2: 1 },
};

/** Maximum composed vectors per equivalence class */
const maxComposed: Record<string, Record<number, string[] | Record<number, string[]>>> = {
  eq1: {
    0: ["AV:N/PR:N/UI:N/"],
    1: ["AV:A/PR:N/UI:N/", "AV:N/PR:L/UI:N/", "AV:N/PR:N/UI:P/"],
    2: ["AV:P/PR:N/UI:N/", "AV:A/PR:L/UI:P/"],
  },
  eq2: {
    0: ["AC:L/AT:N/"],
    1: ["AC:H/AT:N/", "AC:L/AT:P/"],
  },
  eq3: {
    0: { 0: ["VC:H/VI:H/VA:H/CR:H/IR:H/AR:H/"], 1: ["VC:H/VI:H/VA:L/CR:M/IR:M/AR:H/", "VC:H/VI:H/VA:H/CR:M/IR:M/AR:M/"] },
    1: { 0: ["VC:L/VI:H/VA:H/CR:H/IR:H/AR:H/", "VC:H/VI:L/VA:H/CR:H/IR:H/AR:H/"], 1: ["VC:L/VI:H/VA:L/CR:H/IR:M/AR:H/", "VC:L/VI:H/VA:H/CR:H/IR:M/AR:M/", "VC:H/VI:L/VA:H/CR:M/IR:H/AR:M/", "VC:H/VI:L/VA:L/CR:M/IR:H/AR:H/", "VC:L/VI:L/VA:H/CR:H/IR:H/AR:M/"] },
    2: { 1: ["VC:L/VI:L/VA:L/CR:H/IR:H/AR:H/"] },
  },
  eq4: {
    0: ["SC:H/SI:S/SA:S/"],
    1: ["SC:H/SI:H/SA:H/"],
    2: ["SC:L/SI:L/SA:L/"],
  },
  eq5: {
    0: ["E:A/"],
    1: ["E:P/"],
    2: ["E:U/"],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Core Utility Functions
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Parse a CVSS 4.0 vector string into base metrics */
export function parseVector(vector: string): CvssMetrics {
  const defaults: CvssMetrics = {
    AV: "N", AC: "L", AT: "N", PR: "N", UI: "N",
    VC: "N", VI: "N", VA: "N", SC: "N", SI: "N", SA: "N",
  };

  if (!vector || !vector.startsWith("CVSS:4.0/")) return defaults;

  const parts = vector.replace("CVSS:4.0/", "").split("/");
  for (const p of parts) {
    const [k, v] = p.split(":");
    if (k && v && k in defaults) {
      (defaults as unknown as Record<string, string>)[k] = v;
    }
  }
  return defaults;
}

/**
 * Parse a full CVSS 4.0 vector string into all metrics (including optional
 * Threat, Environmental, and Supplemental metrics) with defaults filled.
 */
export function parseVectorFull(vector: string): CvssSelectedMetrics {
  const metrics: CvssSelectedMetrics = {};

  if (!vector || !vector.startsWith("CVSS:4.0/")) return metrics;

  const parts = vector.replace("CVSS:4.0/", "").split("/");
  for (const p of parts) {
    const [k, v] = p.split(":");
    if (k && v) metrics[k] = v;
  }

  // Fill defaults for optional metrics
  if (!("E" in metrics)) metrics["E"] = "X";
  if (!("CR" in metrics)) metrics["CR"] = "X";
  if (!("IR" in metrics)) metrics["IR"] = "X";
  if (!("AR" in metrics)) metrics["AR"] = "X";

  return metrics;
}

/** Build a CVSS 4.0 vector string from base metrics */
export function buildVector(metrics: CvssMetrics): string {
  const parts = METRIC_ORDER.map((key) => `${key}:${metrics[key] ?? "N"}`);
  return `CVSS:4.0/${parts.join("/")}`;
}

/** Calculate severity label from numeric score */
export function getSeverity(score: number): SeverityLabel {
  if (score === 0) return "None";
  if (score < 4.0) return "Low";
  if (score < 7.0) return "Medium";
  if (score < 9.0) return "High";
  return "Critical";
}

/** Severity badge colors */
export function getSeverityColor(severity: SeverityLabel): string {
  switch (severity) {
    case "None": return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    case "Low": return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "Medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300";
    case "High": return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
    case "Critical": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Official CVSS v4.0 Scoring Algorithm (ported from FIRST reference impl)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Resolve effective metric value (handles environmental overrides and "X" defaults) */
function m(cvssSelected: CvssSelectedMetrics, metric: string): string {
  const selected = cvssSelected[metric];

  // E=X defaults to worst case E=A
  if (metric === "E" && selected === "X") return "A";
  // CR/IR/AR=X defaults to H
  if (metric === "CR" && selected === "X") return "H";
  if (metric === "IR" && selected === "X") return "H";
  if (metric === "AR" && selected === "X") return "H";

  // Environmental modified metrics override base values
  if (("M" + metric) in cvssSelected) {
    const modifiedSelected = cvssSelected["M" + metric];
    if (modifiedSelected !== "X") return modifiedSelected;
  }

  return selected;
}

/** Extract a metric value from a composed vector string */
function extractValueMetric(metric: string, str: string): string {
  let extracted = str.slice(str.indexOf(metric) + metric.length + 1);
  if (extracted.indexOf("/") > 0) {
    return extracted.substring(0, extracted.indexOf("/"));
  }
  return extracted;
}

/** Get the maximum vectors for an equivalence class level */
function getEQMaxes(macroVectorStr: string, eq: number): string[] | Record<number, string[]> {
  const eqData = maxComposed["eq" + eq];
  return eqData[parseInt(macroVectorStr[eq - 1])] as string[] | Record<number, string[]>;
}

/** Compute the 6-digit MacroVector from selected metrics */
export function computeMacroVector(cvssSelected: CvssSelectedMetrics): string {
  let eq1: string, eq2: string, eq3: number, eq4: number, eq5: number, eq6: number;

  // EQ1: Exploitability (AV, PR, UI)
  if (m(cvssSelected, "AV") === "N" && m(cvssSelected, "PR") === "N" && m(cvssSelected, "UI") === "N") {
    eq1 = "0";
  } else if (
    (m(cvssSelected, "AV") === "N" || m(cvssSelected, "PR") === "N" || m(cvssSelected, "UI") === "N") &&
    !(m(cvssSelected, "AV") === "N" && m(cvssSelected, "PR") === "N" && m(cvssSelected, "UI") === "N") &&
    m(cvssSelected, "AV") !== "P"
  ) {
    eq1 = "1";
  } else {
    eq1 = "2";
  }

  // EQ2: Complexity (AC, AT)
  if (m(cvssSelected, "AC") === "L" && m(cvssSelected, "AT") === "N") {
    eq2 = "0";
  } else {
    eq2 = "1";
  }

  // EQ3: Vulnerable system impact (VC, VI, VA)
  if (m(cvssSelected, "VC") === "H" && m(cvssSelected, "VI") === "H") {
    eq3 = 0;
  } else if (
    !(m(cvssSelected, "VC") === "H" && m(cvssSelected, "VI") === "H") &&
    (m(cvssSelected, "VC") === "H" || m(cvssSelected, "VI") === "H" || m(cvssSelected, "VA") === "H")
  ) {
    eq3 = 1;
  } else {
    eq3 = 2;
  }

  // EQ4: Subsequent system impact (SC, SI, SA + MSI, MSA)
  if (m(cvssSelected, "MSI") === "S" || m(cvssSelected, "MSA") === "S") {
    eq4 = 0;
  } else if (
    !(m(cvssSelected, "MSI") === "S" || m(cvssSelected, "MSA") === "S") &&
    (m(cvssSelected, "SC") === "H" || m(cvssSelected, "SI") === "H" || m(cvssSelected, "SA") === "H")
  ) {
    eq4 = 1;
  } else {
    eq4 = 2;
  }

  // EQ5: Exploitation (E)
  if (m(cvssSelected, "E") === "A") {
    eq5 = 0;
  } else if (m(cvssSelected, "E") === "P") {
    eq5 = 1;
  } else {
    eq5 = 2;
  }

  // EQ6: Security requirements (CR, IR, AR + VC, VI, VA)
  if (
    (m(cvssSelected, "CR") === "H" && m(cvssSelected, "VC") === "H") ||
    (m(cvssSelected, "IR") === "H" && m(cvssSelected, "VI") === "H") ||
    (m(cvssSelected, "AR") === "H" && m(cvssSelected, "VA") === "H")
  ) {
    eq6 = 0;
  } else {
    eq6 = 1;
  }

  return `${eq1}${eq2}${eq3}${eq4}${eq5}${eq6}`;
}

/**
 * Compute the official CVSS v4.0 score using the MacroVector interpolation algorithm.
 *
 * This is a faithful port of the FIRST reference implementation.
 */
function computeOfficialScore(cvssSelected: CvssSelectedMetrics): number {
  // Severity distance level maps
  const AV_levels: Record<string, number> = { N: 0.0, A: 0.1, L: 0.2, P: 0.3 };
  const PR_levels: Record<string, number> = { N: 0.0, L: 0.1, H: 0.2 };
  const UI_levels: Record<string, number> = { N: 0.0, P: 0.1, A: 0.2 };
  const AC_levels: Record<string, number> = { L: 0.0, H: 0.1 };
  const AT_levels: Record<string, number> = { N: 0.0, P: 0.1 };
  const VC_levels: Record<string, number> = { H: 0.0, L: 0.1, N: 0.2 };
  const VI_levels: Record<string, number> = { H: 0.0, L: 0.1, N: 0.2 };
  const VA_levels: Record<string, number> = { H: 0.0, L: 0.1, N: 0.2 };
  const SC_levels: Record<string, number> = { H: 0.1, L: 0.2, N: 0.3 };
  const SI_levels: Record<string, number> = { S: 0.0, H: 0.1, L: 0.2, N: 0.3 };
  const SA_levels: Record<string, number> = { S: 0.0, H: 0.1, L: 0.2, N: 0.3 };
  const CR_levels: Record<string, number> = { H: 0.0, M: 0.1, L: 0.2 };
  const IR_levels: Record<string, number> = { H: 0.0, M: 0.1, L: 0.2 };
  const AR_levels: Record<string, number> = { H: 0.0, M: 0.1, L: 0.2 };

  // Shortcut: no impact at all → 0.0
  if (["VC", "VI", "VA", "SC", "SI", "SA"].every((metric) => m(cvssSelected, metric) === "N")) {
    return 0.0;
  }

  const macroVectorResult = computeMacroVector(cvssSelected);
  let value = cvssLookup[macroVectorResult];

  if (value === undefined) return 0.0;

  // Parse EQ digits
  const eq1 = parseInt(macroVectorResult[0]);
  const eq2 = parseInt(macroVectorResult[1]);
  const eq3 = parseInt(macroVectorResult[2]);
  const eq4 = parseInt(macroVectorResult[3]);
  const eq5 = parseInt(macroVectorResult[4]);
  const eq6 = parseInt(macroVectorResult[5]);

  // Compute next lower macro vectors
  const eq1_next = `${eq1 + 1}${eq2}${eq3}${eq4}${eq5}${eq6}`;
  const eq2_next = `${eq1}${eq2 + 1}${eq3}${eq4}${eq5}${eq6}`;

  let score_eq3eq6_next: number;
  if (eq3 === 0 && eq6 === 0) {
    const left = cvssLookup[`${eq1}${eq2}${eq3}${eq4}${eq5}${eq6 + 1}`];
    const right = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
    score_eq3eq6_next = (left > right) ? left : right;
  } else if (eq3 === 1 && eq6 === 1) {
    score_eq3eq6_next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
  } else if (eq3 === 0 && eq6 === 1) {
    score_eq3eq6_next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
  } else if (eq3 === 1 && eq6 === 0) {
    score_eq3eq6_next = cvssLookup[`${eq1}${eq2}${eq3}${eq4}${eq5}${eq6 + 1}`];
  } else {
    score_eq3eq6_next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6 + 1}`];
  }

  const eq4_next = `${eq1}${eq2}${eq3}${eq4 + 1}${eq5}${eq6}`;
  const eq5_next = `${eq1}${eq2}${eq3}${eq4}${eq5 + 1}${eq6}`;

  const score_eq1_next = cvssLookup[eq1_next];
  const score_eq2_next = cvssLookup[eq2_next];
  const score_eq4_next = cvssLookup[eq4_next];
  const score_eq5_next = cvssLookup[eq5_next];

  // Get max vectors and compose them
  const eq1_maxes = getEQMaxes(macroVectorResult, 1) as string[];
  const eq2_maxes = getEQMaxes(macroVectorResult, 2) as string[];
  const eq3_eq6_raw = getEQMaxes(macroVectorResult, 3) as Record<number, string[]>;
  const eq3_eq6_maxes = eq3_eq6_raw[parseInt(macroVectorResult[5])] ?? [];
  const eq4_maxes = getEQMaxes(macroVectorResult, 4) as string[];
  const eq5_maxes = getEQMaxes(macroVectorResult, 5) as string[];

  const max_vectors: string[] = [];
  for (const e1 of eq1_maxes) {
    for (const e2 of eq2_maxes) {
      for (const e36 of eq3_eq6_maxes) {
        for (const e4 of eq4_maxes) {
          for (const e5 of eq5_maxes) {
            max_vectors.push(e1 + e2 + e36 + e4 + e5);
          }
        }
      }
    }
  }

  // Find the max vector with all non-negative severity distances
  let severity_distance_AV = 0, severity_distance_PR = 0, severity_distance_UI = 0;
  let severity_distance_AC = 0, severity_distance_AT = 0;
  let severity_distance_VC = 0, severity_distance_VI = 0, severity_distance_VA = 0;
  let severity_distance_SC = 0, severity_distance_SI = 0, severity_distance_SA = 0;
  let severity_distance_CR = 0, severity_distance_IR = 0, severity_distance_AR = 0;

  for (const max_vector of max_vectors) {
    severity_distance_AV = AV_levels[m(cvssSelected, "AV")] - AV_levels[extractValueMetric("AV", max_vector)];
    severity_distance_PR = PR_levels[m(cvssSelected, "PR")] - PR_levels[extractValueMetric("PR", max_vector)];
    severity_distance_UI = UI_levels[m(cvssSelected, "UI")] - UI_levels[extractValueMetric("UI", max_vector)];
    severity_distance_AC = AC_levels[m(cvssSelected, "AC")] - AC_levels[extractValueMetric("AC", max_vector)];
    severity_distance_AT = AT_levels[m(cvssSelected, "AT")] - AT_levels[extractValueMetric("AT", max_vector)];
    severity_distance_VC = VC_levels[m(cvssSelected, "VC")] - VC_levels[extractValueMetric("VC", max_vector)];
    severity_distance_VI = VI_levels[m(cvssSelected, "VI")] - VI_levels[extractValueMetric("VI", max_vector)];
    severity_distance_VA = VA_levels[m(cvssSelected, "VA")] - VA_levels[extractValueMetric("VA", max_vector)];
    severity_distance_SC = SC_levels[m(cvssSelected, "SC")] - SC_levels[extractValueMetric("SC", max_vector)];
    severity_distance_SI = SI_levels[m(cvssSelected, "SI")] - SI_levels[extractValueMetric("SI", max_vector)];
    severity_distance_SA = SA_levels[m(cvssSelected, "SA")] - SA_levels[extractValueMetric("SA", max_vector)];
    severity_distance_CR = CR_levels[m(cvssSelected, "CR")] - CR_levels[extractValueMetric("CR", max_vector)];
    severity_distance_IR = IR_levels[m(cvssSelected, "IR")] - IR_levels[extractValueMetric("IR", max_vector)];
    severity_distance_AR = AR_levels[m(cvssSelected, "AR")] - AR_levels[extractValueMetric("AR", max_vector)];

    if (
      [severity_distance_AV, severity_distance_PR, severity_distance_UI,
       severity_distance_AC, severity_distance_AT,
       severity_distance_VC, severity_distance_VI, severity_distance_VA,
       severity_distance_SC, severity_distance_SI, severity_distance_SA,
       severity_distance_CR, severity_distance_IR, severity_distance_AR,
      ].some((d) => d < 0)
    ) {
      continue;
    }
    break;
  }

  // Compute current severity distances per EQ group
  const current_eq1 = severity_distance_AV + severity_distance_PR + severity_distance_UI;
  const current_eq2 = severity_distance_AC + severity_distance_AT;
  const current_eq3eq6 = severity_distance_VC + severity_distance_VI + severity_distance_VA + severity_distance_CR + severity_distance_IR + severity_distance_AR;
  const current_eq4 = severity_distance_SC + severity_distance_SI + severity_distance_SA;

  const step = 0.1;

  // Available distances (NaN if next lower doesn't exist)
  const available_eq1 = value - score_eq1_next;
  const available_eq2 = value - score_eq2_next;
  const available_eq3eq6 = value - score_eq3eq6_next;
  const available_eq4 = value - score_eq4_next;
  const available_eq5 = value - score_eq5_next;

  let n_existing_lower = 0;
  let normalized_eq1 = 0, normalized_eq2 = 0, normalized_eq3eq6 = 0, normalized_eq4 = 0, normalized_eq5 = 0;

  const maxSev_eq1 = (maxSeverityData.eq1[eq1] as number) * step;
  const maxSev_eq2 = (maxSeverityData.eq2[eq2] as number) * step;
  const eq3eq6Data = maxSeverityData.eq3eq6[eq3] as Record<number, number>;
  const maxSev_eq3eq6 = (eq3eq6Data?.[eq6] ?? 1) * step;
  const maxSev_eq4 = (maxSeverityData.eq4[eq4] as number) * step;

  if (!isNaN(available_eq1)) {
    n_existing_lower++;
    normalized_eq1 = available_eq1 * (current_eq1 / maxSev_eq1);
  }
  if (!isNaN(available_eq2)) {
    n_existing_lower++;
    normalized_eq2 = available_eq2 * (current_eq2 / maxSev_eq2);
  }
  if (!isNaN(available_eq3eq6)) {
    n_existing_lower++;
    normalized_eq3eq6 = available_eq3eq6 * (current_eq3eq6 / maxSev_eq3eq6);
  }
  if (!isNaN(available_eq4)) {
    n_existing_lower++;
    normalized_eq4 = available_eq4 * (current_eq4 / maxSev_eq4);
  }
  if (!isNaN(available_eq5)) {
    n_existing_lower++;
    // EQ5 percentage is always 0
    normalized_eq5 = 0;
  }

  const mean_distance = n_existing_lower === 0
    ? 0
    : (normalized_eq1 + normalized_eq2 + normalized_eq3eq6 + normalized_eq4 + normalized_eq5) / n_existing_lower;

  value -= mean_distance;
  if (value < 0) value = 0.0;
  if (value > 10) value = 10.0;

  return Math.round(value * 10) / 10;
}

/**
 * Compute CVSS 4.0 Score using the official FIRST MacroVector algorithm.
 *
 * Accepts base CvssMetrics and computes the accurate score using lookup
 * tables and equivalence class interpolation.
 */
export function calculateScore(metrics: CvssMetrics): CvssResult {
  const vector = buildVector(metrics);

  // Build the full selected metrics with defaults for optional parameters
  const cvssSelected: CvssSelectedMetrics = { ...metrics };
  if (!("E" in cvssSelected)) cvssSelected["E"] = "X";
  if (!("CR" in cvssSelected)) cvssSelected["CR"] = "X";
  if (!("IR" in cvssSelected)) cvssSelected["IR"] = "X";
  if (!("AR" in cvssSelected)) cvssSelected["AR"] = "X";

  const score = computeOfficialScore(cvssSelected);

  return {
    score,
    severity: getSeverity(score),
    vector,
  };
}

/**
 * Compute CVSS 4.0 Score from a raw vector string.
 * Supports full vectors including Threat, Environmental, and Supplemental metrics.
 */
export function calculateScoreFromVector(vectorString: string): CvssResult {
  const cvssSelected = parseVectorFull(vectorString);

  if (Object.keys(cvssSelected).length === 0) {
    return { score: 0, severity: "None", vector: vectorString };
  }

  const score = computeOfficialScore(cvssSelected);

  return {
    score,
    severity: getSeverity(score),
    vector: vectorString,
  };
}

/** Validate a CVSS 4.0 vector string */
export function validateVector(vectorString: string): { valid: boolean; error?: string } {
  const mandatoryMetrics = ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"];

  const metrics = vectorString.split("/");
  const prefix = metrics[0];
  if (prefix !== "CVSS:4.0") {
    return { valid: false, error: "Invalid vector prefix" };
  }

  metrics.shift();
  const seen: Record<string, string> = {};

  for (const metric of metrics) {
    const [key, value] = metric.split(":");
    if (!key || !value) {
      return { valid: false, error: `Invalid metric format: ${metric}` };
    }
    if (key in seen) {
      return { valid: false, error: `Repeated metric: ${key}` };
    }
    seen[key] = value;
  }

  const missing = mandatoryMetrics.filter((m) => !(m in seen));
  if (missing.length > 0) {
    return { valid: false, error: `Missing mandatory metrics: ${missing.join(", ")}` };
  }

  return { valid: true };
}
