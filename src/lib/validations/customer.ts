import { z } from "zod";

export const customerCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Customer name is required")
    .max(255, "Name must be at most 255 characters"),
  code: z
    .string()
    .min(1, "Customer code is required")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9]+$/, "Code must contain only uppercase letters and numbers"),
  logoUrl: z
    .string()
    .url("Invalid URL")
    .max(255, "URL is too long")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

export const customerUpdateSchema = customerCreateSchema.extend({
  id: z.string().uuid("Invalid customer ID"),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
