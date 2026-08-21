import { publicEnvironmentSchema, type PublicEnvironment } from "./schema";

let cachedEnvironment: PublicEnvironment | undefined;

export function getPublicEnvironment(): PublicEnvironment {
  cachedEnvironment ??= publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  });

  return cachedEnvironment;
}
