import { NextRequest, NextResponse } from "next/server";
import {
  calculateScoreFromVector,
  validateVector,
} from "@/lib/cvss4";

/**
 * GET /api/cvss?q=CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N
 *
 * Calculates the CVSS v4.0 score for a given vector string using the
 * official FIRST MacroVector interpolation algorithm.
 */
export async function GET(req: NextRequest) {
  const vectorString = req.nextUrl.searchParams.get("q");

  if (!vectorString) {
    return NextResponse.json(
      { error: "Missing vector string. Use ?q=CVSS:4.0/..." },
      { status: 400 },
    );
  }

  const validation = validateVector(vectorString);
  if (!validation.valid) {
    return NextResponse.json(
      { vector: vectorString, score: "error", severity: "error", error: validation.error },
      { status: 400 },
    );
  }

  try {
    const result = calculateScoreFromVector(vectorString);

    return NextResponse.json({
      vector: result.vector,
      score: result.score,
      severity: result.severity,
    });
  } catch (error) {
    console.error("Error calculating CVSS score:", error);
    return NextResponse.json(
      { error: "Error calculating CVSS score" },
      { status: 500 },
    );
  }
}
