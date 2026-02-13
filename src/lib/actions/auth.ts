"use server";

import { signIn, signOut, TwoFactorRequiredError } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { auth } from "@/lib/auth";
import {
  checkLoginRateLimit,
  checkForgotPasswordRateLimit,
  resetRateLimit,
  getClientIp,
  audit,
  detectBruteForce,
} from "@/lib/security";

export type AuthActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  identifier?: string;
  requires2FA?: boolean;
  userId?: string;
};

export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const raw = {
    identifier: formData.get("identifier") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors,
      identifier: raw.identifier,
    };
  }

  // ── Rate Limit Check ──
  const ip = await getClientIp();
  const rl = checkLoginRateLimit(ip);
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return {
      success: false,
      error: `Too many login attempts. Please try again in ${secs} seconds.`,
      identifier: raw.identifier,
    };
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirect: false,
    });

    // Successful login — reset rate-limit counter
    resetRateLimit(`login:${ip}`);
    return { success: true };
  } catch (error) {
    // Check if it's a 2FA required error (wrapped inside CallbackRouteError)
    if (error instanceof AuthError && error.type === "CallbackRouteError") {
      const cause = (error as any).cause?.err;
      if (cause instanceof TwoFactorRequiredError) {
        return {
          success: false,
          requires2FA: true,
          userId: cause.userId,
          identifier: cause.identifier,
        };
      }
      // Check for invalid TOTP
      if (cause?.message === "INVALID_TOTP") {
        return {
          success: false,
          error: "Invalid 2FA code.",
          identifier: parsed.data.identifier,
        };
      }
      // Check for invalid backup code
      if (cause?.message === "INVALID_BACKUP_CODE") {
        return {
          success: false,
          error: "Invalid backup code.",
          identifier: parsed.data.identifier,
        };
      }
    }

    if (error instanceof AuthError) {
      // Log failed attempt & check for brute-force
      audit({ userId: "anonymous", action: "auth.login_failed", ip }).catch(() => {});
      detectBruteForce(ip).catch(() => {});

      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false,
            error: "Invalid username/email or password.",
            identifier: parsed.data.identifier,
          };
        default:
          return {
            success: false,
            error: "An authentication error occurred. Please try again.",
            identifier: parsed.data.identifier,
          };
      }
    }

    // Re-throw NEXT_REDIRECT errors
    throw error;
  }
}

// ─── Login with 2FA (called from verify-2fa page) ────────
export async function loginWith2FAAction(
  identifier: string,
  password: string,
  totpToken: string,
): Promise<AuthActionResult> {
  if (!totpToken || totpToken.length !== 6 || !/^\d{6}$/.test(totpToken)) {
    return { success: false, error: "Please enter a valid 6-digit code." };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      totpToken,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error as any).cause?.err;
      if (cause?.message === "INVALID_TOTP") {
        return { success: false, error: "Invalid verification code. Please try again." };
      }
      return {
        success: false,
        error: "Authentication failed. Please try again.",
      };
    }
    throw error;
  }
}

// ─── Login with Backup Code (called from verify-2fa page) ─
export async function loginWithBackupCodeAction(
  identifier: string,
  password: string,
  backupCode: string,
): Promise<AuthActionResult> {
  if (!backupCode || backupCode.length !== 8 || !/^\d{8}$/.test(backupCode)) {
    return { success: false, error: "Please enter a valid 8-digit backup code." };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      backupCode,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = (error as any).cause?.err;
      if (cause?.message === "INVALID_BACKUP_CODE") {
        return { success: false, error: "Invalid backup code. Please try again." };
      }
      return {
        success: false,
        error: "Authentication failed. Please try again.",
      };
    }
    throw error;
  }
}

export async function registerAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  // Check if the current user is an administrator
  const session = await auth();

  if (!session || session.user.role !== "administrator") {
    return {
      success: false,
      error: "Only administrators can register new users.",
    };
  }

  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    role: (formData.get("role") as string) || "viewer",
  };

  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Please check your input.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Check if user already exists
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
      };
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    // Insert user
    await db.insert(users).values({
      username: parsed.data.username,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    });

    await audit({ userId: session.user.id, action: "auth.register" });
    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
