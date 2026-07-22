import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrderBatch } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, rowsToCamel, SupabaseDataAccessService } from './supabase-data-access.service';

type ShippingPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface ShippingLedgerRow {
  batchId?: number | null;
  clientId: number | null;
  clientName: string;
  clientPhone?: string | null;
  batchName: string | null;
  totalFee: number;
  paidAmount: number;
  status: ShippingPaymentStatus;
  sentToDeliveries?: boolean;
  damagedQty?: number;
  hasAllocation?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  getShippingBatches(): Observable<string[]> {
    const feesQuery = this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name')).not('delivery_id', 'is', null);
    const deliveriesQuery = this.scopeShopQuery(this.sb.from('deliveries').select('batch_name'));
    return from(Promise.all([feesQuery, deliveriesQuery])).pipe(
      map(([feesRes, deliveriesRes]: any) => {
        const feeNames = (feesRes?.data || []).map((row: any) => (row.batch_name || '').toString()).filter(Boolean);
        const deliveryNames = (deliveriesRes?.data || []).map((row: any) => (row.batch_name || '').toString()).filter(Boolean);
        return Array.from(new Set([...feeNames, ...deliveryNames]));
      })
    );
  }

  getShippingBatchCounts(): Observable<{ [key: string]: number }> {
    return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name, delivery_id')).not('delivery_id', 'is', null)).pipe(
      map(({ data }) => {
        const sets: Record<string, Set<number>> = {};
        (data || []).forEach((row: any) => {
          const batchName = row.batch_name || '';
          const deliveryId = Number(row.delivery_id || 0);
          if (!batchName || !deliveryId) return;
          sets[batchName] = sets[batchName] || new Set<number>();
          sets[batchName].add(deliveryId);
        });
        const counts: Record<string, number> = {};
        Object.keys(sets).forEach(key => counts[key] = sets[key].size);
        return counts;
      })
    );
  }

  getShippingQueueBatches(): Observable<string[]> {
    return from(this.doGetShippingQueueBatches());
  }

  getShippingQueueCounts(): Observable<{ [key: string]: number }> {
    return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name'))).pipe(
      map(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const batchName = row.batch_name || '';
          if (!batchName) return;
          counts[batchName] = (counts[batchName] || 0) + 1;
        });
        return counts;
      })
    );
  }

  getShippingQueuePage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false,
    filterShowOnlyAdded: boolean | null = null,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): Observable<{ data: any[]; total: number }> {
    return from(this.doGetShippingQueuePage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo));
  }

  getShippingQueuePageWithDamage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false,
    filterShowOnlyAdded: boolean | null = null,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): Observable<{ data: any[]; total: number }> {
    return from(this.doGetShippingQueuePageWithDamage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo));
  }

  updateShippingQueueFees(rows: Array<{ id: number; fee: number }>): Observable<boolean> {
    if (!rows || rows.length === 0) return of(true);
    return from(this.doUpdateShippingQueueFees(rows));
  }

  computeShippingQueueTotal(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(this.doComputeShippingQueueTotal(batchName));
  }

  getShippingQueueSummary(batchName: string): Observable<{ expectedTotal: number; completedQty: number; remainingQty: number }> {
    if (!batchName) return of({ expectedTotal: 0, completedQty: 0, remainingQty: 0 });
    return from(this.doGetShippingQueueSummary(batchName));
  }

  getBatchTotal(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(this.doGetBatchTotal(batchName));
  }

  computeBatchTotalFromFees(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(this.doComputeBatchTotalFromFees(batchName));
  }

  getShippingLedgerBatches(): Observable<OrderBatch[]> {
    if (!this.activeShopId) return of([]);
    return from(this.doGetShippingLedgerBatches());
  }

  getShippingLedgerCounts(): Observable<{ [key: string]: number }> {
    if (!this.activeShopId) return of({});
    return from(this.doGetShippingLedgerCounts());
  }

  getShippingLedger(
    batchName?: string | null,
    searchTerm?: string | null,
    statusFilter: ShippingPaymentStatus | 'all' = 'all'
  ): Observable<ShippingLedgerRow[]> {
    return from(this.doGetShippingLedger(batchName ?? null, searchTerm ?? null, statusFilter));
  }

  getClientsShippingTotals(batchName: string | null): Observable<{ clientName: string; totalFee: number }[]> {
    if (!this.activeShopId) return of([]);
    return from(this.doGetClientsShippingTotals(batchName));
  }

  getShippingItemsForClient(
    batchName: string | null,
    clientId: number,
    includeDelivered = false
  ): Observable<Array<{ productName: string; fee: number; quantity: number }>> {
    if (!this.activeShopId || !clientId) return of([]);
    return from(this.doGetShippingItemsForClient(batchName, clientId, includeDelivered));
  }

  getClientPaymentsTotal(batchName: string | null, clientId: number): Observable<number> {
    if (!this.activeShopId || !clientId) return of(0);
    return from(this.doGetClientPaymentsTotal(batchName, clientId));
  }

  saveClientPayments(batchName: string | null, clientId: number, paidAmount: number): Observable<boolean> {
    return from(this.doSaveClientPayments(batchName, clientId, paidAmount));
  }

  private async doComputeShippingQueueTotal(batchName: string): Promise<number> {
    const batch = await this.resolveBatchByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeShopQuery(this.sb.from('shipping_fees').select('fee, quantity')).is('delivery_id', null),
      batch,
      batchName
    );
    const { data } = await query;
    return this.sumFeeRows(data || []);
  }

  private async doGetShippingQueueSummary(batchName: string): Promise<{ expectedTotal: number; completedQty: number; remainingQty: number }> {
    const batch = await this.resolveBatchByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeShopQuery(this.sb.from('shipping_fees').select('fee, quantity')),
      batch,
      batchName
    );
    const { data } = await query;
    let expectedTotal = 0;
    let completedQty = 0;
    let remainingQty = 0;
    for (const row of data || []) {
      const fee = Number(row.fee || 0);
      const quantity = Number(row.quantity || 0);
      expectedTotal += fee * quantity;
      if (fee > 0) completedQty += 1;
      else remainingQty += 1;
    }
    return { expectedTotal, completedQty, remainingQty };
  }

  private async doGetBatchTotal(batchName: string): Promise<number> {
    const batch = await this.resolveBatchByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeTable('shipping_batches', 'total_fee'),
      batch,
      batchName
    ).limit(1).maybeSingle();
    const { data } = await query;
    return Number(data?.total_fee || 0);
  }

  private async doComputeBatchTotalFromFees(batchName: string): Promise<number> {
    const batch = await this.resolveBatchByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeTable('shipping_fees', 'fee, quantity'),
      batch,
      batchName
    );
    const { data } = await query;
    return this.sumFeeRows(data || []);
  }

  private async doGetClientsShippingTotals(batchName: string | null): Promise<{ clientName: string; totalFee: number }[]> {
    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('client_id, fee, quantity')
    ).is('delivery_id', null);
    if (batchName) query = this.applyResolvedBatchFilter(query, await this.resolveBatchByName(batchName), batchName);
    const { data: fees } = await query;
    const aggregated: Record<number, number> = {};
    (fees || []).forEach((feeRow: any) => {
      const clientId = Number(feeRow.client_id || 0);
      if (!clientId) return;
      aggregated[clientId] = (aggregated[clientId] || 0) + (Number(feeRow.fee || 0) * Number(feeRow.quantity || 0));
    });
    const clientIds = Object.keys(aggregated).map(Number);
    if (clientIds.length === 0) return [];
    const { data: clients } = await this.scopeShopQuery(this.sb.from('customers').select('id, name')).in('id', clientIds);
    const nameMap: Record<number, string> = {};
    (clients || []).forEach((client: any) => nameMap[client.id] = client.name);
    return clientIds.map(id => ({ clientName: nameMap[id] || `Client ${id}`, totalFee: aggregated[id] || 0 }));
  }

  private async doGetShippingItemsForClient(
    batchName: string | null,
    clientId: number,
    includeDelivered: boolean
  ): Promise<Array<{ productName: string; fee: number; quantity: number }>> {
    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('product_name, fee, quantity')
    ).eq('client_id', clientId);
    if (!includeDelivered) {
      query = query.is('delivery_id', null);
    }
    if (batchName) query = this.applyResolvedBatchFilter(query, await this.resolveBatchByName(batchName), batchName);
    const { data } = await query;
    return (data || []).map((row: any) => ({
      productName: row.product_name || 'Item',
      fee: Number(row.fee || 0),
      quantity: Number(row.quantity || 0)
    }));
  }

  private async doGetClientPaymentsTotal(batchName: string | null, clientId: number): Promise<number> {
    let query: any = this.scopeShopQuery(this.sb.from('shipping_payments').select('paid_amount')).eq('client_id', clientId);
    if (batchName) query = this.applyResolvedBatchFilter(query, await this.resolveBatchByName(batchName), batchName);
    const { data } = await query;
    return (data || []).reduce((sum: number, row: any) => sum + Number(row.paid_amount || 0), 0);
  }

  private async doGetShippingQueueBatches(): Promise<string[]> {
    const { data: batches } = await this.scopeShopQuery(
      this.sb.from('batches').select('name')
    )
      .eq('status', 'closed')
      .eq('delivery_status', 'not_sent')
      .order('created_at', { ascending: false });

    return (batches || [])
      .map((batch: any) => (batch.name || '').toString())
      .filter(Boolean);
  }

  private async doGetShippingLedgerBatches(): Promise<OrderBatch[]> {
    const { data: fees } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('batch_id, batch_name, client_id')
    );
    const rows = (fees || []).filter((row: any) => Number(row.client_id || 0));
    const batchIds = Array.from(new Set(rows.map((row: any) => Number(row.batch_id || 0)).filter(Boolean)));
    const fallbackNames = Array.from(new Set(
      rows
        .filter((row: any) => !Number(row.batch_id || 0))
        .map((row: any) => (row.batch_name || '').toString())
        .filter(Boolean)
    ));

    if (batchIds.length === 0 && fallbackNames.length === 0) return [];

    const batchRows: any[] = [];
    if (batchIds.length > 0) {
      const { data } = await this.scopeTable('batches').select('*').in('id', batchIds);
      batchRows.push(...(data || []));
    }
    if (fallbackNames.length > 0) {
      const { data } = await this.scopeTable('batches').select('*').in('name', fallbackNames);
      batchRows.push(...(data || []));
    }

    const uniqueRows = Array.from(new Map(batchRows.map(row => [Number(row.id), row])).values());
    uniqueRows.sort((left: any, right: any) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
    return rowsToCamel<OrderBatch>(uniqueRows);
  }

  private async doGetShippingLedgerCounts(): Promise<{ [key: string]: number }> {
    const { data: fees } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('batch_id, batch_name, client_id')
    );
    const rows = fees || [];
    const batchIds = Array.from(new Set(rows.map((row: any) => Number(row.batch_id || 0)).filter(Boolean)));
    const batchNameById: Record<number, string> = {};
    if (batchIds.length > 0) {
      const { data: batches } = await this.scopeShopQuery(this.sb.from('batches').select('id, name')).in('id', batchIds);
      (batches || []).forEach((batch: any) => {
        batchNameById[Number(batch.id)] = batch.name || '';
      });
    }

    const keys = new Set<string>();
    rows.forEach((row: any) => {
      const batchId = Number(row.batch_id || 0);
      const batchName = batchId ? batchNameById[batchId] : (row.batch_name || '').toString();
      const clientId = Number(row.client_id || 0);
      if (!batchName || !clientId) return;
      keys.add(`${batchName}::${clientId}`);
    });

    const counts: Record<string, number> = {};
    keys.forEach(key => {
      const [batchName] = key.split('::');
      counts[batchName] = (counts[batchName] || 0) + 1;
    });
    return counts;
  }

  private async doGetShippingQueuePage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false,
    filterShowOnlyAdded: boolean | null = null,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): Promise<{ data: any[]; total: number }> {
    if (!batchName) return { data: [], total: 0 };
    const batch = await this.resolveBatchByName(batchName);
    const term = (searchTerm || '').toString().trim();
    let clientIdsByName: number[] = [];

    if (term) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id')
      ).ilike('name', `%${term}%`);
      clientIdsByName = (clients || []).map((client: any) => Number(client.id)).filter(Boolean);
    }

    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees')
        .select('id, client_id, product_id, product_name, quantity, fee, batch_id, batch_name, created_at')
    );
    query = this.applyResolvedBatchFilter(query, batch, batchName)
      .order('product_name', { ascending: true });

    if (onlyUnsent) {
      query = query.or('fee.is.null,fee.eq.0');
    }

    if (term) {
      if (clientIdsByName.length > 0) {
        query = query.or(`product_name.ilike.%${term}%,client_id.in.(${clientIdsByName.join(',')})`);
      } else {
        query = query.ilike('product_name', `%${term}%`);
      }
    }

    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;
    if (error || !data) return { data: [], total: 0 };

    const clientIds = Array.from(new Set((data || []).map((row: any) => Number(row.client_id)).filter(Boolean)));
    const clientMap: Record<number, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id, name')
      ).in('id', clientIds);
      (clients || []).forEach((client: any) => clientMap[client.id] = client.name);
    }

    const productMap = new Map<string, any>();
    (data || []).forEach((row: any) => {
      const productId = Number(row.product_id || 0) || null;
      const clientId = Number(row.client_id || 0) || null;
      const clientName = clientId ? (clientMap[Number(row.client_id)] || '') : 'Shop Stock';
      const key = `${productId}`;

      if (!productMap.has(key)) {
        productMap.set(key, {
          id: Number(row.id),
          rowIds: [],
          productId,
          productName: (row.product_name || '').toString(),
          quantity: 0,
          fee: Number(row.fee ?? 0),
          batchId: row.batch_id ?? batch?.id ?? null,
          batchName: row.batch_name || batch?.name || batchName,
          clients: [],
          createdAt: row.created_at || null
        });
      }

      const group = productMap.get(key)!;
      group.rowIds.push(Number(row.id));
      group.quantity += Number(row.quantity || 0);
      group.clients.push({
        clientId,
        clientName,
        quantity: Number(row.quantity || 0)
      });
    });

    let filteredItems = Array.from(productMap.values());
    if (filterShowOnlyAdded !== null) {
      filteredItems = filterShowOnlyAdded
        ? filteredItems.filter(item => Number(item.fee ?? 0) > 0)
        : filteredItems.filter(item => Number(item.fee ?? 0) === 0);
    }

    const total = filteredItems.length;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize;
    return { data: filteredItems.slice(fromIndex, toIndex), total };
  }

  private async doGetShippingQueuePageWithDamage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false,
    filterShowOnlyAdded: boolean | null = null,
    dateFrom: string | null = null,
    dateTo: string | null = null
  ): Promise<{ data: any[]; total: number }> {
    const batch = await this.resolveBatchByName(batchName);
    const baseResult = await this.doGetShippingQueuePage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo);

    if (!baseResult.data || baseResult.data.length === 0) {
      return baseResult;
    }

    const { data: damageAllocations } = await this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('product_id, client_id, original_quantity, adjusted_quantity, damaged_quantity')
    )
      .eq(batch?.id ? 'batch_id' : 'batch_name', batch?.id ?? batchName ?? '')
      .eq('is_active', true);

    const damageMap: Record<string, any> = {};
    (damageAllocations || []).forEach((damage: any) => {
      const key = `${damage.product_id}::${damage.client_id}`;
      damageMap[key] = {
        originalQuantity: Number(damage.original_quantity || 0),
        adjustedQuantity: Number(damage.adjusted_quantity || 0),
        damagedQuantity: Number(damage.damaged_quantity || 0)
      };
    });

    const enrichedData = baseResult.data.map((item: any) => {
      const enrichedClients = (item.clients || []).map((client: any) => {
        const key = `${item.productId}::${client.clientId}`;
        const damage = damageMap[key];
        if (damage) {
          return {
            ...client,
            originalQuantity: damage.originalQuantity,
            quantity: damage.adjustedQuantity,
            adjustedQuantity: damage.adjustedQuantity,
            damagedQuantity: damage.damagedQuantity,
            displayQuantity: damage.adjustedQuantity
          };
        }
        return {
          ...client,
          adjustedQuantity: null,
          damagedQuantity: 0,
          displayQuantity: client.quantity
        };
      });

      const totalAdjusted = enrichedClients.reduce((sum: number, client: any) =>
        sum + (client.adjustedQuantity !== null ? client.adjustedQuantity : client.quantity), 0
      );
      const totalDamaged = enrichedClients.reduce((sum: number, client: any) =>
        sum + Number(client.damagedQuantity || 0), 0
      );

      return {
        ...item,
        clients: enrichedClients,
        quantity: totalAdjusted || item.quantity,
        damagedQty: totalDamaged,
        hasAllocation: totalDamaged > 0
      };
    });

    return { data: enrichedData, total: baseResult.total };
  }

  private async doUpdateShippingQueueFees(rows: Array<{ id: number; fee: number }>): Promise<boolean> {
    for (const row of rows) {
      const { error } = await this.scopeShopQuery(this.sb.from('shipping_fees').update({ fee: row.fee })).eq('id', row.id);
      if (error) return false;
    }
    return true;
  }

  private async doGetShippingLedger(
    batchName: string | null,
    searchTerm: string | null,
    statusFilter: ShippingPaymentStatus | 'all'
  ): Promise<ShippingLedgerRow[]> {
    if (!this.activeShopId) return [];
    const term = (searchTerm || '').trim();
    let clientIdsByName: number[] = [];

    if (term) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id')
      ).or(`name.ilike.%${term}%,whatsapp_number.ilike.%${term}%`);
      clientIdsByName = (clients || []).map((client: any) => Number(client.id)).filter(Boolean);
    }

    let feeQuery: any = this.scopeShopQuery(
      this.sb.from('shipping_fees')
        .select('client_id, batch_id, batch_name, fee, quantity, delivery_id')
    );

    if (term) {
      if (clientIdsByName.length > 0) {
        feeQuery = feeQuery.or(`batch_name.ilike.%${term}%,client_id.in.(${clientIdsByName.join(',')})`);
      } else {
        feeQuery = feeQuery.ilike('batch_name', `%${term}%`);
      }
    }

    const { data: fees, error: feeError } = await feeQuery;
    if (feeError || !fees || fees.length === 0) return [];

    const selectedBatch = batchName ? await this.resolveBatchByName(batchName) : null;
    const aggregated: Record<string, { clientId: number; batchId: number | null; batchName: string | null; totalFee: number; totalCount: number; sentCount: number }> = {};
    (fees || []).forEach((feeRow: any) => {
      const clientId = Number(feeRow.client_id || 0);
      if (!clientId) return;
      const rowBatchId = Number(feeRow.batch_id || 0) || null;
      const rowBatchName = (feeRow.batch_name ?? null) as string | null;
      const key = `${clientId}::${rowBatchId || rowBatchName || ''}`;
      if (!aggregated[key]) aggregated[key] = { clientId, batchId: rowBatchId, batchName: rowBatchName, totalFee: 0, totalCount: 0, sentCount: 0 };
      aggregated[key].totalFee += Number(feeRow.fee || 0) * Number(feeRow.quantity || 0);
      aggregated[key].totalCount += 1;
      if (feeRow.delivery_id) aggregated[key].sentCount += 1;
    });

    const clientIds = Array.from(new Set(Object.values(aggregated).map(row => row.clientId)));
    if (clientIds.length === 0) return [];

    const { data: clientRows } = await this.scopeShopQuery(
      this.sb.from('customers').select('id, name, whatsapp_number')
    ).in('id', clientIds);
    const clientMap: Record<number, string> = {};
    const phoneMap: Record<number, string> = {};
    (clientRows || []).forEach((client: any) => {
      clientMap[client.id] = client.name;
      phoneMap[client.id] = client.whatsapp_number || '';
    });

    const { data: payments } = await this.scopeShopQuery(
      this.sb.from('shipping_payments').select('client_id, batch_id, batch_name, paid_amount, total_fee, status')
    ).in('client_id', clientIds);
    const paymentMap: Record<string, any> = {};
    (payments || []).forEach((payment: any) => {
      const paymentBatchId = Number(payment.batch_id || 0) || null;
      const key = `${Number(payment.client_id || 0)}::${paymentBatchId || payment.batch_name || ''}`;
      paymentMap[key] = payment;
    });

    const damageQuery = this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('client_id, batch_id, batch_name, damaged_quantity')
    ).eq('is_active', true);
    const { data: damageRows } = await (selectedBatch
      ? damageQuery.eq('batch_id', selectedBatch.id)
      : (batchName ? damageQuery.eq('batch_name', batchName) : damageQuery));
    const damageMap: Record<string, number> = {};
    (damageRows || []).forEach((row: any) => {
      const rowBatchId = Number(row.batch_id || 0) || null;
      const key = `${Number(row.client_id || 0)}::${rowBatchId || row.batch_name || ''}`;
      damageMap[key] = (damageMap[key] || 0) + Number(row.damaged_quantity || 0);
    });

    let rows: ShippingLedgerRow[] = Object.values(aggregated).map(row => {
      const key = `${row.clientId}::${row.batchId || row.batchName || ''}`;
      const payment = paymentMap[key];
      const totalFee = Number(row.totalFee || 0);
      const paidRaw = Number(payment?.paid_amount || 0);
      const paidAmount = totalFee > 0 ? Math.min(paidRaw, totalFee) : paidRaw;
      const damagedQty = Number(damageMap[key] || 0);
      const status: ShippingPaymentStatus = totalFee <= 0
        ? 'paid'
        : (paidAmount <= 0 ? 'unpaid' : (paidAmount >= totalFee ? 'paid' : 'partial'));
      return {
        clientId: row.clientId,
        clientName: clientMap[row.clientId] || `Client ${row.clientId}`,
        clientPhone: phoneMap[row.clientId] || '',
        batchId: row.batchId,
        batchName: row.batchName,
        totalFee,
        paidAmount,
        status,
        sentToDeliveries: row.totalCount > 0 && row.sentCount === row.totalCount,
        damagedQty,
        hasAllocation: damagedQty > 0
      };
    });

    if (batchName) {
      const currentRows = rows.filter(row => selectedBatch ? row.batchId === selectedBatch.id : row.batchName === batchName);
      const previousRows = rows.filter(row => (selectedBatch ? row.batchId !== selectedBatch.id : row.batchName !== batchName) && row.status !== 'paid');
      rows = [...currentRows, ...previousRows];
    }

    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter(row => row.status === statusFilter);
    }

    return rows;
  }

  private async doSaveClientPayments(batchName: string | null, clientId: number, paidAmount: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    if (!clientId) return true;
    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('fee, quantity')
    )
      .eq('client_id', clientId)
      .is('delivery_id', null);
    const batch = await this.resolveBatchByName(batchName);
    if (batchName) query = this.applyResolvedBatchFilter(query, batch, batchName);
    const { data: fees, error: feesError } = await query;
    if (feesError) return false;

    const totalFee = this.sumFeeRows(fees || []);
    const paid = Math.max(0, Math.min(Number(paidAmount || 0), totalFee));
    const status: ShippingPaymentStatus = totalFee <= 0
      ? 'paid'
      : (paid <= 0 ? 'unpaid' : (paid >= totalFee ? 'paid' : 'partial'));
    const batchId = batch?.id ?? null;

    const dbRow = {
      shop_id: this.activeShopId,
      delivery_id: null,
      client_id: clientId,
      batch_id: batchId,
      batch_name: batchName ?? null,
      total_fee: totalFee,
      paid_amount: paid,
      status
    };
    let existingQuery: any = this.scopeShopQuery(
      this.sb.from('shipping_payments').select('id')
    ).eq('client_id', clientId);
    existingQuery = batchName
      ? this.applyResolvedBatchFilter(existingQuery, batch, batchName)
      : existingQuery.is('batch_name', null);

    const { data: existingRow, error: existingError } = await existingQuery
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) return false;

    if (existingRow?.id) {
      const { error } = await this.scopeShopQuery(
        this.sb.from('shipping_payments').update({
          delivery_id: null,
          batch_id: batchId,
          total_fee: totalFee,
          paid_amount: paid,
          status
        })
      ).eq('id', existingRow.id);
      return !error;
    }

    const { error } = await this.scopeShopQuery(this.sb.from('shipping_payments').insert(dbRow));
    return !error;
  }

  private async resolveBatchByName(batchName: string | null | undefined): Promise<{ id: number; name: string } | null> {
    return this.getBatchLookupByName(batchName);
  }

  private sumFeeRows(rows: any[]): number {
    return (rows || []).reduce((sum: number, row: any) =>
      sum + (Number(row.fee || 0) * Number(row.quantity || 0)), 0
    );
  }
}
