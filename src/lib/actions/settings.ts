"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  reports,
  customers,
  findingTemplates,
  auditLogs,
  appSettings,
} from "@/lib/db/schema";
import {
  profileUpdateSchema,
  changePasswordSchema,
  preferencesSchema,
  appSettingsSchema,
} from "@/lib/validations/settings";
import { eq, and, ne, count, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import {
  generateTOTPSecret,
  generateTOTPUri,
  generateQRCodeDataURL,
  verifyTOTPToken,
  generateBackupCodes,
  verifyBackupCode,
} from "@/lib/2fa";
import { audit } from "@/lib/security";

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─── Get current user profile ─────────────────────────────
export async function getProfileAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        avatarUrl: users.avatarUrl,
        twoFactorEnabled: users.twoFactorEnabled,
        preferredLanguage: users.preferredLanguage,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return { success: false as const, error: "User not found", data: null };
    }

    return { success: true as const, data: user };
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return { success: false as const, error: "Failed to fetch profile", data: null };
  }
}

// ─── Get profile stats ───────────────────────────────────
export async function getProfileStatsAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  const role = session.user.role;
  const userId = session.user.id;

  try {
    if (role === "administrator") {
      const [userCount] = await db
        .select({ value: count() })
        .from(users);
      const [releasedCount] = await db
        .select({ value: count() })
        .from(reports)
        .where(eq(reports.status, "Open"));

      return {
        success: true as const,
        data: {
          role: "administrator" as const,
          totalUsersManaged: userCount.value,
          totalReportsReleased: releasedCount.value,
        },
      };
    }

    if (role === "editor") {
      const [createdCount] = await db
        .select({ value: count() })
        .from(reports)
        .where(eq(reports.createdBy, userId));
      const [templateCount] = await db
        .select({ value: count() })
        .from(findingTemplates);

      return {
        success: true as const,
        data: {
          role: "editor" as const,
          totalReportsCreated: createdCount.value,
          activeFindings: templateCount.value,
        },
      };
    }

    // viewer
    const [accessibleCount] = await db
      .select({ value: count() })
      .from(reports)
      .where(eq(reports.status, "Open"));

    return {
      success: true as const,
      data: {
        role: "viewer" as const,
        totalReportsAccessed: accessibleCount.value,
      },
    };
  } catch (error) {
    console.error("Failed to fetch profile stats:", error);
    return { success: false as const, error: "Failed to fetch stats", data: null };
  }
}

// ─── Update profile ──────────────────────────────────────
export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    avatarUrl: formData.get("avatarUrl") as string,
  };

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Check email uniqueness (exclude current user)
    if (parsed.data.email) {
      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(ne(users.id, session.user.id), eq(users.email, parsed.data.email)))
        .limit(1);

      if (dup) {
        return {
          success: false,
          error: "This email is already in use.",
          fieldErrors: { email: ["This email is already in use."] },
        };
      }
    }

    await db
      .update(users)
      .set({
        fullName: parsed.data.fullName || null,
        email: parsed.data.email,
        avatarUrl: parsed.data.avatarUrl || null,
      })
      .where(eq(users.id, session.user.id));

    // Log the action
    await audit({ userId: session.user.id, action: "profile.update" });

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { success: false, error: "Failed to update profile." };
  }
}

// ─── Change password ─────────────────────────────────────
export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return { success: false, error: "User not found." };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return {
        success: false,
        error: "Current password is incorrect.",
        fieldErrors: { currentPassword: ["Current password is incorrect."] },
      };
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(users.id, session.user.id));

    await audit({ userId: session.user.id, action: "password.change" });

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { success: false, error: "Failed to change password." };
  }
}

