import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2.95.3';

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function publicKey(): string {
  return Deno.env.get('SUPABASE_ANON_KEY')
    || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    || requiredEnv('SUPABASE_ANON_KEY');
}

function serviceKey(): string {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    || Deno.env.get('SUPABASE_SECRET_KEY')
    || requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), serviceKey(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function userClient(accessToken: string): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), publicKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

export interface AuthContext {
  user: User;
  accessToken: string;
  admin: SupabaseClient;
  scoped: SupabaseClient;
}

export async function requireUser(request: Request): Promise<AuthContext> {
  const header = request.headers.get('authorization') || '';
  const accessToken = header.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) throw new Error('Sign in is required.');

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error('Your session is invalid or has expired.');

  return { user: data.user, accessToken, admin, scoped: userClient(accessToken) };
}

export async function requireShopPermission(
  context: AuthContext,
  shopId: string,
  action: 'view' | 'create'
): Promise<void> {
  const { data, error } = await context.scoped.rpc('has_shop_permission', {
    p_shop_id: shopId,
    p_resource: 'billing',
    p_action: action
  });

  if (error || data !== true) {
    throw new Error(action === 'create'
      ? 'You do not have permission to make subscription payments for this shop.'
      : 'You do not have permission to view billing for this shop.');
  }
}

export async function requirePlatformAdmin(context: AuthContext): Promise<void> {
  const { data, error } = await context.admin.rpc('is_platform_admin', {
    p_user_id: context.user.id
  });
  if (error || data !== true) throw new Error('Platform administrator access is required.');
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function consumeRateLimit(
  context: AuthContext,
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const { data, error } = await context.admin.rpc('consume_request_rate_limit', {
    p_scope: scope,
    p_key_hash: await sha256(key),
    p_limit: limit,
    p_window_seconds: windowSeconds
  });

  if (error) throw new Error(error.message || 'Could not check request rate limit.');
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    throw new Error(`Too many attempts. Try again in ${Number(result?.retry_after_seconds || 60)} seconds.`);
  }
}
