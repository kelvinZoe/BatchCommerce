import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Expense, Order, OrderBatch, PaymentStatus } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, rowsToCamel, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

export interface DashboardDataError {
  source: DashboardDataSource;
  message: string;
}

export type DashboardDataSource =
  | 'batches'
  | 'orders'
  | 'expenses'
  | 'deliveries'
  | 'damagedItems'
  | 'damageAllocations'
  | 'stockSales'
  | 'stockItems'
  | 'arrivalItems'
  | 'products'
  | 'customers'
  | 'buyingList'
  | 'shippingPayments'
  | 'shippingBatches';

export interface DashboardDataBundle {
  orders: Order[];
  expenses: Expense[];
  deliveries: any[];
  batches: OrderBatch[];
  damagedItems: any[];
  stockSales: any[];
  stockItems: any[];
  arrivalItems: any[];
  products: any[];
  damageAllocations: any[];
  buyingList: any[];
  shippingPayments: any[];
  shippingBatches: any[];
  customerCount: number;
  selectedBatchId: number | null;
  errors: DashboardDataError[];
}

interface DashboardQueryResult<T> {
  data: T;
  error?: DashboardDataError;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  loadDashboardData(requestedBatchId: number | null = null): Observable<DashboardDataBundle> {
    return this.loadBatches().pipe(
      switchMap(batchResult => {
        const batches = batchResult.data;
        const selectedBatch = batches.find(batch => Number(batch.id) === Number(requestedBatchId)) || batches[0];
        const selectedIndex = selectedBatch ? batches.findIndex(batch => batch.id === selectedBatch.id) : -1;
        const previousBatch = selectedIndex >= 0 ? batches[selectedIndex + 1] : undefined;
        const selectedBatchIds = [selectedBatch?.id, previousBatch?.id]
          .map(id => Number(id || 0))
          .filter(id => id > 0);

        const can = (component: Parameters<AuthService['canSeeDashboardComponent']>[0]) =>
          this.authService.canSeeDashboardComponent(component);
        const needsOrders = can('stats') || can('finance') || can('revenueTrend') || can('topProducts') || can('recentOrders');
        const needsDeliveries = can('stats') || can('deliveryOverview') || can('attention');
        const needsProducts = can('stats') || can('damagedItems') || can('inventory');
        const needsDamage = can('damagedItems') || can('attention');
        const needsArrivals = can('inventory') || can('attention');

        return forkJoin({
          orders: needsOrders ? this.loadOrders(selectedBatchIds) : of(this.emptyResult<Order[]>([])),
          expenses: can('expenses') ? this.loadExpenses() : of(this.emptyResult<Expense[]>([])),
          deliveries: needsDeliveries ? this.loadDeliveries(selectedBatchIds) : of(this.emptyResult<any[]>([])),
          damagedItems: needsDamage ? this.loadRows('damagedItems', this.scopeTable(
            'damaged_items', 'id, batch_id, product_id, damaged_qty, created_at'
          )) : of(this.emptyResult<any[]>([])),
          damageAllocations: needsDamage ? this.loadRows('damageAllocations', this.scopeTable(
            'damage_order_allocations', 'id, damaged_item_id, damaged_quantity, is_active'
          ).eq('is_active', true)) : of(this.emptyResult<any[]>([])),
          stockSales: can('stockSales') ? this.loadStockSales() : of(this.emptyResult<any[]>([])),
          stockItems: can('stockSales') ? this.loadRows('stockItems', this.scopeTable(
            'stock_sale_items', 'stock_sale_id, quantity, subtotal'
          )) : of(this.emptyResult<any[]>([])),
          arrivalItems: needsArrivals ? this.loadRows('arrivalItems', this.scopeTable(
            'arrival_items', 'id, batch_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at'
          )) : of(this.emptyResult<any[]>([])),
          products: needsProducts ? this.loadRows('products', this.scopeTable(
            'products', 'id, name, stock, is_active'
          ).eq('is_active', true)) : of(this.emptyResult<any[]>([])),
          customers: can('stats') ? this.loadCount('customers', this.scopeTable(
            'customers', 'id', { count: 'exact', head: true }
          )) : of(this.emptyResult<number>(0)),
          buyingList: can('attention') ? this.loadRows('buyingList', this.scopeTable(
            'buying_list', 'id, status'
          ).eq('status', 'pending')) : of(this.emptyResult<any[]>([])),
          shippingPayments: can('attention') ? this.loadRows('shippingPayments', this.scopeTable(
            'shipping_payments', 'id, total_fee, paid_amount, status'
          ).in('status', ['unpaid', 'partial'])) : of(this.emptyResult<any[]>([])),
          shippingBatches: can('finance') ? this.loadRows('shippingBatches', this.scopeTable(
            'shipping_batches', 'id, batch_id, batch_name, total_fee'
          )) : of(this.emptyResult<any[]>([]))
        }).pipe(
          map(results => {
            const queryResults: DashboardQueryResult<unknown>[] = [batchResult, ...Object.values(results)];
            return {
              orders: results.orders.data,
              expenses: results.expenses.data,
              deliveries: results.deliveries.data,
              batches,
              damagedItems: results.damagedItems.data,
              stockSales: results.stockSales.data,
              stockItems: results.stockItems.data,
              arrivalItems: results.arrivalItems.data,
              products: results.products.data,
              damageAllocations: results.damageAllocations.data,
              buyingList: results.buyingList.data,
              shippingPayments: results.shippingPayments.data,
              shippingBatches: results.shippingBatches.data,
              customerCount: results.customers.data,
              selectedBatchId: selectedBatch?.id ? Number(selectedBatch.id) : null,
              errors: queryResults.flatMap(result => result.error ? [result.error] : [])
            };
          })
        );
      })
    );
  }

