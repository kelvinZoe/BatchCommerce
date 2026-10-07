import { describe, expect, it } from "vitest";
import { publicEnvironmentSchema, serverEnvironmentSchema } from "./schema";

const publicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_key"
};

const serverEnvironment = {
  ...publicEnvironment,
  SUPABASE_SERVICE_ROLE_KEY: "service_role_example_key",
  RESEND_API_KEY: "re_example_key",
  RATE_LIMIT_HMAC_SECRET: "r".repeat(32),
  APP_BASE_URL: "https://staging.example.com"
};

describe("environment schemas", () => {
  it("accepts a valid public environment", () => {
    expect(publicEnvironmentSchema.parse(publicEnvironment)).toEqual(publicEnvironment);
  });

  it("rejects a service-role key that is accidentally exposed as public config", () => {
    expect(
      publicEnvironmentSchema.safeParse({
        ...publicEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_accidental_server_key"
      }).success
    ).toBe(false);
  });

  it("rejects an invalid Supabase URL", () => {
    expect(
      publicEnvironmentSchema.safeParse({
        ...publicEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url"
      }).success
    ).toBe(false);
  });

  it("requires a server-only service-role key", () => {
    expect(serverEnvironmentSchema.safeParse(publicEnvironment).success).toBe(false);
  });

  it("accepts complete server-only configuration", () => {
    expect(serverEnvironmentSchema.parse(serverEnvironment)).toEqual(serverEnvironment);
  });

  it("requires a strong, separate rate-limit HMAC secret", () => {
    expect(
      serverEnvironmentSchema.safeParse({
        ...serverEnvironment,
        RATE_LIMIT_HMAC_SECRET: "too-short"
      }).success
    ).toBe(false);
  });

  it("requires explicit email delivery and callback configuration", () => {
    expect(
      serverEnvironmentSchema.safeParse({
        ...serverEnvironment,
        RESEND_API_KEY: undefined,
        APP_BASE_URL: undefined
      }).success
    ).toBe(false);
  });
});
