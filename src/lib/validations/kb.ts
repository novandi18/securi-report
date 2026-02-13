import { z } from "zod";

const emptyToNull = z
  .string()
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

// CVSS 4.0 vector validation regex
const cvssVectorRegex =
  /^CVSS:4\.0\/AV:[NALP]\/AC:[LH]\/AT:[NP]\/PR:[NLH]\/UI:[NPA]\/VC:[NLH]\/VI:[NLH]\/VA:[NLH]\/SC:[NLH]\/SI:[NLH]\/SA:[NLH](\/.*)?$/;

// ─── CWE Entry ───────────────────────────────────────────
export const cweCreateSchema = z.object({
  id: z.coerce
    .number()
    .int("CWE ID must be an integer")
    .positive("CWE ID must be positive"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  description: emptyToNull,
});

// ─── OWASP Entry ─────────────────────────────────────────
export const owaspCreateSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(50, "Code must be at most 50 characters"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  version: z
    .string()
    .min(1, "Version is required")
    .max(10, "Version must be at most 10 characters"),
});

// ─── Finding Template ────────────────────────────────────
export const templateCreateSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  severity: z
    .enum(["Critical", "High", "Medium", "Low", "Info", "None"])
    .default("Info"),
  cvssScore: z.coerce
    .number()
    .min(0.0, "CVSS score must be between 0.0 and 10.0")
    .max(10.0, "CVSS score must be between 0.0 and 10.0")
    .default(0.0),
  cvssVector: z
    .string()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine((v) => v === null || cvssVectorRegex.test(v), {
      message: "Invalid CVSS 4.0 vector format",
    }),
  description: emptyToNull,
  impact: emptyToNull,
  recommendation: emptyToNull,
  referencesLink: emptyToNull,
  cweId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => (v === 0 || v === undefined ? null : v)),
  owaspId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => (v === 0 || v === undefined ? null : v)),
});

export const templateUpdateSchema = z.object({
  id: z.string().uuid("Invalid template ID"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters"),
  severity: z
    .enum(["Critical", "High", "Medium", "Low", "Info", "None"])
    .default("Info"),
  cvssScore: z.coerce
    .number()
    .min(0.0, "CVSS score must be between 0.0 and 10.0")
    .max(10.0, "CVSS score must be between 0.0 and 10.0")
    .default(0.0),
  cvssVector: z
    .string()
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine((v) => v === null || cvssVectorRegex.test(v), {
      message: "Invalid CVSS 4.0 vector format",
    }),
  description: emptyToNull,
  impact: emptyToNull,
  recommendation: emptyToNull,
  referencesLink: emptyToNull,
  cweId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => (v === 0 || v === undefined ? null : v)),
  owaspId: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .transform((v) => (v === 0 || v === undefined ? null : v)),
});

export type CweCreateInput = z.infer<typeof cweCreateSchema>;
export type OwaspCreateInput = z.infer<typeof owaspCreateSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
