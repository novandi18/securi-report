import { z } from "zod";

const emptyToNull = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v));

// CVSS 4.0 vector validation regex
const cvssVectorRegex =
  /^CVSS:4\.0\/AV:[NALP]\/AC:[LH]\/AT:[NP]\/PR:[NLH]\/UI:[NPA]\/VC:[NLH]\/VI:[NLH]\/VA:[NLH]\/SC:[NLH]\/SI:[NLH]\/SA:[NLH](\/.*)?$/;

export const reportCreateSchema = z
  .object({
    customerId: z
      .string()
      .min(1, "Customer is required")
      .uuid("Invalid customer ID"),
    reportIdCustom: emptyToNull,
    title: z
      .string()
      .min(1, "Title is required")
      .max(255, "Title must be at most 255 characters"),
    executiveSummary: emptyToNull,
    scopeIssa1: emptyToNull,
    scopeIssa2: emptyToNull,
    scopeIssa3: emptyToNull,
    methodology: emptyToNull,
    referencesFramework: emptyToNull,
    cvssVector: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined || v === null ? null : v))
      .refine(
        (v) => v === null || cvssVectorRegex.test(v),
        { message: "Invalid CVSS 4.0 vector format" },
      ),
    impact: emptyToNull,
    recommendationSummary: emptyToNull,
    auditDate: emptyToNull,
    status: z.enum(["Open", "Closed", "Draft"]).default("Draft"),
  });

export const reportUpdateSchema = z
  .object({
    id: z.string().uuid("Invalid report ID"),
    customerId: z
      .string()
      .min(1, "Customer is required")
      .uuid("Invalid customer ID"),
    reportIdCustom: emptyToNull,
    title: z
      .string()
      .min(1, "Title is required")
      .max(255, "Title must be at most 255 characters"),
    executiveSummary: emptyToNull,
    scopeIssa1: emptyToNull,
    scopeIssa2: emptyToNull,
    scopeIssa3: emptyToNull,
    methodology: emptyToNull,
    referencesFramework: emptyToNull,
    cvssVector: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === undefined || v === null ? null : v))
      .refine(
        (v) => v === null || cvssVectorRegex.test(v),
        { message: "Invalid CVSS 4.0 vector format" },
      ),
    impact: emptyToNull,
    recommendationSummary: emptyToNull,
    auditDate: emptyToNull,
    status: z.enum(["Open", "Closed", "Draft"]).default("Draft"),
  });

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
