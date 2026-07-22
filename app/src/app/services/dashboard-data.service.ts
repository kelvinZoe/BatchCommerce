import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Delivery, Expense, Order, OrderBatch } from '../models';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { SupabaseService } from './supabase.service';
import { from, SupabaseDataAccessService } from './supabase-data-access.service';

export interface DashboardDataBundle {
  orders: Order[];
  expenses: Expense[];
  deliveries: Delivery[];
  batches: OrderBatch[];
  damagedItems: any[];
  stockSales: any[];
  stockItems: any[];
  arrivalItems: any[];
  products: any[];
  damageAllocations: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardDataService extends SupabaseDataAccessService {
  constructor(
    supa: SupabaseService,
    authService: AuthService,
    private database: DatabaseService
  ) {
    super(supa, authService);
  }

  loadDashboardData(): Observable<DashboardDataBundle> {
    return forkJoin({
      orders: this.database.getOrders(),
      expenses: this.database.getExpenses(),
      deliveries: this.database.getDeliveries(),
      batches: this.database.getOrderBatches(),
      damagedItems: this.selectDashboardRows('damaged_items'),
      stockSales: this.selectDashboardRows('stock_sales'),
      stockItems: this.selectDashboardRows('stock_sale_items'),
      arrivalItems: this.selectDashboardRows('arrival_items'),
      products: this.selectDashboardRows('products')
    }).pipe(
      switchMap(data => this.loadDamageAllocations(data.batches).pipe(
        map(damageAllocations => ({ ...data, damageAllocations }))
      ))
    );
  }

  private selectDashboardRows(tableName: string): Observable<any[]> {
    return from(this.scopeShopQuery(this.sb.from(tableName).select('*'))).pipe(
      map(({ data, error }: any) => {
        if (error) {
          console.error(`[dashboard] Error loading ${tableName}:`, error);
          return [];
        }
        return data || [];
      })
    );
  }

  private loadDamageAllocations(batches: OrderBatch[]): Observable<any[]> {
    const shopBatchIds = batches
      .map(batch => Number(batch.id || 0))
      .filter(id => id > 0);
    const shopBatchNames = batches
      .map(batch => batch.name)
      .filter((name): name is string => !!name);

    if (shopBatchIds.length === 0 && shopBatchNames.length === 0) {
      return of([]);
    }

    return from(
      Promise.all([
        shopBatchIds.length > 0
          ? this.scopeShopQuery(this.sb.from('damage_order_allocations').select('*')).in('batch_id', shopBatchIds)
          : Promise.resolve({ data: [], error: null }),
        shopBatchNames.length > 0
          ? this.scopeShopQuery(this.sb.from('damage_order_allocations').select('*')).is('batch_id', null).in('batch_name', shopBatchNames)
          : Promise.resolve({ data: [], error: null })
      ])
    ).pipe(
      map(([byId, legacyByName]: any[]) => {
        if (byId?.error || legacyByName?.error) {
          console.error('Error loading damage allocations:', byId?.error || legacyByName?.error);
          return [];
        }
        return [...(byId?.data || []), ...(legacyByName?.data || [])];
      }),
      catchError((error: unknown) => {
        console.error('Error loading damage allocations:', error);
        return of([]);
      })
    );
  }
}
