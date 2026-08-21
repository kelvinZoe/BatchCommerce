import { z } from "zod";

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
