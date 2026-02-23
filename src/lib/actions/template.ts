"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  findingTemplates,
  cweEntries,
  owaspEntries,
} from "@/lib/db/schema";
import {
  templateCreateSchema,
  templateUpdateSchema,
} from "@/lib/validations/kb";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncDocument, removeDocument, INDEX } from "@/lib/meilisearch";
import { sanitizeMarkdown, audit, checkDeleteRateLimit } from "@/lib/security";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
};

// ─── List all templates (with CWE/OWASP info) ───────────
export async function getTemplatesAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({
        id: findingTemplates.id,
        title: findingTemplates.title,
        severity: findingTemplates.severity,
        cvssScore: findingTemplates.cvssScore,
        cvssVector: findingTemplates.cvssVector,
        description: findingTemplates.description,
        impact: findingTemplates.impact,
        recommendation: findingTemplates.recommendation,
        referencesLink: findingTemplates.referencesLink,
        cweId: findingTemplates.cweId,
        owaspId: findingTemplates.owaspId,
        createdAt: findingTemplates.createdAt,
        cweTitle: cweEntries.title,
        owaspCode: owaspEntries.code,
        owaspTitle: owaspEntries.title,
      })
      .from(findingTemplates)
      .leftJoin(cweEntries, eq(findingTemplates.cweId, cweEntries.id))
      .leftJoin(owaspEntries, eq(findingTemplates.owaspId, owaspEntries.id))
      .orderBy(findingTemplates.createdAt);

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return {
      success: false as const,
      error: "Failed to fetch templates",
      data: [],
    };
  }
}

// ─── Get single template ────────────────────────────────
export async function getTemplateAction(id: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [template] = await db
      .select({
        id: findingTemplates.id,
        title: findingTemplates.title,
        severity: findingTemplates.severity,
        cvssScore: findingTemplates.cvssScore,
        cvssVector: findingTemplates.cvssVector,
        description: findingTemplates.description,
        impact: findingTemplates.impact,
        recommendation: findingTemplates.recommendation,
        referencesLink: findingTemplates.referencesLink,
        cweId: findingTemplates.cweId,
        owaspId: findingTemplates.owaspId,
        createdAt: findingTemplates.createdAt,
      })
      .from(findingTemplates)
      .where(eq(findingTemplates.id, id))
      .limit(1);

    if (!template) {
      return {
        success: false as const,
        error: "Template not found",
        data: null,
      };
    }

    return { success: true as const, data: template };
  } catch (error) {
    console.error("Failed to fetch template:", error);
    return {
      success: false as const,
      error: "Failed to fetch template",
      data: null,
    };
  }
}

// ─── Get CWE & OWASP entries for dropdowns ──────────────
export async function getFrameworksForSelectAction() {
  const session = await auth();
  if (!session) {
    return {
      success: false as const,
      error: "Unauthorized",
      cweList: [],
      owaspList: [],
    };
  }

  try {
    const cweList = await db
      .select({ id: cweEntries.id, title: cweEntries.title })
      .from(cweEntries)
      .orderBy(cweEntries.id);

    const owaspList = await db
      .select({
        id: owaspEntries.id,
        code: owaspEntries.code,
        title: owaspEntries.title,
        version: owaspEntries.version,
      })
      .from(owaspEntries)
      .orderBy(owaspEntries.version, owaspEntries.code);

    return { success: true as const, cweList, owaspList };
  } catch (error) {
    console.error("Failed to fetch frameworks:", error);
    return {
      success: false as const,
      error: "Failed to fetch frameworks",
      cweList: [],
      owaspList: [],
    };
  }
}

