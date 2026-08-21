import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/lib/env/public";
import type { Database } from "./database.types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnvironment();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies. The request proxy
            // refreshes sessions before render and performs the writable update.
          }
        }
      }
    }
  );
}
