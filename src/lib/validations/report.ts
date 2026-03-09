import { z } from "zod";

const emptyToNull = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v === "" || v === undefined || v === null ? null : v));

// CVSS 4.0 vector validation regex
const cvssVectorRegex =
  /^CVSS:4\.0\/AV:[NALP]\/AC:[LH]\/AT:[NP]\/PR:[NLH]\/UI:[NPA]\/VC:[NLH]\/VI:[NLH]\/VA:[NLH]\/SC:[NLH]\/SI:[NLH]\/SA:[NLH](\/.*)?$/;

// Shared finding fields used by both create and update schemas
const findingFields = {
  customerId: z
    .string()
    .min(1, "Customer is required")
    .uuid("Invalid customer ID"),
  reportIdCustom: emptyToNull,
  title: z
    .string()
    .min(1, "Finding title is required")
    .max(255, "Title must be at most 255 characters"),
  // Issue Reference Builder components
  clientCode: z
    .string()
    .max(10, "Client code must be at most 10 characters")
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  serviceAffected: z
    .string()
    .max(50, "Service must be at most 50 characters")
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  findingSequence: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null;
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    }),
  issueReferenceNumber: emptyToNull,
  severity: z.enum(["Critical", "High", "Medium", "Low", "Info"]).default("Info"),
  location: emptyToNull,
  description: emptyToNull,
  pocText: emptyToNull,
  referencesList: emptyToNull,
  // Retained fields
  cvssVector: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v))
    .refine(
      (v) => v === null || cvssVectorRegex.test(v),
      { message: "Invalid CVSS 4.0 vector format" },
    ),
  cvssScore: emptyToNull,
  impact: emptyToNull,
  recommendation: emptyToNull,
  auditDate: emptyToNull,
  status: z.enum(["Open", "Closed", "Draft"]).default("Draft"),
};

export const reportCreateSchema = z.object(findingFields);

export const reportUpdateSchema = z.object({
  id: z.string().uuid("Invalid report ID"),
  ...findingFields,
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
