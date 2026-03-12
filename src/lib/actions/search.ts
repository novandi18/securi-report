"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers, reports, findingTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  configureIndexes,
  replaceAllDocuments,
  INDEX,
} from "@/lib/meilisearch";

export type ReindexResult = {
  success: boolean;
  error?: string;
  counts?: { customers: number; reports: number; templates: number };
};

/**
 * Full re-index of all Meilisearch indexes.
 * Admin-only action.
 */
export async function reindexAllAction(): Promise<ReindexResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false, error: "Only administrators can re-index search." };
  }

  try {
    // 1. Configure index settings (idempotent)
    await configureIndexes();

    // 2. Fetch & push Customers
    const allCustomers = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
      })
      .from(customers);
    await replaceAllDocuments(INDEX.CUSTOMERS, allCustomers);

    // 3. Fetch & push Reports (with customer name)
    const { customers: c, reports: r } = { customers, reports };
    const allReports = await db
      .select({
        id: r.id,
        title: r.title,
        reportIdCustom: r.reportIdCustom,
        issueReferenceNumber: r.issueReferenceNumber,
        customerName: c.name,
        status: r.status,
        description: r.description,
        auditDate: r.auditDate,
      })
      .from(r)
      .innerJoin(c, eq(r.customerId, c.id));
    await replaceAllDocuments(INDEX.REPORTS, allReports);

    // 4. Fetch & push Finding Templates
    const allTemplates = await db
      .select({
        id: findingTemplates.id,
        title: findingTemplates.title,
        severity: findingTemplates.severity,
        cvssScore: findingTemplates.cvssScore,
        description: findingTemplates.description,
        impact: findingTemplates.impact,
        recommendation: findingTemplates.recommendation,
      })
      .from(findingTemplates);
    await replaceAllDocuments(INDEX.TEMPLATES, allTemplates);

    return {
      success: true,
      counts: {
        customers: allCustomers.length,
        reports: allReports.length,
        templates: allTemplates.length,
      },
    };
  } catch (error) {
    console.error("Reindex error:", error);
    return {
      success: false,
      error: "Failed to re-index. Check Meilisearch connection.",
    };
  }
}
