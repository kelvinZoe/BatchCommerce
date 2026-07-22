import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BuyingStatus,
  Order,
  OrderItem,
  OrderItemAdjustment,
  OrderStatus,
  PaymentStatus
} from '../models';
import { AuthService } from './auth.service';
import { PricingDataService } from './pricing-data.service';
import { SupabaseService } from './supabase.service';
import { from, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class OrderDataService extends SupabaseDataAccessService {
  constructor(
    supa: SupabaseService,
    authService: AuthService,
    private pricing: PricingDataService
  ) {
    super(supa, authService);
  }

  getOrders(): Observable<Order[]> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((row: any) => this.mapOrderRow(row))));
  }

  getOrdersByBatch(batchId: number): Observable<Order[]> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((row: any) => this.mapOrderRow(row))));
  }

  getOrdersByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: Order[]; total: number }> {
    return from(this.doGetOrdersByBatchPage(batchId, page, pageSize, searchTerm, dateFrom, dateTo));
  }

  getOrdersCountByBatch(batchId: number): Observable<number> {
    return from(
      this.scopeShopQuery(
        this.sb.from('orders')
          .select('id', { count: 'exact', head: true })
      )
        .eq('batch_id', batchId)
    ).pipe(map(({ count }) => count || 0));
  }

  getBatchesPreviewStats(batchIds: number[]): Observable<Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>> {
    if (!batchIds.length) return of(new Map());
    return from(this.doGetBatchesPreviewStats(batchIds));
  }

  getBatchGrandTotal(batchId: number): Observable<number> {
    return from(
      this.scopeTable('orders')
        .select('order_items(subtotal)')
        .eq('batch_id', batchId)
    ).pipe(map(({ data }) =>
      (data || []).reduce((sum: number, order: any) =>
        sum + (order.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.subtotal || 0), 0)
      , 0)
    ));
  }

  getOrder(id: number): Observable<Order | null> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number)')
        .eq('id', id).single()
    ).pipe(map(({ data }) => {
      if (!data) return null;
      return {
        ...toCamel(data),
        clientName: (data as any).customers?.name,
        clientPhone: (data as any).customers?.whatsapp_number,
        items: [],
        paymentStatus: 'paid',
        totalAmount: 0
      } as unknown as Order;
    }));
  }

  getOrderItems(orderId: number): Observable<OrderItem[]> {
    return from(this.doGetOrderItems(orderId));
  }

  createOrder(order: Order): Observable<number> {
    return from(this.doCreateOrder(order));
  }

  addOrderItem(item: OrderItem): Observable<number> {
    const row = {
      shop_id: this.requireActiveShopId(),
      order_id: item.orderId,
      batch_product_id: item.batchProductId || null,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal
    };
    return from(
      this.sb.from('order_items').insert(row).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  updateOrderItem(itemId: number, quantity: number, subtotal: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('order_items').update({ quantity, subtotal })).eq('id', itemId)
    ).pipe(map(({ error }) => !error));
  }

  findOrderByClientBatch(clientId: number, batchId: number): Observable<Order | null> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .eq('customer_id', clientId)
        .eq('batch_id', batchId)
        .limit(1)
        .maybeSingle()
    ).pipe(map(({ data }: any) => data ? this.mapOrderRow(data) : null));
  }

  getClientsByProduct(batchId: number, productId: number): Observable<{ clientName: string; clientPhone: string; quantity: number }[]> {
    return from(
      this.scopeTable('order_items')
        .select('quantity, orders!inner(batch_id, customers!inner(name, whatsapp_number))')
        .eq('product_id', productId)
        .eq('orders.batch_id', batchId)
    ).pipe(map(({ data }: any) => {
      if (!data) return [];
      return (data as any[]).map(row => ({
        clientName: row.orders?.customers?.name || '-',
        clientPhone: row.orders?.customers?.whatsapp_number || '',
        quantity: row.quantity || 0
      }));
    }));
  }

  updateBatchOrderStatus(batchId: number, orderStatus: OrderStatus): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ order_status: orderStatus })).eq('id', batchId)
    ).pipe(map(({ error }) => !error));
  }

  updateBatchBuyingStatus(batchId: number, buyingStatus: BuyingStatus): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ buying_status: buyingStatus })).eq('id', batchId)
    ).pipe(map(({ error }) => !error));
  }

  updatePaymentStatus(_orderId: number, _paymentStatus: PaymentStatus): Observable<boolean> {
    // Orders are paid at entry in the new workflow.
    return of(true);
  }

  deleteOrder(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('orders').delete()).eq('id', id).select('id')
    ).pipe(map(({ data, error }) => {
      if (error) {
        console.error('[deleteOrder] error:', error.message, error);
        return false;
      }
      const deleted = (data?.length ?? 0) > 0;
      if (!deleted) console.warn('[deleteOrder] No rows deleted for id', id, '- possible RLS block or row does not exist');
      return deleted;
    }));
  }

  deleteOrderItem(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('order_items').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  updateOrderTotal(_orderId: number, _totalAmount: number): Observable<boolean> {
    // Order totals are computed from order_items in the new workflow.
    return of(true);
  }

  private mapOrderRow(row: any): Order {
    return {
      ...toCamel(row),
      clientName: row.customers?.name,
      clientPhone: row.customers?.whatsapp_number,
      paymentStatus: 'paid',
      totalAmount: (row.order_items || []).reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0),
      items: (row.order_items || []).map((item: any) => ({
        ...toCamel(item),
        productName: item.products?.name
      }))
    } as unknown as Order;
  }

  private async doGetOrdersByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{ data: Order[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let dataQuery = this.scopeShopQuery(
      this.sb.from('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
    )
      .eq('batch_id', batchId);

    let countQuery = this.scopeShopQuery(
      this.sb.from('orders')
        .select('id', { count: 'exact', head: true })
    )
      .eq('batch_id', batchId);

    if (searchTerm.trim()) {
      const term = `%${searchTerm}%`;
      const numericId = Number(searchTerm);
      const idFilter = Number.isFinite(numericId) ? `id.eq.${numericId}` : '';

      const { data: matchedClients } = await this.scopeShopQuery(
        this.sb.from('customers')
          .select('id')
          .or(`name.ilike.${term},whatsapp_number.ilike.${term}`)
      );
      const clientIds = (matchedClients || []).map((client: any) => client.id);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const parts: string[] = [];
      if (uuidRegex.test(searchTerm)) parts.push(`order_uuid.eq.${searchTerm}`);
      if (idFilter) parts.push(idFilter);
      if (clientIds.length > 0) parts.push(`customer_id.in.(${clientIds.join(',')})`);

      if (parts.length > 0) {
        const filter = parts.join(',');
        dataQuery = dataQuery.or(filter);
        countQuery = countQuery.or(filter);
      } else {
        dataQuery = dataQuery.eq('id', -1);
        countQuery = countQuery.eq('id', -1);
      }
    }

    if (dateFrom) {
      dataQuery = dataQuery.gte('created_at', dateFrom);
      countQuery = countQuery.gte('created_at', dateFrom);
    }

    if (dateTo) {
      dataQuery = dataQuery.lte('created_at', dateTo);
      countQuery = countQuery.lte('created_at', dateTo);
    }

    const [{ data }, { count }] = await Promise.all([
      dataQuery.order('created_at', { ascending: false }).range(fromIndex, toIndex),
      countQuery
    ]);

    return {
      data: (data || []).map((row: any) => this.mapOrderRow(row)),
      total: count ?? 0
    };
  }

  private async doGetBatchesPreviewStats(batchIds: number[]): Promise<Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>> {
    const [ordersRes, buyingListRes] = await Promise.all([
      this.scopeShopQuery(this.sb.from('orders').select('batch_id').in('batch_id', batchIds)),
      this.scopeShopQuery(this.sb.from('buying_list').select('batch_id, status').in('batch_id', batchIds))
    ]);
    const statsMap = new Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>();
    batchIds.forEach(id => statsMap.set(id, { orderCount: 0, pending: 0, ordered: 0, shipped: 0, arrived: 0 }));
    (ordersRes.data || []).forEach((row: any) => {
      const stats = statsMap.get(row.batch_id);
      if (stats) stats.orderCount++;
    });
    (buyingListRes.data || []).forEach((row: any) => {
      const stats = statsMap.get(row.batch_id);
      if (!stats) return;
      if (row.status === 'pending') stats.pending++;
      else if (row.status === 'ordered') stats.ordered++;
      else if (row.status === 'shipped') stats.shipped++;
      else if (row.status === 'arrived') stats.arrived++;
    });
    return statsMap;
  }

  private async doGetOrderItems(orderId: number): Promise<OrderItem[]> {
    const { data } = await this.scopeShopQuery(
      this.sb.from('order_items')
        .select('*, products(name)')
    ).eq('order_id', orderId);

    const items = (data || []).map((row: any) => ({
      ...toCamel(row),
      productName: row.products?.name
    } as unknown as OrderItem));

    const orderItemIds = items
      .map((item: OrderItem) => item.id)
      .filter((id: number | undefined): id is number => typeof id === 'number');
    if (orderItemIds.length === 0) {
      return items;
    }

    let allocations: any[] = [];
    const { data: allocationRows, error: allocationError } = await this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('id, order_item_id, original_quantity, adjusted_quantity, damaged_quantity, reason, is_active, created_at, undone_at')
        .in('order_item_id', orderItemIds)
        .order('created_at', { ascending: false })
    );
    if (!allocationError) {
      allocations = allocationRows || [];
    } else if (!this.isMissingColumnOrTableError(allocationError)) {
      throw allocationError;
    }

    const historyMap = new Map<number, OrderItemAdjustment[]>();
    const activeMap = new Map<number, OrderItemAdjustment>();

    allocations.forEach((row: any) => {
      const orderItemId = Number(row.order_item_id || 0);
      if (!orderItemId) return;
      const mapped: OrderItemAdjustment = {
        id: row.id,
        orderItemId,
        originalQuantity: Number(row.original_quantity || 0),
        adjustedQuantity: Number(row.adjusted_quantity || 0),
        damagedQuantity: Number(row.damaged_quantity || 0),
        reason: row.reason || null,
        isActive: row.is_active !== false,
        createdAt: row.created_at,
        undoneAt: row.undone_at || null
      };
      historyMap.set(orderItemId, [...(historyMap.get(orderItemId) || []), mapped]);
      if (mapped.isActive && !activeMap.has(orderItemId)) {
        activeMap.set(orderItemId, mapped);
      }
    });

    return items.map((item: OrderItem) => {
      const active = item.id ? activeMap.get(item.id) : undefined;
      const fulfilledQuantity = active ? active.adjustedQuantity : item.quantity;
      return {
        ...item,
        fulfilledQuantity,
        shortfallQuantity: Math.max(0, item.quantity - fulfilledQuantity),
        hasFulfillmentAdjustment: !!active || !!(item.id && historyMap.get(item.id)?.length),
        adjustmentReason: active?.reason || null,
        adjustmentHistory: item.id ? (historyMap.get(item.id) || []) : []
      } as OrderItem;
    });
  }

  private async doCreateOrder(order: Order): Promise<number> {
    await this.pricing.assertCanCreateSalesRecord('order');

    const row: any = {
      shop_id: this.requireActiveShopId(),
      customer_id: order.clientId,
      notes: order.notes || ''
    };
    if (order.batchId) {
      row.batch_id = order.batchId;
    }
    const { data, error } = await this.sb.from('orders').insert(row).select('id').single();
    if (error) throw error;
    return data?.id ?? 0;
  }
}
