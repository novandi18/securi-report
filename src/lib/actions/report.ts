"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reports, customers, users, reportAttachments, deliverables } from "@/lib/db/schema";
import {
  reportCreateSchema,
  reportUpdateSchema,
} from "@/lib/validations/report";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncDocument, removeDocument, INDEX } from "@/lib/meilisearch";
import { existsSync } from "fs";
import { unlink, readFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sanitizeMarkdown, audit, checkDeleteRateLimit } from "@/lib/security";
import { generateReportPDF, type ReportPDFData } from "@/lib/pdf/generate-report-pdf";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
};

// ─── Auto-generate report_id_custom ────────────────────────
// Format: PEN-DOC-YYYYMMDDHHmmss-XXX  (timestamp + random suffix for uniqueness)
function generateReportId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PEN-DOC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}`;
}

// ─── List all reports (with customer names) ──────
export async function getReportsAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  const role = session.user.role;

  try {
    const query = db
      .select({
        id: reports.id,
        customerId: reports.customerId,
        reportIdCustom: reports.reportIdCustom,
        title: reports.title,
        status: reports.status,
        cvssVector: reports.cvssVector,
        auditDate: reports.auditDate,
        createdBy: reports.createdBy,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        customerName: customers.name,
        creatorUsername: users.username,
        pdfUrl: sql<string | null>`(
          SELECT d.file_url FROM deliverables d
          WHERE d.report_id = ${reports.id} AND d.format = 'PDF'
          ORDER BY d.generated_at DESC LIMIT 1
        )`.as("pdf_url"),
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .leftJoin(users, eq(reports.createdBy, users.id));

    // Viewer can only see Open reports
    const data =
      role === "viewer"
        ? await query
            .where(eq(reports.status, "Open"))
            .orderBy(desc(reports.createdAt))
        : await query.orderBy(desc(reports.createdAt));

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return {
      success: false as const,
      error: "Failed to fetch reports",
      data: [],
    };
  }
}

// ─── Get single report ──────────────────────────────────
export async function getReportAction(id: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [report] = await db
      .select({
        id: reports.id,
        customerId: reports.customerId,
        reportIdCustom: reports.reportIdCustom,
        title: reports.title,
        clientCode: reports.clientCode,
        serviceAffected: reports.serviceAffected,
        findingSequence: reports.findingSequence,
        issueReferenceNumber: reports.issueReferenceNumber,
        severity: reports.severity,
        location: reports.location,
        description: reports.description,
        pocText: reports.pocText,
        referencesList: reports.referencesList,
        cvssVector: reports.cvssVector,
        cvssScore: reports.cvssScore,
        impact: reports.impact,
        recommendation: reports.recommendation,
        auditDate: reports.auditDate,
        status: reports.status,
        createdBy: reports.createdBy,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        customerName: customers.name,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .where(eq(reports.id, id))
      .limit(1);

    if (!report) {
      return { success: false as const, error: "Report not found", data: null };
    }

    // Viewer can only view Open reports
    if (session.user.role === "viewer" && report.status !== "Open") {
      return { success: false as const, error: "Report not found", data: null };
    }

    return { success: true as const, data: report };
  } catch (error) {
    console.error("Failed to fetch report:", error);
    return { success: false as const, error: "Failed to fetch report", data: null };
  }
}

// ─── List customers (for dropdown) ─────
export async function getCustomersForSelectAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({ id: customers.id, name: customers.name, code: customers.code })
      .from(customers)
      .orderBy(customers.name);

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { success: false as const, error: "Failed to fetch customers", data: [] };
  }
}

// ─── Create report ──────────────────────────────────────
export async function createReportAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Only administrators and editors can create reports." };
  }

  const raw = {
    customerId: formData.get("customerId") as string,
    reportIdCustom: formData.get("reportIdCustom") as string,
    title: formData.get("title") as string,
    clientCode: formData.get("clientCode") as string,
    serviceAffected: formData.get("serviceAffected") as string,
    findingSequence: formData.get("findingSequence") as string,
    issueReferenceNumber: formData.get("issueReferenceNumber") as string,
    severity: (formData.get("severity") as string) || "Info",
    location: formData.get("location") as string,
    description: formData.get("description") as string,
    pocText: formData.get("pocText") as string,
    referencesList: formData.get("referencesList") as string,
    cvssVector: formData.get("cvssVector") as string,
    cvssScore: formData.get("cvssScore") as string,
    impact: formData.get("impact") as string,
    recommendation: formData.get("recommendation") as string,
    auditDate: (formData.get("auditDate") as string) ?? "",
    status: (formData.get("status") as string) || "Draft",
  };

  // Only admin can set status to Closed; editors can set Draft or Open
  if (raw.status === "Closed" && session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can change report status to Closed.",
      values: raw,
    };
  }

  const parsed = reportCreateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error:
        fieldErrors.cvssVector?.[0] ||
        "Validation failed. Please check your input.",
      fieldErrors: fieldErrors as Record<string, string[]>,
      values: raw,
    };
  }

  try {
    // Verify customer exists
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, parsed.data.customerId))
      .limit(1);

    if (!customer) {
      return { success: false, error: "Selected customer does not exist.", values: raw };
    }

    const reportIdCustom = parsed.data.reportIdCustom || generateReportId();

    // Compile the issue reference number
    const issueRef = parsed.data.issueReferenceNumber || reportIdCustom;

    await db.insert(reports).values({
      customerId: parsed.data.customerId,
      reportIdCustom,
      title: parsed.data.title,
      clientCode: parsed.data.clientCode ?? null,
      serviceAffected: parsed.data.serviceAffected ?? null,
      findingSequence: parsed.data.findingSequence ?? null,
      issueReferenceNumber: issueRef,
      severity: parsed.data.severity,
      location: parsed.data.location ?? null,
      description: sanitizeMarkdown(parsed.data.description ?? "") || null,
      pocText: sanitizeMarkdown(parsed.data.pocText ?? "") || null,
      referencesList: parsed.data.referencesList ?? null,
      cvssVector: parsed.data.cvssVector ?? null,
      cvssScore: parsed.data.cvssScore ?? null,
      impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
      recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
      auditDate: parsed.data.auditDate ?? null,
      status: parsed.data.status,
      createdBy: session.user.id,
    });

    // Sync to Meilisearch — get the created report with customer name
    const [created] = await db
      .select({
        id: reports.id,
        title: reports.title,
        reportIdCustom: reports.reportIdCustom,
        issueReferenceNumber: reports.issueReferenceNumber,
        customerName: customers.name,
        status: reports.status,
        description: reports.description,
        auditDate: reports.auditDate,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .orderBy(desc(reports.createdAt))
      .limit(1);
    if (created) {
      syncDocument(INDEX.REPORTS, created);
    }

    await audit({ userId: session.user.id, action: "report.create", resourceId: created?.id });

    // ── Notify admins when an editor submits (status = Open) ──
    if (parsed.data.status === "Open" && session.user.role === "editor") {
      try {
        const { createNotificationForRole } = await import("@/lib/actions/notification");
        await createNotificationForRole("administrator", {
          actorId: session.user.id,
          category: "engagement",
          type: "customer_assigned",
          title: "New Report Submitted",
          message: `${session.user.username} submitted "${parsed.data.title}" for review.`,
          actionUrl: created ? `/reports/${created.id}` : "/reports",
        });
      } catch (err) {
        console.error("Failed to send report notification (non-blocking):", err);
      }
    }

    // ── Link temp attachments to the new report ──
    const attachmentsJson = formData.get("attachmentsJson") as string;
    if (attachmentsJson && created) {
      try {
        const tempAttachments = JSON.parse(attachmentsJson) as {
          fileUrl: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        }[];
        if (Array.isArray(tempAttachments) && tempAttachments.length > 0) {
          await db.insert(reportAttachments).values(
            tempAttachments.map((att) => ({
              reportId: created.id,
              fileUrl: att.fileUrl,
              fileName: att.fileName,
              fileSize: att.fileSize,
              mimeType: att.mimeType,
            })),
          );
        }
      } catch (attErr) {
        console.error("Failed to link attachments (non-blocking):", attErr);
      }
    }

    // ── Generate PDF deliverable ──
    if (created) {
      try {
        // Read linked attachments as base64 data URIs
        const allAttachments = await db
          .select({
            fileName: reportAttachments.fileName,
            fileUrl: reportAttachments.fileUrl,
            mimeType: reportAttachments.mimeType,
          })
          .from(reportAttachments)
          .where(eq(reportAttachments.reportId, created.id));

        const imageAttachments: ReportPDFData["attachments"] = [];
        for (const a of allAttachments.filter((att) => att.mimeType.startsWith("image/"))) {
          try {
            const absPath = path.join(process.cwd(), "public", a.fileUrl);
            const fileBuffer = await readFile(absPath);
            const base64 = fileBuffer.toString("base64");
            imageAttachments!.push({
              fileName: a.fileName,
              dataUri: `data:${a.mimeType};base64,${base64}`,
              mimeType: a.mimeType,
            });
          } catch (err) {
            console.error(`Failed to read attachment file: ${a.fileUrl}`, err);
          }
        }

        const pdfData: ReportPDFData = {
          id: created.id,
          reportIdCustom,
          title: parsed.data.title,
          customerName: created.customerName,
          issueReferenceNumber: issueRef,
          severity: parsed.data.severity,
          location: parsed.data.location ?? null,
          description: sanitizeMarkdown(parsed.data.description ?? "") || null,
          pocText: sanitizeMarkdown(parsed.data.pocText ?? "") || null,
          referencesList: parsed.data.referencesList ?? null,
          cvssVector: parsed.data.cvssVector ?? null,
          cvssScore: parsed.data.cvssScore ?? null,
          impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
          recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
          status: parsed.data.status,
          createdAt: new Date(),
          attachments: imageAttachments,
        };

        const pdfUrl = await generateReportPDF(pdfData);

        const pdfPath = path.join(process.cwd(), "public", pdfUrl);
        const pdfBuffer = await readFile(pdfPath);
        const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

        await db.insert(deliverables).values({
          reportId: created.id,
          format: "PDF",
          fileUrl: pdfUrl,
          sha256Hash,
          generatedBy: session.user.id,
        });
      } catch (pdfErr) {
        console.error("Failed to generate PDF (non-blocking):", pdfErr);
      }
    }

    revalidatePath("/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Create report error:", error);

    if (error?.code === "ER_DUP_ENTRY") {
      return {
        success: false,
        error: "A report with this Report ID already exists.",
        fieldErrors: { reportIdCustom: ["This Report ID is already taken."] },
        values: raw,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred while creating the report.",
      values: raw,
    };
  }
}

// ─── Update report ──────────────────────────────────────
export async function updateReportAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Only administrators and editors can update reports." };
  }

  const raw = {
    id: formData.get("id") as string,
    customerId: formData.get("customerId") as string,
    reportIdCustom: formData.get("reportIdCustom") as string,
    title: formData.get("title") as string,
    clientCode: formData.get("clientCode") as string,
    serviceAffected: formData.get("serviceAffected") as string,
    findingSequence: formData.get("findingSequence") as string,
    issueReferenceNumber: formData.get("issueReferenceNumber") as string,
    severity: (formData.get("severity") as string) || "Info",
    location: formData.get("location") as string,
    description: formData.get("description") as string,
    pocText: formData.get("pocText") as string,
    referencesList: formData.get("referencesList") as string,
    cvssVector: formData.get("cvssVector") as string,
    cvssScore: formData.get("cvssScore") as string,
    impact: formData.get("impact") as string,
    recommendation: formData.get("recommendation") as string,
    auditDate: (formData.get("auditDate") as string) ?? "",
    status: (formData.get("status") as string) || "Draft",
  };

  // Only admin can change status to Closed; editors can set Draft or Open
  if (raw.status === "Closed" && session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can change report status to Closed.",
      values: raw,
    };
  }

  // Editor can only edit reports that are in Draft status
  if (session.user.role === "editor") {
    const [current] = await db
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, raw.id))
      .limit(1);

    if (current && current.status !== "Draft") {
      return {
        success: false,
        error: "Editors can only edit reports in Draft status.",
        values: raw,
      };
    }
  }

  const parsed = reportUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error:
        fieldErrors.cvssVector?.[0] ||
        "Validation failed. Please check your input.",
      fieldErrors: fieldErrors as Record<string, string[]>,
      values: raw,
    };
  }

  try {
    const [existing] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, parsed.data.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Report not found.", values: raw };
    }

    // Verify customer exists
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, parsed.data.customerId))
      .limit(1);

    if (!customer) {
      return { success: false, error: "Selected customer does not exist.", values: raw };
    }

    const issueRef = parsed.data.issueReferenceNumber || parsed.data.reportIdCustom || null;

    await db
      .update(reports)
      .set({
        customerId: parsed.data.customerId,
        reportIdCustom: parsed.data.reportIdCustom ?? null,
        title: parsed.data.title,
        clientCode: parsed.data.clientCode ?? null,
        serviceAffected: parsed.data.serviceAffected ?? null,
        findingSequence: parsed.data.findingSequence ?? null,
        issueReferenceNumber: issueRef,
        severity: parsed.data.severity,
        location: parsed.data.location ?? null,
        description: sanitizeMarkdown(parsed.data.description ?? "") || null,
        pocText: sanitizeMarkdown(parsed.data.pocText ?? "") || null,
        referencesList: parsed.data.referencesList ?? null,
        cvssVector: parsed.data.cvssVector ?? null,
        cvssScore: parsed.data.cvssScore ?? null,
        impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
        recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
        auditDate: parsed.data.auditDate ?? null,
        status: parsed.data.status,
      })
      .where(eq(reports.id, parsed.data.id));

    // Sync to Meilisearch
    const [updated] = await db
      .select({
        id: reports.id,
        title: reports.title,
        reportIdCustom: reports.reportIdCustom,
        issueReferenceNumber: reports.issueReferenceNumber,
        customerName: customers.name,
        status: reports.status,
        description: reports.description,
        auditDate: reports.auditDate,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .where(eq(reports.id, parsed.data.id))
      .limit(1);
    if (updated) {
      syncDocument(INDEX.REPORTS, updated);
    }

    await audit({ userId: session.user.id, action: "report.update", resourceId: parsed.data.id });

    // ── Notify admins when an editor submits (status = Open) ──
    if (parsed.data.status === "Open" && session.user.role === "editor") {
      try {
        const { createNotificationForRole } = await import("@/lib/actions/notification");
        await createNotificationForRole("administrator", {
          actorId: session.user.id,
          category: "engagement",
          type: "customer_assigned",
          title: "Report Submitted for Review",
          message: `${session.user.username} submitted "${parsed.data.title}" for review.`,
          actionUrl: `/reports/${parsed.data.id}`,
        });
      } catch (err) {
        console.error("Failed to send report notification (non-blocking):", err);
      }
    }

    // ── Sync attachments: link any new temp attachments ──
    const attachmentsJson = formData.get("attachmentsJson") as string;
    if (attachmentsJson) {
      try {
        const formAttachments = JSON.parse(attachmentsJson) as {
          id: string;
          fileUrl: string;
          fileName: string;
          fileSize: number;
          mimeType: string;
        }[];
        if (Array.isArray(formAttachments)) {
          // Get existing attachment URLs in DB
          const existingAttachments = await db
            .select({ fileUrl: reportAttachments.fileUrl })
            .from(reportAttachments)
            .where(eq(reportAttachments.reportId, parsed.data.id));
          const existingUrls = new Set(existingAttachments.map((a) => a.fileUrl));

          // Insert only new attachments (those not already in DB)
          const newAttachments = formAttachments.filter(
            (att) => !existingUrls.has(att.fileUrl),
          );
          if (newAttachments.length > 0) {
            await db.insert(reportAttachments).values(
              newAttachments.map((att) => ({
                reportId: parsed.data.id,
                fileUrl: att.fileUrl,
                fileName: att.fileName,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
              })),
            );
          }

          // Delete attachments that were removed from the form
          const formUrls = new Set(formAttachments.map((a) => a.fileUrl));
          const removedAttachments = existingAttachments.filter(
            (a) => !formUrls.has(a.fileUrl),
          );
          for (const removed of removedAttachments) {
            await db
              .delete(reportAttachments)
              .where(eq(reportAttachments.fileUrl, removed.fileUrl));
            // Delete file from disk
            try {
              const absPath = path.join(process.cwd(), "public", removed.fileUrl);
              if (existsSync(absPath)) {
                await unlink(absPath);
              }
            } catch {
              // Non-blocking
            }
          }
        }
      } catch (attErr) {
        console.error("Failed to sync attachments (non-blocking):", attErr);
      }
    }

    // ── Regenerate PDF deliverable ──
    try {
      // Read all current attachments
      const allAttachments = await db
        .select({
          fileName: reportAttachments.fileName,
          fileUrl: reportAttachments.fileUrl,
          mimeType: reportAttachments.mimeType,
        })
        .from(reportAttachments)
        .where(eq(reportAttachments.reportId, parsed.data.id));

      const imageAttachments: ReportPDFData["attachments"] = [];
      for (const a of allAttachments.filter((att) => att.mimeType.startsWith("image/"))) {
        try {
          const absPath = path.join(process.cwd(), "public", a.fileUrl);
          const fileBuffer = await readFile(absPath);
          const base64 = fileBuffer.toString("base64");
          imageAttachments!.push({
            fileName: a.fileName,
            dataUri: `data:${a.mimeType};base64,${base64}`,
            mimeType: a.mimeType,
          });
        } catch (err) {
          console.error(`Failed to read attachment file: ${a.fileUrl}`, err);
        }
      }

      const pdfData: ReportPDFData = {
        id: parsed.data.id,
        reportIdCustom: parsed.data.reportIdCustom ?? null,
        title: parsed.data.title,
        customerName: updated?.customerName ?? "",
        issueReferenceNumber: issueRef,
        severity: parsed.data.severity,
        location: parsed.data.location ?? null,
        description: sanitizeMarkdown(parsed.data.description ?? "") || null,
        pocText: sanitizeMarkdown(parsed.data.pocText ?? "") || null,
        referencesList: parsed.data.referencesList ?? null,
        cvssVector: parsed.data.cvssVector ?? null,
        cvssScore: parsed.data.cvssScore ?? null,
        impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
        recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
        status: parsed.data.status,
        createdAt: new Date(),
        attachments: imageAttachments,
      };

      const pdfUrl = await generateReportPDF(pdfData);

      const pdfPath = path.join(process.cwd(), "public", pdfUrl);
      const pdfBuffer = await readFile(pdfPath);
      const sha256Hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

      // Delete old deliverables for this report, then insert new one
      await db.delete(deliverables).where(eq(deliverables.reportId, parsed.data.id));
      await db.insert(deliverables).values({
        reportId: parsed.data.id,
        format: "PDF",
        fileUrl: pdfUrl,
        sha256Hash,
        generatedBy: session.user.id,
      });
    } catch (pdfErr) {
      console.error("Failed to regenerate PDF (non-blocking):", pdfErr);
    }

    revalidatePath("/reports");
    return { success: true };
  } catch (error: any) {
    console.error("Update report error:", error);

    if (error?.code === "ER_DUP_ENTRY") {
      return {
        success: false,
        error: "A report with this Report ID already exists.",
        fieldErrors: { reportIdCustom: ["This Report ID is already taken."] },
        values: raw,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred while updating the report.",
      values: raw,
    };
  }
}

// ─── Delete report ──────────────────────────────────────
export async function deleteReportAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return { success: false, error: "Only administrators and editors can delete reports." };
  }

  // Rate limit delete operations
  const rl = checkDeleteRateLimit(session.user.id);
  if (!rl.allowed) {
    return { success: false, error: "Too many delete operations. Please slow down." };
  }

  try {
    const [existing] = await db
      .select({
        id: reports.id,
        status: reports.status,
        createdBy: reports.createdBy,
        description: reports.description,
        pocText: reports.pocText,
        impact: reports.impact,
        recommendation: reports.recommendation,
      })
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Report not found." };
    }

    // Editor can only delete their own draft reports
    if (session.user.role === "editor") {
      if (existing.status !== "Draft") {
        return { success: false, error: "Editors can only delete reports in Draft status." };
      }
      if (existing.createdBy !== session.user.id) {
        return { success: false, error: "Editors can only delete their own reports." };
      }
    }

    // ── Collect file paths to delete from disk ──
    const [attachmentRows, deliverableRows] = await Promise.all([
      db
        .select({ fileUrl: reportAttachments.fileUrl })
        .from(reportAttachments)
        .where(eq(reportAttachments.reportId, id)),
      db
        .select({ fileUrl: deliverables.fileUrl })
        .from(deliverables)
        .where(eq(deliverables.reportId, id)),
    ]);

    // ── Extract inline image URLs from Markdown content fields ──
    const contentFields = [
      existing.description,
      existing.pocText,
      existing.impact,
      existing.recommendation,
    ];
    const inlineImageUrls: string[] = [];
    const imgRegex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g;
    for (const content of contentFields) {
      if (!content) continue;
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        if (match[1]) inlineImageUrls.push(match[1]);
      }
    }

    // Delete report (cascades DB rows for attachments + deliverables)
    await db.delete(reports).where(eq(reports.id, id));

    await audit({ userId: session.user.id, action: "report.delete", resourceId: id });

    // ── Delete physical files from disk ──
    const filePaths = [
      ...attachmentRows.map((a) => a.fileUrl),
      ...deliverableRows.map((d) => d.fileUrl),
      ...inlineImageUrls,
    ];
    // Deduplicate in case an inline image is also an attachment
    const uniquePaths = [...new Set(filePaths)];
    for (const fileUrl of uniquePaths) {
      try {
        const absPath = path.join(process.cwd(), "public", fileUrl);
        if (existsSync(absPath)) {
          await unlink(absPath);
        }
      } catch (e) {
        console.warn(`Failed to delete file ${fileUrl}:`, e);
      }
    }

    // Remove from Meilisearch
    removeDocument(INDEX.REPORTS, id);

    revalidatePath("/reports");
    return { success: true };
  } catch (error) {
    console.error("Delete report error:", error);
    return { success: false, error: "An unexpected error occurred while deleting the report." };
  }
}
