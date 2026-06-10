import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Role, Permission, AppResource, PermissionAction,
  DashboardComponentConfig, ProductPermissionConfig,
  OrdersPermissionConfig, BuyingListPermissionConfig, ArrivalsPermissionConfig,
  ShippingPermissionConfig, ShippingLedgerPermissionConfig, StockSalesPermissionConfig,
  ManageBatchesPermissionConfig, RolesPermissionConfig, UsersPermissionConfig,
  MembershipStatus
} from '../models';
import { SupabaseService } from './supabase.service';
import { ShopConfigService } from './shop-config.service';
import { environment } from '../../environments/environment';

function toCamel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[ck] = v;
  }
  return out;
}

export interface WorkspaceRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface WorkspaceBootstrapInput {
  fullName: string;
  email: string;
  shopName: string;
  shopSlug?: string;
  phone: string;
}

export interface WorkspaceBootstrapResult {
  success: boolean;
  message: string;
  requiresVerification?: boolean;
}

export interface LoginResult {
  success: boolean;
  message: string;
  requiresSetup?: boolean;
  requiresPhoneVerification?: boolean;
  verificationPhone?: string;
}

export interface UserCreationResult {
  id: number;
  membershipStatus: MembershipStatus;
  verificationSent?: boolean;
  verificationMessage?: string;
}

export interface UserIdentityAvailabilityResult {
  username: string;
  email: string;
  usernameAvailable: boolean;
  emailAvailable: boolean;
  suggestedUsername?: string | null;
}

export interface ShopProfileUpdateResult {
  success: boolean;
  message: string;
  shopName: string;
  shopSlug: string;
}

export interface VerificationDispatchResult {
  success: boolean;
  message: string;
  email?: string;
}

export interface PhoneVerificationResult {
  success: boolean;
  message: string;
  phone?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly productionAdminApiUrl = 'https://batchcommerce-admin.onrender.com';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private permissionsSubject = new BehaviorSubject<Permission[]>([]);
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  currentUser$ = this.currentUserSubject.asObservable();
  permissions$ = this.permissionsSubject.asObservable();

  private get sb() { return this.supa.client; }

  private get adminApiSecret(): string | null {
    // Optional manual override only; do not ship the secret in client builds.
    return sessionStorage.getItem('shakhis_admin_api_secret') || null;
  }

  constructor(private supa: SupabaseService, private shopConfig: ShopConfigService) {
    // Restore session from localStorage (quick restore while Supabase SDK checks JWT)
    const saved = localStorage.getItem('shakhis_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.currentUserSubject.next(data.user);
        this.permissionsSubject.next(data.permissions || []);
      } catch { /* corrupted, ignore */ }
    }

