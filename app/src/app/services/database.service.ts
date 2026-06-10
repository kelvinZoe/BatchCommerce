import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ClientDataService } from './client-data.service';
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
  OrderItemAdjustment
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends SupabaseDataAccessService {
  private getPriceForQuantity(basePrice: number, discountMinQty: number, discountPrice: number, quantity: number): number {
    const normalizedBasePrice = Number(basePrice || 0);
    const normalizedDiscountMinQty = Number(discountMinQty || 0);
    const normalizedDiscountPrice = Number(discountPrice || 0);
    const normalizedQuantity = Number(quantity || 0);

    return normalizedDiscountMinQty > 0 && normalizedDiscountPrice > 0 && normalizedQuantity >= normalizedDiscountMinQty
      ? normalizedDiscountPrice
      : normalizedBasePrice;
  }

  // Notification subject for when batches are deleted
  private batchDeletedSource = new Subject<string>();
  public batchDeleted$ = this.batchDeletedSource.asObservable();

  constructor(
    supa: SupabaseService,
    authService: AuthService,
    private clients: ClientDataService
  ) {
    super(supa, authService);
  }

  // =====================
  // Products
  // =====================
  getProducts(): Observable<Product[]> {
    return from(
      this.scopeShopQuery(this.sb.from('products').select('*')).order('name')
    ).pipe(map(({ data }) => rowsToCamel<Product>(data || [])));
  }

  getProductCatalog(): Observable<ProductCatalog[]> {
    return from(
      this.scopeTable('products')
        .select('id, name, description, image_url, is_active, stock, created_at, updated_at')
        .order('name')
    ).pipe(map(({ data }) => rowsToCamel<ProductCatalog>(data || [])));
  }

  getMostRecentBatchProductForProduct(productId: number): Observable<BatchProduct | null> {
    return from(
      this.scopeShopQuery(this.sb.from('batch_products').select('preorder_price, preorder_discount_min_qty, preorder_discount_price, stock_price, stock_discount_min_qty, stock_discount_price, in_stock_qty'))
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).pipe(map(({ data }) => data ? toCamel(data) as BatchProduct : null));
  }

  getProduct(id: number): Observable<Product | null> {
    return from(
      this.scopeShopQuery(this.sb.from('products').select('*')).eq('id', id).single()
    ).pipe(map(({ data }) => data ? toCamel(data) as Product : null));
  }

  getProductStock(productId: number): Observable<number> {
    return from(
      this.scopeShopQuery(this.sb.from('products').select('stock')).eq('id', productId).single()
    ).pipe(map(({ data }) => Number((data as any)?.stock || 0)));
  }

  createProduct(product: Product): Observable<number> {
    const row = {
      shop_id: this.activeShopId,
      name: product.name,
      stock: product.stock || 0,
      preorder_price: product.preorderPrice || 0,
      purchase_price: product.purchasePrice || 0,
      description: product.description || '',
      image_url: product.imageUrl || ''
    };
    return from(
      this.sb.from('products').insert(row).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  updateProduct(product: Product): Observable<boolean> {
    const row = {
      name: product.name,
      stock: product.stock || 0,
      preorder_price: product.preorderPrice || 0,
      purchase_price: product.purchasePrice || 0,
      description: product.description || '',
      image_url: product.imageUrl || ''
    };
    return from(
      this.sb.from('products').update(row).eq('id', product.id)
    ).pipe(map(({ error }) => !error));
  }

  deleteProduct(id: number): Observable<boolean> {
    return from(
      this.sb.from('products').delete().eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  createProductCatalog(product: ProductCatalog): Observable<number> {
    return from(this.doCreateProductCatalog(product));
  }

  private async doCreateProductCatalog(product: ProductCatalog): Promise<number> {
    const baseRow = {
      shop_id: this.activeShopId,
      name: product.name,
      description: product.description || '',
      image_url: product.imageUrl || '',
      is_active: product.isActive ?? true,
      stock: product.stock || 0
    } as Record<string, any>;

    const pricingRow = {
      ...baseRow,
      stock_price: product.stockPrice || 0,
      stock_discount_min_qty: product.stockDiscountMinQty || 0,
      stock_discount_price: product.stockDiscountPrice || 0
    };

    const withPricing = await this.sb.from('products').insert(pricingRow).select('id').single();
    if (!withPricing.error) {
      return withPricing.data?.id ?? 0;
    }

    if (!this.isMissingColumnOrTableError(withPricing.error)) {
      throw withPricing.error;
    }

    const fallback = await this.sb.from('products').insert(baseRow).select('id').single();
    if (fallback.error) {
      throw fallback.error;
    }

    return fallback.data?.id ?? 0;
  }

  getProductCatalogPage(
    page: number,
    pageSize: number,
    searchTerm = '',
    statusFilter: 'all' | 'active' | 'inactive' = 'all'
  ): Observable<{ data: ProductCatalog[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    let query = this.scopeTable('products')
      .select('id, name, description, image_url, is_active, stock, created_at, updated_at', { count: 'exact' })
      .order('name');
    
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true);
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false);
    }
    
    return from(query.range(fromIndex, toIndex)).pipe(
      map(({ data, count }) => ({
        data: rowsToCamel<ProductCatalog>(data || []),
        total: count || 0
      }))
    );
  }

  updateProductCatalog(productId: number, product: ProductCatalog): Observable<boolean> {
    return from(this.doUpdateProductCatalog(productId, product));
  }

  private async doUpdateProductCatalog(productId: number, product: ProductCatalog): Promise<boolean> {
    const baseRow = {
      name: product.name,
      description: product.description || '',
      image_url: product.imageUrl || '',
      is_active: product.isActive ?? true,
      stock: product.stock || 0,
      updated_at: new Date().toISOString()
    } as Record<string, any>;

    const pricingRow = {
      ...baseRow,
      stock_price: product.stockPrice || 0,
      stock_discount_min_qty: product.stockDiscountMinQty || 0,
      stock_discount_price: product.stockDiscountPrice || 0
    };

    const withPricing = await this.scopeShopQuery(this.sb.from('products').update(pricingRow)).eq('id', productId);
    if (!withPricing.error) {
      return true;
    }

    if (!this.isMissingColumnOrTableError(withPricing.error)) {
      return false;
    }

    const fallback = await this.scopeShopQuery(this.sb.from('products').update(baseRow)).eq('id', productId);
    return !fallback.error;
  }

  deleteProductCatalog(productId: number): Observable<boolean> {
    return from(this.doDeleteProductCatalog(productId));
  }

  private async doDeleteProductCatalog(productId: number): Promise<boolean> {
    try {
      console.log('[db] Deleting product with ID:', productId);

      // 1. Delete from order_items where product_id matches (RESTRICT constraint)
      const delErr1 = await this.sb.from('order_items').delete().eq('product_id', productId);
      if (delErr1.error) {
        console.error('[db] Error deleting order_items:', delErr1.error, ' - Status:', delErr1.status);
        return false;
      }
      console.log('[db] Deleted order_items');

      // 2. Delete from stock_sale_items where product_id matches (RESTRICT constraint)
      const delErr2 = await this.sb.from('stock_sale_items').delete().eq('product_id', productId);
      if (delErr2.error) {
        console.error('[db] Error deleting stock_sale_items:', delErr2.error, ' - Status:', delErr2.status);
        return false;
      }
      console.log('[db] Deleted stock_sale_items');

      // 3. Delete from shipping_invoice_items where product_id matches (RESTRICT constraint)
      const delErr3 = await this.sb.from('shipping_invoice_items').delete().eq('product_id', productId);
      if (delErr3.error) {
        console.error('[db] Error deleting shipping_invoice_items:', delErr3.error, ' - Status:', delErr3.status);
        return false;
      }
      console.log('[db] Deleted shipping_invoice_items');

      // 4. Delete from batch_product_shipping where product_id matches (RESTRICT constraint)
      const delErr4 = await this.sb.from('batch_product_shipping').delete().eq('product_id', productId);
      if (delErr4.error) {
        console.error('[db] Error deleting batch_product_shipping:', delErr4.error, ' - Status:', delErr4.status);
        return false;
      }
      console.log('[db] Deleted batch_product_shipping');

      // 5. Delete from follow_ups where product_id matches (RESTRICT constraint)
      const delErr5 = await this.sb.from('follow_ups').delete().eq('product_id', productId);
      if (delErr5.error) {
        console.error('[db] Error deleting follow_ups:', delErr5.error, ' - Status:', delErr5.status);
        return false;
      }
      console.log('[db] Deleted follow_ups');

      // 6. Delete from damaged_items where product_id matches (RESTRICT constraint)
      const delErr6 = await this.sb.from('damaged_items').delete().eq('product_id', productId);
      if (delErr6.error) {
        console.error('[db] Error deleting damaged_items:', delErr6.error, ' - Status:', delErr6.status);
        return false;
      }
      console.log('[db] Deleted damaged_items');

      // 7. Delete from arrival_items where product_id matches (RESTRICT constraint)
      const delErr7 = await this.sb.from('arrival_items').delete().eq('product_id', productId);
      if (delErr7.error) {
        console.error('[db] Error deleting arrival_items:', delErr7.error, ' - Status:', delErr7.status);
        return false;
      }
      console.log('[db] Deleted arrival_items');

      // 8. Delete from buying_list where product_id matches (RESTRICT constraint)
      const delErr8 = await this.sb.from('buying_list').delete().eq('product_id', productId);
      if (delErr8.error) {
        console.error('[db] Error deleting buying_list:', delErr8.error, ' - Status:', delErr8.status);
        return false;
      }
      console.log('[db] Deleted buying_list');

      // 9. Delete from batch_products where product_id matches (RESTRICT constraint)
      const delErr9 = await this.scopeShopQuery(this.sb.from('batch_products').delete()).eq('product_id', productId);
      if (delErr9.error) {
        console.error('[db] Error deleting batch_products:', delErr9.error, ' - Status:', delErr9.status);
        return false;
      }
      console.log('[db] Deleted batch_products');

      // 10. Finally delete the product itself
      console.log('[db] Attempting to delete product record with ID:', productId);
      const delErr10 = await this.sb.from('products').delete().eq('id', productId);
      if (delErr10.error) {
        console.error('[db] Error deleting product record:', delErr10.error, ' - Status:', delErr10.status);
        return false;
      }
      console.log('[db] Product deleted successfully');

      return true;
    } catch (err) {
      console.error('Error deleting product cascade:', err);
      return false;
    }
  }

  getBatchProducts(batchId: number): Observable<BatchProduct[]> {
    return from(
      this.scopeShopQuery(this.sb.from('batch_products').select('id, batch_id, product_id, preorder_price, preorder_discount_min_qty, preorder_discount_price, stock_price, stock_discount_min_qty, stock_discount_price, in_stock_qty, created_at, updated_at, products(name, description, image_url)'))
        .eq('batch_id', batchId)
        .order('id', { ascending: true })
    ).pipe(map(({ data }) => (data || []).map((r: any) => ({
      ...toCamel(r),
      productName: r.products?.name,
      description: r.products?.description,
      imageUrl: r.products?.image_url
    } as BatchProduct))));
  }

  getBatchProductsPage(batchId: number, page: number, pageSize: number, searchTerm = ''): Observable<{ data: BatchProduct[]; total: number }> {
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;
    const joinType = searchTerm ? 'products!inner(name, description, image_url)' : 'products(name, description, image_url)';
    let query = this.scopeShopQuery(this.sb.from('batch_products').select(`id, batch_id, product_id, preorder_price, preorder_discount_min_qty, preorder_discount_price, stock_price, stock_discount_min_qty, stock_discount_price, in_stock_qty, created_at, updated_at, ${joinType}`, { count: 'exact' }))
      .eq('batch_id', batchId)
      .order('id', { ascending: true })
      .range(fromIndex, toIndex);
    if (searchTerm) {
      query = query.ilike('products.name', `%${searchTerm}%`);
    }
    return from(query).pipe(map(({ data, count }) => ({
      data: (data || []).map((r: any) => ({
        ...toCamel(r),
        productName: r.products?.name,
        description: r.products?.description,
        imageUrl: r.products?.image_url
      } as BatchProduct)),
      total: count || 0
    })));
  }

  addBatchProduct(row: BatchProduct): Observable<number> {
    return from(
      this.sb.from('batch_products').insert({
        shop_id: this.activeShopId,
        batch_id: row.batchId,
        product_id: row.productId,
        preorder_price: row.preorderPrice,
        preorder_discount_min_qty: row.preorderDiscountMinQty,
        preorder_discount_price: row.preorderDiscountPrice,
        stock_price: row.stockPrice,
        stock_discount_min_qty: row.stockDiscountMinQty,
        stock_discount_price: row.stockDiscountPrice,
        in_stock_qty: row.inStockQty
      }).select('id').single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data?.id ?? 0;
    }));
  }

  updateBatchProduct(id: number, row: Partial<BatchProduct>): Observable<boolean> {
    const updates: any = {
      preorder_price: row.preorderPrice,
      preorder_discount_min_qty: row.preorderDiscountMinQty,
      preorder_discount_price: row.preorderDiscountPrice,
      stock_price: row.stockPrice,
      stock_discount_min_qty: row.stockDiscountMinQty,
      stock_discount_price: row.stockDiscountPrice,
      in_stock_qty: row.inStockQty
    };
    return from(
      this.scopeShopQuery(this.sb.from('batch_products').update(updates)).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  deleteBatchProduct(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batch_products').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  // Preview what orders and stock sales will be affected by a price/discount change
  previewPriceChange(
    batchProductId: number,
    preorderPrice: number,
    preorderDiscountMinQty: number,
    preorderDiscountPrice: number,
    stockPrice: number,
    stockDiscountMinQty: number,
    stockDiscountPrice: number
  ): Observable<any> {
    return from(this.doPreviewPriceChange(
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    ));
  }

  private async doPreviewPriceChange(
    batchProductId: number,
    newPreorderPrice: number,
    newPreorderDiscountMinQty: number,
    newPreorderDiscountPrice: number,
    newStockPrice: number,
    newStockDiscountMinQty: number,
    newStockDiscountPrice: number
  ): Promise<any> {
    try {
      // Get all order items using this batch product
      const { data: orderItems, error: itemsError } = await this.scopeShopQuery(this.sb
        .from('order_items')
        .select('id, order_id, quantity, unit_price, subtotal')
      )
        .eq('batch_product_id', batchProductId);

      if (itemsError) throw itemsError;

      // Get all stock sale items using this batch product
      const { data: stockSaleItems, error: stockItemsError } = await this.scopeShopQuery(this.sb
        .from('stock_sale_items')
        .select('id, stock_sale_id, quantity, unit_price, subtotal')
      )
        .eq('batch_product_id', batchProductId);

      if (stockItemsError) throw stockItemsError;

      const affectedOrders: any[] = [];
      let totalCostChange = 0;

      // 1. Process preorder order items
      if (orderItems && orderItems.length > 0) {
        const scopedOrderItems = orderItems as any[];
        const orderIds = [...new Set(scopedOrderItems.map((item: any) => item.order_id))];
        const { data: orders } = await this.scopeShopQuery(this.sb
          .from('orders')
          .select('id, customer_id, customers(name)')
        )
          .in('id', orderIds);

        const orderMap = new Map(((orders || []) as any[]).map((o: any) => [o.id, o]));

        for (const item of scopedOrderItems) {
          const order = orderMap.get(item.order_id);
          const customers = order?.customers as any;
          const customerName = (Array.isArray(customers) ? customers[0]?.name : customers?.name) || 'Unknown';

          const currentPrice = Number(item.unit_price || 0);
          const quantity = Number(item.quantity || 0);

          const calculatedNewPrice = this.getPriceForQuantity(
            newPreorderPrice,
            newPreorderDiscountMinQty,
            newPreorderDiscountPrice,
            quantity
          );

          const oldTotal = Number(item.subtotal || (quantity * currentPrice));
          const newTotal = quantity * calculatedNewPrice;
          totalCostChange += (newTotal - oldTotal);

          affectedOrders.push({
            id: item.id,
            orderId: item.order_id,
            customerName,
            quantity,
            currentPrice,
            newPrice: calculatedNewPrice,
            oldTotal,
            newTotal,
            type: 'Preorder'
          });
        }
      }

      // 2. Process stock sale items
      if (stockSaleItems && stockSaleItems.length > 0) {
        const scopedStockSaleItems = stockSaleItems as any[];
        const saleIds = [...new Set(scopedStockSaleItems.map((item: any) => item.stock_sale_id))];
        const { data: sales } = await this.scopeShopQuery(this.sb
          .from('stock_sales')
          .select('id, customer_name')
        )
          .in('id', saleIds);

        const saleMap = new Map(((sales || []) as any[]).map((s: any) => [s.id, s]));

        for (const item of scopedStockSaleItems) {
          const sale = saleMap.get(item.stock_sale_id);
          const customerName = sale?.customer_name || 'Walk-in Customer';

          const currentPrice = Number(item.unit_price || 0);
          const quantity = Number(item.quantity || 0);

          const calculatedNewPrice = this.getPriceForQuantity(
            newStockPrice,
            newStockDiscountMinQty,
            newStockDiscountPrice,
            quantity
          );

          const oldTotal = Number(item.subtotal || (quantity * currentPrice));
          const newTotal = quantity * calculatedNewPrice;
          totalCostChange += (newTotal - oldTotal);

          affectedOrders.push({
            id: item.id,
            saleId: item.stock_sale_id,
            customerName,
            quantity,
            currentPrice,
            newPrice: calculatedNewPrice,
            oldTotal,
            newTotal,
            type: 'Stock Sale'
          });
        }
      }

      return {
        affectedRecordCount: affectedOrders.length,
        affectedOrderCount: affectedOrders.length,
        affectedPreorderItemCount: orderItems?.length || 0,
        affectedStockSaleItemCount: stockSaleItems?.length || 0,
        affectedOrders,
        totalCostChange
      };
    } catch (err) {
      console.error('Error previewing price change:', err);
      throw err;
    }
  }

  // Update batch product price and recalculate affected orders/sales
  updateBatchProductPriceWithRecalc(
    batchProductId: number,
    preorderPrice: number,
    preorderDiscountMinQty: number,
    preorderDiscountPrice: number,
    stockPrice: number,
    stockDiscountMinQty: number,
    stockDiscountPrice: number
  ): Observable<any> {
    return from(this.doUpdateBatchProductPrice(
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    ));
  }

  private async doUpdateBatchProductPrice(
    batchProductId: number,
    preorderPrice: number,
    preorderDiscountMinQty: number,
    preorderDiscountPrice: number,
    stockPrice: number,
    stockDiscountMinQty: number,
    stockDiscountPrice: number
  ): Promise<any> {
    try {
      // 1. Update the batch product row itself
      const { error: updateError } = await this.scopeShopQuery(this.sb
        .from('batch_products')
        .update({
          preorder_price: preorderPrice,
          preorder_discount_min_qty: preorderDiscountMinQty,
          preorder_discount_price: preorderDiscountPrice,
          stock_price: stockPrice,
          stock_discount_min_qty: stockDiscountMinQty,
          stock_discount_price: stockDiscountPrice
        })
      )
        .eq('id', batchProductId);

      if (updateError) throw updateError;

      // 2. Recalculate order_items (Preorders)
      const { data: orderItems, error: itemsError } = await this.scopeShopQuery(this.sb
        .from('order_items')
        .select('id, order_id, quantity')
      )
        .eq('batch_product_id', batchProductId);

      if (itemsError) throw itemsError;

      let affectedOrderItemsCount = 0;
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const quantity = Number(item.quantity || 0);
          const calculatedNewPrice = this.getPriceForQuantity(
            preorderPrice,
            preorderDiscountMinQty,
            preorderDiscountPrice,
            quantity
          );
          const subtotal = quantity * calculatedNewPrice;

          const { error } = await this.scopeShopQuery(this.sb
            .from('order_items')
            .update({
              unit_price: calculatedNewPrice,
              subtotal: subtotal
            })
          )
            .eq('id', item.id);

          if (error) throw error;
          affectedOrderItemsCount++;
        }
      }

      // 3. Recalculate stock_sale_items and update parent stock_sales total_amount
      const { data: stockSaleItems, error: stockItemsError } = await this.scopeShopQuery(this.sb
        .from('stock_sale_items')
        .select('id, stock_sale_id, quantity')
      )
        .eq('batch_product_id', batchProductId);

      if (stockItemsError) throw stockItemsError;

      let affectedStockItemsCount = 0;
      const affectedSaleIds = new Set<number>();

      if (stockSaleItems && stockSaleItems.length > 0) {
        for (const item of stockSaleItems) {
          const quantity = Number(item.quantity || 0);
          const calculatedNewPrice = this.getPriceForQuantity(
            stockPrice,
            stockDiscountMinQty,
            stockDiscountPrice,
            quantity
          );
          const subtotal = quantity * calculatedNewPrice;

          const { error } = await this.scopeShopQuery(this.sb
            .from('stock_sale_items')
            .update({
              unit_price: calculatedNewPrice,
              subtotal: subtotal
            })
          )
            .eq('id', item.id);

          if (error) throw error;
          affectedStockItemsCount++;
          affectedSaleIds.add(item.stock_sale_id);
        }

        // Update the total_amount on each affected stock_sales row
        for (const saleId of affectedSaleIds) {
          // Select all items for this stock sale to get the sum
          const { data: allSaleItems, error: sumError } = await this.scopeShopQuery(this.sb
            .from('stock_sale_items')
            .select('subtotal')
          )
            .eq('stock_sale_id', saleId);

          if (sumError) throw sumError;

          const newTotal = ((allSaleItems || []) as any[]).reduce(
            (sum: number, item: any) => sum + Number(item.subtotal || 0),
            0
          );

          const { error: saleUpdateError } = await this.scopeShopQuery(this.sb
            .from('stock_sales')
            .update({ total_amount: newTotal })
          )
            .eq('id', saleId);

          if (saleUpdateError) throw saleUpdateError;
        }
      }

      return {
        success: true,
        affectedRecordCount: affectedOrderItemsCount + affectedStockItemsCount,
        affectedOrderItemsCount,
        affectedStockItemsCount,
        affectedSalesCount: affectedSaleIds.size,
        message: `Successfully updated pricing. Recalculated ${affectedOrderItemsCount} preorder items and ${affectedStockItemsCount} stock sale items.`
      };
    } catch (err) {
      console.error('Error updating batch product price and recalculating:', err);
      throw err;
    }
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
    return from(
      this.scopeShopQuery(this.sb.from('batches').select('*')).order('created_at', { ascending: false })
    ).pipe(map(({ data }) => rowsToCamel<OrderBatch>(data || [])));
  }

  getOrderBatchesPage(page: number, pageSize: number, searchTerm = '', status?: OrderBatchStatus, monthYear?: { month: number; year: number }): Observable<{ data: OrderBatch[]; total: number }> {
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
        shop_id: this.activeShopId,
        name,
        status: 'open',
        order_status: 'pending',
        buying_status: 'pending',
        delivery_status: 'not_sent'
      }).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  closeOrderBatch(batchId: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('batches').update({ status: 'closed', closed_at: new Date().toISOString() })).eq('id', batchId)
    ).pipe(map(({ error }) => !error));
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

  // =====================
  // Orders
  // =====================
  getOrders(): Observable<Order[]> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => ({
      ...toCamel(r),
      clientName: r.customers?.name,
      clientPhone: r.customers?.whatsapp_number,
      paymentStatus: 'paid',
      totalAmount: (r.order_items || []).reduce((sum: number, i: any) => sum + Number(i.subtotal || 0), 0),
      items: (r.order_items || []).map((i: any) => ({
        ...toCamel(i),
        productName: i.products?.name
      }))
    } as unknown as Order))));
  }

  getOrdersByBatch(batchId: number): Observable<Order[]> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => ({
      ...toCamel(r),
      clientName: r.customers?.name,
      clientPhone: r.customers?.whatsapp_number,
      paymentStatus: 'paid',
      totalAmount: (r.order_items || []).reduce((sum: number, i: any) => sum + Number(i.subtotal || 0), 0),
      items: (r.order_items || []).map((i: any) => ({
        ...toCamel(i),
        productName: i.products?.name
      }))
    } as unknown as Order))));
  }

  getOrdersByBatchPage(
    batchId: number,
    page: number,
    pageSize: number,
    searchTerm = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: Order[]; total: number }> {
    const run = async () => {
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

        // PostgREST doesn't support related-table columns inside or(),
        // so resolve matching customer IDs first then filter by customer_id.in.(...)
        const { data: matchedClients } = await this.scopeShopQuery(
          this.sb.from('customers')
            .select('id')
            .or(`name.ilike.${term},whatsapp_number.ilike.${term}`)
        );
        const clientIds = (matchedClients || []).map((c: any) => c.id);

        // order_uuid is a uuid column — ilike doesn't work on it; use eq for exact UUID match only
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
          // Search term doesn't match anything — return empty results
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
        data: (data || []).map((r: any) => ({
          ...toCamel(r),
          clientName: r.customers?.name,
          clientPhone: r.customers?.whatsapp_number,
          paymentStatus: 'paid',
          totalAmount: (r.order_items || []).reduce((sum: number, i: any) => sum + Number(i.subtotal || 0), 0),
          items: (r.order_items || []).map((i: any) => ({
            ...toCamel(i),
            productName: i.products?.name
          }))
        } as unknown as Order)),
        total: count ?? 0
      };
    };
    return from(run());
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
    const run = async () => {
      const [ordersRes, blRes] = await Promise.all([
        this.scopeShopQuery(this.sb.from('orders').select('batch_id').in('batch_id', batchIds)),
        this.scopeShopQuery(this.sb.from('buying_list').select('batch_id, status').in('batch_id', batchIds))
      ]);
      const map = new Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>();
      batchIds.forEach(id => map.set(id, { orderCount: 0, pending: 0, ordered: 0, shipped: 0, arrived: 0 }));
      (ordersRes.data || []).forEach((r: any) => { const s = map.get(r.batch_id); if (s) s.orderCount++; });
      (blRes.data || []).forEach((r: any) => {
        const s = map.get(r.batch_id);
        if (!s) return;
        // Count status directly
        if (r.status === 'pending') s.pending++;
        else if (r.status === 'ordered') s.ordered++;
        else if (r.status === 'shipped') s.shipped++;
        else if (r.status === 'arrived') s.arrived++;
      });
      return map;
    };
    return from(run());
  }

  getBatchGrandTotal(batchId: number): Observable<number> {
    return from(
      this.scopeTable('orders')
        .select('order_items(subtotal)')
        .eq('batch_id', batchId)
    ).pipe(map(({ data }) =>
      (data || []).reduce((sum: number, order: any) =>
        sum + (order.order_items || []).reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0)
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
    const run = async () => {
      const { data } = await this.scopeShopQuery(
        this.sb.from('order_items')
          .select('*, products(name)')
      ).eq('order_id', orderId);

      const items = (data || []).map((r: any) => ({
        ...toCamel(r),
        productName: r.products?.name
      } as unknown as OrderItem));

      const orderItemIds = items.map((item: OrderItem) => item.id).filter((id: number | undefined): id is number => typeof id === 'number');
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
    };

    return from(run());
  }

  createOrder(order: Order): Observable<number> {
    const row: any = {
      shop_id: this.activeShopId,
      customer_id: order.clientId,
      notes: order.notes || ''
    };
    if (order.batchId) {
      row.batch_id = order.batchId;
    }
    return from(
      this.sb.from('orders').insert(row).select('id').single()
    ).pipe(map(({ data }) => data?.id ?? 0));
  }

  addOrderItem(item: OrderItem): Observable<number> {
    const row = {
      shop_id: this.activeShopId,
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

  private async getActiveAllocationsByOrderItemIds(orderItemIds: number[]): Promise<Map<number, number>> {
    const quantityMap = new Map<number, number>();
    if (!orderItemIds.length) return quantityMap;

    const { data, error } = await this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('order_item_id, adjusted_quantity')
        .in('order_item_id', orderItemIds)
        .eq('is_active', true)
    );

    if (error) {
      if (this.isMissingColumnOrTableError(error)) {
        return quantityMap;
      }
      throw error;
    }

    (data || []).forEach((row: any) => {
      const orderItemId = Number(row.order_item_id || 0);
      if (!orderItemId) return;
      quantityMap.set(orderItemId, Number(row.adjusted_quantity || 0));
    });

    return quantityMap;
  }

  findOrderByClientBatch(clientId: number, batchId: number): Observable<Order | null> {
    return from(
      this.scopeTable('orders')
        .select('*, customers(name, whatsapp_number), order_items(id, product_id, batch_product_id, quantity, unit_price, subtotal, products(name))')
        .eq('customer_id', clientId)
        .eq('batch_id', batchId)
        .limit(1)
        .maybeSingle()
    ).pipe(map(({ data }: any) => {
      if (!data) return null;
      return {
        ...toCamel(data),
        clientName: data.customers?.name,
        clientPhone: data.customers?.whatsapp_number,
        paymentStatus: 'paid',
        totalAmount: (data.order_items || []).reduce((sum: number, i: any) => sum + Number(i.subtotal || 0), 0),
        items: (data.order_items || []).map((i: any) => ({
          ...toCamel(i),
          productName: i.products?.name
        }))
      } as unknown as Order;
    }));
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
        clientName: row.orders?.customers?.name || '—',
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

  updatePaymentStatus(orderId: number, paymentStatus: PaymentStatus): Observable<boolean> {
    // Orders are paid at entry in the new workflow.
    return of(true);
  }

  deleteOrder(id: number): Observable<boolean> {
    // order_items cascade-deletes automatically via FK
    // .select() forces PostgREST to return affected rows so we can detect silent RLS failures
    return from(
      this.scopeShopQuery(this.sb.from('orders').delete()).eq('id', id).select('id')
    ).pipe(map(({ data, error }) => {
      if (error) { console.error('[deleteOrder] error:', error.message, error); return false; }
      const deleted = (data?.length ?? 0) > 0;
      if (!deleted) console.warn('[deleteOrder] No rows deleted for id', id, '— possible RLS block or row does not exist');
      return deleted;
    }));
  }

  deleteOrderItem(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('order_items').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  updateOrderTotal(orderId: number, totalAmount: number): Observable<boolean> {
    // Order totals are computed from order_items in the new workflow.
    return of(true);
  }

  /**
   * When closing a batch, aggregate all order items from that batch and
   * create buying list entries grouped by batch product.
   */
  sendBatchToBuyingList(batchId: number, batchName: string): Observable<boolean> {
    return from(this.doSendBatchToBuyingList(batchId, batchName));
  }

  private async doSendBatchToBuyingList(batchId: number, _batchName: string): Promise<boolean> {
    // 1. Get all orders in this batch
    const { data: orders } = await this.scopeShopQuery(this.sb.from('orders').select('id'))
      .eq('batch_id', batchId);

    if (!orders || orders.length === 0) return true;

    const orderIds = orders.map((o: any) => o.id);

    // 2. Get all order items for those orders
    const { data: items } = await this.scopeShopQuery(
      this.sb.from('order_items')
        .select('batch_product_id, product_id, quantity, order_id')
        .in('order_id', orderIds)
    );

    if (!items || items.length === 0) return true;

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
    return !error;
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
    if (!this.activeShopId) return of(0);
    const row = {
      shop_id: this.activeShopId,
      customer_id: delivery.clientId,
      batch_name: delivery.batchName || '',
      delivery_fee: delivery.deliveryFee,
      delivery_type: this.mapDeliveryTypeToDb(delivery.deliveryCategory),
      delivery_date: delivery.deliveryDate,
      status: delivery.status,
      delivery_item_status: delivery.deliveryItemStatus || 'pending',
      notes: delivery.notes || ''
    };
    return from(
      this.scopeShopQuery(this.sb.from('deliveries').insert(row).select('id').single())
    ).pipe(map(({ data }) => data?.id ?? 0));
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
    if (!this.activeShopId) return of([]);
    return from(
      this.scopeShopQuery(this.sb.from('deliveries'))
        .select('*, customers(name, whatsapp_number, address)')
        .eq('batch_name', batchName)
        .order('created_at', { ascending: false })
    ).pipe(map(({ data }) => (data || []).map((r: any) => this.mapDeliveryRow(r))));
  }

  // =====================
  // Stock Sales
  // =====================

  /** All products with stock > 0, priced at their most recent batch_product entry */
  getStockAvailableProducts(): Observable<StockProduct[]> {
    return from(Promise.all([
      this.scopeTable('products', 'id, name, stock').gt('stock', 0).order('name'),
      this.scopeTable('batch_products')
        .select('id, product_id, stock_price, stock_discount_min_qty, stock_discount_price')
        .order('created_at', { ascending: false })
    ])).pipe(map(([productsRes, bpRes]: any[]) => {
      const products = (productsRes.data || []) as any[];
      const bpRows   = (bpRes.data   || []) as any[];
      const latest: Record<number, any> = {};
      for (const row of bpRows) {
        if (!latest[row.product_id]) latest[row.product_id] = row;
      }
      return products.map((p: any) => ({
        id:                   p.id,
        name:                 p.name,
        stock:                p.stock || 0,
        stockPrice:           latest[p.id]?.stock_price           ?? 0,
        stockDiscountMinQty:  latest[p.id]?.stock_discount_min_qty ?? 0,
        stockDiscountPrice:   latest[p.id]?.stock_discount_price   ?? 0,
        latestBatchProductId: latest[p.id]?.id                    ?? null,
      })) as StockProduct[];
    }));
  }

  getStockSalesPage(page: number, pageSize: number, search = '', dateFrom = '', dateTo = '')
    : Observable<{ data: StockSale[]; total: number }> {
    const fromIdx = (page - 1) * pageSize;
    const toIdx   = fromIdx + pageSize - 1;
    let q = this.scopeTable('stock_sales')
      .select('id, sale_uuid, customer_name, customer_id, sale_channel, total_amount, created_at, stock_sale_items(id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);
    if (search)   q = (q as any).ilike('customer_name', `%${search}%`);
    if (dateFrom) q = (q as any).gte('created_at', dateFrom);
    if (dateTo)   q = (q as any).lte('created_at', dateTo + 'T23:59:59');
    return from(q).pipe(map(({ data, count }: any) => ({
      data: (data || []).map((r: any) => ({
        ...toCamel(r),
        itemCount: Array.isArray(r.stock_sale_items) ? r.stock_sale_items.length : 0
      })) as StockSale[],
      total: count || 0
    })));
  }

  getStockSaleDetail(id: number): Observable<StockSale | null> {
    return from(
      this.scopeTable('stock_sales')
        .select('*, stock_sale_items(*, products(name))')
        .eq('id', id)
        .single()
    ).pipe(map(({ data }: any) => {
      if (!data) return null;
      return {
        ...toCamel(data),
        items: (data.stock_sale_items || []).map((i: any) => ({
          ...toCamel(i),
          productName: i.products?.name
        }))
      } as StockSale;
    }));
  }

  createStockSale(
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Observable<{ id: number; saleUuid: string }> {
    return from(this.doCreateStockSale(customerId, customerName, saleChannel, totalAmount, items));
  }

  private async doCreateStockSale(
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<{ id: number; saleUuid: string }> {
    const { data: sale, error: saleErr } = await this.sb.from('stock_sales').insert({
      shop_id: this.activeShopId,
      customer_id:   customerId || null,
      customer_name: customerName,
      sale_channel:  saleChannel,
      total_amount:  totalAmount
    }).select('id, sale_uuid').single();
    if (saleErr || !sale) throw saleErr;

    const itemRows = items.map(i => ({
      shop_id: this.activeShopId,
      stock_sale_id:    (sale as any).id,
      batch_product_id: i.batchProductId,
      product_id:       i.productId,
      quantity:         i.quantity,
      unit_price:       i.unitPrice,
      subtotal:         i.subtotal
    }));
    const { error: itemsErr } = await this.sb.from('stock_sale_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    // Decrement stock once per product to avoid duplicate updates in the same sale.
    const quantityByProduct = new Map<number, number>();
    for (const item of items) {
      const productId = Number(item.productId);
      if (!productId) continue;
      quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + Number(item.quantity || 0));
    }

    for (const [productId, soldQty] of quantityByProduct.entries()) {
      const { data: prod, error: prodErr } = await this.scopeShopQuery(
        this.sb.from('products').select('id, stock')
      ).eq('id', productId).maybeSingle();

      if (prodErr) {
        throw new Error(prodErr.message || `Failed to read stock for product ${productId}`);
      }

      if (!prod) {
        throw new Error(`Product ${productId} not found for the active shop`);
      }

      const currentStock = Number((prod as any)?.stock || 0);
      const newStock = Math.max(0, currentStock - soldQty);

      const { error: stockErr } = await this.scopeShopQuery(
        this.sb.from('products').update({ stock: newStock })
      ).eq('id', productId);

      if (stockErr) {
        throw new Error(stockErr.message || `Failed to update stock for product ${productId}`);
      }
    }

    return { id: (sale as any).id, saleUuid: (sale as any).sale_uuid };
  }

  updateStockSale(
    saleId: number,
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Observable<boolean> {
    return from(this.doUpdateStockSale(saleId, customerId, customerName, saleChannel, totalAmount, items));
  }

  private async doUpdateStockSale(
    saleId: number,
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<boolean> {
    if (!this.activeShopId || !saleId) return false;

    const { data: existingItems, error: existingErr } = await this.scopeShopQuery(
      this.sb.from('stock_sale_items').select('product_id, quantity')
    ).eq('stock_sale_id', saleId);
    if (existingErr) return false;

    await this.adjustProductStock(existingItems || [], 1);

    const { error: saleErr } = await this.scopeShopQuery(this.sb.from('stock_sales').update({
      customer_id: customerId || null,
      customer_name: customerName,
      sale_channel: saleChannel,
      total_amount: totalAmount
    })).eq('id', saleId);
    if (saleErr) return false;

    const { error: deleteItemsErr } = await this.scopeShopQuery(this.sb.from('stock_sale_items').delete())
      .eq('stock_sale_id', saleId);
    if (deleteItemsErr) return false;

    const itemRows = items.map(i => ({
      shop_id: this.activeShopId,
      stock_sale_id: saleId,
      batch_product_id: i.batchProductId,
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: i.subtotal
    }));

    if (itemRows.length > 0) {
      const { error: insertErr } = await this.scopeShopQuery(this.sb.from('stock_sale_items').insert(itemRows));
      if (insertErr) return false;
    }

    await this.adjustProductStock(items, -1);
    return true;
  }

  deleteStockSale(saleId: number): Observable<boolean> {
    return from(this.doDeleteStockSale(saleId));
  }

  private async doDeleteStockSale(saleId: number): Promise<boolean> {
    if (!this.activeShopId || !saleId) return false;

    const { data: existingItems, error: existingErr } = await this.scopeShopQuery(
      this.sb.from('stock_sale_items').select('product_id, quantity')
    ).eq('stock_sale_id', saleId);
    if (existingErr) return false;

    const { error: deleteErr } = await this.scopeShopQuery(this.sb.from('stock_sales').delete()).eq('id', saleId);
    if (deleteErr) return false;

    await this.adjustProductStock(existingItems || [], 1);
    return true;
  }

  private async adjustProductStock(items: Array<{ productId?: number; product_id?: number; quantity?: number }>, direction: 1 | -1): Promise<void> {
    const quantityByProduct = new Map<number, number>();
    for (const item of items || []) {
      const productId = Number(item.productId ?? item.product_id ?? 0);
      const quantity = Number(item.quantity || 0);
      if (!productId || quantity <= 0) continue;
      quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + quantity);
    }

    for (const [productId, quantity] of quantityByProduct.entries()) {
      const { data: product, error: productErr } = await this.scopeShopQuery(
        this.sb.from('products').select('stock')
      ).eq('id', productId).maybeSingle();
      if (productErr || !product) continue;
      const current = Number((product as any).stock || 0);
      const next = direction === 1
        ? current + quantity
        : Math.max(0, current - quantity);
      await this.scopeShopQuery(this.sb.from('products').update({ stock: next })).eq('id', productId);
    }
  }

  // =====================
  // Shipping helpers (UI: batch-first view, per-item fees)
  // =====================
  getShippingBatches(): Observable<string[]> {
    // return distinct batch names that have saved shipping fees (linked to deliveries)
    const qFees = this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name')).not('delivery_id', 'is', null);
    const qDels = this.scopeShopQuery(this.sb.from('deliveries').select('batch_name'));
    return from(Promise.all([qFees, qDels])).pipe(
      map(([feesRes, delsRes]: any) => {
        const feeNames = (feesRes?.data || []).map((r: any) => (r.batch_name || '').toString()).filter(Boolean);
        const delNames = (delsRes?.data || []).map((r: any) => (r.batch_name || '').toString()).filter(Boolean);
        const combined = Array.from(new Set([...feeNames, ...delNames]));
        return combined;
      })
    );
  }

  getShippingBatchCounts(): Observable<{ [k: string]: number }> {
    // count distinct deliveries that have shipping fees per batch
    return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name, delivery_id')).not('delivery_id', 'is', null)).pipe(
      map(({ data }) => {
        const sets: Record<string, Set<number>> = {};
        (data || []).forEach((r: any) => {
          const b = r.batch_name || '';
          const did = Number(r.delivery_id || 0);
          if (!b || !did) return;
          sets[b] = sets[b] || new Set<number>();
          sets[b].add(did);
        });
        const counts: Record<string, number> = {};
        Object.keys(sets).forEach(k => counts[k] = sets[k].size);
        return counts;
      })
    );
  }

  // =====================
  // Shipping queue (pre-delivery)
  // =====================
  getShippingQueueBatches(): Observable<string[]> {
    const run = async () => {
      const { data: batches } = await this.scopeShopQuery(
        this.sb.from('batches').select('name')
      )
        .eq('status', 'closed')
        .eq('delivery_status', 'not_sent')
        .order('created_at', { ascending: false });
      
      return (batches || [])
        .map((b: any) => (b.name || '').toString())
        .filter(Boolean);
    };
    
    return from(run());
  }

  getShippingQueueCounts(): Observable<{ [k: string]: number }> {
    return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name'))).pipe(
      map(({ data }) => {
        const counts: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          const b = r.batch_name || '';
          if (!b) return;
          counts[b] = (counts[b] || 0) + 1;
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
    const term = (searchTerm || '').toString().trim();
    let clientIdsByName: number[] = [];

    if (term) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id')
      ).ilike('name', `%${term}%`);
      clientIdsByName = (clients || []).map((c: any) => Number(c.id)).filter(Boolean);
    }

    // Get ALL matching rows first (no pagination yet) to group by product
    let query: any = this.scopeShopQuery(
      this.sb.from('shipping_fees')
        .select('id, client_id, product_id, product_name, quantity, fee, batch_name, created_at')
    )
      .eq('batch_name', batchName)
      .order('product_name', { ascending: true });

    if (onlyUnsent) {
      query = query.or('fee.is.null,fee.eq.0');
    }

    if (term) {
      if (clientIdsByName.length > 0) {
        const ids = clientIdsByName.join(',');
        query = query.or(`product_name.ilike.%${term}%,client_id.in.(${ids})`);
      } else {
        query = query.ilike('product_name', `%${term}%`);
      }
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    if (error || !data) return { data: [], total: 0 };

    // Get client names
    const clientIds = Array.from(new Set((data || []).map((r: any) => Number(r.client_id)).filter(Boolean)));
    const clientMap: Record<number, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id, name')
      ).in('id', clientIds);
      (clients || []).forEach((c: any) => clientMap[c.id] = c.name);
    }

    // Group by product_id
    const productMap = new Map<string, any>();
    (data || []).forEach((r: any) => {
      const productId = Number(r.product_id || 0) || null;
      const clientId = Number(r.client_id || 0) || null;
      const clientName = clientId ? (clientMap[Number(r.client_id)] || '') : 'Shop Stock';
      const key = `${productId}`;
      
      if (!productMap.has(key)) {
        productMap.set(key, {
          id: Number(r.id), // Use first row's ID as the group ID
          rowIds: [],
          productId,
          productName: (r.product_name || '').toString(),
          quantity: 0,
          fee: Number(r.fee ?? 0),
          batchName: (r.batch_name || batchName),
          clients: [],
          createdAt: r.created_at || null
        });
      }
      
      const group = productMap.get(key)!;
      group.rowIds.push(Number(r.id));
      group.quantity += Number(r.quantity || 0);
      group.clients.push({
        clientId,
        clientName,
        quantity: Number(r.quantity || 0)
      });
    });

    const allItems = Array.from(productMap.values());
    
    // Apply filter for added/not added items
    let filteredItems = allItems;
    if (filterShowOnlyAdded !== null) {
      if (filterShowOnlyAdded === true) {
        // Show only items with fees set (fee > 0)
        filteredItems = allItems.filter(item => Number(item.fee ?? 0) > 0);
      } else {
        // Show only items without fees (fee === 0 or null)
        filteredItems = allItems.filter(item => Number(item.fee ?? 0) === 0);
      }
    }
    
    const total = filteredItems.length;

    // Apply pagination to grouped items
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize;
    const paginatedItems = filteredItems.slice(fromIndex, toIndex);

    return { data: paginatedItems, total };
  }

  updateShippingQueueFees(rows: Array<{ id: number; fee: number }>): Observable<boolean> {
    if (!rows || rows.length === 0) return of(true);
    return from(this.doUpdateShippingQueueFees(rows));
  }

  private async doUpdateShippingQueueFees(rows: Array<{ id: number; fee: number }>): Promise<boolean> {
    for (const r of rows) {
      const { error } = await this.scopeShopQuery(this.sb.from('shipping_fees').update({ fee: r.fee })).eq('id', r.id);
      if (error) return false;
    }
    return true;
  }

  computeShippingQueueTotal(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(
      this.scopeShopQuery(
        this.sb.from('shipping_fees').select('fee, quantity')
      )
        .eq('batch_name', batchName)
        .is('delivery_id', null)
    ).pipe(map((res: any) => {
      const rows = res?.data || [];
      let sum = 0;
      for (const r of rows) {
        const fee = Number(r.fee || 0);
        const qty = Number(r.quantity || 0);
        sum += fee * qty;
      }
      return sum;
    }));
  }

  getShippingQueueSummary(batchName: string): Observable<{ expectedTotal: number; completedQty: number; remainingQty: number }> {
    if (!batchName) return of({ expectedTotal: 0, completedQty: 0, remainingQty: 0 });
    return from(
      this.scopeShopQuery(
        this.sb.from('shipping_fees').select('fee, quantity')
      )
        .eq('batch_name', batchName)
    ).pipe(map((res: any) => {
      const rows = res?.data || [];
      let expectedTotal = 0;
      let completedQty = 0;
      let remainingQty = 0;
      for (const r of rows) {
        const fee = Number(r.fee || 0);
        const qty = Number(r.quantity || 0);
        expectedTotal += fee * qty;
        if (fee > 0) completedQty += 1;
        else remainingQty += 1;
      }
      return { expectedTotal, completedQty, remainingQty };
    }));
  }

  sendConfirmedArrivalsToShipping(batchName: string): Observable<boolean> {
    return from(this.doSendConfirmedArrivalsToShipping(batchName));
  }

  private async doSendConfirmedArrivalsToShipping(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const { data: batch } = await this.scopeShopQuery(this.sb.from('batches').select('id, name')).eq('name', batchName).maybeSingle();
    if (!batch) return false;
    const batchId = (batch as any).id;

    const { data: arrivals } = await this.scopeShopQuery(
      this.sb.from('arrival_items').select('batch_product_id, product_id, confirmed_qty, products(name)')
    )
      .eq('batch_id', batchId)
      .eq('status', 'confirmed');
    const batchProductIds = Array.from(new Set((arrivals || []).map((a: any) => a.batch_product_id).filter(Boolean)));
    if (batchProductIds.length === 0) return true;

    const { data: orderItems } = await this.scopeShopQuery(
      this.sb.from('order_items').select('id, product_id, batch_product_id, quantity, orders!inner(id, customer_id, batch_id), products(name)')
    )
      .in('batch_product_id', batchProductIds)
      .eq('orders.batch_id', batchId);

    const allocationQtyMap = await this.getActiveAllocationsByOrderItemIds(
      (orderItems || []).map((row: any) => Number(row.id || 0)).filter(Boolean)
    );

    const agg: Record<string, { clientId: number; productId: number; productName: string; quantity: number }> = {};
    (orderItems || []).forEach((row: any) => {
      const clientId = (row as any).orders?.customer_id ?? null;
      const productId = row.product_id;
      const productName = row.products?.name || 'Item';
      const effectiveQty = allocationQtyMap.has(Number(row.id || 0))
        ? Number(allocationQtyMap.get(Number(row.id || 0)) || 0)
        : Number(row.quantity || 0);
      if (!clientId || !productId || effectiveQty <= 0) return;
      const key = `${clientId}::${productId}`;
      if (!agg[key]) {
        agg[key] = { clientId, productId, productName, quantity: 0 };
      }
      agg[key].quantity += effectiveQty;
    });

    const productIds = Array.from(new Set((arrivals || []).map((a: any) => a.product_id).filter(Boolean)));
    if (productIds.length > 0) {
      await this.scopeShopQuery(this.sb.from('shipping_fees').delete())
        .eq('batch_name', batchName)
        .is('delivery_id', null)
        .in('product_id', productIds);
    }

    const rows = Object.values(agg).map(r => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_name: batchName,
      client_id: r.clientId,
      product_id: r.productId,
      product_name: r.productName,
      quantity: r.quantity,
      fee: 0
    }));

    const productIdsWithOrders = new Set((orderItems || []).map((r: any) => Number(r.product_id || 0)).filter(Boolean));
    const fallbackRows = (arrivals || []).map((a: any) => {
      const productId = Number(a.product_id || 0);
      const qty = Number(a.confirmed_qty || 0);
      if (!productId || qty <= 0 || productIdsWithOrders.has(productId)) return null;
      return {
        shop_id: this.activeShopId,
        batch_id: batchId,
        batch_name: batchName,
        client_id: null,
        product_id: productId,
        product_name: a.products?.name || 'Item',
        quantity: qty,
        fee: 0
      };
    }).filter(Boolean) as any[];

    const allRows = [...rows, ...fallbackRows];

    if (allRows.length > 0) {
      const { error } = await this.scopeShopQuery(this.sb.from('shipping_fees').insert(allRows));
      if (error) return false;
    }

    const trackingMap: Record<number, { batch_product_id: number; product_id: number }> = {};
    (arrivals || []).forEach((a: any) => {
      const bpId = Number(a.batch_product_id || 0);
      const prodId = Number(a.product_id || 0);
      if (!bpId || !prodId) return;
      trackingMap[bpId] = { batch_product_id: bpId, product_id: prodId };
    });
    const trackingRows = Object.values(trackingMap).map(r => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_product_id: r.batch_product_id,
      product_id: r.product_id
    }));
    if (trackingRows.length > 0) {
      const { error: trackErr } = await this.scopeShopQuery(
        this.sb.from('product_tracking')
          .upsert(trackingRows, { onConflict: 'batch_id,batch_product_id' })
      );
      if (trackErr) return false;
    }

    await this.scopeShopQuery(this.sb.from('arrival_items').update({ status: 'sent_to_shipping' }))
      .eq('batch_id', batchId)
      .eq('status', 'confirmed');

    return true;
  }

  sendConfirmedArrivalItemToShipping(arrivalItemId: number): Observable<boolean> {
    return from(this.doSendConfirmedArrivalItemToShipping(arrivalItemId));
  }

  private async doSendConfirmedArrivalItemToShipping(arrivalItemId: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    const { data: arrival } = await this.scopeShopQuery(
      this.sb.from('arrival_items').select('id, batch_id, batch_product_id, product_id, confirmed_qty, products(name)')
    )
      .eq('id', arrivalItemId)
      .maybeSingle();
    if (!arrival) return false;
    const batchId = (arrival as any).batch_id;
    const batchProductId = (arrival as any).batch_product_id;
    const productId = (arrival as any).product_id;

    const { data: batch } = await this.scopeShopQuery(this.sb.from('batches').select('id, name')).eq('id', batchId).maybeSingle();
    const batchName = (batch as any)?.name || '';
    if (!batchName) return false;

    const { data: orderItems } = await this.scopeShopQuery(
      this.sb.from('order_items').select('id, product_id, batch_product_id, quantity, orders!inner(id, customer_id, batch_id), products(name)')
    )
      .eq('batch_product_id', batchProductId)
      .eq('orders.batch_id', batchId);

    const allocationQtyMap = await this.getActiveAllocationsByOrderItemIds(
      (orderItems || []).map((row: any) => Number(row.id || 0)).filter(Boolean)
    );

    const agg: Record<string, { clientId: number; productId: number; productName: string; quantity: number }> = {};
    (orderItems || []).forEach((row: any) => {
      const clientId = (row as any).orders?.customer_id ?? null;
      const productId = row.product_id;
      const productName = row.products?.name || 'Item';
      const effectiveQty = allocationQtyMap.has(Number(row.id || 0))
        ? Number(allocationQtyMap.get(Number(row.id || 0)) || 0)
        : Number(row.quantity || 0);
      if (!clientId || !productId || effectiveQty <= 0) return;
      const key = `${clientId}::${productId}`;
      if (!agg[key]) {
        agg[key] = { clientId, productId, productName, quantity: 0 };
      }
      agg[key].quantity += effectiveQty;
    });

    const rows = Object.values(agg).map(r => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      batch_name: batchName,
      client_id: r.clientId,
      product_id: r.productId,
      product_name: r.productName,
      quantity: r.quantity,
      fee: 0
    }));

    if (rows.length > 0) {
      await this.scopeShopQuery(this.sb.from('shipping_fees').delete())
        .eq('batch_name', batchName)
        .is('delivery_id', null)
        .eq('product_id', rows[0].product_id);

      const { error } = await this.scopeShopQuery(this.sb.from('shipping_fees').insert(rows));
      if (error) return false;
    } else {
      const qty = Number((arrival as any).confirmed_qty || 0);
      if (productId && qty > 0) {
        await this.scopeShopQuery(this.sb.from('shipping_fees').delete())
          .eq('batch_name', batchName)
          .is('delivery_id', null)
          .eq('product_id', productId);
        const { error } = await this.scopeShopQuery(this.sb.from('shipping_fees').insert([
          {
            shop_id: this.activeShopId,
            batch_id: batchId,
            batch_name: batchName,
            client_id: null,
            product_id: productId,
            product_name: (arrival as any).products?.name || 'Item',
            quantity: qty,
            fee: 0
          }
        ]));
        if (error) return false;
      }
    }

    if (batchId && batchProductId && productId) {
      const { error: trackErr } = await this.scopeShopQuery(
        this.sb.from('product_tracking')
          .upsert([
            { shop_id: this.activeShopId, batch_id: batchId, batch_product_id: batchProductId, product_id: productId }
          ], { onConflict: 'batch_id,batch_product_id' })
      );
      if (trackErr) return false;
    }

    await this.scopeShopQuery(this.sb.from('arrival_items').update({ status: 'sent_to_shipping' }))
      .eq('id', arrivalItemId);

    return true;
  }

  finalizeShippingBatch(batchName: string): Observable<boolean> {
    return from(this.doFinalizeShippingBatch(batchName));
  }

  private async doFinalizeShippingBatch(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    if (!batchName) return false;
    const batchId = await this.getBatchIdByName(batchName);
    const { data: queueRows } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('id, client_id, product_name, quantity, fee')
    )
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
        .eq('batch_name', batchName)
        .is('delivery_id', null)
        .eq('client_id', Number(clientId));
    }

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

  // Persist a per-batch total fee. Upserts on batch_name while carrying batch_id when available.
  saveBatchTotal(batchName: string, totalFee: number): Observable<boolean> {
    return from(this.doSaveBatchTotal(batchName, totalFee));
  }

  private async doSaveBatchTotal(batchName: string, totalFee: number): Promise<boolean> {
    if (!batchName) return true;
    if (!this.activeShopId) return false;
    const dbRow: any = {
      batch_id: await this.getBatchIdByName(batchName),
      batch_name: batchName,
      total_fee: totalFee
    };
    if (this.activeShopId) {
      dbRow.shop_id = this.activeShopId;
    }
    const { error } = await this.scopeShopQuery(
      this.sb.from('shipping_batches').upsert(dbRow, { onConflict: 'shop_id,batch_name' })
    );
    return !error;
  }

  // Read persisted batch total (returns 0 when not found)
  getBatchTotal(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(this.scopeTable('shipping_batches', 'total_fee').eq('batch_name', batchName).limit(1).maybeSingle()).pipe(
      map((res: any) => {
        const row = res?.data || null;
        if (!row) return 0;
        return Number(row.total_fee || 0);
      })
    );
  }

  // Compute batch total from shipping_fees rows (authoritative sum)
  computeBatchTotalFromFees(batchName: string): Observable<number> {
    if (!batchName) return of(0);
    return from(this.scopeTable('shipping_fees', 'fee, quantity').eq('batch_name', batchName)).pipe(
      map((res: any) => {
        const rows = res?.data || [];
        let s = 0;
        for (const r of rows) {
          const qty = Number(r.quantity || 0);
          const fee = Number(r.fee || 0);
          s += fee * qty;
        }
        return s;
      })
    );
  }

  // Shipping ledger helpers (include delivered fees)
  getShippingLedgerBatches(): Observable<OrderBatch[]> {
    if (!this.activeShopId) return of([]);
    const q = this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name, client_id'));
    return from(q).pipe(
      switchMap((res: any) => {
        const names = (res?.data || [])
          .filter((r: any) => Number(r.client_id || 0))
          .map((r: any) => (r.batch_name || '').toString())
          .filter(Boolean);
        const uniqueNames = Array.from(new Set(names));
        if (!uniqueNames.length) return of([]);

        return from(
          this.scopeTable('batches')
            .select('*')
            .in('name', uniqueNames)
            .order('created_at', { ascending: false })
        ).pipe(
          map(({ data }) => rowsToCamel<OrderBatch>(data || []))
        );
      })
    );
  }

  getShippingLedgerCounts(): Observable<{ [k: string]: number }> {
    if (!this.activeShopId) return of({});
    return from(this.scopeShopQuery(this.sb.from('shipping_fees').select('batch_name, client_id'))).pipe(
      map(({ data }) => {
        const keys = new Set<string>();
        (data || []).forEach((r: any) => {
          const b = (r.batch_name || '').toString();
          const cid = Number(r.client_id || 0);
          if (!b || !cid) return;
          keys.add(`${b}::${cid}`);
        });
        const counts: Record<string, number> = {};
        keys.forEach(k => {
          const [b] = k.split('::');
          counts[b] = (counts[b] || 0) + 1;
        });
        return counts;
      })
    );
  }

  // Shipping ledger / payments (pre-delivery, grouped by client)
  getShippingLedger(
    batchName?: string | null,
    searchTerm?: string | null,
    statusFilter: 'all'|'unpaid'|'partial'|'paid' = 'all'
  ): Observable<Array<{ clientId: number | null; clientName: string; clientPhone?: string | null; batchName: string | null; totalFee: number; paidAmount: number; status: 'unpaid'|'partial'|'paid'; sentToDeliveries?: boolean; damagedQty?: number; hasAllocation?: boolean }>> {
    return from(this.doGetShippingLedger(batchName ?? null, searchTerm ?? null, statusFilter));
  }

  private async doGetShippingLedger(
    batchName: string | null,
    searchTerm: string | null,
    statusFilter: 'all'|'unpaid'|'partial'|'paid'
  ): Promise<Array<{ clientId: number; clientName: string; clientPhone?: string | null; batchName: string | null; totalFee: number; paidAmount: number; status: 'unpaid'|'partial'|'paid'; sentToDeliveries?: boolean; damagedQty?: number; hasAllocation?: boolean }>> {
    if (!this.activeShopId) return [];
    const term = (searchTerm || '').trim();
    let clientIdsByName: number[] = [];

    if (term) {
      const { data: clients } = await this.scopeShopQuery(
        this.sb.from('customers').select('id')
      )
        .or(`name.ilike.%${term}%,whatsapp_number.ilike.%${term}%`);
      clientIdsByName = (clients || []).map((c: any) => Number(c.id)).filter(Boolean);
    }

    let feeQuery: any = this.scopeShopQuery(
      this.sb.from('shipping_fees')
        .select('client_id, batch_name, fee, quantity, delivery_id')
    );

    if (term) {
      if (clientIdsByName.length > 0) {
        const ids = clientIdsByName.join(',');
        feeQuery = feeQuery.or(`batch_name.ilike.%${term}%,client_id.in.(${ids})`);
      } else {
        feeQuery = feeQuery.ilike('batch_name', `%${term}%`);
      }
    }

    const { data: fees, error: feeErr } = await feeQuery;
    if (feeErr || !fees || fees.length === 0) return [];

    const agg: Record<string, { clientId: number; batchName: string | null; totalFee: number; totalCount: number; sentCount: number }> = {};
    (fees || []).forEach((f: any) => {
      const clientId = Number(f.client_id || 0);
      if (!clientId) return;
      const bname = (f.batch_name ?? null) as string | null;
      const key = `${clientId}::${bname || ''}`;
      if (!agg[key]) agg[key] = { clientId, batchName: bname, totalFee: 0, totalCount: 0, sentCount: 0 };
      const qty = Number(f.quantity || 0);
      const fee = Number(f.fee || 0);
      agg[key].totalFee += fee * qty;
      agg[key].totalCount += 1;
      if (f.delivery_id) agg[key].sentCount += 1;
    });

    const clientIds = Array.from(new Set(Object.values(agg).map(a => a.clientId)));
    if (clientIds.length === 0) return [];

    const { data: clientRows } = await this.scopeShopQuery(
      this.sb.from('customers').select('id, name, whatsapp_number')
    )
      .in('id', clientIds);
    const clientMap: Record<number, string> = {};
    const phoneMap: Record<number, string> = {};
    (clientRows || []).forEach((c: any) => {
      clientMap[c.id] = c.name;
      phoneMap[c.id] = c.whatsapp_number || '';
    });

    let payQ: any = this.scopeShopQuery(
      this.sb.from('shipping_payments').select('client_id, batch_name, paid_amount, total_fee, status')
    );
    payQ = payQ.in('client_id', clientIds);
    const { data: pays } = await payQ;
    const payMap: Record<string, any> = {};
    (pays || []).forEach((p: any) => {
      const key = `${Number(p.client_id || 0)}::${(p.batch_name ?? '')}`;
      payMap[key] = p;
    });

    const damageQuery = this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('client_id, batch_name, damaged_quantity')
    ).eq('is_active', true);
    const { data: damageRows } = await (batchName ? damageQuery.eq('batch_name', batchName) : damageQuery);
    const damageMap: Record<string, number> = {};
    (damageRows || []).forEach((row: any) => {
      const key = `${Number(row.client_id || 0)}::${row.batch_name || ''}`;
      damageMap[key] = (damageMap[key] || 0) + Number(row.damaged_quantity || 0);
    });

    let rows = Object.values(agg).map(row => {
      const key = `${row.clientId}::${row.batchName || ''}`;
      const pay = payMap[key];
      const totalFee = Number(row.totalFee || 0);
      const paidRaw = Number(pay?.paid_amount || 0);
      const paidAmount = totalFee > 0 ? Math.min(paidRaw, totalFee) : paidRaw;
      const damagedQty = Number(damageMap[key] || 0);
      const status: 'unpaid'|'partial'|'paid' = totalFee <= 0
        ? 'paid'
        : (paidAmount <= 0 ? 'unpaid' : (paidAmount >= totalFee ? 'paid' : 'partial'));
      return {
        clientId: row.clientId,
        clientName: clientMap[row.clientId] || `Client ${row.clientId}`,
        clientPhone: phoneMap[row.clientId] || '',
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
      const currentRows = rows.filter(r => r.batchName === batchName);
      const prevRows = rows.filter(r => r.batchName !== batchName && r.status !== 'paid');
      rows = [...currentRows, ...prevRows];
    }

    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter(r => r.status === statusFilter);
    }

    return rows;
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
    if (!this.activeShopId) return of([]);
    let q: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('client_id, fee, quantity')
    )
      .is('delivery_id', null);
    if (batchName) q = q.eq('batch_name', batchName);
    return from(q).pipe(
      switchMap((res: any) => {
        const fees = (res?.data || []) as any[];
        const agg: Record<number, number> = {};
        fees.forEach(f => {
          const cid = Number(f.client_id || 0);
          if (!cid) return;
          const qty = Number(f.quantity || 0);
          const fee = Number(f.fee || 0);
          agg[cid] = (agg[cid] || 0) + (fee * qty);
        });
        const clientIds = Object.keys(agg).map(Number);
        if (clientIds.length === 0) return of([] as any[]);
        return from(this.scopeShopQuery(this.sb.from('customers').select('id, name')).in('id', clientIds)).pipe(
          map(({ data: clients }) => {
            const nameMap: Record<number, string> = {};
            (clients || []).forEach((c: any) => nameMap[c.id] = c.name);
            return clientIds.map(id => ({ clientName: nameMap[id] || `Client ${id}`, totalFee: agg[id] || 0 }));
          })
        );
      })
    );
  }

  // Fetch shipping fee items for a given client (by client_id) within an optional batch
  getShippingItemsForClient(
    batchName: string | null,
    clientId: number,
    includeDelivered = false
  ): Observable<Array<{ productName: string; fee: number; quantity: number }>> {
    if (!this.activeShopId || !clientId) return of([]);
    let q: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('product_name, fee, quantity')
    )
      .eq('client_id', clientId);
    if (!includeDelivered) {
      q = q.is('delivery_id', null);
    }
    if (batchName) q = q.eq('batch_name', batchName);
    return from(q).pipe(
      map((res: any) => {
        const rows = (res?.data || []) as any[];
        return rows.map(r => ({
          productName: r.product_name || 'Item',
          fee: Number(r.fee || 0),
          quantity: Number(r.quantity || 0)
        }));
      })
    );
  }

  // Sum of paid amounts for a client across deliveries in an optional batch
  getClientPaymentsTotal(batchName: string | null, clientId: number): Observable<number> {
    if (!this.activeShopId || !clientId) return of(0);
    let q: any = this.scopeShopQuery(this.sb.from('shipping_payments').select('paid_amount')).eq('client_id', clientId);
    if (batchName) q = q.eq('batch_name', batchName);
    return from(q).pipe(
      map((pres: any) => {
        const pays = (pres?.data || []) as any[];
        let s = 0;
        for (const p of pays) s += Number(p.paid_amount || 0);
        return s;
      })
    );
  }

  // Allocate a client's paid amount across their deliveries in a batch and upsert per-delivery payments
  saveClientPayments(batchName: string | null, clientId: number, paidAmount: number): Observable<boolean> {
    return from(this.doSaveClientPayments(batchName, clientId, paidAmount));
  }

  private async doSaveClientPayments(batchName: string | null, clientId: number, paidAmount: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    if (!clientId) return true;
    let q: any = this.scopeShopQuery(
      this.sb.from('shipping_fees').select('fee, quantity')
    )
      .eq('client_id', clientId)
      .is('delivery_id', null);
    if (batchName) q = q.eq('batch_name', batchName);
    const { data: feesRes, error: feesErr } = await q;
    if (feesErr) return false;
    const totalFee = (feesRes || []).reduce((sum: number, f: any) => {
      const qty = Number(f.quantity || 0);
      const fee = Number(f.fee || 0);
      return sum + (fee * qty);
    }, 0);
    const paid = Math.max(0, Math.min(Number(paidAmount || 0), totalFee));
    const status: 'unpaid'|'partial'|'paid' = totalFee <= 0
      ? 'paid'
      : (paid <= 0 ? 'unpaid' : (paid >= totalFee ? 'paid' : 'partial'));
    const batchId = await this.getBatchIdByName(batchName);

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
      ? existingQuery.eq('batch_name', batchName)
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

    const { error } = await this.scopeShopQuery(
      this.sb.from('shipping_payments').insert(dbRow)
    );
    return !error;
  }

  sendPaidClientToDeliveries(batchName: string, clientId: number): Observable<boolean> {
    return from(this.doSendPaidClientToDeliveries(batchName, clientId));
  }

  private async doSendPaidClientToDeliveries(batchName: string, clientId: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    if (!batchName || !clientId) return false;

    const { data: batchRow, error: batchError } = await this.scopeShopQuery(
      this.sb.from('batches').select('id')
    )
      .eq('name', batchName)
      .maybeSingle();
    if (batchError || !batchRow?.id) return false;
    const batchId = Number(batchRow.id);

    const { data: feeRows, error: feeErr } = await this.scopeShopQuery(
      this.sb.from('shipping_fees').select('id, product_name, quantity, fee')
    )
      .eq('batch_name', batchName)
      .eq('client_id', clientId)
      .is('delivery_id', null);
    if (feeErr) return false;
    if (!feeRows || feeRows.length === 0) return true;

    const totalFee = (feeRows || []).reduce((sum: number, r: any) => {
      const qty = Number(r.quantity || 0);
      const fee = Number(r.fee || 0);
      return sum + (fee * qty);
    }, 0);
    const { data: payRow } = await this.scopeShopQuery(
      this.sb.from('shipping_payments').select('paid_amount')
    )
      .eq('batch_name', batchName)
      .eq('client_id', clientId)
      .maybeSingle();
    const paidAmount = Number((payRow as any)?.paid_amount || 0);
    if (totalFee > 0 && paidAmount < totalFee) return false;

    let deliveryId: number | null = null;
    const { data: existing } = await this.scopeShopQuery(
      this.sb.from('deliveries').select('id')
    )
      .eq('batch_id', batchId)
      .eq('batch_name', batchName)
      .eq('customer_id', clientId)
      .maybeSingle();
    if (existing?.id) deliveryId = Number(existing.id);

    if (!deliveryId) {
      const row = {
        shop_id: this.activeShopId,
        batch_id: batchId,
        batch_name: batchName,
        customer_id: clientId,
        delivery_fee: 0,
        delivery_date: null,
        status: 'pending',
        delivery_item_status: 'pending',
        notes: 'Created from shipping fees'
      };
      const { data: created, error: createErr } = await this.scopeShopQuery(
        this.sb.from('deliveries').insert(row).select('id').maybeSingle()
      );
      if (createErr) return false;
      deliveryId = created?.id ?? null;
    }

    if (!deliveryId) return false;
    const { error: updateErr } = await this.scopeShopQuery(this.sb.from('shipping_fees').update({ delivery_id: deliveryId }))
      .eq('batch_name', batchName)
      .eq('client_id', clientId)
      .is('delivery_id', null);
    if (updateErr) return false;

    await this.scopeShopQuery(this.sb.from('shipping_payments').update({ delivery_id: deliveryId, batch_id: batchId }))
      .eq('batch_name', batchName)
      .eq('client_id', clientId);

    return true;
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
    // 1. Get all orders in this batch with their items and client info
    const { data: orders } = await this.scopeShopQuery(
      this.sb.from('orders').select('id, customer_id, delivery_type, customers(name, whatsapp_number, address), order_items(quantity, products(name))')
    )
      .eq('batch_id', batchId);

    if (!orders || orders.length === 0) return true;

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
    const rows = Object.values(clientMap).map(c => ({
      shop_id: this.activeShopId,
      batch_id: batchId,
      customer_id: c.clientId,
      shipping_invoice_id: null,
      delivery_type: c.deliveryCategory || 'Ghana Post',
      delivery_fee: 0,
      status: 'pending',
      notes: ''
    }));

    const { error } = await this.scopeShopQuery(this.sb.from('deliveries').insert(rows));
    if (error) return false;

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

    await this.scopeShopQuery(this.sb.from('batches')
      .update({ stock_applied: true })
    )
      .eq('id', batchId);

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

  private async doCreateArrivalForBuyingItem(itemId: number): Promise<boolean> {
    const { data: items, error } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('batch_id, batch_product_id, product_id, ordered_qty, requested_qty')
      .eq('id', itemId)
      .limit(1)
      .single());
    if (error || !items) return false;

    const batchId = (items as any).batch_id;
    const batchProductId = (items as any).batch_product_id;
    const productId = (items as any).product_id;
    if (!batchId || !batchProductId || !productId) return false;

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

  private async doCreateArrivalsForBatch(batchId: number, _batchName: string): Promise<boolean> {
    const { data: items, error } = await this.scopeShopQuery(this.sb.from('buying_list')
      .select('batch_product_id, product_id, requested_qty, ordered_qty')
      .eq('batch_id', batchId));
    if (error) return false;

    const rows = (items || []);
    if (!rows || rows.length === 0) return true;

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
  createDamagedFromDelivery(productId: number, damagedQuantity: number, notes?: string, batchName?: string): Observable<boolean> {
    return from(this.doCreateDamagedFromDelivery(productId, damagedQuantity, notes, batchName));
  }

  private async doCreateDamagedFromDelivery(productId: number, damagedQuantity: number, notes?: string, batchName?: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    // Insert damaged_items row
    const row: any = {
      shop_id: this.activeShopId,
      arrival_item_id: null,
      product_id: productId || null,
      damaged_quantity: damagedQuantity || 0,
      quantity: damagedQuantity || 0,
      reason: notes ? notes : null,
      notes: notes || null
    };
    if (batchName) row.batch_name = batchName;
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

    const rows = allocations.map(a => ({
      shop_id: this.activeShopId,
      order_item_id: a.orderItemId,
      batch_id: a.batchId || null,
      batch_product_id: a.batchProductId || null,
      product_id: a.productId,
      client_id: a.clientId,
      batch_name: a.batchName,
      original_quantity: Number(a.originalQuantity || 0),
      adjusted_quantity: Number(a.adjustedQuantity || 0),
      damaged_quantity: Math.max(0, Number(a.originalQuantity || 0) - Number(a.adjustedQuantity || 0)),
      arrival_item_id: a.arrivalItemId || null,
      damaged_item_id: a.damagedItemId || null,
      reason: a.reason || null,
      notes: a.notes || null,
      is_active: true
    }));

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
    const { data: allocations } = await this.scopeTable('damage_order_allocations')
      .select('client_id, original_quantity, adjusted_quantity, damaged_quantity')
      .eq('product_id', productId)
      .eq('batch_name', batchName)
      .eq('is_active', true);

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
    return from(this.doGetShippingQueuePageWithDamage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo));
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
    // Get base shipping queue data
    const baseResult = await this.doGetShippingQueuePage(batchName, page, pageSize, searchTerm, onlyUnsent, filterShowOnlyAdded, dateFrom, dateTo);
    
    if (!baseResult.data || baseResult.data.length === 0) {
      return baseResult;
    }

    // Get all damage allocations for this batch
    const { data: damageAllocations } = await this.scopeShopQuery(
      this.sb.from('damage_order_allocations')
        .select('product_id, client_id, original_quantity, adjusted_quantity, damaged_quantity')
    )
      .eq('batch_name', batchName || '')
      .eq('is_active', true);

    const damageMap: Record<string, any> = {};
    (damageAllocations || []).forEach((d: any) => {
      const key = `${d.product_id}::${d.client_id}`;
      damageMap[key] = {
        originalQuantity: Number(d.original_quantity || 0),
        adjustedQuantity: Number(d.adjusted_quantity || 0),
        damagedQuantity: Number(d.damaged_quantity || 0)
      };
    });

    // Enrich the data with damage info
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

      // Update item quantity to reflect adjustments
      const totalAdjusted = enrichedClients.reduce((sum: number, c: any) => 
        sum + (c.adjustedQuantity !== null ? c.adjustedQuantity : c.quantity), 0
      );
      const totalDamaged = enrichedClients.reduce((sum: number, c: any) =>
        sum + Number(c.damagedQuantity || 0), 0
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
    return from(this.doDeleteBatchCascade(batchName));
  }

  deleteBatchCascadeById(batchId: number, batchName?: string): Observable<boolean> {
    return from(this.doDeleteBatchCascadeById(batchId, batchName));
  }

  private async doDeleteBatchCascade(batchName: string): Promise<boolean> {
    try {
      // Compatibility wrapper for older callers. New code should delete by batch_id.
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
    try {
      const { data: batchData } = await this.scopeShopQuery(this.sb.from('batches').select('id, name'))
        .eq('id', batchId)
        .maybeSingle();
      const resolvedBatchName = batchData?.name || batchName || '';

      if (!batchData?.id) {
        console.warn('[db] Batch not found for deletion:', batchId);
        return false;
      }

      console.log('[db] Deleting batch:', batchName, 'with ID:', batchId);

      // Delete in order of dependencies (foreign keys)
      // Must respect ON DELETE RESTRICT constraints
      
      // 1. Get all batch_products for this batch first
      const { data: batchProducts } = await this.scopeShopQuery(this.sb.from('batch_products').select('id')).eq('batch_id', batchId);
      const batchProductIds = batchProducts ? batchProducts.map((bp: any) => bp.id) : [];
      console.log('[db] Found', batchProductIds.length, 'batch products');

      // 2. Delete stock_sale_items that reference our batch products (RESTRICT on batch_product_id)
      if (batchProductIds.length > 0) {
        const delErr2 = await this.scopeShopQuery(this.sb.from('stock_sale_items').delete()).in('batch_product_id', batchProductIds);
        if (delErr2.error) {
          console.error('[db] Error deleting stock_sale_items:', delErr2.error, ' - Status:', delErr2.status);
          return false;
        }
        console.log('[db] Deleted stock_sale_items');
      }

      // 3. Get and delete shipping_invoices and their items
      const { data: shippingInvoices } = await this.scopeShopQuery(this.sb.from('shipping_invoices').select('id')).eq('batch_id', batchId);
      if (shippingInvoices && shippingInvoices.length > 0) {
        const siIds = shippingInvoices.map((si: any) => si.id);
        
        // Delete shipping_invoice_items first (RESTRICT on shipping_invoice_id)
        const delErr3a = await this.scopeShopQuery(this.sb.from('shipping_invoice_items').delete()).in('shipping_invoice_id', siIds);
        if (delErr3a.error) {
          console.error('[db] Error deleting shipping_invoice_items:', delErr3a.error, ' - Status:', delErr3a.status);
          return false;
        }
        console.log('[db] Deleted shipping_invoice_items');

        // Delete shipping_invoices (references batch_id)
        const delErr3b = await this.scopeShopQuery(this.sb.from('shipping_invoices').delete()).in('id', siIds);
        if (delErr3b.error) {
          console.error('[db] Error deleting shipping_invoices:', delErr3b.error, ' - Status:', delErr3b.status);
          return false;
        }
        console.log('[db] Deleted shipping_invoices');
      }

      // 4. Delete shipping ledger rows. Prefer batch_id, then clean up legacy name-based rows.
      const delErr4 = await this.scopeShopQuery(this.sb.from('shipping_fees').delete()).eq('batch_id', batchId);
      if (delErr4.error) {
        console.error('[db] Error deleting shipping_fees:', delErr4.error, ' - Status:', delErr4.status);
        return false;
      }
      if (resolvedBatchName) {
        const legacyFeesDelete = await this.scopeShopQuery(this.sb.from('shipping_fees').delete()).eq('batch_name', resolvedBatchName);
        if (legacyFeesDelete.error) {
          console.error('[db] Error deleting legacy shipping_fees:', legacyFeesDelete.error, ' - Status:', legacyFeesDelete.status);
          return false;
        }
      }
      console.log('[db] Deleted shipping_fees');

      const shippingPaymentsDelete = await this.scopeShopQuery(this.sb.from('shipping_payments').delete()).eq('batch_id', batchId);
      if (shippingPaymentsDelete.error) {
        console.error('[db] Error deleting shipping_payments:', shippingPaymentsDelete.error, ' - Status:', shippingPaymentsDelete.status);
        return false;
      }
      if (resolvedBatchName) {
        const legacyPaymentsDelete = await this.scopeShopQuery(this.sb.from('shipping_payments').delete()).eq('batch_name', resolvedBatchName);
        if (legacyPaymentsDelete.error) {
          console.error('[db] Error deleting legacy shipping_payments:', legacyPaymentsDelete.error, ' - Status:', legacyPaymentsDelete.status);
          return false;
        }

        const shippingBatchDelete = await this.scopeShopQuery(this.sb.from('shipping_batches').delete()).eq('batch_name', resolvedBatchName);
        if (shippingBatchDelete.error) {
          console.error('[db] Error deleting shipping_batches:', shippingBatchDelete.error, ' - Status:', shippingBatchDelete.status);
          return false;
        }
      }
      console.log('[db] Deleted shipping payment summaries');

      // 5. Delete deliveries (references batch_id)
      const delErr5 = await this.scopeShopQuery(this.sb.from('deliveries').delete()).eq('batch_id', batchId);
      if (delErr5.error) {
        console.error('[db] Error deleting deliveries:', delErr5.error, ' - Status:', delErr5.status);
        return false;
      }
      console.log('[db] Deleted deliveries');

      // 6. Delete damage_order_allocations by batch_id, then legacy name-based rows.
      const delErr6 = await this.scopeShopQuery(this.sb.from('damage_order_allocations').delete()).eq('batch_id', batchId);
      if (delErr6.error) {
        console.error('[db] Error deleting damage_order_allocations:', delErr6.error, ' - Status:', delErr6.status);
        return false;
      }
      if (resolvedBatchName) {
        const legacyDamageDelete = await this.scopeShopQuery(this.sb.from('damage_order_allocations').delete()).eq('batch_name', resolvedBatchName);
        if (legacyDamageDelete.error) {
          console.error('[db] Error deleting legacy damage_order_allocations:', legacyDamageDelete.error, ' - Status:', legacyDamageDelete.status);
          return false;
        }
      }
      console.log('[db] Deleted damage_order_allocations');

      // 7. Delete order_items and orders for this batch
      const { data: orders } = await this.scopeShopQuery(this.sb.from('orders').select('id')).eq('batch_id', batchId);
      
      if (orders && orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id);
        const delErr7a = await this.scopeShopQuery(this.sb.from('order_items').delete()).in('order_id', orderIds);
        if (delErr7a.error) {
          console.error('[db] Error deleting order_items:', delErr7a.error, ' - Status:', delErr7a.status);
          return false;
        }
        console.log('[db] Deleted order_items');
      }

      const delErr7b = await this.scopeShopQuery(this.sb.from('orders').delete()).eq('batch_id', batchId);
      if (delErr7b.error) {
        console.error('[db] Error deleting orders:', delErr7b.error, ' - Status:', delErr7b.status);
        return false;
      }
      console.log('[db] Deleted orders');

      // 8. Delete buying_list items by batch_id
      const delErr8 = await this.scopeShopQuery(this.sb.from('buying_list').delete()).eq('batch_id', batchId);
      if (delErr8.error) {
        console.error('[db] Error deleting buying_list:', delErr8.error, ' - Status:', delErr8.status);
        return false;
      }
      console.log('[db] Deleted buying_list');

      // 9. Delete arrival_items
      const delErr9 = await this.scopeShopQuery(this.sb.from('arrival_items').delete()).eq('batch_id', batchId);
      if (delErr9.error) {
        console.error('[db] Error deleting arrival_items:', delErr9.error, ' - Status:', delErr9.status);
        return false;
      }
      console.log('[db] Deleted arrival_items');

      // 10. Delete damaged_items
      const delErr10 = await this.scopeShopQuery(this.sb.from('damaged_items').delete()).eq('batch_id', batchId);
      if (delErr10.error) {
        console.error('[db] Error deleting damaged_items:', delErr10.error, ' - Status:', delErr10.status);
        return false;
      }
      console.log('[db] Deleted damaged_items');

      // 11. Delete follow_ups
      const delErr11 = await this.scopeShopQuery(this.sb.from('follow_ups').delete()).eq('batch_id', batchId);
      if (delErr11.error) {
        console.error('[db] Error deleting follow_ups:', delErr11.error, ' - Status:', delErr11.status);
        return false;
      }
      console.log('[db] Deleted follow_ups');

      // 12. Delete product_tracking
      const delErr12 = await this.scopeShopQuery(this.sb.from('product_tracking').delete()).eq('batch_id', batchId);
      if (delErr12.error) {
        console.error('[db] Error deleting product_tracking:', delErr12.error, ' - Status:', delErr12.status);
        return false;
      }
      console.log('[db] Deleted product_tracking');

      // 13. Delete batch_product_shipping
      const delErr13 = await this.scopeShopQuery(this.sb.from('batch_product_shipping').delete()).eq('batch_id', batchId);
      if (delErr13.error) {
        console.error('[db] Error deleting batch_product_shipping:', delErr13.error, ' - Status:', delErr13.status);
        return false;
      }
      console.log('[db] Deleted batch_product_shipping');

      // 14. Delete batch_products
      const delErr14 = await this.scopeShopQuery(this.sb.from('batch_products').delete()).eq('batch_id', batchId);
      if (delErr14.error) {
        console.error('[db] Error deleting batch_products:', delErr14.error, ' - Status:', delErr14.status);
        return false;
      }
      console.log('[db] Deleted batch_products');

      // 15. Finally delete the batch itself
      console.log('[db] Attempting to delete batch record:', batchName, 'by ID:', batchId);
      const delErr15 = await this.scopeShopQuery(this.sb.from('batches').delete()).eq('id', batchId);
      if (delErr15.error) {
        console.error('[db] Error deleting batch record:', delErr15.error, ' - Status:', delErr15.status);
        return false;
      }
      console.log('[db] Deleted batch record');

      console.log('[db] Batch deleted successfully:', resolvedBatchName || batchId);

      // Notify all subscribers that a batch was deleted
      this.batchDeletedSource.next(resolvedBatchName || String(batchId));
      return true;
    } catch (err) {
      console.error('Error deleting batch cascade:', err);
      return false;
    }
  }

  sendArrivalsToDeliveries(batchName: string): Observable<boolean> {
    return from(this.doSendArrivalsToDeliveries(batchName));
  }

  private async doSendArrivalsToDeliveries(batchName: string): Promise<boolean> {
    if (!this.activeShopId) return false;
    const { data: batch } = await this.scopeShopQuery(this.sb.from('batches'))
      .select('id')
      .eq('name', batchName)
      .maybeSingle();
    if (!batch) return false;
    return this.doSendBatchToDeliveries(batch.id, batchName);
  }

  // Create a delivery row from a single confirmed arrival item and remove the arrival
  createDeliveryForArrivalItem(arrivalItemId: number): Observable<boolean> {
    return from(this.doCreateDeliveryForArrivalItem(arrivalItemId));
  }

  private async doCreateDeliveryForArrivalItem(arrivalItemId: number): Promise<boolean> {
    if (!this.activeShopId) return false;
    const { data: ai } = await this.scopeShopQuery(this.sb.from('arrival_items'))
      .select('id, batch_id, product_id, requested_qty, received_qty, products(name), batches(name)')
      .eq('id', arrivalItemId)
      .maybeSingle();
    if (!ai) return false;

    const productName = (ai as any).products?.name || (ai as any).products?.[0]?.name || 'Item';
    const receivedQty = Number((ai as any).received_qty || (ai as any).requested_qty || 0);
    const batchName = (ai as any).batches?.name || null;

    // try to determine a client for this product within the batch
    let clientId: number | null = null;
    const batchId = (ai as any).batch_id ?? null;
    if (batchId) {
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
    }

    // fallback: pick any client if none found (satisfy NOT NULL constraint)
    if (!clientId) {
      const { data: anyClient } = await this.scopeShopQuery(this.sb.from('customers').select('id')).limit(1).maybeSingle();
      clientId = (anyClient && (anyClient as any).id) || null;
    }

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
    // Resolve batch id by name
    const { data: batchRows } = await this.scopeShopQuery(this.sb.from('batches').select('id')).eq('name', batchName).limit(1).maybeSingle();
    if (!batchRows || !batchRows.id) return true;
    const batchId = batchRows.id as number;

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
    const row = {
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
      this.sb.from('expenses').update(row).eq('id', expense.id)
    ).pipe(map(({ error }) => !error));
  }

  deleteExpense(id: number): Observable<boolean> {
    return from(
      this.sb.from('expenses').delete().eq('id', id)
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
