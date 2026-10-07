import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type SignInIdentity = { email: string } | { phone: string };

function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = "";
  if (trimmed.startsWith("+")) normalized = `+${digits}`;
  else if (digits.startsWith("233") && digits.length === 12) normalized = `+${digits}`;
  else if (digits.startsWith("0") && digits.length === 10) normalized = `+233${digits.slice(1)}`;

  const normalizedDigits = normalized.replace(/\D/g, "");
  return normalizedDigits.length >= 10 && normalizedDigits.length <= 15 ? normalized : null;
}
export async function resolveSignInIdentity(
  identifier: string,
  adminClient: SupabaseClient<Database>
): Promise<SignInIdentity | null> {
  const normalized = identifier.trim().toLowerCase();
  if (normalized.includes("@")) return { email: normalized };

  const phone = normalizePhone(normalized);
  if (phone) return { phone };

  const { data, error } = await adminClient
    .from("app_users")
    .select("email")
    .eq("username", normalized)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not resolve that sign-in identifier.");
  return data?.email ? { email: data.email.trim().toLowerCase() } : null;
}
