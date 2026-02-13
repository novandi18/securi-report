/**
 * Access Control Layer (ACL)
 *
 * Reusable server-side utility that enforces:
 * - Authentication check
 * - Role-based access control (RBAC)
 * - Principle of Least Privilege ("fail closed")
 *
 * OWASP A01:2021 — Broken Access Control
 */

import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export type Role = "administrator" | "editor" | "viewer";

export interface AuthenticatedUser {
  id: string;
  role: Role;
  username: string;
  email?: string | null;
}

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/**
 * Require an authenticated session. Throws AccessDeniedError if not authenticated.
 * Fail-closed: ambiguous/missing sessions are always denied.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    throw new AccessDeniedError("Authentication required");
  }

  return {
    id: session.user.id,
    role: session.user.role as Role,
    username: session.user.username ?? session.user.name ?? "unknown",
    email: session.user.email,
  };
}

/**
 * Require a specific role (or higher).
 * Role hierarchy: administrator > editor > viewer
 */
export async function requireRole(...allowedRoles: Role[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new AccessDeniedError(
      `Role '${user.role}' is not authorized. Required: ${allowedRoles.join(" | ")}`,
    );
  }

  return user;
}

/** Shortcut: requires administrator role */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  return requireRole("administrator");
}

/** Shortcut: requires editor or administrator */
export async function requireEditor(): Promise<AuthenticatedUser> {
  return requireRole("administrator", "editor");
}

/**
 * Safely run a protected server action.
 *
 * Wraps the callback in a try/catch that converts AccessDeniedError
 * into a standardised { success: false, error } result.
 *
 * Usage:
 *   return withAccessControl(async () => {
 *     const user = await requireEditor();
 *     // ... your logic
 *     return { success: true };
 *   });
 */
export async function withAccessControl<T extends { success: boolean; error?: string }>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message } as T;
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Verify ownership: ensure a resource belongs to the user or the user is admin.
 * IDOR Prevention (OWASP A01).
 *
 * @param resourceOwnerId  The user ID that owns the resource
 * @param currentUser       The authenticated user
 * @param allowAdmin        If true, administrators bypass ownership check (default: true)
 */
export function assertOwnership(
  resourceOwnerId: string | null | undefined,
  currentUser: AuthenticatedUser,
  allowAdmin = true,
): void {
  if (allowAdmin && currentUser.role === "administrator") return;

  if (!resourceOwnerId || resourceOwnerId !== currentUser.id) {
    throw new AccessDeniedError("You do not have access to this resource");
  }
}

/**
 * Helper to extract client IP from next/headers for rate limiting and audit logging.
 */
export async function getClientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const hdrs = await headers();

  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown"
  );
}
