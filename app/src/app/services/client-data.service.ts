import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Client } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class ClientDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  getClients(): Observable<Client[]> {
    return from(
      this.scopeShopQuery(this.sb.from('customers').select('*')).order('name')
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.normalizeClient(toCamel(r) as Client))));
  }

  getClientsPage(
    page: number,
    pageSize: number,
    nameSearchTerm = '',
    addressSearchTerm = ''
  ): Observable<{ data: Client[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeTable('customers', '*', { count: 'exact' }).order('name');

    const trimmedName = nameSearchTerm.trim();
    const trimmedAddress = addressSearchTerm.trim();

    if (trimmedName) {
      query = query.ilike('name', `%${trimmedName}%`);
    }

    if (trimmedAddress) {
      query = query.ilike('address', `%${trimmedAddress}%`);
    }

    return from(query.range(fromIndex, toIndex)).pipe(
      map(({ data, count }) => ({
        data: (data || []).map((r: any) => this.normalizeClient(toCamel(r) as Client)),
        total: count || 0
      }))
    );
  }

  getClientsSummary(
    nameSearchTerm = '',
    addressSearchTerm = ''
  ): Observable<{ total: number; contactable: number; addressed: number }> {
    let query = this.scopeTable('customers', 'id, whatsapp_number, address').order('name');

    const trimmedName = nameSearchTerm.trim();
    const trimmedAddress = addressSearchTerm.trim();

    if (trimmedName) {
      query = query.ilike('name', `%${trimmedName}%`);
    }

    if (trimmedAddress) {
      query = query.ilike('address', `%${trimmedAddress}%`);
    }

    return from(query).pipe(
      map(({ data }) => {
        const rows = data || [];
        return {
          total: rows.length,
          contactable: rows.filter((row: any) => String(row.whatsapp_number || '').trim().length > 0).length,
          addressed: rows.filter((row: any) => String(row.address || '').trim().length > 0).length,
        };
      })
    );
  }

  getClient(id: number): Observable<Client | null> {
    return from(
      this.scopeShopQuery(this.sb.from('customers').select('*')).eq('id', id).single()
    ).pipe(map(({ data }) => data ? this.normalizeClient(toCamel(data) as Client) : null));
  }

  searchClients(term: string): Observable<Client[]> {
    return from(
      this.scopeShopQuery(this.sb.from('customers').select('*'))
        .or(`name.ilike.%${term}%,whatsapp_number.ilike.%${term}%`)
        .order('name')
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.normalizeClient(toCamel(r) as Client))));
  }

  createClient(client: Client): Observable<number> {
    const row = {
      shop_id: this.activeShopId,
      name: client.name,
      whatsapp_number: client.phone || client.whatsappNumber || '',
      address: client.address || ''
    };
    return from(
      this.sb.from('customers').insert(row).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  updateClient(client: Client): Observable<boolean> {
    const row = {
      name: client.name,
      whatsapp_number: client.phone || client.whatsappNumber || '',
      address: client.address || ''
    };
    return from(
      this.scopeShopQuery(this.sb.from('customers').update(row)).eq('id', client.id)
    ).pipe(map(({ error }) => !error));
  }

  deleteClient(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('customers').delete()).eq('id', id).select('id')
    ).pipe(
      map(({ data, error, status }) => {
        if (error) {
          console.error('[deleteClient] error:', error.message, 'status:', status);
          return false;
        }
        const success = (data?.length ?? 0) > 0;
        if (!success) {
          console.warn('[deleteClient] No rows deleted for id', id, '- possible RLS block or row does not exist');
        }
        return success;
      })
    );
  }

  private normalizeClient(client: Client): Client {
    const phone = client.phone || client.whatsappNumber || '';
    return {
      ...client,
      phone,
      whatsappNumber: phone
    };
  }
}
