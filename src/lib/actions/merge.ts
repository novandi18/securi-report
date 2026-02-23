"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  reports,
  customers,
  users,
  reportAttachments,
} from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncDocument, INDEX } from "@/lib/meilisearch";
import { sanitizeMarkdown, audit } from "@/lib/security";

export type MergeActionResult = {
  success: boolean;
  error?: string;
  masterReportId?: string;
};

/**
 * Get all **Open** contributions grouped by customer.
 * Only returns non-master reports with status "Open" and no parentReportId.
 * Draft reports are excluded — pentesters must submit (set status to Open)
 * before their work is eligible for merge.
 */
export async function getDraftContributionsAction() {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false as const, error: "Only administrators can access merge.", data: [] };
  }

  try {
    const contributions = await db
      .select({
        id: reports.id,
        customerId: reports.customerId,
        reportIdCustom: reports.reportIdCustom,
        title: reports.title,
        executiveSummary: reports.executiveSummary,
        scope: reports.scope,
        methodology: reports.methodology,
        impact: reports.impact,
        recommendationSummary: reports.recommendationSummary,
        cvssVector: reports.cvssVector,
        status: reports.status,
        isMaster: reports.isMaster,
        parentReportId: reports.parentReportId,
        createdBy: reports.createdBy,
        createdAt: reports.createdAt,
        customerName: customers.name,
        creatorUsername: users.username,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .leftJoin(users, eq(reports.createdBy, users.id))
      .where(
        and(
          eq(reports.isMaster, false),
          eq(reports.status, "Open"),
          isNull(reports.parentReportId),
        ),
      )
      .orderBy(customers.name, reports.createdAt);

    // Group by customer
    const grouped: Record<
      string,
      {
        customerId: string;
        customerName: string;
        contributions: typeof contributions;
      }
    > = {};

    for (const c of contributions) {
      if (!grouped[c.customerId]) {
        grouped[c.customerId] = {
          customerId: c.customerId,
          customerName: c.customerName,
          contributions: [],
        };
      }
      grouped[c.customerId].contributions.push(c);
    }

    // Only return groups with 1+ contributions (merging needs 2+, but show all for UI)
    const data = Object.values(grouped).sort((a, b) =>
      a.customerName.localeCompare(b.customerName),
    );

    return { success: true as const, data };
  } catch (err) {
    console.error("getDraftContributions error:", err);
    return { success: false as const, error: "Failed to fetch contributions.", data: [] };
  }
}

/**
 * Merge selected contributions into a new Master Report.
 *
 * The admin provides:
 * - selectedReportIds: IDs of contributions to merge
 * - masterData: Final executive summary, scope, methodology, etc.
 */
export async function mergeReportsAction(input: {
  selectedReportIds: string[];
  title: string;
  executiveSummary: string;
  scope: string;
  methodology: string;
  customerId: string;
  cvssVector?: string;
  impact?: string;
  recommendationSummary?: string;
  referencesFramework?: string;
}): Promise<MergeActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false, error: "Only administrators can merge reports." };
  }

  const {
    selectedReportIds,
    title,
    executiveSummary,
    scope,
    methodology,
    customerId,
    cvssVector,
    impact,
    recommendationSummary,
    referencesFramework,
  } = input;

  if (!selectedReportIds || selectedReportIds.length < 2) {
    return { success: false, error: "You must select at least 2 contributions to merge." };
  }

  try {
    // Verify all selected reports exist and belong to the same customer
    const selectedReports = await db
      .select({
        id: reports.id,
        customerId: reports.customerId,
        status: reports.status,
        isMaster: reports.isMaster,
        parentReportId: reports.parentReportId,
      })
      .from(reports)
      .where(inArray(reports.id, selectedReportIds));

    if (selectedReports.length !== selectedReportIds.length) {
      return { success: false, error: "Some selected reports were not found." };
    }

    // Check all belong to same customer
    const customerIds = new Set(selectedReports.map((r) => r.customerId));
    if (customerIds.size > 1) {
      return { success: false, error: "All contributions must belong to the same customer." };
    }

    // Check none are already master or attached to a parent
    for (const r of selectedReports) {
      if (r.isMaster) {
        return { success: false, error: "Cannot merge a master report. Only contributions are allowed." };
      }
      if (r.parentReportId) {
        return { success: false, error: "One or more contributions are already merged." };
      }
    }

    // ── Only "Open" contributions can be merged ──
    const nonOpenReports = selectedReports.filter((r) => r.status !== "Open");
    if (nonOpenReports.length > 0) {
      return {
        success: false,
        error: "Only contributions with status \"Open\" can be merged. Please ensure all selected reports have been submitted by their authors.",
      };
    }

    // Auto-generate report ID
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const reportIdCustom = `PEN-MASTER-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

    // Create the master report (with Markdown sanitization)
    const masterReportId = randomUUID();
    await db
      .insert(reports)
      .values({
        id: masterReportId,
        customerId,
        reportIdCustom,
        title,
        executiveSummary: sanitizeMarkdown(executiveSummary ?? "") || null,
        scope: sanitizeMarkdown(scope ?? "") || null,
        methodology: sanitizeMarkdown(methodology ?? "") || null,
        cvssVector: cvssVector || null,
        impact: sanitizeMarkdown(impact ?? "") || null,
        recommendationSummary: sanitizeMarkdown(recommendationSummary ?? "") || null,
        referencesFramework: referencesFramework || null,
        isMaster: true,
        status: "Draft",
        createdBy: session.user.id,
      });

    // Link all contributions to the master report and auto-close them
    for (const reportId of selectedReportIds) {
      await db
        .update(reports)
        .set({
          parentReportId: masterReportId,
          status: "Closed",
        })
        .where(eq(reports.id, reportId));
    }

    // Copy all attachments from contributions to master
    for (const reportId of selectedReportIds) {
      const atts = await db
        .select()
        .from(reportAttachments)
        .where(eq(reportAttachments.reportId, reportId));

      for (const att of atts) {
        await db.insert(reportAttachments).values({
          reportId: masterReportId,
          fileUrl: att.fileUrl,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
        });
      }
    }

    // Sync to search
    const [created] = await db
      .select({
        id: reports.id,
        title: reports.title,
        reportIdCustom: reports.reportIdCustom,
        customerName: customers.name,
        status: reports.status,
        executiveSummary: reports.executiveSummary,
        auditDate: reports.auditDate,
      })
      .from(reports)
      .innerJoin(customers, eq(reports.customerId, customers.id))
      .where(eq(reports.id, masterReportId))
      .limit(1);

    if (created) {
      syncDocument(INDEX.REPORTS, created);
    }

    // ── Audit trail ──
    await audit({
      userId: session.user.id,
      action: "report.merge",
      resourceId: masterReportId,
      detail: `${selectedReportIds.length} contributions merged into ${reportIdCustom}`,
    });
    for (const reportId of selectedReportIds) {
      await audit({
        userId: session.user.id,
        action: "report.merged_closed",
        resourceId: reportId,
        detail: `Merged into ${reportIdCustom} (${masterReportId})`,
      });
    }

    // ── Notify pentesters about merge ──
    try {
      const { createNotification } = await import("@/lib/actions/notification");
      // Get unique creators of merged contributions
      const contributions = await db
        .select({ createdBy: reports.createdBy })
        .from(reports)
        .where(inArray(reports.id, selectedReportIds));
      const uniqueCreators = [...new Set(contributions.map((c) => c.createdBy).filter(Boolean))] as string[];
      for (const creatorId of uniqueCreators) {
        if (creatorId !== session.user.id) {
          await createNotification({
            recipientId: creatorId,
            actorId: session.user.id,
            category: "collaboration",
            type: "report_merged",
            title: "Your Contribution Was Merged",
            message: `Your contribution has been merged into "${title}".`,
            actionUrl: `/reports/${masterReportId}`,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send merge notifications (non-blocking):", err);
    }

    revalidatePath("/reports");
    revalidatePath("/reports/merge");
    return { success: true, masterReportId };
  } catch (err) {
    console.error("Merge reports error:", err);
    return { success: false, error: "An unexpected error occurred during merge." };
  }
}
