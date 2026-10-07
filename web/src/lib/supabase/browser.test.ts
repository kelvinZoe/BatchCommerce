import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createBrowserClient: vi.fn(() => ({ client: true })) }));

vi.mock("@supabase/ssr", () => ({ createBrowserClient: mocks.createBrowserClient }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnvironment: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_key"
  })
}));

import { createBrowserSupabaseClient } from "./browser";

it("leaves callback exchange exclusively to the explicit callback handler", () => {
  createBrowserSupabaseClient();

  expect(mocks.createBrowserClient).toHaveBeenCalledWith(
    "https://example.supabase.co",
    "sb_publishable_example_key",
    { auth: { detectSessionInUrl: false } }
  );
});
