import { z } from "zod";

// ─── Profile Update ──────────────────────────────────────
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .max(100, "Full name must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Invalid email address")
    .max(100, "Email must be at most 100 characters"),
  avatarUrl: z
    .string()
    .max(500, "Avatar URL must be at most 500 characters")
    .optional()
    .or(z.literal("")),
});

// ─── Change Password ─────────────────────────────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Preferences ─────────────────────────────────────────
export const preferencesSchema = z.object({
  preferredLanguage: z.enum(["en", "id"]).default("en"),
});

// ─── App Settings (Admin) ────────────────────────────────
export const appSettingsSchema = z.object({
  companyName: z
    .string()
    .min(1, "Company name is required")
    .max(255, "Company name must be at most 255 characters"),
  companyLogo: z
    .string()
    .max(512, "Logo URL must be at most 512 characters")
    .optional()
    .or(z.literal("")),
  reportIdPrefix: z
    .string()
    .min(1, "Report ID prefix is required")
    .max(50, "Prefix must be at most 50 characters"),
  latexEngine: z.enum(["pdflatex", "xelatex"]).default("pdflatex"),
  titlePageColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #1E3A5F)")
    .default("#1E3A5F"),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