// ─── Create template ────────────────────────────────────
export async function createTemplateAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can create templates.",
    };
  }

  const raw = {
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || "Info",
    cvssScore: formData.get("cvssScore") as string,
    cvssVector: formData.get("cvssVector") as string,
    description: formData.get("description") as string,
    impact: formData.get("impact") as string,
    recommendation: formData.get("recommendation") as string,
    referencesLink: formData.get("referencesLink") as string,
    cweId: formData.get("cweId") as string,
    owaspId: formData.get("owaspId") as string,
  };

  const parsed = templateCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error:
        fieldErrors.cvssScore?.[0] ||
        fieldErrors.cvssVector?.[0] ||
        "Validation failed. Please check your input.",
      fieldErrors: fieldErrors as Record<string, string[]>,
      values: raw,
    };
  }

  try {
    await db.insert(findingTemplates).values({
      title: parsed.data.title,
      severity: parsed.data.severity,
      cvssScore: String(parsed.data.cvssScore),
      cvssVector: parsed.data.cvssVector,
      description: sanitizeMarkdown(parsed.data.description ?? "") || null,
      impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
      recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
      referencesLink: parsed.data.referencesLink,
      cweId: parsed.data.cweId ?? null,
      owaspId: parsed.data.owaspId ?? null,
    });

    // Sync to Meilisearch
    const [created] = await db
      .select({
        id: findingTemplates.id,
        title: findingTemplates.title,
        severity: findingTemplates.severity,
        cvssScore: findingTemplates.cvssScore,
        description: findingTemplates.description,
        impact: findingTemplates.impact,
        recommendation: findingTemplates.recommendation,
      })
      .from(findingTemplates)
      .orderBy(desc(findingTemplates.createdAt))
      .limit(1);
    if (created) {
      syncDocument(INDEX.TEMPLATES, created);
    }

    await audit({ userId: session.user.id, action: "template.create", resourceId: created?.id });
    revalidatePath("/kb/templates");
    return { success: true };
  } catch (error) {
    console.error("Failed to create template:", error);
    return {
      success: false,
      error: "Failed to create template.",
      values: raw,
    };
  }
}

// ─── Update template ────────────────────────────────────
export async function updateTemplateAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can update templates.",
    };
  }

  const raw = {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    severity: (formData.get("severity") as string) || "Info",
    cvssScore: formData.get("cvssScore") as string,
    cvssVector: formData.get("cvssVector") as string,
    description: formData.get("description") as string,
    impact: formData.get("impact") as string,
    recommendation: formData.get("recommendation") as string,
    referencesLink: formData.get("referencesLink") as string,
    cweId: formData.get("cweId") as string,
    owaspId: formData.get("owaspId") as string,
  };

  const parsed = templateUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error:
        fieldErrors.cvssScore?.[0] ||
        fieldErrors.cvssVector?.[0] ||
        "Validation failed. Please check your input.",
      fieldErrors: fieldErrors as Record<string, string[]>,
      values: raw,
    };
  }

  try {
    await db
      .update(findingTemplates)
      .set({
        title: parsed.data.title,
        severity: parsed.data.severity,
        cvssScore: String(parsed.data.cvssScore),
        cvssVector: parsed.data.cvssVector,
        description: sanitizeMarkdown(parsed.data.description ?? "") || null,
        impact: sanitizeMarkdown(parsed.data.impact ?? "") || null,
        recommendation: sanitizeMarkdown(parsed.data.recommendation ?? "") || null,
        referencesLink: parsed.data.referencesLink,
        cweId: parsed.data.cweId ?? null,
        owaspId: parsed.data.owaspId ?? null,
      })
      .where(eq(findingTemplates.id, parsed.data.id));

    // Sync to Meilisearch
    syncDocument(INDEX.TEMPLATES, {
      id: parsed.data.id,
      title: parsed.data.title,
      severity: parsed.data.severity,
      cvssScore: String(parsed.data.cvssScore),
      description: parsed.data.description ?? null,
      impact: parsed.data.impact ?? null,
      recommendation: parsed.data.recommendation ?? null,
    });

    await audit({ userId: session.user.id, action: "template.update", resourceId: parsed.data.id });
    revalidatePath("/kb/templates");
    return { success: true };
  } catch (error) {
    console.error("Failed to update template:", error);
    return {
      success: false,
      error: "Failed to update template.",
      values: raw,
    };
  }
}

// ─── Delete template ────────────────────────────────────
export async function deleteTemplateAction(
  id: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can delete templates.",
    };
  }

  // Rate limit delete operations
  const rl = checkDeleteRateLimit(session.user.id);
  if (!rl.allowed) {
    return { success: false, error: "Too many delete operations. Please slow down." };
  }

  try {
    await db
      .delete(findingTemplates)
      .where(eq(findingTemplates.id, id));

    // Remove from Meilisearch
    removeDocument(INDEX.TEMPLATES, id);

    await audit({ userId: session.user.id, action: "template.delete", resourceId: id });
    revalidatePath("/kb/templates");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete template:", error);
    return { success: false, error: "Failed to delete template." };
  }
}
