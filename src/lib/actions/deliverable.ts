"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deliverables, reports, users, customers, reportAttachments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { generateReportPDF } from "@/lib/pdf/generate-report-pdf";
import type { ReportAttachmentPDF } from "@/lib/pdf/generate-report-pdf";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { audit, checkDeleteRateLimit } from "@/lib/security";

// ─── List all deliverables ──────────────────────────────
export async function getDeliverablesAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({
        id: deliverables.id,
        reportId: deliverables.reportId,
        format: deliverables.format,
        fileUrl: deliverables.fileUrl,
        generatedBy: deliverables.generatedBy,
        generatedAt: deliverables.generatedAt,
        reportTitle: reports.title,
        reportIdCustom: reports.reportIdCustom,
        generatorUsername: users.username,
      })
      .from(deliverables)
      .innerJoin(reports, eq(deliverables.reportId, reports.id))
      .leftJoin(users, eq(deliverables.generatedBy, users.id))
      .orderBy(desc(deliverables.generatedAt));

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch deliverables:", error);
    return {
      success: false as const,
      error: "Failed to fetch deliverables",
      data: [],
    };
  }
}

// ─── Generate PDF deliverable for a report ──────────────
export async function generateReportPDFAction(reportId: string) {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false as const, error: "Unauthorized" };
  }

  try {
    // Fetch the full report with customer name
    const [report] = await db
      .select({
        id: reports.id,
        reportIdCustom: reports.reportIdCustom,
        title: reports.title,
        executiveSummary: reports.executiveSummary,
        scope: reports.scope,
        methodology: reports.methodology,
        referencesFramework: reports.referencesFramework,
        cvssVector: reports.cvssVector,
        impact: reports.impact,
        recommendationSummary: reports.recommendationSummary,
        auditDate: reports.auditDate,
        status: reports.status,
        createdAt: reports.createdAt,
        customerName: customers.name,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      return { success: false as const, error: "Report not found" };
    }

    // Fetch image attachments for Proof of Concept section
    const allAttachments = await db
      .select({
        fileName: reportAttachments.fileName,
        fileUrl: reportAttachments.fileUrl,
        mimeType: reportAttachments.mimeType,
      })
      .from(reportAttachments)
      .where(eq(reportAttachments.reportId, reportId));

    // Convert image attachments to base64 data URIs for embedding in PDF
    const imageAttachments: ReportAttachmentPDF[] = [];
    for (const a of allAttachments.filter((att) => att.mimeType.startsWith("image/"))) {
      try {
        const absPath = path.join(process.cwd(), "public", a.fileUrl);
        const fileBuffer = await fs.readFile(absPath);
        const base64 = fileBuffer.toString("base64");
        imageAttachments.push({
          fileName: a.fileName,
          dataUri: `data:${a.mimeType};base64,${base64}`,
          mimeType: a.mimeType,
        });
      } catch (err) {
        console.error(`Failed to read attachment file: ${a.fileUrl}`, err);
      }
    }

    // Generate the PDF
    const fileUrl = await generateReportPDF({ ...report, attachments: imageAttachments });

    // Compute SHA-256 hash of the generated PDF for integrity verification
    const pdfPath = path.join(process.cwd(), "public", fileUrl);
    const pdfBuffer = await fs.readFile(pdfPath);
    const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    // Insert deliverable record with hash
    await db.insert(deliverables).values({
      reportId,
      format: "PDF",
      fileUrl,
      sha256Hash,
      generatedBy: session.user.id,
    });

    await audit({ userId: session.user.id, action: "deliverable.generate", resourceId: reportId });

    // Notify the user that PDF was generated
    try {
      const { createNotification } = await import("@/lib/actions/notification");
      await createNotification({
        recipientId: session.user.id,
        category: "system",
        type: "pdf_generated",
        title: "PDF Generated Successfully",
        message: `PDF for "${report.title}" is ready for download.`,
        actionUrl: "/reports/deliverables",
      });
    } catch (err) {
      console.error("Failed to send PDF notification (non-blocking):", err);
    }

    revalidatePath("/reports/deliverables");
    return { success: true as const, fileUrl };
  } catch (error) {
    console.error("Failed to generate PDF:", error);

    // Notify user about failure
    try {
      const { createNotification } = await import("@/lib/actions/notification");
      await createNotification({
        recipientId: session.user.id,
        category: "system",
        type: "pdf_failed",
        title: "PDF Generation Failed",
        message: "An error occurred while generating the PDF. Please try again.",
        actionUrl: `/reports/${reportId}`,
      });
    } catch (_) {}

    return {
      success: false as const,
      error: "Failed to generate PDF deliverable",
    };
  }
}

// ─── Delete deliverable ─────────────────────────────────
export async function deleteDeliverableAction(deliverableId: string) {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false as const, error: "Only administrators can delete deliverables." };
  }

  // Rate limit delete operations
  const rl = checkDeleteRateLimit(session.user.id);
  if (!rl.allowed) {
    return { success: false as const, error: "Too many delete operations. Please slow down." };
  }

  try {
    // Fetch the deliverable to get the file URL
    const [deliverable] = await db
      .select({
        id: deliverables.id,
        fileUrl: deliverables.fileUrl,
      })
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) {
      return { success: false as const, error: "Deliverable not found." };
    }

    // Delete the physical file if it exists
    if (deliverable.fileUrl) {
      try {
        // fileUrl is relative like /uploads/reports/xxx.pdf
        const filePath = path.join(process.cwd(), "public", deliverable.fileUrl);
        await fs.unlink(filePath);
      } catch (fileError) {
        // File may already be deleted; log but don't fail
        console.warn("Could not delete physical file:", fileError);
      }
    }

    // Delete the DB record
    await db.delete(deliverables).where(eq(deliverables.id, deliverableId));

    await audit({ userId: session.user.id, action: "deliverable.delete", resourceId: deliverableId });
    revalidatePath("/reports/deliverables");
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete deliverable:", error);
    return {
      success: false as const,
      error: "Failed to delete deliverable.",
    };
  }
}

// ─── Verify deliverable integrity (SHA-256) ─────────────
export async function verifyDeliverableIntegrityAction(deliverableId: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", valid: false };
  }

  try {
    const [deliverable] = await db
      .select({
        id: deliverables.id,
        fileUrl: deliverables.fileUrl,
        sha256Hash: deliverables.sha256Hash,
      })
      .from(deliverables)
      .where(eq(deliverables.id, deliverableId))
      .limit(1);

    if (!deliverable) {
      return { success: false as const, error: "Deliverable not found", valid: false };
    }

    if (!deliverable.sha256Hash) {
      // Legacy deliverable without hash — skip verification
      return { success: true as const, valid: true, legacy: true };
    }

    const filePath = path.join(process.cwd(), "public", deliverable.fileUrl);
    const fileBuffer = await fs.readFile(filePath);
    const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const valid = currentHash === deliverable.sha256Hash;
    return { success: true as const, valid };
  } catch (error) {
    console.error("Integrity verification failed:", error);
    return { success: false as const, error: "Verification failed", valid: false };
  }
}