// ─── 2FA Setup: Generate secret & QR code ────────────────
export async function setup2FAAction(currentPassword: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  if (!currentPassword || typeof currentPassword !== "string") {
    return { success: false as const, error: "Current password is required.", data: null };
  }

  try {
    // Verify current password before allowing 2FA setup
    const [currentUser] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return { success: false as const, error: "User not found.", data: null };
    }

    const valid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!valid) {
      return { success: false as const, error: "Current password is incorrect.", data: null };
    }

    const secret = generateTOTPSecret();
    const otpauthUri = generateTOTPUri(secret, session.user.username || session.user.email || "user");
    const qrCodeDataUrl = await generateQRCodeDataURL(otpauthUri);

    // Store secret temporarily (not yet enabled) — we save it so verify can check
    await db
      .update(users)
      .set({ twoFactorSecret: secret })
      .where(eq(users.id, session.user.id));

    return {
      success: true as const,
      data: {
        secret,
        qrCodeDataUrl,
      },
    };
  } catch (error) {
    console.error("Setup 2FA error:", error);
    return { success: false as const, error: "Failed to setup 2FA.", data: null };
  }
}

// ─── 2FA Verify & Enable ─────────────────────────────────
export async function verify2FAAction(token: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", backupCodes: null };
  }

  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return { success: false as const, error: "Please enter a valid 6-digit code.", backupCodes: null };
  }

  try {
    const [user] = await db
      .select({ twoFactorSecret: users.twoFactorSecret })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.twoFactorSecret) {
      return { success: false as const, error: "No 2FA setup in progress. Please start setup again.", backupCodes: null };
    }

    const isValid = verifyTOTPToken(token, user.twoFactorSecret);
    if (!isValid) {
      return { success: false as const, error: "Invalid verification code. Please try again.", backupCodes: null };
    }

    // Generate backup codes
    const { plain, hashed } = generateBackupCodes();

    // Code is valid — enable 2FA and store hashed backup codes
    await db
      .update(users)
      .set({ twoFactorEnabled: true, backupCodes: JSON.stringify(hashed) })
      .where(eq(users.id, session.user.id));

    await audit({ userId: session.user.id, action: "2fa.enabled" });

    // Notify admins about 2FA state change
    try {
      const { createNotificationForRole } = await import("@/lib/actions/notification");
      await createNotificationForRole("administrator", {
        actorId: session.user.id,
        category: "security",
        type: "2fa_state_change",
        title: "2FA Enabled",
        message: `${session.user.username} has enabled two-factor authentication.`,
        actionUrl: "/users",
      });
    } catch (err) {
      console.error("Failed to send 2FA notification (non-blocking):", err);
    }

    revalidatePath("/settings/account");
    return { success: true as const, backupCodes: plain };
  } catch (error) {
    console.error("Verify 2FA error:", error);
    return { success: false as const, error: "Failed to verify code.", backupCodes: null };
  }
}

// ─── Disable 2FA ─────────────────────────────────────────
export async function disable2FAAction(currentPassword: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!currentPassword || typeof currentPassword !== "string") {
    return { success: false, error: "Current password is required." };
  }

  try {
    // Verify current password
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return { success: false, error: "User not found." };
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "Current password is incorrect." };
    }

    await db
      .update(users)
      .set({ twoFactorEnabled: false, twoFactorSecret: null, backupCodes: null })
      .where(eq(users.id, session.user.id));

    await audit({ userId: session.user.id, action: "2fa.disabled" });

    // Notify admins about 2FA state change
    try {
      const { createNotificationForRole } = await import("@/lib/actions/notification");
      await createNotificationForRole("administrator", {
        actorId: session.user.id,
        category: "security",
        type: "2fa_state_change",
        title: "2FA Disabled",
        message: `${session.user.username} has disabled two-factor authentication.`,
        actionUrl: "/users",
        sendEmail: true,
        emailSeverity: "high",
      });
    } catch (err) {
      console.error("Failed to send 2FA notification (non-blocking):", err);
    }

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    console.error("Disable 2FA error:", error);
    return { success: false, error: "Failed to disable 2FA." };
  }
}

// ─── 2FA Login Verification ──────────────────────────────
export async function verifyLoginTOTPAction(
  userId: string,
  token: string,
): Promise<ActionResult> {
  if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
    return { success: false, error: "Please enter a valid 6-digit code." };
  }

  try {
    const [user] = await db
      .select({ twoFactorSecret: users.twoFactorSecret })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.twoFactorSecret) {
      return { success: false, error: "2FA is not configured for this account." };
    }

    const isValid = verifyTOTPToken(token, user.twoFactorSecret);
    if (!isValid) {
      return { success: false, error: "Invalid verification code." };
    }

    return { success: true };
  } catch (error) {
    console.error("Verify login TOTP error:", error);
    return { success: false, error: "Verification failed." };
  }
}

