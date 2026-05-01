import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ShopConfig {
  shopId?: string;
  shopName: string;
  shopSlug?: string;
  configuredAt?: string;
}

const STORAGE_KEY = 'shakhis_active_shop';

@Injectable({
  providedIn: 'root'
})
export class ShopConfigService {
  private configSubject = new BehaviorSubject<ShopConfig | null>(null);
  config$ = this.configSubject.asObservable();

  constructor() {
    this.loadConfig();
  }

  /** Whether a shop has been configured */
  get isConfigured(): boolean {
    return !!this.configSubject.value;
  }

  /** The current shop config (or null) */
  get config(): ShopConfig | null {
    return this.configSubject.value;
  }

  /** Shop display name — falls back to 'Commerce' */
  get shopName(): string {
    return this.configSubject.value?.shopName || 'Commerce';
  }

  /** Active shop identifier, if the user has selected one */
  get shopId(): string | null {
    return this.configSubject.value?.shopId || null;
  }

  /** Supabase project URL */
  get supabaseUrl(): string {
    return environment.supabaseUrl || '';
  }

  /** Supabase anon (publishable) key */
  get supabaseKey(): string {
    return environment.supabaseKey || '';
  }

  /** Save the selected shop and persist it to localStorage */
  saveConfig(config: ShopConfig): void {
    const nextConfig: ShopConfig = {
      shopId: config.shopId || this.generateShopId(config.shopName),
      shopName: config.shopName.trim(),
      shopSlug: config.shopSlug || this.generateShopSlug(config.shopName),
      configuredAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    this.configSubject.next(nextConfig);
  }

  /** Clear saved config (factory reset) */
  clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('shakhis_session');
    localStorage.removeItem('shakhis_auth');
    this.configSubject.next(null);
  }

  /** Load the previously selected shop from localStorage */
  private loadConfig(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const config = JSON.parse(raw) as ShopConfig;
        if (config.shopName) {
          this.configSubject.next(config);
        }
      }
    } catch {
      // corrupted — ignore
    }
  }

  private generateShopId(shopName: string): string {
    const slug = shopName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug ? `${slug}-${Date.now().toString(36)}` : `shop-${Date.now().toString(36)}`;
  }

  private generateShopSlug(shopName: string): string {
    const slug = shopName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || `shop-${Date.now().toString(36)}`;
  }
}
