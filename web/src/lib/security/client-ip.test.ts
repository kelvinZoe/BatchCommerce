import { describe, expect, it } from "vitest";
import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("prefers Vercel's trusted forwarded address", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.1",
      "x-forwarded-for": "198.51.100.4",
      "x-real-ip": "192.0.2.2"
    });

    expect(getClientIp(headers)).toBe("203.0.113.8");
  });

  it("uses the first standard forwarded address outside Vercel", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.4, 10.0.0.1",
      "x-real-ip": "192.0.2.2"
    });

    expect(getClientIp(headers)).toBe("198.51.100.4");
  });

  it("falls back safely when no address is available", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
