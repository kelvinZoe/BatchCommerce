type RequestHeaders = Pick<Headers, "get">;

function firstForwardedAddress(value: string | null): string | null {
  const address = value?.split(",")[0]?.trim();
  return address || null;
}

export function getClientIp(requestHeaders: RequestHeaders): string {
  return (
    firstForwardedAddress(requestHeaders.get("x-vercel-forwarded-for")) ||
    firstForwardedAddress(requestHeaders.get("x-forwarded-for")) ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
