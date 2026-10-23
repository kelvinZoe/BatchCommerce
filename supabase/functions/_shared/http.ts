const configuredOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') || Deno.env.get('APP_BASE_URL') || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const developmentOrigins = ['http://localhost:4200', 'http://localhost:4300'];

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')?.replace(/\/$/, '') || '';
  const allowed = [...configuredOrigins, ...developmentOrigins];
  const allowOrigin = allowed.includes(origin) ? origin : (configuredOrigins[0] || developmentOrigins[1]);

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(request) });
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

export async function readJson<T extends Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error('A valid JSON request body is required.');
  }
}
