import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTesting } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(resetRateLimitsForTesting);

  it("blocks requests above the limit within a window", () => {
    expect(checkRateLimit("ip", { limit: 2, windowMs: 1_000, now: 0 }).allowed).toBe(true);
    expect(checkRateLimit("ip", { limit: 2, windowMs: 1_000, now: 1 }).allowed).toBe(true);
    expect(checkRateLimit("ip", { limit: 2, windowMs: 1_000, now: 2 }).allowed).toBe(false);
  });

  it("starts a new window after expiry", () => {
    checkRateLimit("ip", { limit: 1, windowMs: 1_000, now: 0 });
    expect(checkRateLimit("ip", { limit: 1, windowMs: 1_000, now: 1_000 }).allowed).toBe(
      true
    );
  });
});