// ─── Regenerate Backup Codes ─────────────────────────────
export async function regenerateBackupCodesAction(currentPassword: string) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", backupCodes: null };
  }

  if (!currentPassword || typeof currentPassword !== "string") {
    return { success: false as const, error: "Current password is required.", backupCodes: null };
  }

  try {
    const [user] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.twoFactorEnabled) {
      return { success: false as const, error: "2FA must be enabled to regenerate backup codes.", backupCodes: null };
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false as const, error: "Current password is incorrect.", backupCodes: null };
    }

    const { plain, hashed } = generateBackupCodes();

    await db
      .update(users)
      .set({ backupCodes: JSON.stringify(hashed) })
      .where(eq(users.id, session.user.id));

    await audit({ userId: session.user.id, action: "2fa.backup_codes_regenerated" });

    revalidatePath("/settings/account");
    return { success: true as const, backupCodes: plain };
  } catch (error) {
    console.error("Regenerate backup codes error:", error);
    return { success: false as const, error: "Failed to regenerate backup codes.", backupCodes: null };
  }
}

// ─── Update preferences ─────────────────────────────────
export async function updatePreferencesAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    preferredLanguage: formData.get("preferredLanguage") as string,
  };

  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Invalid preferences." };
  }

  try {
    await db
      .update(users)
      .set({ preferredLanguage: parsed.data.preferredLanguage })
      .where(eq(users.id, session.user.id));

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    console.error("Update preferences error:", error);
    return { success: false, error: "Failed to update preferences." };
  }
}

// ─── Get audit logs (admin only — own logs) ──────────────
export async function getAuditLogsAction() {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const data = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, session.user.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return { success: false as const, error: "Failed to fetch logs", data: [] };
  }
}

// ─── Get app settings ────────────────────────────────────
export async function getAppSettingsAction() {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false as const, error: "Unauthorized", data: null };
  }

  try {
    const [settings] = await db.select().from(appSettings).limit(1);

    // If no row exists, return defaults
    if (!settings) {
      return {
        success: true as const,
        data: {
          id: 1,
          companyName: "Securi Report",
          companyLogo: null,
          reportIdPrefix: "PEN-DOC-",
          latexEngine: "pdflatex" as const,
          titlePageColor: "#1E3A5F",
          updatedAt: null,
        },
      };
    }

    return { success: true as const, data: settings };
  } catch (error) {
    console.error("Failed to fetch app settings:", error);
    return { success: false as const, error: "Failed to fetch settings", data: null };
  }
}

// ─── Update app settings (admin only) ────────────────────
export async function updateAppSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false, error: "Only administrators can update application settings." };
  }

  const raw = {
    companyName: formData.get("companyName") as string,
    companyLogo: formData.get("companyLogo") as string,
    reportIdPrefix: formData.get("reportIdPrefix") as string,
    latexEngine: formData.get("latexEngine") as string,
    titlePageColor: formData.get("titlePageColor") as string,
  };

  const parsed = appSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Check if row exists
    const [existing] = await db.select({ id: appSettings.id }).from(appSettings).limit(1);

    const values = {
      companyName: parsed.data.companyName,
      companyLogo: parsed.data.companyLogo || null,
      reportIdPrefix: parsed.data.reportIdPrefix,
      latexEngine: parsed.data.latexEngine,
      titlePageColor: parsed.data.titlePageColor,
    };

    if (existing) {
      await db.update(appSettings).set(values).where(eq(appSettings.id, 1));
    } else {
      await db.insert(appSettings).values({ id: 1, ...values });
    }

    await audit({ userId: session.user.id, action: "app_settings.update" });

    revalidatePath("/settings/app");
    return { success: true };
  } catch (error) {
    console.error("Update app settings error:", error);
    return { success: false, error: "Failed to update application settings." };
  }
}
