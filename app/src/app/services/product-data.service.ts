import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BatchProduct, Product, ProductCatalog } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, rowsToCamel, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class ProductDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

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
    const shopId = this.requireActiveShopId();
    const row = {
      shop_id: shopId,
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
      this.scopeShopQuery(this.sb.from('products').update(row)).eq('id', product.id)
    ).pipe(map(({ error }) => !error));
  }

  deleteProduct(id: number): Observable<boolean> {
    return from(
      this.scopeShopQuery(this.sb.from('products').delete()).eq('id', id)
    ).pipe(map(({ error }) => !error));
  }

  createProductCatalog(product: ProductCatalog): Observable<number> {
    return from(this.doCreateProductCatalog(product));
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

  deleteProductCatalog(productId: number): Observable<boolean> {
    return from(this.doDeleteProductCatalog(productId));
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
        shop_id: this.requireActiveShopId(),
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

  private getPriceForQuantity(basePrice: number, discountMinQty: number, discountPrice: number, quantity: number): number {
    const normalizedBasePrice = Number(basePrice || 0);
    const normalizedDiscountMinQty = Number(discountMinQty || 0);
    const normalizedDiscountPrice = Number(discountPrice || 0);
    const normalizedQuantity = Number(quantity || 0);

    return normalizedDiscountMinQty > 0 && normalizedDiscountPrice > 0 && normalizedQuantity >= normalizedDiscountMinQty
      ? normalizedDiscountPrice
      : normalizedBasePrice;
  }

  private async doCreateProductCatalog(product: ProductCatalog): Promise<number> {
    const shopId = this.requireActiveShopId();
    const baseRow = {
      shop_id: shopId,
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

  private async doDeleteProductCatalog(productId: number): Promise<boolean> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('delete_product_catalog_cascade', {
      p_shop_id: shopId,
      p_product_id: productId
    });

    if (!error) {
      return Boolean(data);
    }

    if (!this.isMissingRpcError(error)) {
      console.error(`[db] Error deleting product ${productId} through RPC:`, error);
      return false;
    }

    return this.doDeleteProductCatalogClientScoped(productId);
  }

  private async doDeleteProductCatalogClientScoped(productId: number): Promise<boolean> {
    try {
      const relatedTables = [
        'damage_order_allocations',
        'shipping_fees',
        'order_items',
        'stock_sale_items',
        'shipping_invoice_items',
        'product_tracking',
        'batch_product_shipping',
        'follow_ups',
        'damaged_items',
        'arrival_items',
        'buying_list',
        'batch_products'
      ];

      for (const table of relatedTables) {
        const { error } = await this.scopeShopQuery(this.sb.from(table).delete()).eq('product_id', productId);
        if (error) {
          console.error(`[db] Error deleting ${table} for product ${productId}:`, error);
          return false;
        }
      }

      const { error } = await this.scopeShopQuery(this.sb.from('products').delete()).eq('id', productId);
      if (error) {
        console.error(`[db] Error deleting product ${productId}:`, error);
      }
      return !error;
    } catch (err) {
      console.error('Error deleting product cascade:', err);
      return false;
    }
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
      const { data: orderItems, error: itemsError } = await this.scopeShopQuery(this.sb
        .from('order_items')
        .select('id, order_id, quantity, unit_price, subtotal')
      )
        .eq('batch_product_id', batchProductId);

      if (itemsError) throw itemsError;

      const { data: stockSaleItems, error: stockItemsError } = await this.scopeShopQuery(this.sb
        .from('stock_sale_items')
        .select('id, stock_sale_id, quantity, unit_price, subtotal')
      )
        .eq('batch_product_id', batchProductId);

      if (stockItemsError) throw stockItemsError;

      const affectedOrders: any[] = [];
      let totalCostChange = 0;

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
              subtotal
            })
          )
            .eq('id', item.id);

          if (error) throw error;
          affectedOrderItemsCount++;
        }
      }

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
              subtotal
            })
          )
            .eq('id', item.id);

          if (error) throw error;
          affectedStockItemsCount++;
          affectedSaleIds.add(item.stock_sale_id);
        }

        for (const saleId of affectedSaleIds) {
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
}
