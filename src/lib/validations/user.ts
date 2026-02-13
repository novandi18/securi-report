import { z } from "zod";

export const userCreateSchema = z.object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens, and underscores",
      ),
    email: z
      .string()
      .email("Invalid email address")
      .max(100, "Email must be at most 100 characters"),
    role: z.enum(["administrator", "editor", "viewer"]).default("viewer"),
  });

export const userUpdateSchema = z
  .object({
    id: z.string().min(1, "User ID is required"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens, and underscores",
      ),
    email: z
      .string()
      .email("Invalid email address")
      .max(100, "Email must be at most 100 characters"),
    password: z
      .string()
      .max(128, "Password must be at most 128 characters")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
    role: z.enum(["administrator", "editor", "viewer"]).default("viewer"),
  })
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return data.password.length >= 8;
      }
      return true;
    },
    {
      message: "Password must be at least 8 characters",
      path: ["password"],
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return /[A-Z]/.test(data.password);
      }
      return true;
    },
    {
      message: "Password must contain at least one uppercase letter",
      path: ["password"],
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return /[a-z]/.test(data.password);
      }
      return true;
    },
    {
      message: "Password must contain at least one lowercase letter",
      path: ["password"],
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return /[0-9]/.test(data.password);
      }
      return true;
    },
    {
      message: "Password must contain at least one number",
      path: ["password"],
    },
  )
  .refine(
    (data) => {
      if (data.password && data.password.length > 0) {
        return /[^A-Za-z0-9]/.test(data.password);
      }
      return true;
    },
    {
      message: "Password must contain at least one special character",
      path: ["password"],
    },
  );

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
