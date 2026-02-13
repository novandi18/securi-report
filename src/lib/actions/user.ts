"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, notifications } from "@/lib/db/schema";
import { userCreateSchema, userUpdateSchema } from "@/lib/validations/user";
import { eq, or, and, ne, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import {
  generateSecurePassword,
  sendNewUserCredentials,
  sendPasswordResetCredentials,
} from "@/lib/email";
import { headers } from "next/headers";
import {
  requireAdmin,
  audit,
  checkDeleteRateLimit,
  checkForgotPasswordRateLimit,
  getClientIp,
} from "@/lib/security";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  generatedPassword?: string;
  emailSent?: boolean;
};

// ─── List all users ───────────────────────────────────────
export async function getUsersAction() {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        mustChangePassword: users.mustChangePassword,
        resetRequestPending: users.resetRequestPending,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { success: false as const, error: "Failed to fetch users", data: [] };
  }
}

// ─── Get single user (no password hash) ──────────────────
export async function getUserAction(id: string) {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return { success: false as const, error: "User not found", data: null };
    }

    return { success: true as const, data: user };
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return { success: false as const, error: "Failed to fetch user", data: null };
  }
}

// ─── Create user ─────────────────────────────────────────
export async function createUserAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can create users.",
    };
  }

  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    role: (formData.get("role") as string) || "viewer",
  };

  // Values to return on error (exclude passwords for security)
  const safeValues = { username: raw.username, email: raw.email, role: raw.role };

  const parsed = userCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Please check your input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: safeValues,
    };
  }

  // ── Single Admin Constraint ──
  // Only one administrator is allowed in the system
  if (parsed.data.role === "administrator") {
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "administrator"))
      .limit(1);

    if (existingAdmin) {
      return {
        success: false,
        error:
          "Only one administrator is allowed. An administrator already exists.",
        values: safeValues,
      };
    }
  }

  try {
    // Check for duplicate username or email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          eq(users.username, parsed.data.username),
          eq(users.email, parsed.data.email),
        ),
      )
      .limit(1);

    if (existingUser) {
      return {
        success: false,
        error: "A user with this username or email already exists.",
        values: safeValues,
      };
    }

    // Auto-generate a secure password
    const plainPassword = generateSecurePassword(16);
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    await db.insert(users).values({
      username: parsed.data.username,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      mustChangePassword: true,
    });

    // Send credentials email
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:3000";
    const protocol = hdrs.get("x-forwarded-proto") || "http";
    const loginUrl = `${protocol}://${host}/login`;

    const emailSent = await sendNewUserCredentials(
      parsed.data.email,
      parsed.data.username,
      plainPassword,
      loginUrl,
    );

    await audit({ userId: session.user.id, action: "user.create" });
    revalidatePath("/users");
    return { success: true, generatedPassword: plainPassword, emailSent, values: safeValues };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while creating the user.",
      values: safeValues,
    };
  }
}

// ─── Update user ─────────────────────────────────────────
export async function updateUserAction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can update users.",
    };
  }

  const raw = {
    id: formData.get("id") as string,
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: (formData.get("password") as string) || "",
    confirmPassword: (formData.get("confirmPassword") as string) || "",
    role: (formData.get("role") as string) || "viewer",
  };

  // Values to return on error (exclude passwords for security)
  const safeValues = { username: raw.username, email: raw.email, role: raw.role };

  const parsed = userUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Please check your input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: safeValues,
    };
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, parsed.data.id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "User not found.", values: safeValues };
    }

    // ── Single Admin Constraint ──
    // Prevent changing the admin's role to anything else
    if (
      existing.role === "administrator" &&
      parsed.data.role !== "administrator"
    ) {
      return {
        success: false,
        error:
          "Cannot change the administrator's role. The administrator account is protected.",
        values: safeValues,
      };
    }

    // Prevent promoting to admin if one already exists (and it's not the same user)
    if (
      parsed.data.role === "administrator" &&
      existing.role !== "administrator"
    ) {
      const [existingAdmin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "administrator"))
        .limit(1);

      if (existingAdmin) {
        return {
          success: false,
          error:
            "Only one administrator is allowed. An administrator already exists.",
          values: safeValues,
        };
      }
    }

    // Check for duplicate username/email (excluding current user)
    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.id, parsed.data.id),
          or(
            eq(users.username, parsed.data.username),
            eq(users.email, parsed.data.email),
          ),
        ),
      )
      .limit(1);

    if (duplicate) {
      return {
        success: false,
        error: "A user with this username or email already exists.",
        values: safeValues,
      };
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      username: parsed.data.username,
      email: parsed.data.email,
      role: parsed.data.role,
    };

    // Only update password if provided
    if (parsed.data.password && parsed.data.password.length > 0) {
      updateValues.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, parsed.data.id));

    await audit({ userId: session.user.id, action: "user.update", resourceId: parsed.data.id });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Update user error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating the user.",
      values: safeValues,
    };
  }
}

