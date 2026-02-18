"use server";

import { auth } from "@/lib/auth";

/* ─── Types ─────────────────────────────────────────── */

export interface GenerateReportInput {
  title: string;
  customerName: string;
  rawNotes: string;
  aiContext: string;
}

export interface GenerateReportResult {
  success: boolean;
  data?: {
    executive_summary: string;
    impact: string;
    recommendation: string;
  };
  error?: string;
}

/* ─── Server Action ─────────────────────────────────── */

export async function generateReportWithAI(
  formData: GenerateReportInput,
): Promise<GenerateReportResult> {
  /* ── Auth gate ── */
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Unauthorized. Only administrators and editors can use AI generation.",
    };
  }

  /* ── Validate input ── */
  if (!formData.rawNotes.trim()) {
    return { success: false, error: "Raw findings notes cannot be empty." };
  }
  if (!formData.title.trim()) {
    return { success: false, error: "Report title is required." };
  }

  /*
   * AI backend is not configured.
   * The UI is preserved but the generation functionality is disabled.
   */
  return {
    success: false,
    error:
      "AI generation is currently disabled. No AI provider is configured.",
  };
}
