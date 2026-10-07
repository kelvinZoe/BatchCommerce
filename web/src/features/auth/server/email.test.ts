import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnvironment: () => ({
    RESEND_API_KEY: "re_example_key",
    APP_BASE_URL: "https://staging.example.com"
  })
}));

import { sendResendEmail, wasEmailDefinitivelyRejected } from "./email";

const message = {
  to: "ama@example.com",
  subject: "Test",
  text: "Test",
  html: "<p>Test</p>",
  idempotencyKey: "test/123"
};

describe("sendResendEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks a provider rejection as definitive", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("invalid sender", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await sendResendEmail(message).catch((caught) => caught);

    expect(wasEmailDefinitivelyRejected(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "Idempotency-Key": "test/123" })
    });
  });

  it("does not treat a network failure as a definitive rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const error = await sendResendEmail(message).catch((caught) => caught);

    expect(wasEmailDefinitivelyRejected(error)).toBe(false);
  });

  it("treats a provider-side failure as ambiguous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("provider unavailable", { status: 503 }))
    );

    const error = await sendResendEmail(message).catch((caught) => caught);

    expect(wasEmailDefinitivelyRejected(error)).toBe(false);
  });

  it("safely retries an ambiguous failure with the same idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "email-id" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendResendEmail(message)).resolves.toEqual({
      providerMessageId: "email-id"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "Idempotency-Key": "test/123" })
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "Idempotency-Key": "test/123" })
    });
  });
});