// ─── Delete user ─────────────────────────────────────────
export async function deleteUserAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can delete users.",
    };
  }
  // Rate limit delete operations
  const rl = checkDeleteRateLimit(session.user.id);
  if (!rl.allowed) {
    return { success: false, error: "Too many delete operations. Please slow down." };
  }
  // Prevent self-deletion
  if (session.user.id === id) {
    return {
      success: false,
      error: "You cannot delete your own account.",
    };
  }

  try {
    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return { success: false, error: "User not found." };
    }

    // ── Single Admin Constraint ──
    // The administrator account cannot be deleted
    if (existing.role === "administrator") {
      return {
        success: false,
        error: "The administrator account cannot be deleted.",
      };
    }

    await db.delete(users).where(eq(users.id, id));

    await audit({ userId: session.user.id, action: "user.delete", resourceId: id });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the user.",
    };
  }
}

// ─── Reset user password (admin action) ──────────────────
export async function resetUserPasswordAction(
  userId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false, error: "Only administrators can reset passwords." };
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: "User not found." };
    }

    // Generate new password
    const plainPassword = generateSecurePassword(16);
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        resetRequestPending: false,
      })
      .where(eq(users.id, userId));

    // Mark related notifications as read
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.actorId, userId),
          eq(notifications.type, "password_reset_request"),
          eq(notifications.isRead, false),
        ),
      );

    // Send email with new credentials
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:3000";
    const protocol = hdrs.get("x-forwarded-proto") || "http";
    const loginUrl = `${protocol}://${host}/login`;

    const emailSent = await sendPasswordResetCredentials(
      user.email,
      user.username,
      plainPassword,
      loginUrl,
    );

    revalidatePath("/users");
    return { success: true, generatedPassword: plainPassword, emailSent };
  } catch (error) {
    console.error("Reset user password error:", error);
    return { success: false, error: "Failed to reset password." };
  }
}

// ─── Forgot password request (public) ────────────────────
export async function forgotPasswordAction(
  email: string,
): Promise<ActionResult> {
  // Rate limit forgot-password to prevent abuse
  const ip = await getClientIp();
  const rl = checkForgotPasswordRateLimit(ip);
  if (!rl.allowed) {
    // Still return generic response to prevent enumeration
    return { success: true };
  }

  // Always return success to prevent email enumeration
  const genericResponse: ActionResult = { success: true };

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal whether the email exists
      return genericResponse;
    }

    // Set reset request pending flag
    await db
      .update(users)
      .set({ resetRequestPending: true })
      .where(eq(users.id, user.id));

    // Create admin notification
    const { createNotificationForRole } = await import("@/lib/actions/notification");
    await createNotificationForRole("administrator", {
      actorId: user.id,
      category: "system",
      type: "password_reset_request",
      title: "Password Reset Request",
      message: `User "${user.username}" (${user.email}) has requested a password reset.`,
      actionUrl: "/users",
    });

    // Notify admin via email
    const [admin] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.role, "administrator"))
      .limit(1);

    if (admin) {
      const { sendResetRequestNotification } = await import("@/lib/email");
      await sendResetRequestNotification(admin.email, user.username, user.email);
    }

    return genericResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return genericResponse;
  }
}
