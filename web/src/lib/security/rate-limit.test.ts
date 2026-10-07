import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn()
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({ RATE_LIMIT_HMAC_SECRET: "r".repeat(32) })
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ rpc: mocks.rpc })
}));

import {
  checkRateLimit,
  hashRateLimitIdentifier,
  RateLimitUnavailableError
} from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("returns the shared RPC result without exposing the raw identifier", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: true, remaining: 3, retry_after_seconds: 42 }],
      error: null
    });

    await expect(
      checkRateLimit("sign-in", "203.0.113.8", { limit: 5, windowMs: 60_000 })
    ).resolves.toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 42 });

    const expectedHash = hashRateLimitIdentifier(
      "r".repeat(32),
      "sign-in",
      "203.0.113.8"
    );
    expect(mocks.rpc).toHaveBeenCalledWith("consume_request_rate_limit", {
      p_scope: "sign-in",
      p_key_hash: expectedHash,
      p_limit: 5,
      p_window_seconds: 60
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("203.0.113.8");
  });

  it("preserves an exhausted-window response", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after_seconds: 9 }],
      error: null
    });

    await expect(
      checkRateLimit("register", "unknown", { limit: 1, windowMs: 1_000 })
    ).resolves.toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 9 });
  });

  it("fails closed when the shared store cannot answer", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" }
    });

    await expect(
      checkRateLimit("password-reset", "unknown", { limit: 5, windowMs: 1_000 })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});
