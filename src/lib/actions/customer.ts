"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import {
  customerCreateSchema,
  customerUpdateSchema,
} from "@/lib/validations/customer";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncDocument, removeDocument, INDEX } from "@/lib/meilisearch";
import { audit, checkDeleteRateLimit } from "@/lib/security";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
};

// ─── List all customers ───────────────────────────────────
export async function getCustomersAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db.select().from(customers).orderBy(desc(customers.createdAt));
    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return { success: false as const, error: "Failed to fetch customers", data: [] };
  }
}

// ─── Get single customer ─────────────────────────────────
export async function getCustomerAction(id: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      return { success: false as const, error: "Customer not found", data: null };
    }

    return { success: true as const, data: customer };
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    return { success: false as const, error: "Failed to fetch customer", data: null };
  }
}

// ─── Create customer ─────────────────────────────────────
export async function createCustomerAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can create customers.",
    };
  }

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    description: formData.get("description") as string,
    logoUrl: formData.get("logoUrl") as string,
  };

  const parsed = customerCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Please check your input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }

  try {
    await db.insert(customers).values({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      description: parsed.data.description ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
    });

    // Sync to Meilisearch — get the last inserted customer
    const [created] = await db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt))
      .limit(1);
    if (created) {
      syncDocument(INDEX.CUSTOMERS, {
        id: created.id,
        name: created.name,
        email: created.email,
        description: created.description,
      });
    }

    await audit({ userId: session.user.id, action: "customer.create", resourceId: created?.id });
    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("Create customer error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while creating the customer.",
      values: raw,
    };
  }
}

// ─── Update customer ─────────────────────────────────────
export async function updateCustomerAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can update customers.",
    };
  }

  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    description: formData.get("description") as string,
    logoUrl: formData.get("logoUrl") as string,
  };

  const parsed = customerUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Please check your input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }

  try {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, parsed.data.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Customer not found.", values: raw };
    }

    await db
      .update(customers)
      .set({
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        description: parsed.data.description ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
      })
      .where(eq(customers.id, parsed.data.id));

    // Sync to Meilisearch
    syncDocument(INDEX.CUSTOMERS, {
      id: parsed.data.id,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      description: parsed.data.description ?? null,
    });

    await audit({ userId: session.user.id, action: "customer.update", resourceId: parsed.data.id });
    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("Update customer error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating the customer.",
      values: raw,
    };
  }
}

// ─── Delete customer ─────────────────────────────────────
export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role === "viewer") {
    return {
      success: false,
      error: "Only administrators and editors can delete customers.",
    };
  }

  // Rate limit delete operations
  const rl = checkDeleteRateLimit(session.user.id);
  if (!rl.allowed) {
    return { success: false, error: "Too many delete operations. Please slow down." };
  }

  try {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "Customer not found." };
    }

    await db.delete(customers).where(eq(customers.id, id));

    // Remove from Meilisearch
    removeDocument(INDEX.CUSTOMERS, id);

    await audit({ userId: session.user.id, action: "customer.delete", resourceId: id });
    revalidatePath("/customers");
    return { success: true };
  } catch (error) {
    console.error("Delete customer error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the customer.",
    };
  }
}
