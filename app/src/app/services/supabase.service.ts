import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private readonly authStorageKey = 'batchcommerce_auth';

  constructor() {
    if (environment.supabaseUrl && environment.supabaseKey) {
      this.initClient(environment.supabaseUrl, environment.supabaseKey);
    }
  }

  /** (Re-)initialize the Supabase client with the given credentials */
  initClient(url: string, key: string): void {
    this.supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: this.authStorageKey
      }
    });
  }

  /** Returns true if a Supabase client is initialized */
  get isReady(): boolean {
    return !!this.supabase;
  }

  get client(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase client is not initialized. Complete shop setup first.');
    }
    return this.supabase;
  }
}
