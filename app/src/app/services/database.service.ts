import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { BatchDataService } from './batch-data.service';
import { ClientDataService } from './client-data.service';
import { OrderDataService } from './order-data.service';
import { ProductDataService } from './product-data.service';
import { PricingDataService } from './pricing-data.service';
import { ShippingDataService } from './shipping-data.service';
import { ShippingWorkflowService } from './shipping-workflow.service';
import { StockSaleDataService } from './stock-sale-data.service';
import { from, rowsToCamel, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';
import {
  Product,
  ProductCatalog,
  BatchProduct,
  Client,
  Order,
  OrderItem,
  OrderBatch,
  OrderBatchStatus,
  Delivery,
  DeliveryCategory,
  BuyingListItem,
  ArrivalItem,
  Expense,
  DashboardStats,
  OrderStatus,
  PaymentStatus,
  DeliveryStatus,
  DeliveryItemStatus,
  DeliveryBatchStatus,
  BuyingStatus,
  StockProduct,
  StockSale,
  StockSaleItem,
  OrderItemAdjustment,
  PromoCodeRedemptionResult,
  PricingUsage
} from '../models';
import {
  BatchWorkflowSnapshot,
  BatchWorkflowTransition,
  canRunBatchWorkflowTransition
} from '../models/batch-workflow';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends SupabaseDataAccessService {
  public readonly batchDeleted$: Observable<string>;

  constructor(
    supa: SupabaseService,
    authService: AuthService,
    private clients: ClientDataService,
    private batches: BatchDataService,
    private orders: OrderDataService,
    private products: ProductDataService,
    private pricing: PricingDataService,
    private shipping: ShippingDataService,
    private shippingWorkflow: ShippingWorkflowService,
    private stockSales: StockSaleDataService
  ) {
    super(supa, authService);
    this.batchDeleted$ = this.batches.batchDeleted$;
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

  private async getBatchWorkflowSnapshotByName(batchName: string): Promise<BatchWorkflowSnapshot | null> {
    if (!this.activeShopId || !batchName) return null;
    const { data, error } = await this.scopeShopQuery(
      this.sb.from('batches').select('id, name, status, order_status, buying_status, delivery_status, arrivals_sent')
    ).eq('name', batchName).maybeSingle();
    if (error) return null;
    return this.mapBatchWorkflowSnapshot(data);
  }

  private async hasBatchRows(tableName: string, batchId: number): Promise<boolean> {
    const { count, error } = await this.scopeShopQuery(
      this.sb.from(tableName).select('id', { count: 'exact', head: true })
    ).eq('batch_id', batchId);
    return !error && Number(count || 0) > 0;
  }

  private canRunBatchWorkflowTransition(batch: BatchWorkflowSnapshot, transition: BatchWorkflowTransition): boolean {
    return canRunBatchWorkflowTransition(batch, transition);
  }

  getPricingUsage(): Observable<PricingUsage> {
    return this.pricing.getPricingUsage();
  }

  redeemPromoCode(code: string): Observable<PromoCodeRedemptionResult> {
    return this.pricing.redeemPromoCode(code);
  }

  private async assertCanCreateSalesRecord(recordLabel: 'order' | 'stock sale'): Promise<void> {
    return this.pricing.assertCanCreateSalesRecord(recordLabel);
  }

  // =====================
  // Products
  // =====================
  getProducts(): Observable<Product[]> {
    return this.products.getProducts();
  }

  getProductCatalog(): Observable<ProductCatalog[]> {
    return this.products.getProductCatalog();
  }

  getMostRecentBatchProductForProduct(productId: number): Observable<BatchProduct | null> {
    return this.products.getMostRecentBatchProductForProduct(productId);
  }

  getProduct(id: number): Observable<Product | null> {
    return this.products.getProduct(id);
  }

  getProductStock(productId: number): Observable<number> {
    return this.products.getProductStock(productId);
  }

  createProduct(product: Product): Observable<number> {
    return this.products.createProduct(product);
  }

  updateProduct(product: Product): Observable<boolean> {
    return this.products.updateProduct(product);
  }

  deleteProduct(id: number): Observable<boolean> {
    return this.products.deleteProduct(id);
  }

  createProductCatalog(product: ProductCatalog): Observable<number> {
    return this.products.createProductCatalog(product);
  }

  getProductCatalogPage(
    page: number,
    pageSize: number,
    searchTerm = '',
    statusFilter: 'all' | 'active' | 'inactive' = 'all'
  ): Observable<{ data: ProductCatalog[]; total: number }> {
    return this.products.getProductCatalogPage(page, pageSize, searchTerm, statusFilter);
  }

  updateProductCatalog(productId: number, product: ProductCatalog): Observable<boolean> {
    return this.products.updateProductCatalog(productId, product);
  }

  deleteProductCatalog(productId: number): Observable<boolean> {
    return this.products.deleteProductCatalog(productId);
  }

  getBatchProducts(batchId: number): Observable<BatchProduct[]> {
    return this.products.getBatchProducts(batchId);
  }

  getBatchProductsPage(batchId: number, page: number, pageSize: number, searchTerm = ''): Observable<{ data: BatchProduct[]; total: number }> {
    return this.products.getBatchProductsPage(batchId, page, pageSize, searchTerm);
  }

  addBatchProduct(row: BatchProduct): Observable<number> {
    return this.products.addBatchProduct(row);
  }

  updateBatchProduct(id: number, row: Partial<BatchProduct>): Observable<boolean> {
    return this.products.updateBatchProduct(id, row);
  }

  deleteBatchProduct(id: number): Observable<boolean> {
    return this.products.deleteBatchProduct(id);
  }

  previewPriceChange(
    batchProductId: number,
    preorderPrice: number,
    preorderDiscountMinQty: number,
    preorderDiscountPrice: number,
    stockPrice: number,
    stockDiscountMinQty: number,
    stockDiscountPrice: number
  ): Observable<any> {
    return this.products.previewPriceChange(
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    );
  }

  updateBatchProductPriceWithRecalc(
    batchProductId: number,
    preorderPrice: number,
    preorderDiscountMinQty: number,
    preorderDiscountPrice: number,
    stockPrice: number,
    stockDiscountMinQty: number,
    stockDiscountPrice: number
  ): Observable<any> {
    return this.products.updateBatchProductPriceWithRecalc(
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    );
  }

  // =====================
  // Clients
  // =====================
  getClients(): Observable<Client[]> {
    return this.clients.getClients();
  }

  getClientsPage(
    page: number,
    pageSize: number,
    nameSearchTerm = '',
    addressSearchTerm = ''
  ): Observable<{ data: Client[]; total: number }> {
    return this.clients.getClientsPage(page, pageSize, nameSearchTerm, addressSearchTerm);
  }

  getClientsSummary(
    nameSearchTerm = '',
    addressSearchTerm = ''
  ): Observable<{ total: number; contactable: number; addressed: number }> {
    return this.clients.getClientsSummary(nameSearchTerm, addressSearchTerm);
  }

  getClient(id: number): Observable<Client | null> {
    return this.clients.getClient(id);
  }

  searchClients(term: string): Observable<Client[]> {
    return this.clients.searchClients(term);
  }

  createClient(client: Client): Observable<number> {
    return this.clients.createClient(client);
  }

  updateClient(client: Client): Observable<boolean> {
    return this.clients.updateClient(client);
  }

  deleteClient(id: number): Observable<boolean> {
    return this.clients.deleteClient(id);
  }

  // =====================
  // Batches
  // =====================
  getOrderBatches(): Observable<OrderBatch[]> {
    return this.batches.getOrderBatches();
  }

  getOrderBatchesPage(page: number, pageSize: number, searchTerm = '', status?: OrderBatchStatus, monthYear?: { month: number; year: number }): Observable<{ data: OrderBatch[]; total: number }> {
    return this.batches.getOrderBatchesPage(page, pageSize, searchTerm, status, monthYear);
  }

  getOrderBatchById(id: number): Observable<OrderBatch | null> {
    return this.batches.getOrderBatchById(id);
  }

  getOpenBatches(): Observable<OrderBatch[]> {
    return this.batches.getOpenBatches();
  }

  createOrderBatch(name: string): Observable<number> {
    return this.batches.createOrderBatch(name);
  }

  closeOrderBatch(batchId: number): Observable<boolean> {
    return this.batches.closeOrderBatch(batchId);
  }

  reopenOrderBatch(batchId: number): Observable<boolean> {
    return this.batches.reopenOrderBatch(batchId);
  }

  deleteOrderBatch(id: number): Observable<boolean> {
    return this.batches.deleteOrderBatch(id);
  }

  updateOrderBatch(id: number, name: string): Observable<boolean> {
    return this.batches.updateOrderBatch(id, name);
  }

  // =====================
  // Orders
  // =====================
  getOrders(): Observable<Order[]> {
    return this.orders.getOrders();
  }

  getOrdersByBatch(batchId: number): Observable<Order[]> {
    return this.orders.getOrdersByBatch(batchId);
  }

  getOrdersByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: Order[]; total: number }> {
    return this.orders.getOrdersByBatchPage(batchId, page, pageSize, searchTerm, dateFrom, dateTo);
  }

  getOrdersCountByBatch(batchId: number): Observable<number> {
    return this.orders.getOrdersCountByBatch(batchId);
  }

  getBatchesPreviewStats(batchIds: number[]): Observable<Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>> {
    return this.orders.getBatchesPreviewStats(batchIds);
  }

  getBatchGrandTotal(batchId: number): Observable<number> {
    return this.orders.getBatchGrandTotal(batchId);
  }

  getOrder(id: number): Observable<Order | null> {
    return this.orders.getOrder(id);
  }

  getOrderItems(orderId: number): Observable<OrderItem[]> {
    return this.orders.getOrderItems(orderId);
  }

  createOrder(order: Order): Observable<number> {
    return this.orders.createOrder(order);
  }

  addOrderItem(item: OrderItem): Observable<number> {
    return this.orders.addOrderItem(item);
  }

  updateOrderItem(itemId: number, quantity: number, subtotal: number): Observable<boolean> {
    return this.orders.updateOrderItem(itemId, quantity, subtotal);
  }

  findOrderByClientBatch(clientId: number, batchId: number): Observable<Order | null> {
    return this.orders.findOrderByClientBatch(clientId, batchId);
  }

  getClientsByProduct(batchId: number, productId: number): Observable<{ clientName: string; clientPhone: string; quantity: number }[]> {
    return this.orders.getClientsByProduct(batchId, productId);
  }

  updateBatchOrderStatus(batchId: number, orderStatus: OrderStatus): Observable<boolean> {
    return this.orders.updateBatchOrderStatus(batchId, orderStatus);
  }

  updateBatchBuyingStatus(batchId: number, buyingStatus: BuyingStatus): Observable<boolean> {
    return this.orders.updateBatchBuyingStatus(batchId, buyingStatus);
  }

  updatePaymentStatus(orderId: number, paymentStatus: PaymentStatus): Observable<boolean> {
    return this.orders.updatePaymentStatus(orderId, paymentStatus);
  }

  deleteOrder(id: number): Observable<boolean> {
    return this.orders.deleteOrder(id);
  }

  deleteOrderItem(id: number): Observable<boolean> {
    return this.orders.deleteOrderItem(id);
  }

  updateOrderTotal(orderId: number, totalAmount: number): Observable<boolean> {
    return this.orders.updateOrderTotal(orderId, totalAmount);
  }

  /**
   * When closing a batch, aggregate all order items from that batch and
   * create buying list entries grouped by batch product.
   */
  sendBatchToBuyingList(batchId: number, batchName: string): Observable<boolean> {
    return from(this.doSendBatchToBuyingList(batchId, batchName));
  }

  private async doSendBatchToBuyingList(batchId: number, _batchName: string): Promise<boolean> {
    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch) return false;
    if (batch.status === 'closed') {
      return this.hasBatchRows('buying_list', batchId);
    }
    if (!this.canRunBatchWorkflowTransition(batch, 'orders_to_buying')) return false;

    // 1. Get all orders in this batch
    const { data: orders } = await this.scopeShopQuery(this.sb.from('orders').select('id'))
      .eq('batch_id', batchId);

    if (!orders || orders.length === 0) return false;

    const orderIds = orders.map((o: any) => o.id);

    // 2. Get all order items for those orders
    const { data: items } = await this.scopeShopQuery(
      this.sb.from('order_items')
        .select('batch_product_id, product_id, quantity, order_id')
        .in('order_id', orderIds)
    );

    if (!items || items.length === 0) return false;

    // 3. Aggregate by batch_product_id
    const aggregated: Record<number, { batchProductId: number; productId: number; totalQty: number }> = {};
    for (const item of items) {
      const batchProductId = item.batch_product_id;
      if (!batchProductId) continue;
      if (!aggregated[batchProductId]) {
        aggregated[batchProductId] = {
          batchProductId,
          productId: item.product_id,
          totalQty: 0
        };
      }
      aggregated[batchProductId].totalQty += item.quantity;
    }

    // 4. Insert each aggregated product into buying_list
    const rows = Object.values(aggregated).map(a => ({
      batch_id: batchId,
      batch_product_id: a.batchProductId,
      product_id: a.productId,
      requested_qty: a.totalQty,
      ordered_qty: 0,
      status: 'pending'
    }));

    const { error } = await this.sb.from('buying_list')
      .upsert(rows.map(row => ({ ...row, shop_id: this.activeShopId })), { onConflict: 'batch_id,batch_product_id' });
    if (error) return false;

    await this.scopeShopQuery(
      this.sb.from('batches').update({ order_status: 'confirmed', buying_status: 'pending' })
    ).eq('id', batchId);
    return true;
  }

  // =====================
  // Deliveries
  // =====================
  private mapDeliveryTypeFromDb(value: string | null | undefined): DeliveryCategory | undefined {
    switch ((value || '').trim().toLowerCase()) {
      case 'ghana post':
      case 'ghana_post':
        return 'ghana_post';
      case 'rider':
      case 'riders':
        return 'riders';
      case 'station car':
      case 'station_car_delivery':
        return 'station_car_delivery';
      default:
        return undefined;
    }
  }

  private mapDeliveryTypeToDb(value: string | null | undefined): string | null {
    switch ((value || '').trim().toLowerCase()) {
      case 'ghana_post':
      case 'ghana post':
        return 'Ghana Post';
      case 'riders':
      case 'rider':
        return 'Rider';
      case 'station_car_delivery':
      case 'station car':
        return 'Station Car';
      case '':
        return null;
      default:
        return value ?? null;
    }
  }

  private mapDeliveryRow(r: any): Delivery {
    return {
      ...toCamel(r),
      batchId: r.batch_id ?? r.batchId ?? null,
      deliveryCategory: this.mapDeliveryTypeFromDb(r.delivery_type ?? r.delivery_category),
      clientName: r.customers?.name,
      clientPhone: r.customers?.whatsapp_number,
      clientAddress: r.customers?.address
    } as unknown as Delivery;
  }

  getDeliveries(): Observable<Delivery[]> {
    return from(
      this.scopeTable('deliveries')
        .select('*, customers(name, whatsapp_number, address)')
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.mapDeliveryRow(r))));
  }

  getPendingDeliveries(): Observable<Delivery[]> {
    return from(
      this.scopeTable('deliveries')
        .select('*, customers(name, whatsapp_number, address)')
        .in('status', ['pending', 'in_transit'])
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.mapDeliveryRow(r))));
  }

  createDelivery(delivery: Delivery): Observable<number> {
    return from(this.doCreateDelivery(delivery));
  }

  private async doCreateDelivery(delivery: Delivery): Promise<number> {
    if (!this.activeShopId) return 0;
    const batch = delivery.batchId ? null : await this.getBatchLookupByName(delivery.batchName);
    const batchId = delivery.batchId ?? batch?.id ?? null;
    const row = {
      shop_id: this.activeShopId,
      customer_id: delivery.clientId,
      batch_id: batchId,
      batch_name: delivery.batchName || '',
      delivery_fee: delivery.deliveryFee,
      delivery_type: this.mapDeliveryTypeToDb(delivery.deliveryCategory),
      delivery_date: delivery.deliveryDate,
      status: delivery.status,
      delivery_item_status: delivery.deliveryItemStatus || 'pending',
      notes: delivery.notes || ''
    };
    const { data } = await this.scopeShopQuery(this.sb.from('deliveries').insert(row).select('id').single());
    return data?.id ?? 0;
  }

  updateDeliveryStatus(id: number, status: DeliveryStatus, deliveryDate?: string): Observable<boolean> {
    if (!this.activeShopId) return of(false);
    const update: any = { status };
    if (deliveryDate) update.delivery_date = deliveryDate;
    return from(
      this.scopeShopQuery(this.sb.from('deliveries').update(update)).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  private deliveryStatusConsumesStock(status: DeliveryItemStatus | null | undefined): boolean {
    return status === 'delivering' || status === 'delivered';
  }

  private async getDeliveryStockAdjustments(deliveryId: number): Promise<Array<{ productId: number; quantity: number }>> {
    const { data: feeRows, error } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('product_id, quantity')
    )
      .eq('delivery_id', deliveryId);

    if (error || !feeRows || feeRows.length === 0) return [];

    const quantityByProduct = new Map<number, number>();
    for (const row of feeRows as any[]) {
      const productId = Number(row.product_id || 0);
      const quantity = Number(row.quantity || 0);
      if (!productId || quantity <= 0) continue;
      quantityByProduct.set(productId, Number(quantityByProduct.get(productId) || 0) + quantity);
    }

    return Array.from(quantityByProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  }

  private async applyDeliveryStockAdjustments(
    rows: Array<{ productId: number; quantity: number }>,
    direction: 1 | -1
  ): Promise<boolean> {
    for (const row of rows) {
      const { data: product, error: productError } = await this.scopeShopQuery(
        this.sb.from('products').select('stock')
      )
        .eq('id', row.productId)
        .maybeSingle();

      if (productError) return false;

      const currentStock = Number((product as any)?.stock || 0);
      const nextStock = direction < 0
        ? Math.max(0, currentStock - row.quantity)
        : currentStock + row.quantity;

      const { error: updateError } = await this.scopeShopQuery(
        this.sb.from('products').update({ stock: nextStock })
      )
        .eq('id', row.productId);

      if (updateError) return false;
    }

    return true;
  }

  updateDeliveryItemStatus(id: number, deliveryItemStatus: DeliveryItemStatus): Observable<boolean> {
    return from(this.doUpdateDeliveryItemStatus(id, deliveryItemStatus));
  }

  private async doUpdateDeliveryItemStatus(id: number, deliveryItemStatus: DeliveryItemStatus): Promise<boolean> {
    if (!this.activeShopId) return false;

    const { data: deliveryRow, error: deliveryError } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id, delivery_item_status')
    )
      .eq('id', id)
      .maybeSingle();

    if (deliveryError || !deliveryRow) return false;

    const currentStatus = ((deliveryRow as any).delivery_item_status || 'pending') as DeliveryItemStatus;
    const stockWasReserved = this.deliveryStatusConsumesStock(currentStatus);
    const stockShouldBeReserved = this.deliveryStatusConsumesStock(deliveryItemStatus);

    const update: any = { delivery_item_status: deliveryItemStatus };
    if (deliveryItemStatus === 'delivered') {
      update.status = 'delivered';
      update.delivery_date = new Date().toISOString().split('T')[0];
    } else if (deliveryItemStatus === 'delivering') {
      update.status = 'in_transit';
    } else {
      update.status = 'pending';
      update.delivery_date = null;
    }

    let stockDirection: 1 | -1 | 0 = 0;
    if (!stockWasReserved && stockShouldBeReserved) {
      stockDirection = -1;
    } else if (stockWasReserved && !stockShouldBeReserved) {
      stockDirection = 1;
    }

    const stockRows = stockDirection === 0
      ? []
      : await this.getDeliveryStockAdjustments(id);

    if (stockDirection !== 0 && stockRows.length > 0) {
      const stockApplied = await this.applyDeliveryStockAdjustments(stockRows, stockDirection);
      if (!stockApplied) return false;
    }

    const { error: updateError } = await this.scopeShopQuery(
      this.sb.from('deliveries').update(update)
    )
      .eq('id', id);

    if (updateError) {
      if (stockDirection !== 0 && stockRows.length > 0) {
        await this.applyDeliveryStockAdjustments(stockRows, stockDirection === -1 ? 1 : -1);
      }
      return false;
    }

    return true;
  }

  // Update delivery fields like category and fee
  updateDeliveryInfo(id: number, deliveryCategory?: string | null, deliveryFee?: number | null): Observable<boolean> {
    if (!this.activeShopId) return of(false);
    const update: any = {};
    if (deliveryCategory !== undefined) update.delivery_type = this.mapDeliveryTypeToDb(deliveryCategory);
    if (deliveryFee !== undefined) update.delivery_fee = deliveryFee ?? 0;
    if (Object.keys(update).length === 0) return of(true);
    return from(this.scopeShopQuery(this.sb.from('deliveries').update(update)).eq('id', id)).pipe(map(({ error }) => !error));
  }

  updateBatchDeliveryStatus(batchId: number, deliveryStatus: DeliveryBatchStatus): Observable<boolean> {
    if (!this.activeShopId) return of(false);
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ delivery_status: deliveryStatus })).eq('id', batchId)
    ).pipe(map(({ error }) => !error));
  }

  getDeliveriesByBatch(batchName: string): Observable<Delivery[]> {
    return from(this.doGetDeliveriesByBatch(batchName));
  }

  private async doGetDeliveriesByBatch(batchName: string): Promise<Delivery[]> {
    if (!this.activeShopId) return [];
    const batch = await this.getBatchLookupByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeShopQuery(this.sb.from('deliveries'))
        .select('*, customers(name, whatsapp_number, address)'),
      batch,
      batchName
    ).order('created_at', { ascending: false });
    const { data } = await query;
    return (data || []).map((r: any) => this.mapDeliveryRow(r));
  }

  // =====================
  // Stock Sales
  // =====================

  getStockAvailableProducts(): Observable<StockProduct[]> {
    return this.stockSales.getStockAvailableProducts();
  }

  getStockSalesPage(
    page: number,
    pageSize: number,
    search = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: StockSale[]; total: number }> {
    return this.stockSales.getStockSalesPage(page, pageSize, search, dateFrom, dateTo);
  }

  getStockSaleDetail(id: number): Observable<StockSale | null> {
    return this.stockSales.getStockSaleDetail(id);
  }

  createStockSale(
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Observable<{ id: number; saleUuid: string }> {
    return from(this.assertCanCreateSalesRecord('stock sale')).pipe(
      switchMap(() => this.stockSales.createStockSale(customerId, customerName, saleChannel, totalAmount, items))
    );
  }

  updateStockSale(
    saleId: number,
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Observable<boolean> {
    return this.stockSales.updateStockSale(saleId, customerId, customerName, saleChannel, totalAmount, items);
  }

  deleteStockSale(saleId: number): Observable<boolean> {
    return this.stockSales.deleteStockSale(saleId);
  }

  closeStockSale(saleId: number, closedByUserId: number | null): Observable<boolean> {
    return this.stockSales.closeStockSale(saleId, closedByUserId);
  }

  cancelStockSale(saleId: number): Observable<boolean> {
    return this.stockSales.cancelStockSale(saleId);
  }

  // =====================
  // Shipping helpers (UI: batch-first view, per-item fees)
  // =====================
  getShippingBatches(): Observable<string[]> {
    return this.shipping.getShippingBatches();
  }

  getShippingBatchCounts(): Observable<{ [k: string]: number }> {
    return this.shipping.getShippingBatchCounts();
  }

  // =====================
  // Shipping queue (pre-delivery)
  // =====================
  getShippingQueueBatches(): Observable<string[]> {
    return this.shipping.getShippingQueueBatches();
  }

  getShippingQueueCounts(): Observable<{ [k: string]: number }> {
    return this.shipping.getShippingQueueCounts();
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
    return this.shipping.getShippingQueuePage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo);
  }

  updateShippingQueueFees(rows: Array<{ id: number; fee: number }>): Observable<boolean> {
    return this.shipping.updateShippingQueueFees(rows);
  }

  computeShippingQueueTotal(batchName: string): Observable<number> {
    return this.shipping.computeShippingQueueTotal(batchName);
  }

  getShippingQueueSummary(batchName: string): Observable<{ expectedTotal: number; completedQty: number; remainingQty: number }> {
    return this.shipping.getShippingQueueSummary(batchName);
  }

  sendConfirmedArrivalsToShipping(batchName: string): Observable<boolean> {
    return this.shippingWorkflow.sendConfirmedArrivalsToShipping(batchName);
  }

  sendConfirmedArrivalItemToShipping(arrivalItemId: number): Observable<boolean> {
    return this.shippingWorkflow.sendConfirmedArrivalItemToShipping(arrivalItemId);
  }

  finalizeShippingBatch(batchName: string): Observable<boolean> {
    return from(this.doFinalizeShippingBatch(batchName));
  }

  private async doFinalizeShippingBatch(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    if (!batchName) return false;
    const batch = await this.getBatchWorkflowSnapshotByName(batchName);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'shipping_to_deliveries')) return false;
    const batchId = batch.id;
    const { data: queueRows } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('id, client_id, product_name, quantity, fee')
    )
      .eq('batch_id', batchId)
      .eq('batch_name', batchName)
      .is('delivery_id', null);
    if (!queueRows || queueRows.length === 0) return true;

    const byClient: Record<number, Array<any>> = {};
    (queueRows || []).forEach((r: any) => {
      const cid = Number(r.client_id || 0);
      if (!cid) return;
      byClient[cid] = byClient[cid] || [];
      byClient[cid].push(r);
    });

    const { data: existingDeliveries } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id, customer_id')
    )
      .eq('batch_id', batchId)
      .eq('batch_name', batchName);
    const deliveryMap: Record<number, number> = {};
    (existingDeliveries || []).forEach((d: any) => {
      if (d.customer_id) deliveryMap[Number(d.customer_id)] = Number(d.id);
    });

    const newRows: any[] = [];
    Object.keys(byClient).forEach(k => {
      const clientId = Number(k);
      if (deliveryMap[clientId]) return;
      const items = byClient[clientId];
      const itemsText = items.map((i: any) => `${(i.product_name || 'Item')} x${Number(i.quantity || 0)}`).join(', ');
      const totalQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
      newRows.push({
        shop_id: this.activeShopId,
        order_id: null,
        customer_id: clientId,
        items: itemsText,
        quantity: totalQty,
        delivery_fee: 0,
        delivery_category: null,
        delivery_address: '',
        delivery_date: null,
        status: 'pending',
        delivery_item_status: 'pending',
        batch_id: batchId,
        batch_name: batchName,
        notes: 'Created from shipping fees'
      });
    });

    if (newRows.length > 0) {
      const { data: created, error } = await this.scopeShopQuery(
        this.sb.from('deliveries').insert(newRows).select('id, customer_id')
      );
      if (error) return false;
      (created || []).forEach((d: any) => {
        if (d.customer_id) deliveryMap[Number(d.customer_id)] = Number(d.id);
      });
    }

    for (const [clientId, items] of Object.entries(byClient)) {
      const deliveryId = deliveryMap[Number(clientId)];
      if (!deliveryId) continue;
      await this.scopeShopQuery(this.sb.from('shipping_fees').update({ delivery_id: deliveryId }))
        .eq('batch_id', batchId)
        .eq('batch_name', batchName)
        .is('delivery_id', null)
        .eq('client_id', Number(clientId));
    }

    await this.scopeShopQuery(
      this.sb.from('batches').update({ delivery_status: 'pending' })
    ).eq('id', batchId);
    return true;
  }

  ensureShippingFeesForBatch(batchName: string): Observable<boolean> {
    if (!batchName) return of(true);
    return from(this.doEnsureShippingFeesForBatch(batchName));
  }

  private async doEnsureShippingFeesForBatch(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const batchId = await this.getBatchIdByName(batchName);
    const { data: deliveries, error } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id, items, batch_name')
    )
      .eq('batch_name', batchName);
    if (error || !deliveries || deliveries.length === 0) return !error;

    const rows: any[] = [];
    for (const d of deliveries) {
      const itemsStr = (d as any).items || '';
      const parts = itemsStr.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
      parts.forEach((p: string) => {
        const m = p.match(/^(.*) x(\d+)$/);
        const name = m ? m[1].trim() : p;
        const qty = m ? Number(m[2]) : 1;
        rows.push({
          shop_id: this.activeShopId,
          batch_id: batchId,
          batch_name: batchName,
          delivery_id: (d as any).id,
          product_name: name,
          quantity: qty,
          fee: 0
        });
      });
    }

    if (rows.length === 0) return true;
    const { error: upsertErr } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').upsert(rows, { onConflict: 'delivery_id,product_name', ignoreDuplicates: true })
    );
    return !upsertErr;
  }

  getShippingItemsPage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false
  ): Observable<{ data: any[]; total: number }> {
    return from(this.doGetShippingItemsPage(batchName, page, pageSize, searchTerm, onlyUnsent));
  }

  private async doGetShippingItemsPage(
    batchName: string | null,
    page: number,
    pageSize: number,
    searchTerm: string | null = null,
    onlyUnsent = false
  ): Promise<{ data: any[]; total: number }> {
    if (!batchName) return { data: [], total: 0 };
    const term = (searchTerm || '').toString().trim();
    let deliveryIdsByClient: number[] = [];

    if (term) {
      const { data: matchedDeliveries } = await this.scopeShopQuery(
        this.sb.from('deliveries').select('id, customers(name)')
      )
        .eq('batch_name', batchName)
        .ilike('customers.name', `%${term}%`);
      deliveryIdsByClient = (matchedDeliveries || []).map((d: any) => Number(d.id)).filter(Boolean);
    }

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('delivery_id, product_name, quantity, fee, batch_name', { count: 'exact' })
    )
      .eq('batch_name', batchName)
      .order('delivery_id', { ascending: true })
      .range(fromIndex, toIndex);

    if (onlyUnsent) {
      query = query.eq('fee', 0);
    }

    if (term) {
      if (deliveryIdsByClient.length > 0) {
        const ids = deliveryIdsByClient.join(',');
        query = query.or(`product_name.ilike.%${term}%,delivery_id.in.(${ids})`);
      } else {
        query = query.ilike('product_name', `%${term}%`);
      }
    }

    const { data, count, error } = await query;
    if (error || !data) return { data: [], total: 0 };

    const deliveryIds = Array.from(new Set((data || []).map((r: any) => Number(r.delivery_id)).filter(Boolean)));
    const deliveryMap: Record<number, any> = {};
    if (deliveryIds.length > 0) {
      const { data: deliveries } = await this.scopeShopQuery(
        this.sb.from('deliveries').select('id, customer_id, customers(name)')
      )
        .in('id', deliveryIds);
      (deliveries || []).forEach((d: any) => {
        deliveryMap[d.id] = d;
      });
    }

    const items = (data || []).map((r: any) => {
      const del = deliveryMap[Number(r.delivery_id)] || null;
      const clientName = del?.customers?.name || del?.clients?.name || '';
      return {
        deliveryId: Number(r.delivery_id || 0),
        clientName,
        productName: (r.product_name || '').toString(),
        quantity: Number(r.quantity || 0),
        fee: Number(r.fee || 0),
        batchName: (r.batch_name || batchName)
      };
    });

    return { data: items, total: count || 0 };
  }

  getShippingItems(batchName: string | null, searchTerm?: string | null, onlyUnsent?: boolean): Observable<any[]> {
    if (!batchName) return of([]);
    return this.getDeliveriesByBatch(batchName).pipe(
      switchMap(deliveries => {
        const rows: any[] = [];
        (deliveries || []).forEach(d => {
          const itemsStr = (d as any).items || '';
          const parts = itemsStr.split(',').map((p: string) => p.trim()).filter((p: string) => p.length>0);
          parts.forEach((p: string) => {
            const m = p.match(/^(.*) x(\d+)$/);
            const name = m ? m[1].trim() : p;
            const qty = m ? Number(m[2]) : 1;
            rows.push({ deliveryId: (d as any).id, clientName: (d as any).clientName || '', productName: name, quantity: qty, fee: null, batchName });
          });
        });
        const deliveryIds = Array.from(new Set(rows.map(r => r.deliveryId).filter(Boolean)));
        if (deliveryIds.length === 0) return of(rows);
        return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('*')).in('delivery_id', deliveryIds)).pipe(
          map((res: any) => {
            const fees = (res?.data || []) as any[];
            const feeMap: Record<string, number> = {};
            for (const f of fees) {
              const key = `${Number(f.delivery_id)}::${(f.product_name || '').toString().trim()}`;
              feeMap[key] = Number(f.fee || 0);
            }
            rows.forEach(r => {
              const key = `${r.deliveryId}::${(r.productName || '').toString().trim()}`;
              if (feeMap.hasOwnProperty(key)) r.fee = feeMap[key];
            });

            // apply optional search filter across the whole batch (server-side search behavior)
            let filtered = rows;
            const q = (searchTerm || '').toString().trim().toLowerCase();
            if (q) {
              filtered = filtered.filter(r => {
                const prod = (r.productName || '').toString().toLowerCase();
                const client = (r.clientName || '').toString().toLowerCase();
                return prod.indexOf(q) !== -1 || client.indexOf(q) !== -1;
              });
            }
            if (onlyUnsent) {
              filtered = filtered.filter(r => {
                const key = `${r.deliveryId}::${(r.productName || '').toString().trim()}`;
                const fv = feeMap.hasOwnProperty(key) ? Number(feeMap[key]) : undefined;
                return fv === undefined || Number(fv) === 0;
              });
            }

            return filtered;
          })
        );
      })
    );
  }

  saveShippingFees(rows: Array<{ batchName: string; deliveryId: number; productName: string; quantity: number; fee: number; }>): Observable<boolean> {
    return from(this.doSaveShippingFees(rows));
  }

  private async doSaveShippingFees(rows: Array<{ batchName: string; deliveryId: number; productName: string; quantity: number; fee: number; }>): Promise<boolean> {
    if (!rows || rows.length === 0) return true;
    if (!this.activeShopId) return false;

    const batchNames = Array.from(new Set(rows.map(r => r.batchName).filter(Boolean)));
    const batchIdByName = new Map<string, number | null>();
    for (const batchName of batchNames) {
      batchIdByName.set(batchName, await this.getBatchIdByName(batchName));
    }

    // Upsert into shipping_fees; rely on migration to have created a unique index on (delivery_id, product_name).
    const dbRows = rows.map(r => ({
      shop_id: this.activeShopId,
      batch_id: batchIdByName.get(r.batchName) ?? null,
      batch_name: r.batchName,
      delivery_id: r.deliveryId,
      product_name: r.productName,
      quantity: r.quantity,
      fee: r.fee
    }));

    const { error } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').upsert(dbRows, { onConflict: 'delivery_id,product_name' })
    );
    return !error;
  }

  // Persist a per-batch total fee. batch_id is canonical; batch_name is retained for display/legacy rows.
  saveBatchTotal(batchName: string, totalFee: number): Observable<boolean> {
    return from(this.doSaveBatchTotal(batchName, totalFee));
  }

  private async doSaveBatchTotal(batchName: string, totalFee: number): Promise<boolean> {
    if (!batchName) return true;
    if (!this.activeShopId) return false;
    const batchId = await this.getBatchIdByName(batchName);
    const dbRow: any = {
      batch_id: batchId,
      batch_name: batchName,
      total_fee: totalFee
    };
    if (this.activeShopId) {
      dbRow.shop_id = this.activeShopId;
    }
    const conflictTarget = batchId ? 'shop_id,batch_id' : 'shop_id,batch_name';
    const { error } = await this.scopeShopQuery(
      this.sb.from('shipping_batches').upsert(dbRow, { onConflict: conflictTarget })
    );
    return !error;
  }

  // Read persisted batch total (returns 0 when not found)
  getBatchTotal(batchName: string): Observable<number> {
    return this.shipping.getBatchTotal(batchName);
  }

  // Compute batch total from shipping_fees rows (authoritative sum)
  computeBatchTotalFromFees(batchName: string): Observable<number> {
    return this.shipping.computeBatchTotalFromFees(batchName);
  }

  // Shipping ledger helpers (include delivered fees)
  getShippingLedgerBatches(): Observable<OrderBatch[]> {
    return this.shipping.getShippingLedgerBatches();
  }

  getShippingLedgerCounts(): Observable<{ [k: string]: number }> {
    return this.shipping.getShippingLedgerCounts();
  }

  // Shipping ledger / payments (pre-delivery, grouped by client)
  getShippingLedger(
    batchName?: string | null,
    searchTerm?: string | null,
    statusFilter: 'all'|'unpaid'|'partial'|'paid' = 'all'
  ): Observable<Array<{ clientId: number | null; clientName: string; clientPhone?: string | null; batchName: string | null; totalFee: number; paidAmount: number; status: 'unpaid'|'partial'|'paid'; sentToDeliveries?: boolean; damagedQty?: number; hasAllocation?: boolean }>> {
    return this.shipping.getShippingLedger(batchName, searchTerm, statusFilter);
  }

  saveShippingPayments(rows: Array<{ deliveryId: number; clientId?: number; batchName?: string | null; totalFee: number; paidAmount: number; status?: 'unpaid'|'partial'|'paid' }>): Observable<boolean> {
    return from(this.doSaveShippingPayments(rows));
  }

  private async doSaveShippingPayments(rows: Array<{ deliveryId: number; clientId?: number; batchName?: string | null; totalFee: number; paidAmount: number; status?: 'unpaid'|'partial'|'paid' }>): Promise<boolean> {
    if (!rows || rows.length === 0) return true;
    if (!this.activeShopId) return false;

    const batchNames = Array.from(new Set(rows.map(r => r.batchName || '').filter(Boolean)));
    const batchIdByName = new Map<string, number | null>();
    for (const batchName of batchNames) {
      batchIdByName.set(batchName, await this.getBatchIdByName(batchName));
    }

    const dbRows = rows.map(r => ({
      shop_id: this.activeShopId,
      delivery_id: r.deliveryId,
      client_id: r.clientId ?? null,
      batch_id: r.batchName ? (batchIdByName.get(r.batchName) ?? null) : null,
      batch_name: r.batchName ?? null,
      total_fee: r.totalFee,
      paid_amount: r.paidAmount,
      status: r.status || (r.paidAmount <= 0 ? 'unpaid' : (r.paidAmount >= r.totalFee ? 'paid' : 'partial'))
    }));

    // upsert by delivery_id
    const { error } = await this.scopeShopQuery(
      this.sb.from('shipping_payments').upsert(dbRows, { onConflict: 'delivery_id' })
    );
    return !error;
  }

  getClientsShippingTotals(batchName: string | null): Observable<{ clientName: string; totalFee: number }[]> {
    return this.shipping.getClientsShippingTotals(batchName);
  }

  // Fetch shipping fee items for a given client (by client_id) within an optional batch
  getShippingItemsForClient(
    batchName: string | null,
    clientId: number,
    includeDelivered = false
  ): Observable<Array<{ productName: string; fee: number; quantity: number }>> {
    return this.shipping.getShippingItemsForClient(batchName, clientId, includeDelivered);
  }

  // Sum of paid amounts for a client across deliveries in an optional batch
  getClientPaymentsTotal(batchName: string | null, clientId: number): Observable<number> {
    return this.shipping.getClientPaymentsTotal(batchName, clientId);
  }

  // Allocate a client's paid amount across their deliveries in a batch and upsert per-delivery payments
  saveClientPayments(batchName: string | null, clientId: number, paidAmount: number): Observable<boolean> {
    return this.shipping.saveClientPayments(batchName, clientId, paidAmount);
  }

  sendPaidClientToDeliveries(batchName: string, clientId: number): Observable<boolean> {
    return this.shippingWorkflow.sendPaidClientToDeliveries(batchName, clientId);
  }

  /**
   * When a buying batch arrives, send items to deliveries.
   * Creates one delivery per client with all their ordered items listed.
   */
  sendBatchToDeliveries(batchId: number, batchName: string): Observable<boolean> {
    return from(this.doSendBatchToDeliveries(batchId, batchName));
  }

  private async doSendBatchToDeliveries(batchId: number, batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'shipping_to_deliveries')) return false;

    // 1. Get all orders in this batch with their items and client info
    const { data: orders } = await this.scopeShopQuery(
      this.sb.from('orders').select('id, customer_id, delivery_type, customers(name, whatsapp_number, address), order_items(quantity, products(name))')
    )
      .eq('batch_id', batchId);

    if (!orders || orders.length === 0) return true;

    const { data: existingDeliveries } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id, customer_id')
    ).eq('batch_id', batchId);
    const existingClientIds = new Set(
      (existingDeliveries || []).map((d: any) => Number(d.customer_id || 0)).filter(Boolean)
    );

    // 2. Aggregate items per client
    const clientMap: Record<number, {
      clientId: number;
      items: string[];
      totalQty: number;
      deliveryFee: number;
      deliveryCategory: string | null;
      clientAddress: string;
    }> = {};

    for (const order of orders) {
      const cid = order.customer_id;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          clientId: cid,
          items: [],
          totalQty: 0,
          deliveryFee: 0,
          deliveryCategory: null,
          clientAddress: (order as any).customers?.address || ''
        };
      }
      const c = clientMap[cid];
      // Delivery fees are assigned on the Deliveries page; ignore any order-level delivery_fee
      c.deliveryFee = 0;
      c.deliveryCategory = (order as any).delivery_type || c.deliveryCategory;
      for (const item of ((order as any).order_items || [])) {
        const name = item.products?.name || 'Unknown';
        c.items.push(`${name} x${item.quantity}`);
        c.totalQty += item.quantity;
      }
    }

    // 3. Create delivery rows
    const rows = Object.values(clientMap).filter(c => !existingClientIds.has(c.clientId)).map(c => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_name: batchName,
      customer_id: c.clientId,
      shipping_invoice_id: null,
      delivery_type: c.deliveryCategory || 'Ghana Post',
      delivery_fee: 0,
      status: 'pending',
      notes: ''
    }));

    if (rows.length > 0) {
      const { error } = await this.scopeShopQuery(this.sb.from('deliveries').insert(rows));
      if (error) return false;
    }

    // 4. Update batch delivery_status
    await this.scopeShopQuery(this.sb.from('batches').update({ delivery_status: 'pending' })).eq('id', batchId);
    return true;
  }

  // =====================
  // Buying List
  // =====================
  private mapBuyingListRow(row: any): BuyingListItem {
    const requested = Number(row.requested_qty ?? row.requested_quantity ?? row.requestedQty ?? row.requestedQuantity ?? 0);
    const ordered = Number(row.ordered_qty ?? row.ordered_quantity ?? row.orderedQty ?? row.orderedQuantity ?? 0);
    return {
      id: row.id,
      batchId: row.batch_id ?? row.batchId,
      batchProductId: row.batch_product_id ?? row.batchProductId,
      productId: row.product_id ?? row.productId,
      productName: row.products?.name || row.product_name || row.productName || '',
      batchName: row.batches?.name || row.batch_name || row.batchName || '',
      requestedQty: requested,
      orderedQty: ordered,
      requestedQuantity: requested,
      orderedQuantity: ordered,
      status: row.status || 'pending',
      movedToArrivals: row.moved_to_arrivals ?? row.movedToArrivals,
      source: row.source,
      createdAt: row.created_at ?? row.createdAt,
      updatedAt: row.updated_at ?? row.updatedAt
    } as BuyingListItem;
  }

  getBuyingList(): Observable<BuyingListItem[]> {
    return from(
      this.scopeShopQuery(this.sb.from('buying_list')
        .select('id, batch_id, batch_product_id, product_id, requested_qty, ordered_qty, status, moved_to_arrivals, created_at, updated_at, products(name), batches(name)')
        .order('created_at', { ascending: false }))
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.mapBuyingListRow(r))));
  }

  getBuyingListByBatch(batchId: number): Observable<BuyingListItem[]> {
    return from(
      this.scopeShopQuery(this.sb.from('buying_list')
        .select('id, batch_id, batch_product_id, product_id, requested_qty, ordered_qty, status, moved_to_arrivals, created_at, updated_at, products(name), batches(name)')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false }))
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.mapBuyingListRow(r))));
  }

  getBuyingListItemsByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = '',
    status = ''
  ): Observable<{ data: BuyingListItem[]; total: number }> {
    const run = async () => {
      const fromIndex = (page - 1) * pageSize;
      const toIndex = fromIndex + pageSize - 1;

      let dataQuery = this.scopeShopQuery(
        this.sb.from('buying_list')
          .select('id, batch_id, batch_product_id, product_id, requested_qty, ordered_qty, status, moved_to_arrivals, created_at, updated_at, products(name), batches(name)')
      )
        .eq('batch_id', batchId);

      let countQuery = this.scopeShopQuery(
        this.sb.from('buying_list')
          .select('id', { count: 'exact', head: true })
      )
        .eq('batch_id', batchId);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        const { data: matchedProducts } = await this.scopeShopQuery(
          this.sb.from('products')
            .select('id')
            .ilike('name', term)
        );
        const productIds = (matchedProducts || []).map((product: any) => product.id);
        if (productIds.length > 0) {
          dataQuery = dataQuery.in('product_id', productIds);
          countQuery = countQuery.in('product_id', productIds);
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

      if (status) {
        dataQuery = dataQuery.eq('status', status);
        countQuery = countQuery.eq('status', status);
      }

      const [{ data }, { count }] = await Promise.all([
        dataQuery.order('created_at', { ascending: false }).range(fromIndex, toIndex),
        countQuery
      ]);

      return {
        data: (data || []).map((row: any) => this.mapBuyingListRow(row)),
        total: count || 0
      };
    };

    return from(run());
  }

  getBuyingListItemsSummary(
    batchId: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = '',
    status = ''
  ): Observable<{ count: number; requested: number; ordered: number }> {
    const run = async () => {
      let query = this.scopeShopQuery(
        this.sb.from('buying_list')
          .select('requested_qty, ordered_qty, created_at, product_id, status')
      )
        .eq('batch_id', batchId);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        const { data: matchedProducts } = await this.scopeShopQuery(
          this.sb.from('products')
            .select('id')
            .ilike('name', term)
        );
        const productIds = (matchedProducts || []).map((product: any) => product.id);
        if (productIds.length > 0) {
          query = query.in('product_id', productIds);
        } else {
          query = query.eq('id', -1);
        }
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data } = await query;
      const rows = data || [];
      const requested = rows.reduce((sum: number, row: any) => sum + Number(row.requested_qty ?? row.requested_quantity ?? 0), 0);
      const ordered = rows.reduce((sum: number, row: any) => sum + Number(row.ordered_qty ?? row.ordered_quantity ?? 0), 0);

      return {
        count: rows.length,
        requested,
        ordered
      };
    };

    return from(run());
  }

  createBuyingListItem(item: BuyingListItem): Observable<number> {
    return from(this.doCreateOrUpdateBuyingListItem(item));
  }

  private async doCreateOrUpdateBuyingListItem(item: BuyingListItem): Promise<number> {
    const batchId = item.batchId;
    const batchProductId = item.batchProductId;
    const productId = item.productId;
    if (!batchId || !batchProductId || !productId) return 0;

    const requested = Number(item.requestedQuantity ?? item.requestedQty ?? 0);
    const ordered = Number(item.orderedQuantity ?? item.orderedQty ?? item.requestedQuantity ?? item.requestedQty ?? 0);

    const { data: existing } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('id, requested_qty, ordered_qty, status')
      .eq('batch_id', batchId)
      .eq('batch_product_id', batchProductId)
      .limit(1)
      .maybeSingle());

    if (existing && (existing as any).id) {
      const id = (existing as any).id as number;
      const updatedRow: any = {
        requested_qty: Number((existing as any).requested_qty || 0) + requested,
        ordered_qty: Number((existing as any).ordered_qty || 0) + ordered,
        status: item.status || (existing as any).status || 'pending'
      };

      await this.scopeShopQuery(this.sb.from('buying_list').update(updatedRow)).eq('id', id);
      return id;
    }

    const row: any = {
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_product_id: batchProductId,
      product_id: productId,
      requested_qty: requested,
      ordered_qty: ordered,
      status: item.status || 'pending'
    };

    const { data } = await this.sb.from('buying_list').insert(row).select('id').single();
    return data?.id ?? 0;
  }

  updateBuyingListItem(item: BuyingListItem): Observable<boolean> {
    const requested = Number(item.requestedQuantity ?? item.requestedQty ?? 0);
    const ordered = Number(item.orderedQuantity ?? item.orderedQty ?? item.requestedQuantity ?? item.requestedQty ?? 0);
    const row = {
      requested_qty: requested,
      ordered_qty: ordered,
      status: item.status
    };
    return from(
      this.scopeShopQuery(this.sb.from('buying_list').update(row)).eq('id', item.id)
    ).pipe(map(({ error }) => !error));
  }

  applyBuyingListArrivalToStock(batchId: number, batchName: string): Observable<boolean> {
    return from(this.doApplyBuyingListArrivalToStock(batchId, batchName));
  }

  private async doApplyBuyingListArrivalToStock(batchId: number, _batchName: string): Promise<boolean> {
    const { data: claimedBatch, error: claimErr } = await this.scopeShopQuery(
      this.sb.from('batches').update({ stock_applied: true }).eq('id', batchId).eq('stock_applied', false).select('id').maybeSingle()
    );
    if (claimErr) return false;
    if (!claimedBatch) return true;

    const { data: items, error } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('product_id, ordered_qty')
    )
      .eq('batch_id', batchId);

    if (error) return false;
    const rows = items || [];
    for (const row of rows) {
      const productId = row.product_id as number | null;
      const qty = Number(row.ordered_qty || 0);
      if (!productId || qty <= 0) continue;
      const { data: product } = await this.scopeShopQuery(this.sb.from('products')
        .select('stock')
      )
        .eq('id', productId)
        .single();
      const current = Number(product?.stock || 0);
      await this.scopeShopQuery(this.sb.from('products')
        .update({ stock: current + qty })
      )
        .eq('id', productId);
    }
    return true;
  }

  deleteBuyingListItem(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('buying_list').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  // =====================
  // Arrivals
  // =====================
  // Read arrival items (normalized arrival_items with batch_id)
  getArrivals(): Observable<ArrivalItem[]> {
    return from(
      this.scopeShopQuery(
        this.sb.from('arrival_items')
          .select('id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at, products(name,stock), batches(name)')
      )
        .neq('status', 'sent_to_shipping')
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => {
      const requested = Number(r.requested_qty ?? 0);
      const received = Number(r.received_qty ?? 0);
      return {
        id: r.id,
        batchId: r.batch_id,
        batchProductId: r.batch_product_id,
        productId: r.product_id,
        productName: r.products?.name || '',
        orderedQuantity: requested,
        receivedQuantity: received,
        batchName: r.batches?.name || '',
        productStock: r.products?.stock ?? 0,
        confirmed: r.status === 'confirmed' || r.status === 'sent_to_shipping',
        sentToShipping: r.status === 'sent_to_shipping',
        requestedQuantity: requested,
        boughtQuantity: requested,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      } as ArrivalItem;
    })));
  }

  getArrivalsByBatch(batchName: string): Observable<ArrivalItem[]> {
    return from(this.scopeShopQuery(this.sb.from('batches').select('id')).eq('name', batchName).limit(1).maybeSingle()).pipe(
      switchMap(({ data: batch }) => {
        if (!batch) return of([] as ArrivalItem[]);
        return from(
          this.scopeShopQuery(
            this.sb.from('arrival_items')
              .select('id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at, products(name,stock), batches(name)')
          )
            .eq('batch_id', batch.id)
            .neq('status', 'sent_to_shipping')
            .order('created_at', { ascending: false })
        ).pipe(map(({ data }) => (data || []).map((r: any) => {
          const requested = Number(r.requested_qty ?? 0);
          const received = Number(r.received_qty ?? 0);
          return {
            id: r.id,
            batchId: r.batch_id,
            batchProductId: r.batch_product_id,
            productId: r.product_id,
            productName: r.products?.name || '',
            orderedQuantity: requested,
            receivedQuantity: received,
            batchName: r.batches?.name || '',
            productStock: r.products?.stock ?? 0,
            confirmed: r.status === 'confirmed' || r.status === 'sent_to_shipping',
            sentToShipping: r.status === 'sent_to_shipping',
            requestedQuantity: requested,
            boughtQuantity: requested,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          } as ArrivalItem;
        })));
      })
    );
  }

  getArrivalBatchesPage(
    page: number,
    pageSize: number,
    searchTerm = '',
    monthYear?: { month: number; year: number }
  ): Observable<{ data: OrderBatch[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeTable('batches')
      .select('*', { count: 'exact' })
      .eq('arrivals_sent', true)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);
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

  /** Get all batches for admin management (includes open and closed) */
  getAllBatchesForManagement(page: number, pageSize: number, searchTerm = ''): Observable<{ data: OrderBatch[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeShopQuery(this.sb.from('batches'))
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    return from(query).pipe(map(({ data, count }) => ({
      data: rowsToCamel<OrderBatch>(data || []),
      total: count || 0
    })));
  }

  /** Get count of items (arrival_items) for a batch by ID */
  getBatchItemCountById(batchId: number): Observable<number> {
    return from(
      this.scopeShopQuery(
        this.sb.from('arrival_items').select('id', { count: 'exact' })
      )
        .eq('batch_id', batchId)
    ).pipe(map(({ count }) => count || 0));
  }

  /** Get count of orders for a batch by ID */
  getBatchOrderCountById(batchId: number): Observable<number> {
    return from(
      this.scopeShopQuery(
        this.sb.from('orders').select('id', { count: 'exact' })
      )
        .eq('batch_id', batchId)
    ).pipe(map(({ count }) => count || 0));
  }

  /** Get count of items (arrival_items) for a batch */
  getBatchItemCount(batchName: string): Observable<number> {
    return from(this.doGetBatchItemCount(batchName));
  }

  private async doGetBatchItemCount(batchName: string): Promise<number> {
    const { data: batch } = await this.scopeShopQuery(this.sb.from('batches').select('id')).eq('name', batchName).maybeSingle();
    if (!batch || !batch.id) return 0;
    const { count } = await this.scopeShopQuery(
      this.sb.from('arrival_items').select('id', { count: 'exact' })
    )
      .eq('batch_id', batch.id);
    return count || 0;
  }

  /** Get count of orders for a batch */
  getBatchOrderCount(batchName: string): Observable<number> {
    return from(this.doGetBatchOrderCount(batchName));
  }

  private async doGetBatchOrderCount(batchName: string): Promise<number> {
    const { data: batch } = await this.scopeShopQuery(this.sb.from('batches').select('id')).eq('name', batchName).maybeSingle();
    if (!batch || !batch.id) return 0;
    const { count } = await this.scopeShopQuery(
      this.sb.from('orders').select('id', { count: 'exact' })
    )
      .eq('batch_id', batch.id);
    return count || 0;
  }

  getArrivalBatchStats(batchId: number): Observable<{ count: number; ordered: number; received: number; confirmed: number }> {
    return from(
      this.scopeShopQuery(
        this.sb.from('arrival_items').select('requested_qty, received_qty, confirmed_qty, status', { count: 'exact' })
      )
        .eq('batch_id', batchId)
    ).pipe(map(({ data, count }) => {
      const rows = data || [];
      const ordered = rows.reduce((sum: number, r: any) => sum + Number(r.requested_qty ?? 0), 0);
      const received = rows.reduce((sum: number, r: any) => sum + Number(r.received_qty ?? 0), 0);
      const confirmed = rows.filter((r: any) => r.status === 'confirmed' || r.status === 'sent_to_shipping').length;
      return {
        count: count || rows.length,
        ordered,
        received,
        confirmed
      };
    }));
  }

  getArrivalItemsByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: ArrivalItem[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    if (!searchTerm) {
      // No search term - use direct query
      let query = this.scopeShopQuery(
        this.sb.from('arrival_items')
          .select('id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at, products(name,stock), batches(name)', { count: 'exact' })
      )
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      return from(query.range(fromIndex, toIndex)).pipe(
        map(({ data, count }) => ({
          data: (data || []).map((r: any) => {
            const requested = Number(r.requested_qty ?? 0);
            const received = Number(r.received_qty ?? 0);
            return {
              id: r.id,
              batchId: r.batch_id,
              batchProductId: r.batch_product_id,
              productId: r.product_id,
              productName: r.products?.name || '',
              orderedQuantity: requested,
              receivedQuantity: received,
              batchName: r.batches?.name || '',
              productStock: r.products?.stock ?? 0,
              confirmed: r.status === 'confirmed' || r.status === 'sent_to_shipping',
              sentToShipping: r.status === 'sent_to_shipping',
              requestedQuantity: requested,
              boughtQuantity: requested,
              createdAt: r.created_at,
              updatedAt: r.updated_at
            } as ArrivalItem;
          }),
          total: count || 0
        }))
      );
    }

    // Search term exists - use two-step query
    const run = async () => {
      const { data: products } = await this.scopeShopQuery(
        this.sb.from('products').select('id')
      )
        .ilike('name', `%${searchTerm}%`);
      const matchingProductIds = (products || []).map((p: any) => p.id);

      if (matchingProductIds.length === 0) {
        // No matching products
        return { data: [], total: 0 };
      }

      let query = this.scopeShopQuery(
        this.sb.from('arrival_items')
          .select('id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at, products(name,stock), batches(name)', { count: 'exact' })
      )
        .eq('batch_id', batchId)
        .in('product_id', matchingProductIds)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, count } = await query.range(fromIndex, toIndex);

      return {
        data: (data || []).map((r: any) => {
          const requested = Number(r.requested_qty ?? 0);
          const received = Number(r.received_qty ?? 0);
          return {
            id: r.id,
            batchId: r.batch_id,
            batchProductId: r.batch_product_id,
            productId: r.product_id,
            productName: r.products?.name || '',
            orderedQuantity: requested,
            receivedQuantity: received,
            batchName: r.batches?.name || '',
            productStock: r.products?.stock ?? 0,
            confirmed: r.status === 'confirmed' || r.status === 'sent_to_shipping',
            sentToShipping: r.status === 'sent_to_shipping',
            requestedQuantity: requested,
            boughtQuantity: requested,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          } as ArrivalItem;
        }),
        total: count || 0
      };
    };

    return from(run());
  }

  getArrivalItemsSummary(
    batchId: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ count: number; requested: number; ordered: number; received: number; confirmed: number }> {
    if (!searchTerm) {
      // No search term - use direct query
      let query = this.scopeShopQuery(
        this.sb.from('arrival_items').select('requested_qty, received_qty, confirmed_qty, status, created_at', { count: 'exact' })
      )
        .eq('batch_id', batchId);

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      return from(query).pipe(
        map(({ data, count }) => {
          const rows = data || [];
          const requested = rows.reduce((sum: number, r: any) => sum + Number(r.requested_qty ?? 0), 0);
          const received = rows.reduce((sum: number, r: any) => sum + Number(r.received_qty ?? 0), 0);
          const confirmed = rows.filter((r: any) => r.status === 'confirmed' || r.status === 'sent_to_shipping').length;
          return {
            count: count || rows.length,
            requested,
            ordered: requested,
            received,
            confirmed
          };
        })
      );
    }

    // Search term exists - use two-step query
    const run = async () => {
      const { data: products } = await this.scopeShopQuery(
        this.sb.from('products').select('id')
      )
        .ilike('name', `%${searchTerm}%`);
      const matchingProductIds = (products || []).map((p: any) => p.id);

      if (matchingProductIds.length === 0) {
        // No matching products
        return { count: 0, requested: 0, ordered: 0, received: 0, confirmed: 0 };
      }

      let query = this.scopeShopQuery(
        this.sb.from('arrival_items').select('requested_qty, received_qty, confirmed_qty, status, created_at', { count: 'exact' })
      )
        .eq('batch_id', batchId)
        .in('product_id', matchingProductIds);

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, count } = await query;
      const rows = data || [];
      const requested = rows.reduce((sum: number, r: any) => sum + Number(r.requested_qty ?? 0), 0);
      const received = rows.reduce((sum: number, r: any) => sum + Number(r.received_qty ?? 0), 0);
      const confirmed = rows.filter((r: any) => r.status === 'confirmed' || r.status === 'sent_to_shipping').length;

      return {
        count: count || rows.length,
        requested,
        ordered: requested,
        received,
        confirmed
      };
    };

    return from(run());
  }

  // =====================
  // Product Tracking
  // =====================
  getTrackingBatchesPage(page: number, pageSize: number, searchTerm = ''): Observable<{ data: OrderBatch[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeShopQuery(
      this.sb.from('batches').select('*', { count: 'exact' })
    )
      .eq('arrivals_sent', true)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }
    return from(query).pipe(map(({ data, count }) => ({
      data: rowsToCamel<OrderBatch>(data || []),
      total: count || 0
    })));
  }

  getTrackingBatchStats(batchId: number): Observable<{ count: number; tracked: number }> {
    const run = async () => {
      // Count all confirmed items
      const { count: itemCount } = await this.scopeShopQuery(
        this.sb.from('arrival_items').select('id', { count: 'exact', head: true })
      )
        .eq('batch_id', batchId)
        .or('status.eq.confirmed,confirmed_qty.gt.0');
      
      // Count tracking rows that have at least one field filled in
      const { data: trackedRows } = await this.scopeShopQuery(
        this.sb.from('product_tracking').select('tracking_number, measurements, cbm, moq')
      )
        .eq('batch_id', batchId);
      
      const trackedCount = (trackedRows || []).filter((row: any) => 
        (row.tracking_number && row.tracking_number.trim() !== '') ||
        (row.measurements && row.measurements.trim() !== '') ||
        (row.cbm && Number(row.cbm) > 0) ||
        (row.moq && Number(row.moq) > 0)
      ).length;
      
      return { count: itemCount || 0, tracked: trackedCount };
    };
    
    return from(run());
  }

  getTrackingItemsByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: any[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    // Use inner join when searching so non-matching rows are excluded instead of
    // being returned with a null products relation (left-join behaviour)
    const productSelect = searchTerm ? 'products!inner(name)' : 'products(name)';
    let query = this.scopeShopQuery(
      this.sb.from('arrival_items')
        .select(`id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status, created_at, updated_at, ${productSelect}`, { count: 'exact' })
    )
      .eq('batch_id', batchId)
      .or('status.eq.confirmed,confirmed_qty.gt.0')
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (searchTerm) {
      query = query.ilike('products.name', `%${searchTerm}%`);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    return from(query).pipe(
      switchMap(({ data, count }) => {
        const rows = data || [];
        const batchProductIds = Array.from(new Set(rows.map((r: any) => r.batch_product_id).filter(Boolean)));
        if (batchProductIds.length === 0) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            batchId: r.batch_id,
            batchProductId: r.batch_product_id,
            productId: r.product_id,
            productName: r.products?.name || '',
            confirmedQty: Number(r.confirmed_qty ?? r.received_qty ?? 0),
            trackingNumber: '',
            measurements: '',
            cbm: 0,
            moq: 0,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
          return of({ data: mapped, total: count || 0 });
        }

        const damageQuery = this.scopeShopQuery(
          this.sb.from('damage_order_allocations')
            .select('batch_product_id, damaged_quantity')
        )
          .eq('batch_id', batchId)
          .eq('is_active', true)
          .in('batch_product_id', batchProductIds);

        return from(
          Promise.all([
            this.scopeShopQuery(
              this.sb.from('product_tracking')
                .select('batch_product_id, tracking_number, measurements, cbm, moq, updated_at')
            )
              .eq('batch_id', batchId)
              .in('batch_product_id', batchProductIds),
            damageQuery
          ])
        ).pipe(
          map(([trackingResult, damageResult]: any[]) => {
            const trackingRows = trackingResult?.data || [];
            const damageRows = damageResult?.data || [];
            const trackingMap: Record<number, any> = {};
            (trackingRows || []).forEach((t: any) => trackingMap[t.batch_product_id] = t);
            const damageMap: Record<number, number> = {};
            (damageRows || []).forEach((d: any) => {
              const key = Number(d.batch_product_id || 0);
              if (!key) return;
              damageMap[key] = (damageMap[key] || 0) + Number(d.damaged_quantity || 0);
            });
            const mapped = rows.map((r: any) => {
              const tracking = trackingMap[r.batch_product_id] || {};
              const damagedQty = Number(damageMap[r.batch_product_id] || 0);
              return {
                id: r.id,
                batchId: r.batch_id,
                batchProductId: r.batch_product_id,
                productId: r.product_id,
                productName: r.products?.name || '',
                confirmedQty: Number(r.confirmed_qty ?? r.received_qty ?? 0),
                trackingNumber: tracking.tracking_number || '',
                measurements: tracking.measurements || '',
                cbm: Number(tracking.cbm ?? 0),
                moq: Number(tracking.moq ?? 0),
                damagedQty,
                hasAllocation: damagedQty > 0,
                createdAt: r.created_at,
                updatedAt: tracking.updated_at || r.updated_at
              };
            });
            return { data: mapped, total: count || 0 };
          })
        );
      })
    );
  }

  saveTrackingItems(rows: Array<{ batchId: number; batchProductId: number; productId: number; trackingNumber: string; measurements: string; cbm: number; moq: number }>): Observable<boolean> {
    if (!rows || rows.length === 0) return of(true);
    if (!this.activeShopId) return of(false);
    const dbRows = rows.map(r => ({
      shop_id: this.activeShopId,
      batch_id: r.batchId,
      batch_product_id: r.batchProductId,
      product_id: r.productId,
      tracking_number: r.trackingNumber || '',
      measurements: r.measurements || '',
      cbm: Number(r.cbm || 0),
      moq: Number(r.moq || 0)
    }));
    return from(this.scopeShopQuery(
      this.sb.from('product_tracking').upsert(dbRows, { onConflict: 'batch_id,batch_product_id' })
    ))
      .pipe(map(({ error }) => !error));
  }

  createArrivalsForBatch(batchId: number, batchName: string): Observable<boolean> {
    return from(this.doCreateArrivalsForBatch(batchId, batchName));
  }

  createArrivalForBuyingItem(itemId: number): Observable<boolean> {
    return from(this.doCreateArrivalForBuyingItem(itemId));
  }

  reverseArrivalForBuyingItem(itemId: number): Observable<boolean> {
    return from(this.doReverseArrivalForBuyingItem(itemId));
  }

  reverseArrivalToBuyingList(arrivalItemId: number): Observable<boolean> {
    return from(this.doReverseArrivalToBuyingList(arrivalItemId));
  }

  private async doCreateArrivalForBuyingItem(itemId: number): Promise<boolean> {
    const { data: items, error } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('batch_id, batch_product_id, product_id, ordered_qty, requested_qty, moved_to_arrivals')
      .eq('id', itemId)
      .limit(1)
      .single());
    if (error || !items) return false;

    const batchId = (items as any).batch_id;
    const batchProductId = (items as any).batch_product_id;
    const productId = (items as any).product_id;
    if (!batchId || !batchProductId || !productId) return false;
    if ((items as any).moved_to_arrivals) return true;

    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'buying_to_arrivals')) return false;

    const requested = (items as any).ordered_qty ?? (items as any).requested_qty ?? 0;
    const ai = {
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_product_id: batchProductId,
      product_id: productId,
      requested_qty: requested,
      received_qty: 0,
      confirmed_qty: 0,
      status: 'pending'
    };
    const { error: aiErr } = await this.sb.from('arrival_items')
      .upsert(ai, { onConflict: 'batch_id,batch_product_id', ignoreDuplicates: true });
    if (aiErr) return false;

    // mark buying_list item as moved to arrivals so UI can disable move button
    await this.scopeShopQuery(this.sb.from('buying_list').update({ moved_to_arrivals: true })).eq('id', itemId);
    if (batchId) {
      await this.scopeShopQuery(this.sb.from('batches').update({ arrivals_sent: true })).eq('id', batchId);
    }
    return true;
  }

  private async doReverseArrivalForBuyingItem(itemId: number): Promise<boolean> {
    if (!this.activeShopId || !itemId) return false;

    const { data: buyingItem, error: buyingErr } = await this.scopeShopQuery(
      this.sb.from('buying_list')
        .select('id, batch_id, batch_product_id, moved_to_arrivals')
    )
      .eq('id', itemId)
      .maybeSingle();

    if (buyingErr || !buyingItem) return false;
    if (!(buyingItem as any).moved_to_arrivals) return true;

    const batchId = Number((buyingItem as any).batch_id || 0);
    const batchProductId = Number((buyingItem as any).batch_product_id || 0);
    if (!batchId || !batchProductId) return false;

    return this.reverseUnconfirmedArrival(batchId, batchProductId);
  }

  private async doReverseArrivalToBuyingList(arrivalItemId: number): Promise<boolean> {
    if (!this.activeShopId || !arrivalItemId) return false;

    const { data: arrival, error } = await this.scopeShopQuery(
      this.sb.from('arrival_items')
        .select('batch_id, batch_product_id')
    )
      .eq('id', arrivalItemId)
      .maybeSingle();

    if (error || !arrival) return false;

    const batchId = Number((arrival as any).batch_id || 0);
    const batchProductId = Number((arrival as any).batch_product_id || 0);
    if (!batchId || !batchProductId) return false;

    return this.reverseUnconfirmedArrival(batchId, batchProductId);
  }

  private async reverseUnconfirmedArrival(batchId: number, batchProductId: number): Promise<boolean> {
    const { data: arrival, error } = await this.scopeShopQuery(
      this.sb.from('arrival_items')
        .select('id, received_qty, confirmed_qty, status')
    )
      .eq('batch_id', batchId)
      .eq('batch_product_id', batchProductId)
      .maybeSingle();

    if (error) return false;
    if (!arrival) {
      await this.scopeShopQuery(
        this.sb.from('buying_list').update({ moved_to_arrivals: false })
      )
        .eq('batch_id', batchId)
        .eq('batch_product_id', batchProductId);
      return this.refreshBatchArrivalsSentFlag(batchId);
    }

    const status = String((arrival as any).status || 'pending');
    const receivedQty = Number((arrival as any).received_qty || 0);
    const confirmedQty = Number((arrival as any).confirmed_qty || 0);
    if (status !== 'pending' || receivedQty > 0 || confirmedQty > 0) {
      return false;
    }

    const { error: deleteErr } = await this.scopeShopQuery(
      this.sb.from('arrival_items').delete()
    ).eq('id', (arrival as any).id);
    if (deleteErr) return false;

    const { error: updateErr } = await this.scopeShopQuery(
      this.sb.from('buying_list').update({ moved_to_arrivals: false })
    )
      .eq('batch_id', batchId)
      .eq('batch_product_id', batchProductId);
    if (updateErr) return false;

    return this.refreshBatchArrivalsSentFlag(batchId);
  }

  private async refreshBatchArrivalsSentFlag(batchId: number): Promise<boolean> {
    const hasArrivals = await this.hasBatchRows('arrival_items', batchId);
    if (hasArrivals) return true;

    const { error } = await this.scopeShopQuery(
      this.sb.from('batches').update({ arrivals_sent: false })
    ).eq('id', batchId);
    return !error;
  }

  private async doCreateArrivalsForBatch(batchId: number, _batchName: string): Promise<boolean> {
    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch) return false;
    if (batch.arrivalsSent && await this.hasBatchRows('arrival_items', batchId)) return true;
    if (!this.canRunBatchWorkflowTransition(batch, 'buying_to_arrivals')) return false;

    const { data: items, error } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('batch_product_id, product_id, requested_qty, ordered_qty')
      .eq('batch_id', batchId));
    if (error) return false;

    const rows = (items || []);
    if (!rows || rows.length === 0) return false;

    // Create arrival_items for each buying_list row
    const aiRows = rows.map((i: any) => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_product_id: i.batch_product_id,
      product_id: i.product_id,
      requested_qty: i.ordered_qty ?? i.requested_qty ?? 0,
      received_qty: 0,
      confirmed_qty: 0,
      status: 'pending'
    }));

    if (aiRows.length > 0) {
      const { error: aiInsertErr } = await this.sb.from('arrival_items')
        .upsert(aiRows, { onConflict: 'batch_id,batch_product_id' });
      if (aiInsertErr) return false;
    }

    // mark all buying_list items in this batch as moved
    await this.scopeShopQuery(this.sb.from('buying_list').update({ moved_to_arrivals: true })).eq('batch_id', batchId);

    await this.scopeShopQuery(this.sb.from('batches')
      .update({ arrivals_sent: true }))
      .eq('id', batchId);

    return true;
  }

  updateArrivalItem(item: ArrivalItem): Observable<boolean> {
    const row = {
      received_qty: item.receivedQuantity
    };
    return from(
      this.sb.from('arrival_items').update(row).eq('id', item.id)
    ).pipe(map(({ error }) => !error));
  }

  confirmArrivalItem(itemId: number, productId: number | null, receivedQty: number, surplusAccepted = false): Observable<boolean> {
    return from(this.doConfirmArrivalItem(itemId, productId, receivedQty, surplusAccepted));
  }

  private async doConfirmArrivalItem(itemId: number, productId: number | null, receivedQty: number, surplusAccepted = false): Promise<boolean> {
    const { data: arrivalItem } = await this.scopeShopQuery(
      this.sb.from('arrival_items')
        .select('id, batch_id, batch_product_id, product_id, requested_qty, received_qty, confirmed_qty, status')
    )
      .eq('id', itemId)
      .maybeSingle();
    if (!arrivalItem) return false;

    const normalizedReceivedQty = Math.max(0, Number(receivedQty || 0));
    const previousReceivedQty = Number((arrivalItem as any).received_qty || 0);
    const previousConfirmedQty = Number((arrivalItem as any).confirmed_qty || 0);
    const previousStatus = ((arrivalItem as any).status || 'pending') as string;
    const targetProductId = (arrivalItem as any).product_id ?? productId ?? null;
    const stockDelta = normalizedReceivedQty - previousConfirmedQty;

    const { error: aiErr } = await this.scopeShopQuery(this.sb.from('arrival_items').update({ received_qty: normalizedReceivedQty, confirmed_qty: normalizedReceivedQty, status: 'confirmed' }))
      .eq('id', itemId);
    if (aiErr) return false;

    // Confirmed arrivals become available stock immediately and are later reduced by damage or delivery.
    if (targetProductId && stockDelta !== 0) {
      const { data: product, error: productErr } = await this.scopeShopQuery(this.sb.from('products').select('stock'))
        .eq('id', targetProductId)
        .maybeSingle();
      if (productErr) {
        await this.scopeShopQuery(this.sb.from('arrival_items').update({
          received_qty: previousReceivedQty,
          confirmed_qty: previousConfirmedQty,
          status: previousStatus
        })).eq('id', itemId);
        return false;
      }

      const current = Number((product as any)?.stock || 0);
      const { error: stockErr } = await this.scopeShopQuery(this.sb.from('products').update({ stock: Math.max(0, current + stockDelta) }))
        .eq('id', targetProductId);
      if (stockErr) {
        await this.scopeShopQuery(this.sb.from('arrival_items').update({
          received_qty: previousReceivedQty,
          confirmed_qty: previousConfirmedQty,
          status: previousStatus
        })).eq('id', itemId);
        return false;
      }
    }

    return true;
  }

  // Damaged items
  createDamagedItem(payload: { arrivalItemId?: number; productId?: number | null; batchName?: string; expectedQuantity: number; damagedQuantity: number; notes?: string }): Observable<boolean> {
    return from(this.doCreateDamagedItem(payload));
  }

  private async doCreateDamagedItem(payload: { arrivalItemId?: number; productId?: number | null; batchName?: string; expectedQuantity: number; damagedQuantity: number; notes?: string }): Promise<boolean> {
    const expected = payload.expectedQuantity || 0;
    const damaged = payload.damagedQuantity || 0;
    console.debug('[db] doCreateDamagedItem payload', payload);
    
    if (payload.arrivalItemId) {
      const { data: ai } = await this.scopeShopQuery(this.sb.from('arrival_items').select('batch_id, batch_product_id, product_id'))
        .eq('id', payload.arrivalItemId)
        .maybeSingle();
      if (ai) {
        const row: any = {
          shop_id: this.activeShopId,
          batch_id: (ai as any).batch_id,
          batch_product_id: (ai as any).batch_product_id,
          product_id: (ai as any).product_id ?? payload.productId ?? null,
          requested_qty: expected,
          damaged_qty: damaged,
          reason: payload.notes || 'damaged_in_transit',
          notes: payload.notes || ''
        };
        console.debug('[db] damaged row', row);
        const { error: insertErr } = await this.sb.from('damaged_items').insert(row);
        if (!insertErr) {
          console.debug('[db] insert succeeded');
          return true;
        }
        console.warn('[db] insert failed', insertErr);
      }
    }
    
    console.warn('[db] Cannot create damaged item without arrivalItemId');
    return false;
    }
  

  // Damaged items CRUD
  getDamagedItems(): Observable<any[]> {
    if (!this.activeShopId) return of([]);
    // Fetch damaged rows with product info, then enrich with origin/batch where possible
    return from(this.scopeShopQuery(this.sb.from('damaged_items').select('*')).order('created_at', { ascending: false })).pipe(
      switchMap(({ data: rows }) => {
        const items = (rows || []) as any[];
        if (items.length === 0) return of([] as any[]);

        const normalizeDamagedQuantity = (row: any) => {
          const qtyPrimary = Number(row.damaged_qty ?? 0);
          const qtyLegacy = Number(row.damaged_quantity ?? 0);
          const qtyFallback = Number(row.quantity ?? 0);
          if (qtyPrimary > 0) return qtyPrimary;
          if (qtyLegacy > 0) return qtyLegacy;
          if (qtyFallback > 0) return qtyFallback;
          return qtyPrimary || qtyLegacy || qtyFallback || 0;
        };

        // Fetch product names for all product_ids in one query
        const productIds = Array.from(new Set(items.map(i => i.product_id).filter(Boolean)));
        const arrivalItemIds = Array.from(new Set(items.map(i => i.arrival_item_id).filter(Boolean)));

        return from(Promise.all([
          this.scopeShopQuery(this.sb.from('products').select('id, name').in('id', productIds || [])),
          this.scopeShopQuery(this.sb.from('arrival_items').select('id, batch_id, product_id').in('id', arrivalItemIds || []))
        ])).pipe(
          switchMap((results: any) => {
            const prodRes = results[0];
            const aiRes = results[1];
            const prodMap: Record<number, string> = {};
            (prodRes.data || []).forEach((p: any) => prodMap[p.id] = p.name);

            const aiMap: Record<number, any> = {};
            (aiRes.data || []).forEach((a: any) => aiMap[a.id] = a);

            const batchIds = Array.from(new Set([
              ...items.map(i => (i as any).batch_id).filter(Boolean),
              ...Object.values(aiMap).map((a: any) => a.batch_id).filter(Boolean)
            ]));

            if (batchIds.length === 0) {
              const out = items.map(i => ({
                ...toCamel(i),
                productName: prodMap[i.product_id] || null,
                origin: (i as any).batch_id || i.arrival_item_id ? 'arrival' : 'delivery',
                batchName: (i as any).batch_name || null,
                damagedQuantity: normalizeDamagedQuantity(i)
              }));
              return of(out as any[]);
            }

            return from(this.scopeShopQuery(this.sb.from('batches').select('id, name').in('id', batchIds))).pipe(
              map(({ data: batches }) => {
                const batchMap: Record<number, string> = {};
                (batches || []).forEach((b: any) => batchMap[b.id] = b.name);

                const out = items.map(i => {
                  const productName = prodMap[i.product_id] || null;
                  let batchName: string | null = (i as any).batch_name || null;
                  let batchId: number | null = (i as any).batch_id || null;
                  if (!batchId && i.arrival_item_id) {
                    const ai = aiMap[i.arrival_item_id];
                    if (ai?.batch_id) batchId = ai.batch_id;
                  }
                  const origin = batchId || i.arrival_item_id ? 'arrival' : 'delivery';
                  if (batchId && !batchName) batchName = batchMap[batchId] || null;

                  return {
                    ...toCamel(i),
                    productName,
                    origin,
                    batchName,
                    damagedQuantity: normalizeDamagedQuantity(i)
                  };
                });
                return out as any[];
              })
            );
          })
        );
      })
    );
  }

  // Record damaged items coming from deliveries (client-side damage reported during packing/delivery)
  // This will insert a damaged_items row and decrement product stock by the damaged quantity.
  createDamagedFromDelivery(productId: number, damagedQuantity: number, notes?: string, batchName?: string, batchId?: number | null): Observable<boolean> {
    return from(this.doCreateDamagedFromDelivery(productId, damagedQuantity, notes, batchName, batchId));
  }

  private async doCreateDamagedFromDelivery(productId: number, damagedQuantity: number, notes?: string, batchName?: string, batchId?: number | null): Promise<boolean> {
    if (!this.activeShopId) return false;
    const batch = batchId ? null : await this.getBatchLookupByName(batchName);
    // Insert damaged_items row
    const row: any = {
      shop_id: this.activeShopId,
      arrival_item_id: null,
      batch_id: batchId ?? batch?.id ?? null,
      product_id: productId || null,
      damaged_quantity: damagedQuantity || 0,
      quantity: damagedQuantity || 0,
      reason: notes ? notes : null,
      notes: notes || null
    };
    if (batchName) row.batch_name = batch?.name || batchName;
    console.debug('[db] createDamagedFromDelivery inserting', row);
    const { error } = await this.scopeShopQuery(this.sb.from('damaged_items').insert(row));
    if (error) {
      console.warn('[db] createDamagedFromDelivery insert failed', error);
      return false;
    }

    // Decrement product stock to reflect damaged removal from inventory
    if (productId && damagedQuantity > 0) {
      const { data: product } = await this.scopeShopQuery(this.sb.from('products').select('stock')).eq('id', productId).maybeSingle();
      const current = Number((product as any)?.stock || 0);
      const newStock = Math.max(0, current - damagedQuantity);
      await this.scopeShopQuery(this.sb.from('products').update({ stock: newStock })).eq('id', productId);
    }

    return true;
  }

  updateDamagedItem(id: number, patch: Partial<{ damagedQuantity: number; notes: string }>): Observable<boolean> {
    if (!this.activeShopId) return of(false);
    const dbPatch: any = {};
    if (patch.damagedQuantity !== undefined) dbPatch.damaged_quantity = patch.damagedQuantity;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    return from(this.scopeShopQuery(this.sb.from('damaged_items').update(dbPatch)).eq('id', id)).pipe(map(({ error }) => !error));
  }

  deleteDamagedItem(id: number): Observable<boolean> {
    if (!this.activeShopId) return of(false);
    return from(this.scopeShopQuery(this.sb.from('damaged_items').delete()).eq('id', id)).pipe(map(({ error }) => !error));
  }

  // Undo confirm: mark arrival item unconfirmed and decrement product stock by receivedQty
  unconfirmArrivalItem(arrivalItemId: number): Observable<boolean> {
    return from(this.doUnconfirmArrivalItem(arrivalItemId));
  }

  private async doUnconfirmArrivalItem(arrivalItemId: number): Promise<boolean> {
    const { data: ai } = await this.scopeShopQuery(this.sb.from('arrival_items').select('id, batch_id, batch_product_id, product_id, received_qty, confirmed_qty, status'))
      .eq('id', arrivalItemId)
      .maybeSingle();
    if (!ai) return false;
    const previousReceivedQty = Number((ai as any).received_qty || 0);
    const previousConfirmedQty = Number((ai as any).confirmed_qty || 0);
    const previousStatus = ((ai as any).status || 'confirmed') as string;
    const batchId = (ai as any).batch_id ?? null;
    const batchProductId = (ai as any).batch_product_id ?? null;
    const productId = (ai as any).product_id ?? null;
    const stockContribution = previousConfirmedQty;

    if (previousStatus === 'sent_to_shipping' && batchId && productId) {
      const { error: shippingFeesErr } = await this.scopeShopQuery(this.sb.from('shipping_fees').delete())
        .eq('batch_id', batchId)
        .eq('product_id', productId);
      if (shippingFeesErr) return false;
    }

    if (previousStatus === 'sent_to_shipping') {
      if (batchId && batchProductId) {
        const { error: trackingErr } = await this.scopeShopQuery(this.sb.from('product_tracking').delete())
          .eq('batch_id', batchId)
          .eq('batch_product_id', batchProductId);
        if (trackingErr) return false;
      }
    }

    const { error: resetErr } = await this.scopeShopQuery(this.sb.from('arrival_items').update({ received_qty: 0, confirmed_qty: 0, status: 'pending' }))
      .eq('id', arrivalItemId);
    if (resetErr) return false;

    if (productId && stockContribution > 0) {
      const { data: product, error: productErr } = await this.scopeShopQuery(this.sb.from('products').select('stock'))
        .eq('id', productId)
        .maybeSingle();
      if (productErr) {
        await this.scopeShopQuery(this.sb.from('arrival_items').update({
          received_qty: previousReceivedQty,
          confirmed_qty: previousConfirmedQty,
          status: previousStatus
        })).eq('id', arrivalItemId);
        return false;
      }

      const current = Number(product?.stock || 0);
      const newStock = Math.max(0, current - stockContribution);
      const { error: stockErr } = await this.scopeShopQuery(this.sb.from('products').update({ stock: newStock }))
        .eq('id', productId);
      if (stockErr) {
        await this.scopeShopQuery(this.sb.from('arrival_items').update({
          received_qty: previousReceivedQty,
          confirmed_qty: previousConfirmedQty,
          status: previousStatus
        })).eq('id', arrivalItemId);
        return false;
      }
    }

    const allocationDelete = await this.scopeShopQuery(this.sb.from('damage_order_allocations').update({
      is_active: false,
      undone_at: new Date().toISOString(),
      undone_by: this.currentAppUserId
    }))
      .eq('arrival_item_id', arrivalItemId);
    if (allocationDelete.error && !this.isMissingColumnOrTableError(allocationDelete.error)) {
      return false;
    }

    const legacyDelete = await this.scopeShopQuery(this.sb.from('damaged_items').delete())
      .eq('arrival_item_id', arrivalItemId);

    if (legacyDelete.error && !this.isMissingColumnOrTableError(legacyDelete.error)) {
      return false;
    }

    if (batchId && batchProductId) {
      let del = this.scopeShopQuery(this.sb.from('damaged_items').delete())
        .eq('batch_id', batchId)
        .eq('batch_product_id', batchProductId);
      if (productId) del = del.eq('product_id', productId);
      const { error: normalizedDeleteErr } = await del;
      if (normalizedDeleteErr) return false;
    }

    return true;
  }

  // =====================
  // Damage Order Allocations
  // =====================
  /**
   * Get all clients who ordered a specific product in a batch.
   * Returns array of {clientId, clientName, orderedQuantity}
   */
  getClientsForProductInBatch(productId: number, batchId: number): Observable<Array<{ orderItemId: number; orderId: number; clientId: number; clientName: string; orderedQuantity: number; batchProductId?: number }>> {
    return from(this.doGetClientsForProductInBatch(productId, batchId));
  }

  private async doGetClientsForProductInBatch(productId: number, batchId: number): Promise<Array<{ orderItemId: number; orderId: number; clientId: number; clientName: string; orderedQuantity: number; batchProductId?: number }>> {
    const { data: orderItems } = await this.scopeShopQuery(
      this.sb.from('order_items')
        .select('id, quantity, batch_product_id, orders!inner(id, customer_id, customers!inner(id, name))')
    )
      .eq('product_id', productId)
      .eq('orders.batch_id', batchId);

    if (!orderItems) return [];

    return (orderItems || []).map((item: any) => {
      const orders = item.orders as any;
      const customer = orders?.customers as any;
      const clientId = Number(customer?.id ?? orders?.customer_id ?? 0);
      return {
        orderItemId: Number(item.id || 0),
        orderId: Number(orders?.id || 0),
        clientId,
        clientName: customer?.name || `Client ${clientId}`,
        orderedQuantity: Number(item.quantity || 0),
        batchProductId: item.batch_product_id ?? undefined
      };
    }).filter((row: { orderItemId: number; clientId: number }) => row.orderItemId && row.clientId);
  }

  /**
   * Save damage order allocations for clients.
   * Each allocation tracks adjusted quantity vs original quantity per client.
   */
  saveDamageOrderAllocations(allocations: Array<{
    orderItemId: number;
    productId: number;
    clientId: number;
    batchId?: number;
    batchProductId?: number;
    batchName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    reason?: string;
    notes?: string;
    arrivalItemId?: number;
    damagedItemId?: number;
  }>): Observable<boolean> {
    return from(this.doSaveDamageOrderAllocations(allocations));
  }

  private async doSaveDamageOrderAllocations(allocations: Array<{
    orderItemId: number;
    productId: number;
    clientId: number;
    batchId?: number;
    batchProductId?: number;
    batchName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    reason?: string;
    notes?: string;
    arrivalItemId?: number;
    damagedItemId?: number;
  }>): Promise<boolean> {
    if (!allocations || allocations.length === 0) return true;

    const batchNames = Array.from(new Set(
      allocations
        .filter(allocation => !allocation.batchId && allocation.batchName)
        .map(allocation => allocation.batchName)
    ));
    const batchByName = new Map<string, { id: number; name: string } | null>();
    for (const batchName of batchNames) {
      batchByName.set(batchName, await this.getBatchLookupByName(batchName));
    }

    const rows = allocations.map(a => {
      const batch = a.batchId ? null : batchByName.get(a.batchName);
      return {
        shop_id: this.activeShopId,
        order_item_id: a.orderItemId,
        batch_id: a.batchId || batch?.id || null,
        batch_product_id: a.batchProductId || null,
        product_id: a.productId,
        client_id: a.clientId,
        batch_name: batch?.name || a.batchName,
        original_quantity: Number(a.originalQuantity || 0),
        adjusted_quantity: Number(a.adjustedQuantity || 0),
        damaged_quantity: Math.max(0, Number(a.originalQuantity || 0) - Number(a.adjustedQuantity || 0)),
        arrival_item_id: a.arrivalItemId || null,
        damaged_item_id: a.damagedItemId || null,
        reason: a.reason || null,
        notes: a.notes || null,
        is_active: true
      };
    });

    const { error } = await this.sb.from('damage_order_allocations').insert(rows);
    return !error || this.isMissingColumnOrTableError(error);
  }

  /**
   * Get damage allocations for a specific product and batch.
   * Returns aggregated damage info including total damaged quantity per client.
   */
  getDamageAllocationsForProductBatch(productId: number, batchName: string): Observable<Array<{
    clientId: number;
    clientName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    damagedQuantity: number;
  }>> {
    return from(this.doGetDamageAllocationsForProductBatch(productId, batchName));
  }

  private async doGetDamageAllocationsForProductBatch(productId: number, batchName: string): Promise<Array<{
    clientId: number;
    clientName: string;
    originalQuantity: number;
    adjustedQuantity: number;
    damagedQuantity: number;
  }>> {
    const batch = await this.getBatchLookupByName(batchName);
    const query = this.applyResolvedBatchFilter(
      this.scopeTable('damage_order_allocations')
      .select('client_id, original_quantity, adjusted_quantity, damaged_quantity')
        .eq('product_id', productId),
      batch,
      batchName
    )
      .eq('is_active', true);
    const { data: allocations } = await query;

    if (!allocations || allocations.length === 0) return [];

    // Get client names
    const clientIds = Array.from(new Set((allocations || []).map((a: any) => Number(a.client_id)).filter(Boolean)));
    const clientMap: Record<number, string> = {};

    if (clientIds.length > 0) {
      const { data: customers } = await this.scopeShopQuery(
        this.sb.from('customers').select('id, name')
      ).in('id', clientIds);
      (customers || []).forEach((c: any) => clientMap[c.id] = c.name);
    }

    return (allocations || []).map((a: any) => ({
      clientId: Number(a.client_id),
      clientName: clientMap[a.client_id] || `Client ${a.client_id}`,
      originalQuantity: Number(a.original_quantity || 0),
      adjustedQuantity: Number(a.adjusted_quantity || 0),
      damagedQuantity: Number(a.damaged_quantity || 0)
    }));
  }

  /**
   * Query shipping fees data with damage allocations joined in.
   * Returns adjusted quantities where allocations exist.
   */
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
    return this.shipping.getShippingQueuePageWithDamage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo);
  }

  /**
   * Delete all damage allocations for a given arrival item.
   * Used when undoing a confirmed arrival with damage allocation.
   */
  deleteDamageAllocationsForArrivalItem(arrivalItemId: number): Observable<boolean> {
    return from(this.doDeleteDamageAllocationsForArrivalItem(arrivalItemId));
  }

  private async doDeleteDamageAllocationsForArrivalItem(arrivalItemId: number): Promise<boolean> {
    const { error } = await this.scopeShopQuery(this.sb.from('damage_order_allocations').update({
      is_active: false,
      undone_at: new Date().toISOString(),
      undone_by: this.currentAppUserId
    }))
      .eq('arrival_item_id', arrivalItemId);
    return !error || this.isMissingColumnOrTableError(error);
  }

  /**
   * Delete damaged item record for a given arrival item.
   * Used when undoing a confirmed arrival with damage.
   */
  deleteDamagedItemForArrivalItem(arrivalItemId: number): Observable<boolean> {
    return from(this.doDeleteDamagedItemForArrivalItem(arrivalItemId));
  }

  private async doDeleteDamagedItemForArrivalItem(arrivalItemId: number): Promise<boolean> {
    const legacyDelete = await this.scopeShopQuery(this.sb.from('damaged_items').delete())
      .eq('arrival_item_id', arrivalItemId);

    if (!legacyDelete.error) {
      return true;
    }

    // Some deployed schemas no longer carry arrival_item_id on damaged_items.
    // In that normalized shape, damaged rows are tied to the arrival item through
    // batch_id + batch_product_id (+ product_id when available), so fall back to that.
    if (!this.isMissingColumnOrTableError(legacyDelete.error)) {
      return false;
    }

    const { data: arrivalItem, error: arrivalError } = await this.scopeShopQuery(this.sb.from('arrival_items').select('batch_id, batch_product_id, product_id'))
      .eq('id', arrivalItemId)
      .maybeSingle();

    if (arrivalError || !arrivalItem) {
      return false;
    }

    let normalizedDelete = this.scopeShopQuery(this.sb.from('damaged_items').delete())
      .eq('batch_id', (arrivalItem as any).batch_id)
      .eq('batch_product_id', (arrivalItem as any).batch_product_id);

    if ((arrivalItem as any).product_id) {
      normalizedDelete = normalizedDelete.eq('product_id', (arrivalItem as any).product_id);
    }

    const { error } = await normalizedDelete;
    return !error;
  }

  /**
   * Delete a batch and all related data cascading through the system.
   * Removes: orders, order_items, buying_list, arrivals, damaged_items, 
   * damage_allocations, shipping_fees, deliveries
   * PRESERVES: products table (even if created for this batch)
   */
  deleteBatchCascade(batchName: string): Observable<boolean> {
    return this.batches.deleteBatchCascade(batchName);
  }

  deleteBatchCascadeById(batchId: number, batchName?: string): Observable<boolean> {
    return this.batches.deleteBatchCascadeById(batchId, batchName);
  }

  sendArrivalsToDeliveries(batchName: string): Observable<boolean> {
    return from(this.doSendArrivalsToDeliveries(batchName));
  }

  private async doSendArrivalsToDeliveries(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const batch = await this.getBatchWorkflowSnapshotByName(batchName);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'shipping_to_deliveries')) return false;
    return this.doSendBatchToDeliveries(batch.id, batch.name || batchName);
  }

  // Create a delivery row from a single confirmed arrival item and remove the arrival
  createDeliveryForArrivalItem(arrivalItemId: number): Observable<boolean> {
    return from(this.doCreateDeliveryForArrivalItem(arrivalItemId));
  }

  private async doCreateDeliveryForArrivalItem(arrivalItemId: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    const { data: ai } = await this.scopeShopQuery(this.sb.from('arrival_items'))
      .select('id, batch_id, product_id, requested_qty, received_qty, status, products(name), batches(name)')
      .eq('id', arrivalItemId)
      .maybeSingle();
    if (!ai) return false;
    if ((ai as any).status !== 'confirmed') return false;

    const productName = (ai as any).products?.name || (ai as any).products?.[0]?.name || 'Item';
    const receivedQty = Number((ai as any).received_qty || (ai as any).requested_qty || 0);
    const batchName = (ai as any).batches?.name || null;
    const batchId = (ai as any).batch_id ?? null;
    if (!batchId || !batchName) return false;

    const batch = await this.getBatchWorkflowSnapshotById(batchId);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'shipping_to_deliveries')) return false;

    // try to determine a client for this product within the batch
    let clientId: number | null = null;
    const { data: orders } = await this.scopeShopQuery(this.sb.from('orders').select('id, customer_id')).eq('batch_id', batchId);
    if (orders && orders.length > 0) {
      const orderIds = orders.map((o: any) => o.id);
      const { data: oi } = await this.scopeShopQuery(this.sb.from('order_items').select('order_id')).eq('product_id', ai.product_id).in('order_id', orderIds).limit(1);
      if (oi && oi.length > 0) {
        const orderMatch = orders.find((o: any) => o.id === oi[0].order_id);
        clientId = orderMatch?.customer_id ?? orders[0].customer_id;
      } else {
        clientId = orders[0].customer_id;
      }
    }

    // fallback: pick any client if none found (satisfy NOT NULL constraint)
    if (!clientId) {
      const { data: anyClient } = await this.scopeShopQuery(this.sb.from('customers').select('id')).limit(1).maybeSingle();
      clientId = (anyClient && (anyClient as any).id) || null;
    }

    if (!clientId) return false;

    const { data: existingDelivery, error: existingDeliveryErr } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id')
    )
      .eq('batch_id', batchId)
      .eq('batch_name', batchName)
      .eq('customer_id', clientId)
      .maybeSingle();
    if (existingDeliveryErr) return false;

    if (!existingDelivery?.id) {
      const rows = [{
        shop_id: this.activeShopId,
        batch_id: batchId,
        batch_name: batchName,
        customer_id: clientId,
        delivery_fee: 0,
        delivery_date: null,
        status: 'pending',
        delivery_item_status: 'pending',
        notes: 'Created from arrival item'
      }];

      const { error: insertError } = await this.scopeShopQuery(this.sb.from('deliveries').insert(rows));
      if (insertError) return false;
    }

    // remove the arrival_items row so it no longer appears
    await this.scopeShopQuery(this.sb.from('arrival_items').delete()).eq('id', arrivalItemId);
    return true;
  }

  // Create deliveries for all confirmed arrival items in a batch
  createDeliveriesForBatch(batchName: string): Observable<boolean> {
    return from(this.doCreateDeliveriesForBatch(batchName));
  }

  private async doCreateDeliveriesForBatch(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const batch = await this.getBatchWorkflowSnapshotByName(batchName);
    if (!batch || !this.canRunBatchWorkflowTransition(batch, 'shipping_to_deliveries')) return false;
    const batchId = batch.id;

    // Find confirmed arrival_items under this batch
    const { data: items } = await this.scopeShopQuery(this.sb.from('arrival_items'))
      .select('id')
      .eq('batch_id', batchId)
      .eq('status', 'confirmed');
    if (!items || items.length === 0) return true;

    for (const it of items) {
      const ok = await this.doCreateDeliveryForArrivalItem(it.id);
      if (!ok) return false;
    }
    return true;
  }

  /**
   * Get all buyers (clients) who ordered a specific product within a batch.
   * Returns array of { clientName, clientPhone, quantity }.
   */
  getBuyersForProduct(productId: number, batchName: string): Observable<{ clientName: string; clientPhone: string; quantity: number }[]> {
    return from(this.doGetBuyersForProduct(productId, batchName));
  }

  getBuyersForProductPage(
    productId: number,
    batchId: number,
    page: number,
    pageSize: number
  ): Observable<{ data: { clientName: string; clientPhone: string; quantity: number }[]; total: number; totalQty: number }> {
    return from(this.doGetBuyersForProductPage(productId, batchId, page, pageSize));
  }

  private async doGetBuyersForProduct(productId: number, batchName: string): Promise<{ clientName: string; clientPhone: string; quantity: number }[]> {
    const { data: batch } = await this.scopeShopQuery(
      this.sb.from('batches')
        .select('id')
        .eq('name', batchName)
        .limit(1)
        .maybeSingle()
    );
    if (!batch || !(batch as any).id) return [];
    const result = await this.doGetBuyersForProductPage(productId, (batch as any).id, 1, 1000);
    return result.data;
  }

  private async doGetBuyersForProductPage(
    productId: number,
    batchId: number,
    page: number,
    pageSize: number
  ): Promise<{ data: { clientName: string; clientPhone: string; quantity: number }[]; total: number; totalQty: number }> {
    const { data: orders } = await this.scopeShopQuery(
      this.sb.from('orders')
        .select('id, customer_id, customers(name, whatsapp_number)')
        .eq('batch_id', batchId)
    );
    if (!orders || orders.length === 0) {
      return { data: [], total: 0, totalQty: 0 };
    }

    const orderIds = orders.map((order: any) => order.id);
    const { data: items } = await this.scopeShopQuery(
      this.sb.from('order_items')
        .select('order_id, quantity')
        .eq('product_id', productId)
        .in('order_id', orderIds)
    );
    if (!items || items.length === 0) {
      return { data: [], total: 0, totalQty: 0 };
    }

    const orderMap: Record<number, { name: string; phone: string }> = {};
    for (const order of orders) {
      orderMap[order.id] = {
        name: (order as any).customers?.name || 'Unknown',
        phone: (order as any).customers?.whatsapp_number || ''
      };
    }

    const aggregated = new Map<string, { clientName: string; clientPhone: string; quantity: number }>();
    for (const item of items) {
      const buyer = orderMap[(item as any).order_id];
      if (!buyer) continue;
      const key = `${buyer.name}|${buyer.phone}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          clientName: buyer.name,
          clientPhone: buyer.phone,
          quantity: 0
        });
      }
      aggregated.get(key)!.quantity += Number((item as any).quantity || 0);
    }

    const rows = Array.from(aggregated.values()).sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return a.clientName.localeCompare(b.clientName);
    });
    const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
    const fromIndex = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);
    const toIndex = fromIndex + Math.max(pageSize, 1);

    return {
      data: rows.slice(fromIndex, toIndex),
      total: rows.length,
      totalQty
    };
  }

  // =====================
  // Expenses
  // =====================
  getExpenses(): Observable<Expense[]> {
    return from(
      this.scopeTable('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => ({
      ...toCamel(r),
      createdByName: ''
    } as unknown as Expense))));
  }

  getExpensesByCategory(category: string): Observable<Expense[]> {
    return from(
      this.scopeTable('expenses')
        .select('*')
        .eq('category', category)
        .order('expense_date', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => ({
      ...toCamel(r),
      createdByName: ''
    } as unknown as Expense))));
  }

  createExpense(expense: Expense): Observable<number> {
    const shopId = this.activeShopId;
    if (!shopId) {
      throw new Error('Active shop context is required to create an expense.');
    }

    const row = {
      shop_id: shopId,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      recipient: expense.recipient || '',
      payment_method: expense.paymentMethod || 'cash',
      reference: expense.reference || '',
      expense_date: expense.expenseDate,
      notes: expense.notes || '',
      created_by: expense.createdBy || null
    };
    return from(
      this.sb.from('expenses').insert(row).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  updateExpense(expense: Expense): Observable<boolean> {
    const row = {
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      recipient: expense.recipient || '',
      payment_method: expense.paymentMethod || 'cash',
      reference: expense.reference || '',
      expense_date: expense.expenseDate,
      notes: expense.notes || ''
    };
    return from(
      this.scopeShopQuery(this.sb.from('expenses').update(row)).eq('id', expense.id)
    ).pipe(map(({ error }) => !error));
  }

  deleteExpense(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('expenses').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  // =====================
  // Dashboard Stats
  // =====================
  getDashboardStats(): Observable<DashboardStats> {
    return from(Promise.all([
      this.scopeTable('products', 'id', { count: 'exact', head: true }),
      this.scopeTable('customers', 'id', { count: 'exact', head: true }),
      this.scopeTable('batches', 'id', { count: 'exact', head: true })
        .eq('status', 'open').in('order_status', ['pending', 'confirmed', 'processing']),
      this.scopeTable('deliveries', 'id', { count: 'exact', head: true })
        .in('status', ['pending', 'in_transit']),
      this.scopeTable('orders', 'id, payment_status, order_items(subtotal)')
        .eq('payment_status', 'paid'),
      this.scopeTable('orders', 'id', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0])
    ])).pipe(
      map(([products, clients, pendingOrders, pendingDeliveries, revenueRows, todayOrders]) => ({
        totalProducts: products.count || 0,
        totalClients: clients.count || 0,
        pendingOrders: pendingOrders.count || 0,
        pendingDeliveries: pendingDeliveries.count || 0,
        totalRevenue: (revenueRows.data || []).reduce((sum: number, r: any) => {
          const itemsTotal = (r.order_items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.subtotal || 0), 0);
          return sum + itemsTotal;
        }, 0),
        todayOrders: todayOrders.count || 0
      }))
    );
  }

  // =====================
  // Clear All Data
  // =====================
  /**
   * Deletes ALL business data from the database.
   * Order matters due to foreign key constraints:
   *   order_items -> orders -> customers
   *   deliveries -> customers
   *   buying_list, expenses, batches are independent
   * Does NOT delete users, roles, or role_permissions.
   */
  clearAllData(): Observable<{ success: boolean; errors: string[] }> {
    return from(this.doClearAllData());
  }

  private async doClearAllData(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Delete in FK-safe order (children first)
    const tables = [
      'order_items',
      'deliveries',
      'expenses',
      'buying_list',
      'orders',
      'batches',
      'products',
      'customers',
    ];

    for (const table of tables) {
      const { error } = await this.scopeShopQuery(this.sb.from(table).delete()).gte('id', 0);
      if (error) {
        errors.push(`${table}: ${error.message}`);
      }
    }

    return { success: errors.length === 0, errors };
  }
}
