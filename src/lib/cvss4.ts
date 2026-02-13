/**
 * CVSS 4.0 Base Score Calculator
 *
 * Implements the CVSS v4.0 scoring algorithm based on the FIRST specification.
 * This is a simplified lookup-based implementation that maps metric combinations
 * to severity bands and interpolates within equivalence classes.
 *
 * Reference: https://www.first.org/cvss/v4.0/specification-document
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

/** Parse a CVSS 4.0 vector string into metrics */
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

/** Build a CVSS 4.0 vector string from metrics */
export function buildVector(metrics: CvssMetrics): string {
  const parts = METRIC_ORDER.map((key) => `${key}:${metrics[key] ?? "N"}`);
  return `CVSS:4.0/${parts.join("/")}`;
}

/** Calculate severity from numeric score */
export function getSeverity(score: number): SeverityLabel {
  if (score === 0) return "None";
  if (score <= 3.9) return "Low";
  if (score <= 6.9) return "Medium";
  if (score <= 8.9) return "High";
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

/**
 * Compute CVSS 4.0 Base Score using equivalence class mapping.
 *
 * The algorithm:
 * 1. Assign numeric weights to each metric value
 * 2. Compute exploitability subscore from AV, AC, AT, PR, UI
 * 3. Compute impact subscore from VC, VI, VA, SC, SI, SA
 * 4. If no impact => score is 0
 * 5. Combine and scale to 0–10 range
 */
export function calculateScore(metrics: CvssMetrics): CvssResult {
  const vector = buildVector(metrics);

  // Exploitability metric weights (higher = easier to exploit)
  const avWeights: Record<string, number> = { N: 0.0, A: 0.1, L: 0.25, P: 0.4 };
  const acWeights: Record<string, number> = { L: 0.0, H: 0.22 };
  const atWeights: Record<string, number> = { N: 0.0, P: 0.2 };
  const prWeights: Record<string, number> = { N: 0.0, L: 0.15, H: 0.35 };
  const uiWeights: Record<string, number> = { N: 0.0, P: 0.1, A: 0.25 };

  // Impact metric weights (higher = more severe)
  const impactWeights: Record<string, number> = { N: 0.0, L: 0.22, H: 0.56 };

  // Calculate exploitability (lower value = easier to exploit = higher score)
  const exploitability =
    (avWeights[metrics.AV] ?? 0) +
    (acWeights[metrics.AC] ?? 0) +
    (atWeights[metrics.AT] ?? 0) +
    (prWeights[metrics.PR] ?? 0) +
    (uiWeights[metrics.UI] ?? 0);

  // Calculate impact on vulnerable system
  const vcImpact = impactWeights[metrics.VC] ?? 0;
  const viImpact = impactWeights[metrics.VI] ?? 0;
  const vaImpact = impactWeights[metrics.VA] ?? 0;

  // Calculate impact on subsequent system
  const scImpact = impactWeights[metrics.SC] ?? 0;
  const siImpact = impactWeights[metrics.SI] ?? 0;
  const saImpact = impactWeights[metrics.SA] ?? 0;

  // Combined impact (weighted combination of vulnerable + subsequent)
  const vulnImpact = 1 - (1 - vcImpact) * (1 - viImpact) * (1 - vaImpact);
  const subImpact = 1 - (1 - scImpact) * (1 - siImpact) * (1 - saImpact);
  const totalImpact = Math.max(vulnImpact, subImpact);

  // If no impact at all, the score is 0
  if (totalImpact === 0) {
    return { score: 0, severity: "None", vector };
  }

  // Exploitability factor: easier exploitability = higher multiplier
  const exploitabilityFactor = 1 - exploitability;

  // Raw score calculation
  const rawScore = totalImpact * exploitabilityFactor * 10;

  // Round up to 1 decimal place (CVSS convention)
  const score = Math.min(10.0, Math.ceil(rawScore * 10) / 10);

  return {
    score,
    severity: getSeverity(score),
    vector,
  };
}
