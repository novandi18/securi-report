"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { eq, desc, and, count, lt } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────

export type NotificationCategory =
  | "collaboration"
  | "security"
  | "engagement"
  | "system";

export type NotificationType =
  | "contribution_submitted"
  | "report_merged"
  | "report_released"
  | "brute_force_detected"
  | "2fa_state_change"
  | "unauthorized_access"
  | "sla_alert"
  | "customer_assigned"
  | "pdf_generated"
  | "pdf_failed"
  | "backup_reminder"
  | "password_reset_request"
  | "general";

export type NotificationData = {
  id: string;
  recipientId: string;
  actorId: string | null;
  category: string;
  type: string;
  title: string;
  message: string | null;
  actionUrl: string | null;
  isRead: boolean | null;
  createdAt: Date | null;
  actorUsername: string | null;
};

// ─── Core: Create Notification ───────────────────────────
/**
 * Reusable helper — create a notification for a specific user.
 * Non-blocking: errors are caught and logged.
 */
export async function createNotification(params: {
  recipientId: string;
  actorId?: string | null;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message?: string;
  actionUrl?: string;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      recipientId: params.recipientId,
      actorId: params.actorId ?? null,
      category: params.category,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      actionUrl: params.actionUrl ?? null,
    });
  } catch (error) {
    console.error("[notification] Failed to create:", error);
  }
}

/**
 * Create a notification for ALL users with a given role.
 * Optionally sends an email for critical alerts (set sendEmail: true).
 */
export async function createNotificationForRole(
  role: "administrator" | "editor" | "viewer",
  params: Omit<Parameters<typeof createNotification>[0], "recipientId"> & {
    sendEmail?: boolean;
    emailSeverity?: "critical" | "high" | "medium" | "low" | "info";
  },
): Promise<void> {
  try {
    const roleUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, role));

    for (const u of roleUsers) {
      await createNotification({ ...params, recipientId: u.id });
    }

    // Send email for critical/security notifications
    if (params.sendEmail) {
      try {
        const { sendNotificationEmail } = await import("@/lib/email");
        for (const u of roleUsers) {
          if (u.email) {
            await sendNotificationEmail(u.email, {
              title: params.title,
              message: params.message ?? "",
              severity: params.emailSeverity ?? "info",
              actionUrl: params.actionUrl,
            });
          }
        }
      } catch (emailErr) {
        console.error("[notification] Email send failed (non-blocking):", emailErr);
      }
    }
  } catch (error) {
    console.error("[notification] Failed to create for role:", error);
  }
}

// ─── Get notifications for current user ──────────────────
export async function getNotificationsAction(limit = 20) {
  const session = await auth();
  if (!session) {
    return { success: false as const, error: "Unauthorized", data: [] };
  }

  try {
    const actor = db
      .select({ id: users.id, username: users.username })
      .from(users)
      .as("actor");

    const data = await db
      .select({
        id: notifications.id,
        recipientId: notifications.recipientId,
        actorId: notifications.actorId,
        category: notifications.category,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        actionUrl: notifications.actionUrl,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        actorUsername: actor.username,
      })
      .from(notifications)
      .leftJoin(actor, eq(notifications.actorId, actor.id))
      .where(eq(notifications.recipientId, session.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return { success: true as const, data };
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return { success: false as const, error: "Failed to fetch notifications", data: [] };
  }
}

// ─── Backward compat alias ───────────────────────────────
export const getAdminNotificationsAction = getNotificationsAction;

// ─── Get unread notification count ───────────────────────
export async function getUnreadNotificationCountAction() {
  const session = await auth();
  if (!session) return 0;

  try {
    const [result] = await db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, session.user.id),
          eq(notifications.isRead, false),
        ),
      );

    return result?.value ?? 0;
  } catch {
    return 0;
  }
}

// ─── Mark notification as read ───────────────────────────
export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, session.user.id),
        ),
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    return { success: false, error: "Failed to update notification" };
  }
}

// ─── Mark all notifications as read ──────────────────────
export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, session.user.id),
          eq(notifications.isRead, false),
        ),
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to mark all notifications read:", error);
    return { success: false, error: "Failed to update notifications" };
  }
}

// ─── Delete notification ─────────────────────────────────
export async function deleteNotificationAction(notificationId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, session.user.id),
        ),
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}

// ─── Clean up old notifications (30+ days) ───────────────
export async function cleanupOldNotificationsAction() {
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    return { success: false, error: "Unauthorized", deleted: 0 };
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoff));

    return { success: true, deleted: 0 };
  } catch (error) {
    console.error("Failed to cleanup old notifications:", error);
    return { success: false, error: "Failed to cleanup notifications", deleted: 0 };
  }
}
