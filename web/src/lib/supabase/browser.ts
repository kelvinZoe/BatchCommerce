"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/lib/env/public";
import type { Database } from "./database.types";

export function createBrowserSupabaseClient() {
  const environment = getPublicEnvironment();

  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
