import { z } from "zod";

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20)
});

export const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_LOGO_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional()
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
