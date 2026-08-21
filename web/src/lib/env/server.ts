import "server-only";

import { serverEnvironmentSchema, type ServerEnvironment } from "./schema";

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_LOGO_URL: process.env.EMAIL_LOGO_URL,
    APP_BASE_URL: process.env.APP_BASE_URL
  });

  return cachedEnvironment;
}
