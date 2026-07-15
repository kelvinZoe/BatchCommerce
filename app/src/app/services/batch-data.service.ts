import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrderBatch, OrderBatchStatus } from '../models';
import {
  BatchWorkflowSnapshot,
  canRunBatchWorkflowTransition
} from '../models/batch-workflow';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, rowsToCamel, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class BatchDataService extends SupabaseDataAccessService {
  private batchDeletedSource = new Subject<string>();
  public batchDeleted$ = this.batchDeletedSource.asObservable();

  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  getOrderBatches(): Observable<OrderBatch[]> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').select('*')).order('created_at', { ascending: false })
    ).pipe(map(({ data }) => rowsToCamel<OrderBatch>(data || [])));
  }

  getOrderBatchesPage(
    page: number,
    pageSize: number,
    searchTerm = '',
    status?: OrderBatchStatus,
    monthYear?: { month: number; year: number }
  ): Observable<{ data: OrderBatch[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeTable('batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (status) {
      query = query.eq('status', status);
    }

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    if (monthYear) {
      const { month, year } = monthYear;
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 1).toISOString();
      query = query.gte('created_at', start).lt('created_at', end);
    }

    return from(query).pipe(map(({ data, count }) => ({
      data: rowsToCamel<OrderBatch>(data || []),
      total: count || 0
    })));
  }

  getOrderBatchById(id: number): Observable<OrderBatch | null> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').select('*')).eq('id', id).single()
    ).pipe(map(({ data }) => (data ? toCamel(data) as OrderBatch : null)));
  }

  getOpenBatches(): Observable<OrderBatch[]> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').select('*')).eq('status', 'open').order('created_at', { ascending: false })
    ).pipe(map(({ data }) => rowsToCamel<OrderBatch>(data || [])));
  }

  createOrderBatch(name: string): Observable<number> {
    return from(
      this.sb.from('batches').insert({
        shop_id: this.requireActiveShopId(),
        name,
        status: 'open',
        order_status: 'pending',
        buying_status: 'pending',
        delivery_status: 'not_sent'
      }).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  closeOrderBatch(batchId: number): Observable<boolean> {
    return from(this.doCloseOrderBatch(batchId));
  }

  reopenOrderBatch(batchId: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ status: 'open', closed_at: null })).eq('id', batchId)
    ).pipe(map(({ error }) => !error));
  }

  deleteOrderBatch(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  updateOrderBatch(id: number, name: string): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ name })).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  /**
   * Delete a batch and all related workflow rows while preserving products.
   * Prefer the guarded RPC; keep the client fallback for environments where
   * the migration has not been applied yet.
   */
  deleteBatchCascade(batchName: string): Observable<boolean> {
    return from(this.doDeleteBatchCascade(batchName));
  }

  deleteBatchCascadeById(batchId: number, batchName?: string): Observable<boolean> {
    return from(this.doDeleteBatchCascadeById(batchId, batchName));
  }

  private mapBatchWorkflowSnapshot(row: any): BatchWorkflowSnapshot | null {
    if (!row?.id) return null;
    return {
      id: Number(row.id),
      name: row.name || '',
      status: row.status || 'open',
      orderStatus: row.order_status || 'pending',
      buyingStatus: row.buying_status || 'pending',
      deliveryStatus: row.delivery_status || 'not_sent',
      arrivalsSent: !!row.arrivals_sent
    };
  }

  private async getBatchWorkflowSnapshotById(batchId: number): Promise<BatchWorkflowSnapshot | null> {
    if (!this.activeShopId || !batchId) return null;
    const { data, error } = await this.scopeShopQuery(
      this.sb.from('batches').select('id, name, status, order_status, buying_status, delivery_status, arrivals_sent')
    ).eq('id', batchId).maybeSingle();
    if (error) return null;
    return this.mapBatchWorkflowSnapshot(data);
  }

  private async hasBatchRows(tableName: string, batchId: number): Promise<boolean> {
    const { count, error } = await this.scopeShopQuery(
      this.sb.from(tableName).select('id', { count: 'exact', head: true })
    ).eq('batch_id', batchId);
    return !error && Number(count || 0) > 0;
  }

  private async doCloseOrderBatch(batchId: number): Promise<boolean> {
    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch) return false;
    if (batch.status === 'closed') return true;
    if (!canRunBatchWorkflowTransition(batch, 'orders_to_buying')) return false;

    const hasBuyingList = await this.hasBatchRows('buying_list', batchId);
    if (!hasBuyingList) return false;

    const { data, error } = await this.scopeShopQuery(
      this.sb.from('batches')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
    ).eq('id', batchId).eq('status', 'open').select('id').maybeSingle();
    return !error && !!data;
  }

  private async doDeleteBatchCascade(batchName: string): Promise<boolean> {
    try {
      const { data: batchData } = await this.scopeShopQuery(this.sb.from('batches').select('id, name'))
        .eq('name', batchName)
        .maybeSingle();
      const batchId = batchData?.id;

      if (!batchId) {
        console.warn('[db] Batch not found for deletion:', batchName);
        return false;
      }

      return this.doDeleteBatchCascadeById(batchId, batchData?.name || batchName);
    } catch (err) {
      console.error('[db] Error in deleteBatchCascade:', err);
      return false;
    }
  }

  private async doDeleteBatchCascadeById(batchId: number, batchName?: string): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('delete_batch_cascade', {
      p_shop_id: shopId,
      p_batch_id: batchId
    });

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      const deleted = Boolean(row?.deleted ?? data);
      if (deleted) {
        this.batchDeletedSource.next(row?.batch_name || batchName || String(batchId));
      }
      return deleted;
    }

    if (!this.isMissingRpcError(error)) {
      console.error(`[db] Error deleting batch ${batchId} through RPC:`, error);
      return false;
    }

    return this.doDeleteBatchCascadeByIdClientScoped(batchId, batchName);
  }

  private async doDeleteBatchCascadeByIdClientScoped(batchId: number, batchName?: string): Promise<boolean> {
    try {
      const { data: batchData } = await this.scopeShopQuery(this.sb.from('batches').select('id, name'))
        .eq('id', batchId)
        .maybeSingle();
      const resolvedBatchName = batchData?.name || batchName || '';

      if (!batchData?.id) {
        console.warn('[db] Batch not found for deletion:', batchId);
        return false;
      }

      const { data: batchProducts } = await this.scopeShopQuery(this.sb.from('batch_products').select('id')).eq('batch_id', batchId);
      const batchProductIds = batchProducts ? batchProducts.map((bp: any) => bp.id) : [];

      if (batchProductIds.length > 0) {
        const delErr2 = await this.scopeShopQuery(this.sb.from('stock_sale_items').delete()).in('batch_product_id', batchProductIds);
        if (delErr2.error) return this.logBatchDeleteError('stock_sale_items', delErr2);
      }

      const { data: shippingInvoices } = await this.scopeShopQuery(this.sb.from('shipping_invoices').select('id')).eq('batch_id', batchId);
      if (shippingInvoices && shippingInvoices.length > 0) {
        const siIds = shippingInvoices.map((si: any) => si.id);
        const delErr3a = await this.scopeShopQuery(this.sb.from('shipping_invoice_items').delete()).in('shipping_invoice_id', siIds);
        if (delErr3a.error) return this.logBatchDeleteError('shipping_invoice_items', delErr3a);

        const delErr3b = await this.scopeShopQuery(this.sb.from('shipping_invoices').delete()).in('id', siIds);
        if (delErr3b.error) return this.logBatchDeleteError('shipping_invoices', delErr3b);
      }

      const delErr4 = await this.scopeShopQuery(this.sb.from('shipping_fees').delete()).eq('batch_id', batchId);
      if (delErr4.error) return this.logBatchDeleteError('shipping_fees', delErr4);

      if (resolvedBatchName) {
        const legacyFeesDelete = await this.scopeShopQuery(this.sb.from('shipping_fees').delete()).eq('batch_name', resolvedBatchName);
        if (legacyFeesDelete.error) return this.logBatchDeleteError('legacy shipping_fees', legacyFeesDelete);
      }

      const shippingPaymentsDelete = await this.scopeShopQuery(this.sb.from('shipping_payments').delete()).eq('batch_id', batchId);
      if (shippingPaymentsDelete.error) return this.logBatchDeleteError('shipping_payments', shippingPaymentsDelete);

      if (resolvedBatchName) {
        const legacyPaymentsDelete = await this.scopeShopQuery(this.sb.from('shipping_payments').delete()).eq('batch_name', resolvedBatchName);
        if (legacyPaymentsDelete.error) return this.logBatchDeleteError('legacy shipping_payments', legacyPaymentsDelete);

        const shippingBatchDelete = await this.scopeShopQuery(this.sb.from('shipping_batches').delete()).eq('batch_name', resolvedBatchName);
        if (shippingBatchDelete.error) return this.logBatchDeleteError('shipping_batches', shippingBatchDelete);
      }

      const delErr5 = await this.scopeShopQuery(this.sb.from('deliveries').delete()).eq('batch_id', batchId);
      if (delErr5.error) return this.logBatchDeleteError('deliveries', delErr5);

      const delErr6 = await this.scopeShopQuery(this.sb.from('damage_order_allocations').delete()).eq('batch_id', batchId);
      if (delErr6.error) return this.logBatchDeleteError('damage_order_allocations', delErr6);

      if (resolvedBatchName) {
        const legacyDamageDelete = await this.scopeShopQuery(this.sb.from('damage_order_allocations').delete()).eq('batch_name', resolvedBatchName);
        if (legacyDamageDelete.error) return this.logBatchDeleteError('legacy damage_order_allocations', legacyDamageDelete);
      }

      const { data: orders } = await this.scopeShopQuery(this.sb.from('orders').select('id')).eq('batch_id', batchId);
      if (orders && orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id);
        const delErr7a = await this.scopeShopQuery(this.sb.from('order_items').delete()).in('order_id', orderIds);
        if (delErr7a.error) return this.logBatchDeleteError('order_items', delErr7a);
      }

      const delErr7b = await this.scopeShopQuery(this.sb.from('orders').delete()).eq('batch_id', batchId);
      if (delErr7b.error) return this.logBatchDeleteError('orders', delErr7b);

      const delErr8 = await this.scopeShopQuery(this.sb.from('buying_list').delete()).eq('batch_id', batchId);
      if (delErr8.error) return this.logBatchDeleteError('buying_list', delErr8);

      const delErr9 = await this.scopeShopQuery(this.sb.from('arrival_items').delete()).eq('batch_id', batchId);
      if (delErr9.error) return this.logBatchDeleteError('arrival_items', delErr9);

      const delErr10 = await this.scopeShopQuery(this.sb.from('damaged_items').delete()).eq('batch_id', batchId);
      if (delErr10.error) return this.logBatchDeleteError('damaged_items', delErr10);

      const delErr11 = await this.scopeShopQuery(this.sb.from('follow_ups').delete()).eq('batch_id', batchId);
      if (delErr11.error) return this.logBatchDeleteError('follow_ups', delErr11);

      const delErr12 = await this.scopeShopQuery(this.sb.from('product_tracking').delete()).eq('batch_id', batchId);
      if (delErr12.error) return this.logBatchDeleteError('product_tracking', delErr12);

      const delErr13 = await this.scopeShopQuery(this.sb.from('batch_product_shipping').delete()).eq('batch_id', batchId);
      if (delErr13.error) return this.logBatchDeleteError('batch_product_shipping', delErr13);

      const delErr14 = await this.scopeShopQuery(this.sb.from('batch_products').delete()).eq('batch_id', batchId);
      if (delErr14.error) return this.logBatchDeleteError('batch_products', delErr14);

      const delErr15 = await this.scopeShopQuery(this.sb.from('batches').delete()).eq('id', batchId);
      if (delErr15.error) return this.logBatchDeleteError('batches', delErr15);

      this.batchDeletedSource.next(resolvedBatchName || String(batchId));
      return true;
    } catch (err) {
      console.error('Error deleting batch cascade:', err);
      return false;
    }
  }

  private logBatchDeleteError(label: string, result: any): false {
    console.error(`[db] Error deleting ${label}:`, result.error, ' - Status:', result.status);
    return false;
  }
}
