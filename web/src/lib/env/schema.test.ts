import { describe, expect, it } from "vitest";
import { publicEnvironmentSchema, serverEnvironmentSchema } from "./schema";

const publicEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_key"
};

describe("environment schemas", () => {
  it("accepts a valid public environment", () => {
    expect(publicEnvironmentSchema.parse(publicEnvironment)).toEqual(publicEnvironment);
  });

  it("rejects a service-role key that is accidentally exposed as public config", () => {
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
});