  private loadBatches(): Observable<DashboardQueryResult<OrderBatch[]>> {
    return this.loadRows(
      'batches',
      this.scopeTable('batches', 'id, name, status, order_status, buying_status, delivery_status, created_at, closed_at')
        .order('created_at', { ascending: false })
    ).pipe(map(result => ({ ...result, data: rowsToCamel<OrderBatch>(result.data) })));
  }

  private loadOrders(batchIds: number[]): Observable<DashboardQueryResult<Order[]>> {
    const trendStart = this.dashboardTrendStart();
    let query = this.scopeTable(
      'orders',
      'id, batch_id, total, payment_status, refunded, created_at, customers(name), order_items(id, product_id, quantity, subtotal, products(name))'
    ).order('created_at', { ascending: false });

    query = batchIds.length > 0
      ? query.or(`created_at.gte.${trendStart},batch_id.in.(${batchIds.join(',')})`)
      : query.gte('created_at', trendStart);

    return this.loadRows('orders', query).pipe(
      map(result => ({ ...result, data: result.data.map(row => this.mapOrderRow(row)) }))
    );
  }

  private loadExpenses(): Observable<DashboardQueryResult<Expense[]>> {
    return this.loadRows(
      'expenses',
      this.scopeTable('expenses', '*')
        .gte('expense_date', this.dashboardTrendStart().substring(0, 10))
        .order('expense_date', { ascending: false })
    ).pipe(map(result => ({
      ...result,
      data: result.data.map(row => ({
        ...toCamel(row),
        description: row.description || row.name || '',
        amount: Number(row.amount || 0)
      } as Expense))
    })));
  }

  private loadDeliveries(batchIds: number[]): Observable<DashboardQueryResult<any[]>> {
    let query = this.scopeTable(
      'deliveries', 'id, batch_id, batch_name, delivery_type, delivery_fee, status, created_at'
    ).order('created_at', { ascending: false });

    query = batchIds.length > 0
      ? query.or(`created_at.gte.${this.dashboardTrendStart()},batch_id.in.(${batchIds.join(',')}),status.in.(pending,in_transit)`)
      : query.gte('created_at', this.dashboardTrendStart());

    return this.loadRows('deliveries', query).pipe(map(result => ({
      ...result,
      data: result.data.map(row => ({ ...toCamel(row), deliveryCategory: this.deliveryCategory(row.delivery_type) }))
    })));
  }

  private loadStockSales(): Observable<DashboardQueryResult<any[]>> {
    return this.loadRows(
      'stockSales',
      this.scopeTable('stock_sales', 'id, customer_name, status, total_amount, created_at')
        .eq('status', 'closed')
        .gte('created_at', this.dashboardTrendStart())
        .order('created_at', { ascending: false })
    );
  }

  private loadRows(source: DashboardDataSource, query: any): Observable<DashboardQueryResult<any[]>> {
    return from(query).pipe(
      map(({ data, error }: any) => error
        ? { data: [], error: { source, message: error.message || 'Data could not be loaded.' } }
        : { data: data || [] }
      ),
      catchError((error: unknown) => of({ data: [], error: { source, message: this.errorMessage(error) } }))
    );
  }

  private loadCount(source: DashboardDataSource, query: any): Observable<DashboardQueryResult<number>> {
    return from(query).pipe(
      map(({ count, error }: any) => error
        ? { data: 0, error: { source, message: error.message || 'Count could not be loaded.' } }
        : { data: Number(count || 0) }
      ),
      catchError((error: unknown) => of({ data: 0, error: { source, message: this.errorMessage(error) } }))
    );
  }

  private emptyResult<T>(data: T): DashboardQueryResult<T> {
    return { data };
  }

  private dashboardTrendStart(): string {
    const now = new Date();
    const sixMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return new Date(Math.min(sixMonthStart.getTime(), yearStart.getTime())).toISOString();
  }

  private mapOrderRow(row: any): Order {
    const items = (row.order_items || []).map((item: any) => ({
      ...toCamel(item),
      productName: item.products?.name
    }));
    const itemTotal = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
    const paymentStatus = (row.refunded ? 'refunded' : (row.payment_status || 'paid')) as PaymentStatus;

    return {
      ...toCamel(row),
      clientName: row.customers?.name || 'Unknown customer',
      paymentStatus,
      totalAmount: itemTotal || Number(row.total || 0),
      items
    } as Order;
  }

  private deliveryCategory(value: string | null | undefined): string | undefined {
    switch ((value || '').trim().toLowerCase()) {
      case 'ghana_post':
      case 'ghana post': return 'ghana_post';
      case 'rider':
      case 'riders': return 'riders';
      case 'station car':
      case 'station_car_delivery': return 'station_car_delivery';
      default: return undefined;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Data could not be loaded.';
  }
}
