import { Observable, from as rxFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

// snake_case <-> camelCase helpers
export function toCamel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[ck] = v;
  }
  return out;
}

export function rowsToCamel<T>(rows: any[]): T[] {
  return rows.map(r => toCamel(r) as T);
}

export const from = <T = any>(input: any): Observable<T> => rxFrom(input as any) as Observable<T>;

export abstract class SupabaseDataAccessService {
  protected constructor(
    protected supa: SupabaseService,
    protected authService: AuthService
  ) {}

  protected get sb() { return this.supa.client; }

  protected get activeShopId(): string | null {
    return this.authService.currentUser?.shopId || null;
  }

  protected get currentAppUserId(): number | null {
    return this.authService.currentUser?.id || null;
  }

  protected scopeShopQuery(query: any) {
    const shopId = this.activeShopId;
    if (!shopId) {
      throw new Error('Active shop context is required for this operation.');
    }
    if (!query || typeof query.eq !== 'function') return query;
    return query.eq('shop_id', shopId);
  }

  protected scopeTable(table: string, columns = '*', options?: any) {
    return this.scopeShopQuery(this.sb.from(table).select(columns, options));
  }

  protected isMissingColumnOrTableError(error: any): boolean {
    const code = error?.code;
    // 42703 = unknown column, 42P01 = unknown table, PGRST204/205 = schema cache miss
    return code === '42703' || code === '42P01' || code === 'PGRST204' || code === 'PGRST205';
  }

  protected async getBatchIdByName(batchName: string | null | undefined): Promise<number | null> {
    const normalizedBatchName = (batchName || '').toString().trim();
    if (!normalizedBatchName) return null;

    const { data } = await this.scopeShopQuery(this.sb.from('batches').select('id'))
      .eq('name', normalizedBatchName)
      .maybeSingle();

    return data?.id ? Number(data.id) : null;
  }
}