    // Only listen for auth state changes if Supabase is already initialized
    // (it won't be on first launch before shop setup)
    if (this.supa.isReady) {
      this.sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          this.clearSession();
        }
      });
    }
  }

  private mapPermissionRows(rows: any[]): Permission[] {
    return (rows || []).map((p: any) => ({
      ...toCamel(p) as Permission,
      dashboardConfig: p.resource === 'dashboard' ? (p.dashboard_config || null) : undefined,
      productConfig: p.resource === 'products' ? (p.product_config || null) : undefined,
      ordersConfig: p.resource === 'orders' ? (p.orders_config || null) : undefined,
      buyingListConfig: p.resource === 'buying_list' ? (p.buying_list_config || null) : undefined,
      arrivalsConfig: p.resource === 'arrivals' ? (p.arrivals_config || null) : undefined,
      shippingConfig: p.resource === 'shipping' ? (p.shipping_config || null) : undefined,
      shippingLedgerConfig: p.resource === 'shipping' ? (p.shipping_ledger_config || null) : undefined,
      stockSalesConfig: p.resource === 'stock_sales' ? (p.stock_sales_config || null) : undefined,
      manageBatchesConfig: p.resource === 'batches' ? (p.manage_batches_config || null) : undefined,
      rolesConfig: p.resource === 'roles' ? (p.roles_config || null) : undefined,
      usersConfig: p.resource === 'users' ? (p.users_config || null) : undefined
    }));
  }

  private async loadPermissionsForRole(roleId: number): Promise<Permission[]> {
    const shopId = this.activeShopId;
    let query = this.sb.from('role_permissions').select('*').eq('role_id', roleId);
    if (shopId) {
      query = query.eq('shop_id', shopId);
    }
    const { data } = await query;
    return this.mapPermissionRows(data || []);
  }

  private async resolveMembershipForAuthUser(authUserId: string, preferredShopId?: string | null): Promise<any | null> {
    const fullSelect = 'id, shop_id, auth_user_id, app_user_id, role_id, is_owner, is_active, membership_status, accepted_at, last_selected_at, shops(id, name, slug), roles(id, name), app_users!shop_memberships_app_user_id_fkey(username, full_name, email, phone)';
    const fallbackSelect = 'id, shop_id, auth_user_id, app_user_id, role_id, is_owner, is_active, last_selected_at, shops(id, name, slug), roles(id, name), app_users!shop_memberships_app_user_id_fkey(username, full_name, email, phone)';

    const runQuery = async (shopId?: string | null, useFallbackSelect = false): Promise<any | null> => {
      let query = this.sb.from('shop_memberships')
        .select(useFallbackSelect ? fallbackSelect : fullSelect)
        .eq('auth_user_id', authUserId)
        .eq('is_active', true)
        .order('is_owner', { ascending: false })
        .order('last_selected_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data, error } = await query;

      if (error) {
        const code = String(error.code || '').toUpperCase();
        const msg = String(error.message || '').toLowerCase();
        const missingColumns = (code === '42703' || code === 'PGRST204')
          && (msg.includes('membership_status') || msg.includes('accepted_at') || msg.includes('column'));

        if (!useFallbackSelect && missingColumns) {
          return runQuery(shopId, true);
        }

        throw new Error(error.message || 'Failed to load shop membership');
      }

      return data && data.length > 0 ? data[0] : null;
    };

    const scopedCandidates = Array.from(new Set([
      this.shopConfig.shopId,
      preferredShopId || null
    ].filter((value): value is string => !!value)));

    for (const shopId of scopedCandidates) {
      const scopedMatch = await runQuery(shopId);
      if (scopedMatch) {
        return scopedMatch;
      }
    }

    return runQuery();
  }

  private buildUserFromMembership(authUser: any, membership: any): User {
    const profile = Array.isArray(membership.app_users) ? membership.app_users[0] : membership.app_users;
    const membershipStatus = (membership.membership_status || 'active') as MembershipStatus;
    return {
      id: membership.app_user_id ?? undefined,
      authId: authUser.id,
      shopId: membership.shop_id,
      membershipId: membership.id,
      username: profile?.username || authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'user',
      fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || authUser.phone || 'User',
      email: profile?.email || authUser.email || authUser.user_metadata?.email || '',
      phone: profile?.phone || authUser.phone || authUser.user_metadata?.phone || '',
      roleId: membership.role_id ?? 0,
      roleName: membership.roles?.name || 'Member',
      isActive: membershipStatus === 'active' && membership.is_active !== false,
      membershipStatus,
      phoneVerifiedAt: profile?.phone_verified_at || undefined
    };
  }

  normalizePhoneNumber(value: string): string {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return '';
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (trimmed.startsWith('+')) {
      return `+${digits}`;
    }

    if (digits.startsWith('233') && digits.length === 12) {
      return `+${digits}`;
    }

    if (digits.startsWith('0') && digits.length === 10) {
      return `+233${digits.slice(1)}`;
    }

    return digits.length >= 10 ? `+${digits}` : digits;
  }

  normalizeEmail(value: string): string {
    return (value || '').trim().toLowerCase();
  }

  normalizeUsername(value: string): string {
    const normalized = (value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '')
      .replace(/[-._]{2,}/g, '-');

    return normalized;
  }

  buildUsernameFromFullName(fullName: string): string {
    const base = this.normalizeUsername(fullName);
    return base || 'user';
  }

  isValidEmail(value: string): boolean {
    const normalized = this.normalizeEmail(value);
    return this.emailPattern.test(normalized);
  }

  isValidPhoneNumber(value: string): boolean {
    const normalized = this.normalizePhoneNumber(value);
    const digits = normalized.replace(/\D/g, '');
    return normalized.startsWith('+') && digits.length >= 10 && digits.length <= 15;
  }

  private sanitizeEmailLocalPart(value: string): string {
    const normalized = (value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '')
      .replace(/[-._]{2,}/g, '-');

    return normalized || 'user';
  }

  private getSyntheticUserDomain(): string {
    const rawShopLabel = this.shopConfig.config?.shopSlug || this.shopConfig.shopName || 'shop';
    const normalized = rawShopLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'shop';
  }

  private buildSyntheticUserEmail(identifier: string): string {
    const normalized = (identifier || '').trim().toLowerCase();
    if (normalized.includes('@')) {
      return normalized;
    }

    const localPart = `${this.sanitizeEmailLocalPart(normalized)}+${this.getSyntheticUserDomain()}`;
    return `${localPart}@${this.getInternalUserEmailDomain()}`;
  }

  private getInternalUserEmailDomain(): string {
    const rawUrl = this.shopConfig.supabaseUrl || environment.supabaseUrl || '';
    try {
      return new URL(rawUrl).host.toLowerCase();
    } catch {
      return 'supabase.co';
    }
  }
  private buildLegacySyntheticEmail(identifier: string): string {
    const normalized = (identifier || '').trim().toLowerCase();
    if (normalized.includes('@')) {
      return normalized;
    }

    return `${this.sanitizeEmailLocalPart(normalized)}@shakhis.com`;
  }

  private normalizeShopSlug(value: string): string {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return slug || 'shop';
  }

  updateActiveShopProfile(shopName: string, shopSlug?: string): Observable<ShopProfileUpdateResult> {
    return from(this.doUpdateActiveShopProfile(shopName, shopSlug));
  }

  private async doUpdateActiveShopProfile(shopName: string, shopSlug?: string): Promise<ShopProfileUpdateResult> {
    const shopId = this.requireActiveShopId();
    const trimmedName = String(shopName || '').trim();

    if (!trimmedName) {
      throw new Error('Business name is required.');
    }

    const normalizedSlug = this.normalizeShopSlug(
      shopSlug || this.shopConfig.config?.shopSlug || trimmedName
    );

    if (this.usesManagedPhoneIdentity) {
      const adminApiUrl = this.getNormalizedAdminApiUrl();
      if (!adminApiUrl) {
        throw new Error('Admin API is not configured.');
      }

      let authHeader = await this.getAdminApiAuthorizationHeader(true);
      let response = await fetch(`${adminApiUrl}/admin/update-shop-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({
          shopId,
          name: trimmedName,
          slug: normalizedSlug
        })
      });

      if (response.status === 401 && this.adminApiSecret) {
        sessionStorage.removeItem('shakhis_admin_api_secret');
        authHeader = await this.getAdminApiAuthorizationHeader(false);
        response = await fetch(`${adminApiUrl}/admin/update-shop-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader
          },
          body: JSON.stringify({
            shopId,
            name: trimmedName,
            slug: normalizedSlug
          })
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || 'Failed to update shop profile.');
      }

      const finalName = String(payload?.shopName || trimmedName).trim();
      const finalSlug = this.normalizeShopSlug(payload?.shopSlug || normalizedSlug);

      this.shopConfig.saveConfig({
        shopId,
        shopName: finalName,
        shopSlug: finalSlug
      });

      return {
        success: true,
        message: 'Shop profile updated successfully.',
        shopName: finalName,
        shopSlug: finalSlug
      };
    }

    const { error } = await this.sb.from('shops').update({
      name: trimmedName,
      slug: normalizedSlug
    }).eq('id', shopId);

    if (error) {
      throw new Error(error.message || 'Failed to update shop profile.');
    }

    this.shopConfig.saveConfig({
      shopId,
      shopName: trimmedName,
      shopSlug: normalizedSlug
    });

    return {
      success: true,
      message: 'Shop profile updated successfully.',
      shopName: trimmedName,
      shopSlug: normalizedSlug
    };
  }

  checkUserIdentityAvailability(username: string, email = '', excludeUserId?: number): Observable<UserIdentityAvailabilityResult> {
    return from(this.doCheckUserIdentityAvailability(username, email, excludeUserId));
  }

  private async doCheckUserIdentityAvailability(username: string, email = '', excludeUserId?: number): Promise<UserIdentityAvailabilityResult> {
    const normalizedUsername = this.normalizeUsername(username);
    const normalizedEmail = this.normalizeEmail(email);

    if (this.usesManagedPhoneIdentity) {
      return this.checkUserIdentityAvailabilityViaAdminApi(normalizedUsername, normalizedEmail, excludeUserId);
    }

    const [usernameResult, emailResult] = await Promise.all([
      normalizedUsername
        ? this.sb.from('app_users').select('id, username').eq('username', normalizedUsername).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
      normalizedEmail
        ? this.sb.from('app_users').select('id, email').eq('email', normalizedEmail).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any)
    ]);

    const usernameTaken = !!usernameResult.data && usernameResult.data.id !== excludeUserId;
    const emailTaken = !!emailResult.data && emailResult.data.id !== excludeUserId;

    return {
      username: normalizedUsername,
      email: normalizedEmail,
      usernameAvailable: !usernameTaken,
      emailAvailable: !emailTaken,
      suggestedUsername: usernameTaken ? `${normalizedUsername}-1` : normalizedUsername || null
    };
  }

  private async checkUserIdentityAvailabilityViaAdminApi(username: string, email: string, excludeUserId?: number): Promise<UserIdentityAvailabilityResult> {
    const adminApiUrl = this.getNormalizedAdminApiUrl();
    const shopId = this.requireActiveShopId();

    if (!adminApiUrl) {
      throw new Error('Admin API is not configured.');
    }

    let authHeader = await this.getAdminApiAuthorizationHeader(true);
    let response = await fetch(`${adminApiUrl}/admin/user-availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({ username, email, shopId, excludeUserId })
    });

    if (response.status === 401 && this.adminApiSecret) {
      sessionStorage.removeItem('shakhis_admin_api_secret');
      authHeader = await this.getAdminApiAuthorizationHeader(false);
      response = await fetch(`${adminApiUrl}/admin/user-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({ username, email, shopId, excludeUserId })
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || 'Could not validate username and email availability.');
    }

    return {
      username: this.normalizeUsername(payload?.username || username),
      email: this.normalizeEmail(payload?.email || email),
      usernameAvailable: !!payload?.usernameAvailable,
      emailAvailable: email ? !!payload?.emailAvailable : true,
      suggestedUsername: payload?.suggestedUsername || null
    };
  }

  private async trySignInWithCandidates(identifier: string, password: string) {
    const rawIdentifier = (identifier || '').trim();
    const normalized = this.normalizeEmail(rawIdentifier);
    let lastError: any = null;

    if (!normalized.includes('@') && this.isValidPhoneNumber(rawIdentifier)) {
      const phone = this.normalizePhoneNumber(rawIdentifier);
      const { data, error } = await this.sb.auth.signInWithPassword({ phone, password });
      if (!error && data?.user) {
        return { data, error: null };
      }
      lastError = error;
    }

    const resolvedEmail = normalized.includes('@') ? normalized : await this.resolveEmailForLoginIdentifier(normalized);

    const candidates = normalized.includes('@')
      ? [normalized]
      : Array.from(new Set([
          resolvedEmail,
          this.buildSyntheticUserEmail(normalized),
          `${this.sanitizeEmailLocalPart(normalized)}@${this.getInternalUserEmailDomain()}`,
          this.buildLegacySyntheticEmail(normalized)
        ].filter((value): value is string => !!value)));

    for (const email of candidates) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        return { data, error: null };
      }
      lastError = error;
    }

    return { data: null, error: lastError };
  }

  private async resolveEmailForLoginIdentifier(identifier: string): Promise<string | null> {
    const normalized = this.normalizeEmail(identifier);
    if (!normalized || normalized.includes('@')) {
      return normalized || null;
    }

    const { data, error } = await this.sb.from('app_users')
      .select('email')
      .eq('username', normalized)
      .limit(1)
      .maybeSingle();

    if (error || !data?.email) {
      return null;
    }

    return this.normalizeEmail(data.email);
  }

  private async hasPendingMembershipForAuthUser(authUserId: string): Promise<boolean> {
    const { data, error } = await this.sb.from('shop_memberships')
      .select('id')
      .eq('auth_user_id', authUserId)
      .eq('membership_status', 'pending_verification')
      .limit(1);

    if (error) {
      return false;
    }

    return !!(data && data.length > 0);
  }

  private async hasPendingMembershipForEmail(email: string): Promise<boolean> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return false;
    }

    const { data: appUser, error: appUserError } = await this.sb.from('app_users')
      .select('auth_id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (appUserError || !appUser?.auth_id) {
      return false;
    }

    return this.hasPendingMembershipForAuthUser(appUser.auth_id);
  }

  private async hasPendingMembershipForPhone(phone: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!this.isValidPhoneNumber(normalizedPhone)) {
      return false;
    }

    const { data: appUser, error: appUserError } = await this.sb.from('app_users')
      .select('auth_id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle();

    if (appUserError || !appUser?.auth_id) {
      return false;
    }

    return this.hasPendingMembershipForAuthUser(appUser.auth_id);
  }

  private async activatePendingMembershipsForAuthUser(authUserId: string): Promise<void> {
    const now = new Date().toISOString();

    const { error: membershipError } = await this.sb.from('shop_memberships').update({
      membership_status: 'active',
      is_active: true,
      accepted_at: now
    }).eq('auth_user_id', authUserId)
      .eq('membership_status', 'pending_verification');

    if (membershipError) {
      throw new Error(membershipError.message || 'Failed to activate the invited shop membership');
    }
  }

  private syncShopContextFromMembership(membership: any): void {
    if (!this.shopConfig.shopId || this.shopConfig.shopId !== membership.shop_id) {
      const shop = Array.isArray(membership.shops) ? membership.shops[0] : membership.shops;
      if (shop?.id && shop?.name) {
        this.shopConfig.saveConfig({
          shopId: shop.id,
          shopName: shop.name,
          shopSlug: shop.slug
        });
      }
    }
  }

  private formatPhoneVerificationError(error: any, mode: 'send' | 'verify'): string {
    const msg = (error?.message || '').toLowerCase();

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Too many verification requests. Please wait a moment and try again.';
    }

    if (msg.includes('expired') || msg.includes('invalid')) {
      return mode === 'verify'
        ? 'The verification code is invalid or has expired.'
        : 'Could not send the verification code.';
    }

    if (msg.includes('whatsapp') || msg.includes('sms provider') || msg.includes('channel')) {
      return 'WhatsApp OTP is not configured yet for this Supabase project. Configure the phone auth provider before using invited account verification.';
    }

    return error?.message || (mode === 'send' ? 'Could not send the verification code.' : 'Could not verify the code.');
  }

  private formatEmailVerificationError(error: any): string {
    const msg = (error?.message || '').toLowerCase();

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Too many verification requests. Please wait a moment and try again.';
    }

    if (msg.includes('smtp') || msg.includes('email provider') || msg.includes('mailer')) {
      return 'Email delivery is not configured yet for this Supabase project.';
    }

    if (msg.includes('already confirmed')) {
      return 'This email is already verified. The user can sign in now.';
    }

    return error?.message || 'Could not send the verification email.';
  }

  resendEmailVerification(email: string): Observable<VerificationDispatchResult> {
    return from(this.doResendEmailVerification(email));
  }

  private async doResendEmailVerification(email: string): Promise<VerificationDispatchResult> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!this.isValidEmail(normalizedEmail)) {
      return {
        success: false,
        message: 'Enter a valid email address first.',
        email: normalizedEmail
      };
    }

    const isolatedClient = this.buildIsolatedAuthClient();
    const { error } = await isolatedClient.auth.resend({
      type: 'signup',
      email: normalizedEmail
    });

    if (error) {
      return {
        success: false,
        message: this.formatEmailVerificationError(error),
        email: normalizedEmail
      };
    }

    return {
      success: true,
      message: `Verification email sent to ${normalizedEmail}.`,
      email: normalizedEmail
    };
  }

  sendPhoneVerificationOtp(phone: string, channel: 'sms' | 'whatsapp' = 'whatsapp'): Observable<PhoneVerificationResult> {
    return from(this.doSendPhoneVerificationOtp(phone, channel));
  }

  private async doSendPhoneVerificationOtp(phone: string, channel: 'sms' | 'whatsapp' = 'whatsapp'): Promise<PhoneVerificationResult> {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (!this.isValidPhoneNumber(normalizedPhone)) {
      return {
        success: false,
        message: 'Enter a valid phone number in international format such as +233241234567.',
        phone: normalizedPhone
      };
    }

    const isolatedClient = this.buildIsolatedAuthClient();
    const { error } = await isolatedClient.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: false,
        channel
      }
    });

    if (error) {
      return {
        success: false,
        message: this.formatPhoneVerificationError(error, 'send'),
        phone: normalizedPhone
      };
    }

    return {
      success: true,
      message: `Verification code sent to ${normalizedPhone} via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`,
      phone: normalizedPhone
    };
  }

  verifyPhoneOtp(phone: string, token: string): Observable<LoginResult> {
    return from(this.doVerifyPhoneOtp(phone, token));
  }

  private async doVerifyPhoneOtp(phone: string, token: string): Promise<LoginResult> {
    const normalizedPhone = this.normalizePhoneNumber(phone);
    const normalizedToken = (token || '').trim();

    if (!this.isValidPhoneNumber(normalizedPhone)) {
      return { success: false, message: 'Enter a valid phone number in international format such as +233241234567.' };
    }

    if (!normalizedToken) {
      return { success: false, message: 'Enter the verification code from WhatsApp.' };
    }

    const { data, error } = await this.sb.auth.verifyOtp({
      phone: normalizedPhone,
      token: normalizedToken,
      type: 'sms'
    });

    const authUser = data?.user;
    if (error || !authUser) {
      return { success: false, message: this.formatPhoneVerificationError(error, 'verify') };
    }

    await this.activatePendingMembershipsForAuthUser(authUser.id);

    const membership = await this.resolveMembershipForAuthUser(authUser.id);
    if (!membership) {
      this.clearSession();
      return {
        success: true,
        message: 'Phone verified. Sign in again to finish setup.',
        requiresSetup: true
      };
    }

    this.syncShopContextFromMembership(membership);
    const permissions = await this.loadPermissionsForRole(Number(membership.role_id));
    const user = this.buildUserFromMembership(authUser, membership);
    this.setSession(user, permissions);
    return { success: true, message: '' };
  }

  /** Call after shop setup completes to attach the auth listener */
  initAuthListener(): void {
    if (this.supa.isReady) {
      this.sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          this.clearSession();
        }
      });
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get permissions(): Permission[] {
    return this.permissionsSubject.value;
  }

  get usesManagedPhoneIdentity(): boolean {
    return !!environment.adminApiUrl;
  }

  private get activeShopId(): string | null {
    return this.currentUser?.shopId || this.shopConfig.shopId;
  }

  private requireActiveShopId(): string {
    const shopId = this.activeShopId;
    if (!shopId) {
      throw new Error('No active shop selected');
    }
    return shopId;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  get isAdmin(): boolean {
    return this.currentUser?.roleName === 'Admin';
  }

  // ─── Login ──────────────────────────────────────────
  login(email: string, password: string): Observable<LoginResult> {
    return from(this.doLogin(email, password));
  }

  private async doLogin(email: string, password: string): Promise<LoginResult> {
    try {
      // 1. Sign in with Supabase Auth
      const normalizedPhone = this.normalizePhoneNumber(email);
      const normalizedEmail = this.normalizeEmail(email);
      const resolvedEmail = normalizedEmail.includes('@') ? normalizedEmail : await this.resolveEmailForLoginIdentifier(normalizedEmail);
      const { data: authData, error: authError } = await this.trySignInWithCandidates(email, password);

      const authUser = authData?.user;
      if (authError || !authUser) {
        const authMessage = (authError?.message || '').toLowerCase();
        if (resolvedEmail && authMessage.includes('not confirmed') && await this.hasPendingMembershipForEmail(resolvedEmail)) {
          return {
            success: false,
            message: `Verify ${resolvedEmail} from the confirmation email before signing in.`
          };
        }

        if (this.isValidPhoneNumber(normalizedPhone) && await this.hasPendingMembershipForPhone(normalizedPhone)) {
          return {
            success: false,
            message: 'Verify your phone number first. Enter the code sent to your WhatsApp to activate this account.',
            requiresPhoneVerification: true,
            verificationPhone: normalizedPhone
          };
        }

        return { success: false, message: authError?.message || 'Invalid email, username, phone, or password' };
      }

      if (await this.hasPendingMembershipForAuthUser(authUser.id)) {
        await this.activatePendingMembershipsForAuthUser(authUser.id);
      }

      const shopIdHint = String(authUser.user_metadata?.['shop_id'] || authUser.app_metadata?.['shop_id'] || '').trim() || null;
      const membership = await this.resolveMembershipForAuthUser(authUser.id, shopIdHint);
      if (!membership) {
        if (await this.hasPendingMembershipForAuthUser(authUser.id)) {
          await this.sb.auth.signOut();
          this.clearSession();
          return {
            success: false,
            message: 'Verify your phone number first. Enter the code sent to your WhatsApp to activate this account.',
            requiresPhoneVerification: true,
            verificationPhone: authUser.phone || normalizedPhone
          };
        }

        this.currentUserSubject.next(null);
        this.permissionsSubject.next([]);
        return {
          success: true,
          message: 'Account sign-in complete. Finish creating your shop workspace.',
          requiresSetup: true
        };
      }

      this.syncShopContextFromMembership(membership);

      const permissions = await this.loadPermissionsForRole(Number(membership.role_id));
      const user = this.buildUserFromMembership(authUser, membership);
      this.setSession(user, permissions);
      return { success: true, message: '' };

    } catch (err: any) {
      return { success: false, message: err.message || 'Login failed' };
    }
  }

  registerAccount(fullName: string, email: string, password: string, phone = ''): Observable<{ success: boolean; message: string; sessionCreated?: boolean }> {
    return from(this.doRegisterAccount(fullName, email, password, phone));
  }

  private async signInAfterRegistration(email: string, password: string): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        return true;
      }

      await this.delay(300 * (attempt + 1));
    }

    return false;
  }

  private async doRegisterAccount(fullName: string, email: string, password: string, phone = ''): Promise<{ success: boolean; message: string; sessionCreated?: boolean }> {
    try {
      const normalizedEmail = this.normalizeEmail(email);
      const normalizedFullName = fullName.trim();
      const normalizedPhone = this.normalizePhoneNumber(phone);
      const adminApiUrl = this.getNormalizedAdminApiUrl();

      if (!this.isValidEmail(normalizedEmail)) {
        return { success: false, message: 'Enter a valid email address like user@example.com' };
      }

      if (!normalizedPhone) {
        return { success: false, message: 'Please enter your phone number' };
      }

      if (adminApiUrl) {
        const response = await fetch(`${adminApiUrl}/public/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            full_name: normalizedFullName,
            phone: normalizedPhone
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const rawMessage = String(payload?.detail || payload?.message || payload?.error || '').trim();
          const message = rawMessage.toLowerCase();

          if (response.status === 409 || message.includes('already registered') || message.includes('user_exists')) {
            return {
              success: false,
              message: 'This email is already registered. Please sign in instead.'
            };
          }

          if (response.status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
            return {
              success: false,
              message: 'Too many verification emails were requested. Please wait a bit and try again.'
            };
          }

          return {
            success: false,
            message: rawMessage || 'Could not create account'
          };
        }

        const emailSent = payload?.emailSent !== false;
        return {
          success: true,
          sessionCreated: false,
          message: emailSent
            ? `Account created. We sent a verification email to ${normalizedEmail}. Confirm it, then sign in to finish setting up your shop.`
            : 'Account created, but we could not send the verification email. Contact support or try again later.'
        };
      }

      const { data, error } = await this.sb.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedFullName,
            phone: normalizedPhone
          }
        }
      });

      if (error) {
        const message = (error.message || '').toLowerCase();
        if (message.includes('already registered')) {
          return {
            success: false,
            message: 'This email is already registered. Please sign in instead.'
          };
        }

        if (message.includes('rate limit') || message.includes('too many requests')) {
          return {
            success: false,
            message: 'Too many verification emails were requested. Please wait a bit and try again.'
          };
        }

        return {
          success: false,
          message: error.message || 'Could not create account'
        };
      }

      const sessionCreated = !!data?.session;
      return {
        success: true,
        sessionCreated,
        message: sessionCreated
          ? ''
          : 'Account created. Check your email, confirm it, then sign in to finish setting up your shop.'
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Could not create account' };
    }
  }

  signInWithOAuth(provider: 'google' | 'github' | 'facebook'): Observable<{ success: boolean; message: string }> {
    return from(this.doSignInWithOAuth(provider));
  }

  sendPasswordResetEmail(email: string): Observable<{ success: boolean; message: string }> {
    return from((async () => {
      const normalized = this.normalizeEmail(email);
      if (!this.isValidEmail(normalized)) {
        return { success: false, message: 'Enter a valid email address.' };
      }
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await this.sb.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) {
        return { success: false, message: error.message || 'Could not send reset email.' };
      }
      return { success: true, message: `Password reset link sent to ${normalized}. Check your inbox.` };
    })());
  }

  updatePassword(newPassword: string): Observable<{ success: boolean; message: string }> {
    return from((async () => {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
      }
      const { error } = await this.sb.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, message: error.message || 'Could not update password.' };
      }
      return { success: true, message: 'Password updated successfully.' };
    })());
  }

  private async doSignInWithOAuth(provider: 'google' | 'github' | 'facebook'): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return { success: false, message: error.message || 'OAuth sign-in failed' };
      }

      // OAuth will redirect, so we don't return success here
      return { success: true, message: 'Redirecting to OAuth provider...' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'OAuth sign-in failed' };
    }
  }

  handleOAuthCallback(): Observable<LoginResult> {
    return from(this.doHandleOAuthCallback());
  }

  private async doHandleOAuthCallback(): Promise<LoginResult> {
    try {
      const { data, error } = await this.sb.auth.getSession();
      
      if (error || !data?.session) {
        return { success: false, message: 'OAuth authentication failed' };
      }

      const authUser = data.session.user;
      
      // Check if user has a membership
      const membership = await this.resolveMembershipForAuthUser(authUser.id);
      if (!membership) {
        // New OAuth user - redirect to setup
        return {
          success: true,
          message: 'OAuth sign-in successful. Complete your account setup.',
          requiresSetup: true
        };
      }

      // Existing user - load their session
      this.syncShopContextFromMembership(membership);
      const permissions = await this.loadPermissionsForRole(Number(membership.role_id));
      const user = this.buildUserFromMembership(authUser, membership);
      this.setSession(user, permissions);
      return { success: true, message: '' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'OAuth callback failed' };
    }
  }

  bootstrapWorkspace(input: WorkspaceBootstrapInput): Observable<WorkspaceBootstrapResult> {
    return from(this.doBootstrapWorkspace(input));
  }

  private async doBootstrapWorkspace(input: WorkspaceBootstrapInput): Promise<WorkspaceBootstrapResult> {
    try {
      const { data: authData, error: authError } = await this.sb.auth.getUser();
      const authUser = authData?.user;

      if (authError || !authUser) {
        return { success: false, message: 'Please sign in before creating your shop.' };
      }

      const normalizedPhone = this.normalizePhoneNumber(input.phone || '');

      if (!normalizedPhone) {
        return { success: false, message: 'Please enter your phone number' };
      }

      const { data, error } = await this.sb.rpc('bootstrap_shop_workspace', {
        p_shop_name: input.shopName,
        p_full_name: input.fullName,
        p_email: input.email,
        p_phone: normalizedPhone,
        p_shop_slug: input.shopSlug || null
      });

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to create workspace' };
      }

      const result = data as any;
      const permissions = await this.loadPermissionsForRole(Number(result.roleId));
      const user: User = {
        id: Number(result.appUserId),
        authId: authUser.id,
        shopId: result.shopId,
        membershipId: result.membershipId,
        username: result.username || authUser.email?.split('@')[0] || 'user',
        fullName: input.fullName,
        phone: normalizedPhone,
        roleId: Number(result.roleId),
        roleName: result.roleName || 'Admin',
        isActive: true,
        membershipStatus: 'active'
      };

      this.setSession(user, permissions);
      this.shopConfig.saveConfig({
        shopId: result.shopId,
        shopName: result.shopName,
        shopSlug: result.shopSlug
      });

      return { success: true, message: 'Workspace created successfully' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to create workspace' };
    }
  }

  // ─── Session helpers ────────────────────────────────
  private setSession(user: User, permissions: Permission[]) {
    this.currentUserSubject.next(user);
    this.permissionsSubject.next(permissions);
    localStorage.setItem('shakhis_session', JSON.stringify({ user, permissions }));
  }

  private clearSession() {
    this.currentUserSubject.next(null);
    this.permissionsSubject.next([]);
    localStorage.removeItem('shakhis_session');
  }

  logout() {
    this.sb.auth.signOut();
    this.clearSession();
  }

  // ─── Permission checking ───────────────────────────
  private getPermission(resource: AppResource): Permission | undefined {
    return this.permissions.find(p => p.resource === resource);
  }

  can(action: PermissionAction, resource: AppResource): boolean {
    if (this.isAdmin) return true;
    const perm = this.getPermission(resource);
    if (!perm) return false;
    switch (action) {
      case 'view':   return !!perm.canView;
      case 'create': return !!perm.canCreate;
      case 'edit':   return !!perm.canEdit;
      case 'delete': return !!perm.canDelete;
      default:       return false;
    }
  }

  canView(resource: AppResource): boolean {
    return this.can('view', resource);
  }

  canSeeDashboardComponent(component: keyof DashboardComponentConfig): boolean {
    return this.canPerformPageOperation('dashboard', component);
  }

  canPerformPageOperation(resource: AppResource, operation: string): boolean {
    if (this.isAdmin) return true;

    const perm = this.getPermission(resource);
    if (!perm || !perm.canView) return false;

    const configKeys = this.getOperationConfigKeys(resource);
    for (const configKey of configKeys) {
      const config = perm[configKey] as Record<string, boolean> | null | undefined;
      if (config && Object.prototype.hasOwnProperty.call(config, operation)) {
        return !!config[operation];
      }
    }

    return false;
  }

  private getOperationConfigKeys(resource: AppResource): Array<keyof Permission> {
    switch (resource) {
      case 'dashboard': return ['dashboardConfig'];
      case 'products': return ['productConfig'];
      case 'orders': return ['ordersConfig'];
      case 'buying_list': return ['buyingListConfig'];
      case 'arrivals': return ['arrivalsConfig'];
      case 'shipping': return ['shippingConfig', 'shippingLedgerConfig'];
      case 'stock_sales': return ['stockSalesConfig'];
      case 'batches': return ['manageBatchesConfig'];
      case 'roles': return ['rolesConfig'];
      case 'users': return ['usersConfig'];
      default: return [];
    }
  }

  /** Check if user can perform a product operation */
  canPerformProductOperation(operation: keyof ProductPermissionConfig): boolean {
    return this.canPerformPageOperation('products', operation);
  }

  canPerformOrdersOperation(op: keyof OrdersPermissionConfig): boolean {
    return this.canPerformPageOperation('orders', op);
  }

  canPerformBuyingListOperation(op: keyof BuyingListPermissionConfig): boolean {
    return this.canPerformPageOperation('buying_list', op);
  }

  canPerformArrivalsOperation(op: keyof ArrivalsPermissionConfig): boolean {
    return this.canPerformPageOperation('arrivals', op);
  }

  canPerformShippingOperation(op: keyof ShippingPermissionConfig): boolean {
    return this.canPerformPageOperation('shipping', op);
  }

  canPerformShippingLedgerOperation(op: keyof ShippingLedgerPermissionConfig): boolean {
    return this.canPerformPageOperation('shipping', op);
  }

  canPerformStockSalesOperation(op: keyof StockSalesPermissionConfig): boolean {
    return this.canPerformPageOperation('stock_sales', op);
  }

  canPerformManageBatchesOperation(op: keyof ManageBatchesPermissionConfig): boolean {
    return this.canPerformPageOperation('batches', op);
  }

  canPerformRolesOperation(op: keyof RolesPermissionConfig): boolean {
    return this.canPerformPageOperation('roles', op);
  }

  canPerformUsersOperation(op: keyof UsersPermissionConfig): boolean {
    return this.canPerformPageOperation('users', op);
  }

  private mapUserFromMembership(row: any): User {
    const appUser = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    const membershipStatus = (row.membership_status || ((row.is_active !== false && appUser?.is_active !== false) ? 'active' : 'suspended')) as MembershipStatus;

    return {
      id: appUser?.id,
      authId: appUser?.auth_id || row.auth_user_id,
      username: appUser?.username || 'user',
      fullName: appUser?.full_name || 'User',
      email: appUser?.email || '',
      phone: appUser?.phone || '',
      shopId: row.shop_id,
      membershipId: row.id,
      roleId: Number(row.role_id || 0),
      roleName: role?.name || undefined,
      isActive: membershipStatus === 'active' && row.is_active !== false && appUser?.is_active !== false,
      membershipStatus,
      phoneVerifiedAt: appUser?.phone_verified_at || undefined,
      createdAt: appUser?.created_at || row.created_at,
      updatedAt: appUser?.updated_at || row.updated_at
    } as User;
  }

  private buildIsolatedAuthClient() {
    return createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    });
  }

  private async addUserToActiveShop(authUserId: string, appUserId: number, roleId: number, isActive: boolean, membershipStatus: MembershipStatus = 'active'): Promise<void> {
    const shopId = this.requireActiveShopId();
    const now = new Date().toISOString();
    const { error } = await this.sb.from('shop_memberships').insert({
      shop_id: shopId,
      auth_user_id: authUserId,
      app_user_id: appUserId,
      role_id: roleId,
      is_owner: false,
      is_active: membershipStatus === 'active' ? isActive : false,
      membership_status: membershipStatus,
      invited_at: now,
      accepted_at: membershipStatus === 'active' ? now : null,
      invited_by: this.currentUser?.id || null
    });

    if (error) {
      throw new Error(error.message || 'Failed to assign the user to this shop');
    }
  }

  private isCurrentShopUser(target: Pick<User, 'id' | 'authId'> | { id?: number; authId?: string }): boolean {
    const currentUser = this.currentUser;
    if (!currentUser) return false;

    return (target.id != null && currentUser.id === target.id)
      || (!!target.authId && currentUser.authId === target.authId);
  }

  private async fetchUsersForShop(shopId: string): Promise<any[]> {
    const fullSelect = 'id, shop_id, auth_user_id, app_user_id, role_id, is_active, membership_status, created_at, updated_at, app_users!shop_memberships_app_user_id_fkey(id, auth_id, username, full_name, email, phone, is_active, created_at, updated_at), roles(name)';
    const fallbackSelect = 'id, shop_id, auth_user_id, app_user_id, role_id, is_active, created_at, updated_at, app_users!shop_memberships_app_user_id_fkey(id, auth_id, username, full_name, email, phone, is_active, created_at, updated_at), roles(name)';

    const runQuery = async (useFallbackSelect = false): Promise<any[]> => {
      const { data, error } = await this.sb.from('shop_memberships')
        .select(useFallbackSelect ? fallbackSelect : fullSelect)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: true });

      if (error) {
        const code = String(error.code || '').toUpperCase();
        const msg = String(error.message || '').toLowerCase();
        const missingColumns = (code === '42703' || code === 'PGRST204')
          && (msg.includes('membership_status') || msg.includes('column'));

        if (!useFallbackSelect && missingColumns) {
          return runQuery(true);
        }

        throw new Error(error.message || 'Failed to load users for this shop');
      }

      return data || [];
    };

    return runQuery(false);
  }

  // ─── User CRUD ─────────────────────────────────────
  getUsers(): Observable<User[]> {
    const shopId = this.activeShopId;
    if (!shopId) return of([]);

    return from(this.fetchUsersForShop(shopId)).pipe(map((data) => {
      return (data || [])
        .map((row: any) => this.mapUserFromMembership(row))
        .sort((left, right) => left.fullName.localeCompare(right.fullName));
    }));
  }

  createUser(user: User): Observable<UserCreationResult> {
    return from(this.doCreateUser(user));
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getNormalizedAdminApiUrl(): string {
    const configured = (environment.adminApiUrl || '').trim().replace(/\/+$/, '');
    const isLocalApi = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);
    const isLocalOrigin = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

    if (isLocalApi && !isLocalOrigin) {
      return this.productionAdminApiUrl;
    }

    if (!configured && !isLocalOrigin) {
      return this.productionAdminApiUrl;
    }

    return configured;
  }

  private async createUserViaAdminApi(user: User, normalizedEmail: string, normalizedPhone: string): Promise<UserCreationResult> {
    const adminApiUrl = this.getNormalizedAdminApiUrl();
    const shopId = this.requireActiveShopId();

    if (!adminApiUrl) {
      throw new Error('Admin API is not configured.');
    }

    let authHeader = await this.getAdminApiAuthorizationHeader(true);

    let response = await fetch(`${adminApiUrl}/admin/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: user.password || 'password123',
        full_name: user.fullName,
        phone: normalizedPhone,
        roleId: user.roleId,
        shopId,
        autoConfirm: true,
        username: user.username
      })
    });

    // If an old/bad session secret is present, retry once with the active user JWT.
    if (response.status === 401 && this.adminApiSecret) {
      sessionStorage.removeItem('shakhis_admin_api_secret');
      authHeader = await this.getAdminApiAuthorizationHeader(false);
      response = await fetch(`${adminApiUrl}/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: user.password || 'password123',
          full_name: user.fullName,
          phone: normalizedPhone,
          roleId: user.roleId,
          shopId,
          autoConfirm: true,
          username: user.username
        })
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(this.formatUserCreationError(payload));
    }

    const authUserId = payload?.authUserId;
    const appUserId = Number(payload?.appUserId || 0);
    if (!authUserId || !appUserId) {
      throw new Error('Admin API did not return a valid user payload.');
    }

    const membershipStatus = (payload?.membershipStatus || 'active') as MembershipStatus;

    return {
      id: appUserId,
      membershipStatus,
      verificationSent: false,
      verificationMessage: undefined
    };
  }

  formatUserCreationError(error: any): string {
    const msg = String(error?.message || error?.error_description || error?.toString() || '').toLowerCase();
    const detail = String(error?.detail || '').toLowerCase();
    const code = String(error?.code || error?.error || error?.original?.code || '').toLowerCase();

    if (code.includes('phone_exists') || msg.includes('phone_exists') || detail.includes('phone_exists')) {
      return 'This phone number is already registered in the system. Please use a different phone number or update the existing user instead.';
    }

    if (code.includes('email_exists') || msg.includes('email_exists') || detail.includes('email_exists')) {
      return 'This email is already registered in the system. Please use a different email or check if the user already exists.';
    }

    if (code.includes('user_exists') || msg.includes('user_exists') || detail.includes('already registered')) {
      return 'This account already exists. Please sign in instead.';
    }

    if (msg.includes('already registered')) {
      return 'This email is already registered in the system. Please use a different email or ask the user to sign in.';
    }

    if (msg.includes('foreign key') || msg.includes('app_users_auth_id_fkey')) {
      return 'Could not create user account (database issue). Please try again with a different email, or contact your administrator if the problem persists.';
    }

    if (msg.includes('duplicate') || msg.includes('unique')) {
      return 'A user with this username or email already exists. Please try a different username.';
    }

    if (msg.includes('unauthorized') || msg.includes('forbidden')) {
      return 'You are not authorized to create users for this shop. Sign in again with an admin account and retry.';
    }

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (msg.includes('supabase') || msg.includes('auth')) {
      if (msg.includes('password')) {
        return 'Password does not meet requirements (minimum 6 characters recommended).';
      }
      return 'Authentication service error. Please try again or contact support.';
    }

    return error?.message || 'Failed to create user account. Please try again.';
  }

  private async getAdminApiAuthorizationHeader(preferSessionSecret = true): Promise<string> {
    const adminApiSecret = this.adminApiSecret;
    if (preferSessionSecret && adminApiSecret) {
      return `Bearer ${adminApiSecret}`;
    }

    const { data, error } = await this.sb.auth.getSession();
    const accessToken = data?.session?.access_token;

    if (error || !accessToken) {
      throw new Error('Could not authenticate with the admin API. Please sign in again.');
    }

    return `Bearer ${accessToken}`;
  }

  private async doCreateUser(user: User, retryCount = 0): Promise<UserCreationResult> {
    const maxRetries = 3;
    const baseDelay = 1000;

    if (retryCount > 0) {
      const backoffDelay = baseDelay * Math.pow(2, retryCount - 1);
      await this.delay(backoffDelay);
    }

    const email = this.normalizeEmail(user.email || '');
    const normalizedPhone = this.normalizePhoneNumber(user.phone || '');

    if (!this.isValidEmail(email)) {
      throw new Error('Enter a valid email address to create this user.');
    }

    if (normalizedPhone && !this.isValidPhoneNumber(normalizedPhone)) {
      throw new Error('Enter a valid phone number like 0241234567 or +233241234567.');
    }

    if (this.usesManagedPhoneIdentity) {
      return this.createUserViaAdminApi(user, email, normalizedPhone);
    }

    let authData: any = null;
    let authError: any = null;
    const isolatedClient = this.buildIsolatedAuthClient();
    ({ data: authData, error: authError } = await isolatedClient.auth.signUp({
      email,
      password: user.password || 'password123',
      options: { data: { full_name: user.fullName, phone: normalizedPhone, username: user.username } }
    }));

    if (authError) {
      const errorMsg = authError.message?.toLowerCase() || '';
      const isRateLimited = errorMsg.includes('rate limit') || authError.status === 429;

      if (isRateLimited && retryCount < maxRetries) {
        console.warn(`Rate limited. Retrying in ${baseDelay * Math.pow(2, retryCount)}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        return this.doCreateUser(user, retryCount + 1);
      }

      if (isRateLimited) {
        throw new Error(
          `Email rate limit exceeded. Too many signup requests were made for this project. ` +
          `Wait a bit and try again.`
        );
      }

      const formattedError: any = new Error(this.formatUserCreationError(authError));
      formattedError.original = authError;
      formattedError.code = authError.code;
      throw formattedError;
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user');
    }

    const { data, error } = await this.sb.from('app_users').insert({
      auth_id: authData.user.id,
      username: user.username,
      full_name: user.fullName,
      phone: normalizedPhone,
      email,
      is_active: true
    }).select('id').single();

    if (error) {
      const formattedError: any = new Error(this.formatUserCreationError(error));
      formattedError.original = error;
      throw formattedError;
    }

    const membershipStatus: MembershipStatus = authData.user?.email_confirmed_at ? 'active' : 'pending_verification';
    await this.addUserToActiveShop(authData.user.id, data?.id ?? 0, user.roleId, user.isActive, membershipStatus);
    return {
      id: data?.id ?? 0,
      membershipStatus,
      verificationSent: membershipStatus === 'pending_verification',
      verificationMessage: membershipStatus === 'pending_verification'
        ? `Verification email sent to ${email}.`
        : undefined
    };
  }

  updateUser(user: User): Observable<boolean> {
    return from(this.doUpdateUser(user));
  }

  private async doUpdateUser(user: User): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    if (!user.id) return false;

    if (this.isCurrentShopUser(user)) {
      if (!user.isActive) {
        throw new Error('You cannot deactivate your own access to the active shop.');
      }

      if (this.currentUser && user.roleId !== this.currentUser.roleId) {
        throw new Error('Use another admin account to change your own role in this shop.');
      }
    }

    const { error: appUserError } = await this.sb.from('app_users').update({
      username: user.username,
      full_name: user.fullName,
      phone: this.normalizePhoneNumber(user.phone || '')
    }).eq('id', user.id);

    if (appUserError) {
      throw new Error(appUserError.message || 'Failed to update the user profile');
    }

    const { error: membershipError } = await this.sb.from('shop_memberships').update({
      role_id: user.roleId,
      is_active: user.membershipStatus === 'pending_verification' ? false : user.isActive,
      membership_status: user.membershipStatus === 'pending_verification'
        ? 'pending_verification'
        : (user.isActive ? 'active' : 'suspended')
    }).eq('shop_id', shopId).eq('app_user_id', user.id);

    if (membershipError) {
      throw new Error(membershipError.message || 'Failed to update this shop membership');
    }

    return true;
  }

  deleteUser(id: number, authId?: string): Observable<boolean> {
    return from(this.doDeleteUser(id, authId));
  }

  private async doDeleteUser(id: number, _authId?: string): Promise<boolean> {
    if (this.isCurrentShopUser({ id, authId: _authId })) {
      throw new Error('You cannot remove your own access from the active shop.');
    }

    const shopId = this.requireActiveShopId();
    const { error } = await this.sb.from('shop_memberships').delete().eq('shop_id', shopId).eq('app_user_id', id);
    if (error) {
      throw new Error(error.message || 'Failed to remove the user from this shop');
    }

    return true;
  }

  // ─── Role CRUD ─────────────────────────────────────
  getRoles(): Observable<Role[]> {
    return from(this.doGetRolesWithPermissions());
  }

  private async doGetRolesWithPermissions(): Promise<Role[]> {
    const shopId = this.activeShopId;
    if (!shopId) return [];

    const { data: roles } = await this.sb.from('roles').select('*').eq('shop_id', shopId).order('id');
    const { data: permissions } = await this.sb.from('role_permissions').select('*').eq('shop_id', shopId);

    const permissionsByRoleId = new Map<number, Permission[]>();
    (permissions || []).forEach((row: any) => {
      const mapped = this.mapPermissionRows([row])[0];

      const rolePermissions = permissionsByRoleId.get(row.role_id) || [];
      rolePermissions.push(mapped);
      permissionsByRoleId.set(row.role_id, rolePermissions);
    });

    return (roles || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      permissions: permissionsByRoleId.get(r.id) || [],
      createdAt: r.created_at
    } as Role));
  }

  getRolePermissions(roleId: number): Observable<Permission[]> {
    const shopId = this.activeShopId;
    if (!shopId) return of([]);

    return from(
      this.sb.from('role_permissions').select('*').eq('shop_id', shopId).eq('role_id', roleId)
    ).pipe(map(({ data }) => this.mapPermissionRows(data || [])));
  }

  createRole(name: string, description: string): Observable<number> {
    return from(this.doCreateRole(name, description));
  }

  private async doCreateRole(name: string, description: string): Promise<number> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await this.sb.from('roles')
      .insert({
        shop_id: shopId,
        name,
        description: description || '',
        is_system: false
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id ?? 0;
  }

  updateRole(role: Role): Observable<boolean> {
    const shopId = this.activeShopId;
    if (!shopId) return of(false);

    return from(
      this.sb.from('roles').update({ name: role.name, description: role.description || '' }).eq('shop_id', shopId).eq('id', role.id)
    ).pipe(map(({ error }) => !error));
  }

  updateRolePermissions(
    roleId: number, 
    permissions: { resource: string; action: string }[],
    dashboardConfig?: DashboardComponentConfig,
    productConfig?: ProductPermissionConfig,
    ordersConfig?: OrdersPermissionConfig,
    buyingListConfig?: BuyingListPermissionConfig,
    arrivalsConfig?: ArrivalsPermissionConfig,
    shippingConfig?: ShippingPermissionConfig,
    shippingLedgerConfig?: ShippingLedgerPermissionConfig,
    stockSalesConfig?: StockSalesPermissionConfig,
    manageBatchesConfig?: ManageBatchesPermissionConfig,
    rolesConfig?: RolesPermissionConfig,
    usersConfig?: UsersPermissionConfig
  ): Observable<boolean> {
    return from(this.doUpdateRolePermissions(
      roleId, permissions, dashboardConfig, productConfig,
      ordersConfig, buyingListConfig, arrivalsConfig,
      shippingConfig, shippingLedgerConfig, stockSalesConfig,
      manageBatchesConfig, rolesConfig, usersConfig
    ));
  }

  private async doUpdateRolePermissions(
    roleId: number, 
    permissions: { resource: string; action: string }[],
    dashboardConfig?: DashboardComponentConfig,
    productConfig?: ProductPermissionConfig,
    ordersConfig?: OrdersPermissionConfig,
    buyingListConfig?: BuyingListPermissionConfig,
    arrivalsConfig?: ArrivalsPermissionConfig,
    shippingConfig?: ShippingPermissionConfig,
    shippingLedgerConfig?: ShippingLedgerPermissionConfig,
    stockSalesConfig?: StockSalesPermissionConfig,
    manageBatchesConfig?: ManageBatchesPermissionConfig,
    rolesConfig?: RolesPermissionConfig,
    usersConfig?: UsersPermissionConfig
  ): Promise<boolean> {
    const shopId = this.requireActiveShopId();

    // Delete old permissions
    await this.sb.from('role_permissions').delete().eq('shop_id', shopId).eq('role_id', roleId);

    // Group by resource
    const grouped: Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }> = {};
    for (const p of permissions) {
      if (!grouped[p.resource]) {
        grouped[p.resource] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
      }
      if (p.action === 'view')   grouped[p.resource].can_view = true;
      if (p.action === 'create') grouped[p.resource].can_create = true;
      if (p.action === 'edit')   grouped[p.resource].can_edit = true;
      if (p.action === 'delete') grouped[p.resource].can_delete = true;
    }

    // Insert grouped rows
    const rows = Object.entries(grouped).map(([resource, perm]) => ({
      shop_id: shopId,
      role_id: roleId,
      resource,
      ...perm,
      dashboard_config: resource === 'dashboard' && dashboardConfig ? dashboardConfig : null,
      product_config: resource === 'products' && productConfig ? productConfig : null,
      orders_config: resource === 'orders' && ordersConfig ? ordersConfig : null,
      buying_list_config: resource === 'buying_list' && buyingListConfig ? buyingListConfig : null,
      arrivals_config: resource === 'arrivals' && arrivalsConfig ? arrivalsConfig : null,
      shipping_config: resource === 'shipping' && shippingConfig ? shippingConfig : null,
      shipping_ledger_config: resource === 'shipping' && shippingLedgerConfig ? shippingLedgerConfig : null,
      stock_sales_config: resource === 'stock_sales' && stockSalesConfig ? stockSalesConfig : null,
      manage_batches_config: resource === 'batches' && manageBatchesConfig ? manageBatchesConfig : null,
      roles_config: resource === 'roles' && rolesConfig ? rolesConfig : null,
      users_config: resource === 'users' && usersConfig ? usersConfig : null
    }));

    if (rows.length > 0) {
      await this.sb.from('role_permissions').insert(rows);
    }
    return true;
  }

  deleteRole(id: number): Observable<boolean> {
    const shopId = this.activeShopId;
    if (!shopId) return of(false);

    return from(
      this.sb.from('roles').delete().eq('shop_id', shopId).eq('id', id).eq('is_system', false)
    ).pipe(map(({ error }) => !error));
  }

  /** Returns a map of roleId → number of users with that role */
  getUserCountByRole(): Observable<Record<number, number>> {
    return from(this.doGetUserCountByRole());
  }

  private async doGetUserCountByRole(): Promise<Record<number, number>> {
    const shopId = this.activeShopId;
    if (!shopId) return {};

    const { data, error } = await this.sb.from('shop_memberships')
      .select('role_id')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (error) {
      console.warn('[roles] Unable to load user counts by role:', error.message);
      return {};
    }

    const counts: Record<number, number> = {};
    for (const row of (data || [])) {
      if (row.role_id == null) continue;
      counts[row.role_id] = (counts[row.role_id] || 0) + 1;
    }
    return counts;
  }

  /** Duplicate a role with all its permissions */
  duplicateRole(sourceRoleId: number, newName: string): Observable<number> {
    return from(this.doDuplicateRole(sourceRoleId, newName));
  }

  private async doDuplicateRole(sourceRoleId: number, newName: string): Promise<number> {
    const shopId = this.requireActiveShopId();

    // Create the new role
    const { data: roleData, error: roleError } = await this.sb.from('roles')
      .insert({ shop_id: shopId, name: newName, description: '', is_system: false })
      .select('id').single();
    if (roleError || !roleData) throw new Error(roleError?.message || 'Failed to create role');

    // Copy permissions
    const { data: perms } = await this.sb.from('role_permissions')
      .select('*').eq('shop_id', shopId).eq('role_id', sourceRoleId);

    if (perms && perms.length > 0) {
      const newPerms = perms.map((p: any) => ({
        shop_id: shopId,
        role_id: roleData.id,
        resource: p.resource,
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        dashboard_config: p.dashboard_config || null,
        product_config: p.product_config || null,
        orders_config: p.orders_config || null,
        buying_list_config: p.buying_list_config || null,
        arrivals_config: p.arrivals_config || null,
        shipping_config: p.shipping_config || null,
        shipping_ledger_config: p.shipping_ledger_config || null,
        stock_sales_config: p.stock_sales_config || null,
        manage_batches_config: p.manage_batches_config || null,
        roles_config: p.roles_config || null,
        users_config: p.users_config || null
      }));
      await this.sb.from('role_permissions').insert(newPerms);
    }

    return roleData.id;
  }

  /** Re-fetch and update cached permissions for the current user (after role changes) */
  refreshCurrentUserPermissions(): Observable<boolean> {
    const user = this.currentUser;
    if (!user) return of(false);
    const shopId = user.shopId || this.activeShopId;
    if (!shopId) return of(false);

    return from(
      this.sb.from('role_permissions').select('*').eq('shop_id', shopId).eq('role_id', user.roleId)
    ).pipe(map(({ data }) => {
      const permissions: Permission[] = (data || []).map((p: any) => ({
        ...toCamel(p) as Permission,
        dashboardConfig: p.resource === 'dashboard' ? (p.dashboard_config || null) : undefined,
        productConfig: p.resource === 'products' ? (p.product_config || null) : undefined,
        ordersConfig: p.resource === 'orders' ? (p.orders_config || null) : undefined,
        buyingListConfig: p.resource === 'buying_list' ? (p.buying_list_config || null) : undefined,
        arrivalsConfig: p.resource === 'arrivals' ? (p.arrivals_config || null) : undefined,
        shippingConfig: p.resource === 'shipping' ? (p.shipping_config || null) : undefined,
        shippingLedgerConfig: p.resource === 'shipping' ? (p.shipping_ledger_config || null) : undefined,
        stockSalesConfig: p.resource === 'stock_sales' ? (p.stock_sales_config || null) : undefined,
        manageBatchesConfig: p.resource === 'batches' ?  (p.manage_batches_config || null) : undefined,
        rolesConfig: p.resource === 'roles' ? (p.roles_config || null) : undefined,
        usersConfig: p.resource === 'users' ? (p.users_config || null) : undefined
      }));
      this.setSession(user, permissions);
      return true;
    }));
  }

  /** Change current user's password. Requires current (old) password for verification. */
  changePassword(oldPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return from(this.doChangePassword(oldPassword, newPassword));
  }

  private async doChangePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure we have an authenticated auth user to get email
      const { data: currentUserData } = await this.sb.auth.getUser();
      const authUser = (currentUserData as any)?.user;
      if (!authUser || !authUser.email) return { success: false, message: 'Not authenticated' };

      const email = authUser.email;

      // Re-authenticate using the old password
      const { data: signInData, error: signInError } = await this.sb.auth.signInWithPassword({ email, password: oldPassword });
      if (signInError || !signInData?.user) {
        return { success: false, message: signInError?.message || 'Old password is incorrect' };
      }

      // Update password for the currently signed-in session
      const { data: updateData, error: updateError } = await this.sb.auth.updateUser({ password: newPassword });
      if (updateError) return { success: false, message: updateError.message };

      // Refresh session by signing in with new password (optional but keeps client session consistent)
      await this.sb.auth.signInWithPassword({ email, password: newPassword });

      return { success: true, message: 'Password changed successfully' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to change password' };
    }
  }
}
