import { z } from "zod";
import { isValidInternationalPhone, normalizePhoneNumber } from "../lib/normalization";

const formString = (schema: z.ZodString) =>
  z.preprocess((value) => (typeof value === "string" ? value : ""), schema);

export const loginSchema = z.object({
  identifier: formString(z.string().trim().min(1, "Please enter your email or username.")),
  password: formString(z.string().min(1, "Please enter your password."))
});

export const passwordResetRequestSchema = z.object({
  email: formString(
    z.string().trim().toLowerCase().min(1, "Email is required.").email("Enter a valid email address.")
  )
});

export const updatePasswordSchema = z
  .object({
    password: formString(z.string().min(6, "Password must be at least 6 characters.").max(128)),
    confirmPassword: formString(z.string())
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

const fullNameSchema = formString(
  z.string().trim().min(2, "Please enter your full name.").max(100, "Full name is too long.")
);

const emailSchema = formString(
  z.string().trim().toLowerCase().min(1, "Please enter your email.").email("Enter a valid email address like user@example.com.")
);

const phoneSchema = formString(
  z.string().trim().min(1, "Please enter your phone number.")
)
  .transform(normalizePhoneNumber)
  .refine(isValidInternationalPhone, "Enter a valid international phone number.");

export const registrationSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: formString(
    z.string().min(6, "Password must be at least 6 characters.").max(128, "Password is too long.")
  )
});

export const workspaceSetupSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  shopName: formString(
    z.string().trim().min(2, "Please enter your shop name.").max(120, "Shop name is too long.")
  )
});

export const workspaceBootstrapResultSchema = z.object({
  appUserId: z.number().int().positive(),
  shopId: z.string().uuid(),
  shopName: z.string().min(1),
  shopSlug: z.string().min(1),
  roleId: z.number().int().positive(),
  roleName: z.string().min(1),
  membershipId: z.number().int().positive(),
  username: z.string().min(1),
  email: z.string().email()
});
