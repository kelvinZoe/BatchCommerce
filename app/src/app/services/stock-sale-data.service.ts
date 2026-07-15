import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StockProduct, StockSale, StockSaleItem } from '../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { from, SupabaseDataAccessService, toCamel } from './supabase-data-access.service';

@Injectable({
  providedIn: 'root'
})
export class StockSaleDataService extends SupabaseDataAccessService {
  constructor(supa: SupabaseService, authService: AuthService) {
    super(supa, authService);
  }

  /** All products with stock > 0, priced at their most recent batch_product entry. */
  getStockAvailableProducts(): Observable<StockProduct[]> {
    return from(Promise.all([
      this.scopeTable('products', 'id, name, stock').gt('stock', 0).order('name'),
      this.scopeTable('batch_products')
        .select('id, product_id, stock_price, stock_discount_min_qty, stock_discount_price')
        .order('created_at', { ascending: false })
    ])).pipe(map(([productsRes, bpRes]: any[]) => {
      const products = (productsRes.data || []) as any[];
      const bpRows = (bpRes.data || []) as any[];
      const latest: Record<number, any> = {};
      for (const row of bpRows) {
        if (!latest[row.product_id]) latest[row.product_id] = row;
      }
      return products.map((p: any) => ({
        id: p.id,
        name: p.name,
        stock: p.stock || 0,
        stockPrice: latest[p.id]?.stock_price ?? 0,
        stockDiscountMinQty: latest[p.id]?.stock_discount_min_qty ?? 0,
        stockDiscountPrice: latest[p.id]?.stock_discount_price ?? 0,
        latestBatchProductId: latest[p.id]?.id ?? null
      })) as StockProduct[];
    }));
  }

  getStockSalesPage(
    page: number,
    pageSize: number,
    search = '',
    dateFrom = '',
    dateTo = ''
  ): Observable<{ data: StockSale[]; total: number }> {
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    let query = this.scopeTable('stock_sales')
      .select('id, sale_uuid, customer_name, customer_id, sale_channel, total_amount, created_at, status, stock_sale_items(id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (search) query = (query as any).ilike('customer_name', `%${search}%`);
    if (dateFrom) query = (query as any).gte('created_at', dateFrom);
    if (dateTo) query = (query as any).lte('created_at', dateTo + 'T23:59:59');

    return from(query).pipe(map(({ data, count }: any) => ({
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

  deleteStockSale(saleId: number): Observable<boolean> {
    return from(this.doDeleteStockSale(saleId));
  }

  closeStockSale(saleId: number, closedByUserId: number | null): Observable<boolean> {
    return from(this.doCloseStockSale(saleId, closedByUserId));
  }

  cancelStockSale(saleId: number): Observable<boolean> {
    return from(this.doCancelStockSale(saleId));
  }

  private async doCreateStockSale(
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<{ id: number; saleUuid: string }> {
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('create_stock_sale_with_items', {
      p_shop_id: shopId,
      p_customer_id: customerId || null,
      p_customer_name: customerName,
      p_sale_channel: saleChannel,
      p_total_amount: totalAmount,
      p_items: this.toStockSaleRpcItems(items)
    });

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return { id: Number(row?.id || 0), saleUuid: row?.sale_uuid || '' };
    }

    if (!this.isMissingRpcError(error)) {
      throw new Error(error.message || 'Failed to create stock sale.');
    }

    return this.doCreateStockSaleClientScoped(customerId, customerName, saleChannel, totalAmount, items);
  }

  private async doCreateStockSaleClientScoped(
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<{ id: number; saleUuid: string }> {
    const shopId = this.requireActiveShopId();
    const { data: sale, error: saleErr } = await this.sb.from('stock_sales').insert({
      shop_id: shopId,
      customer_id: customerId || null,
      customer_name: customerName,
      sale_channel: saleChannel,
      total_amount: totalAmount,
      status: 'open'
    }).select('id, sale_uuid').single();
    if (saleErr || !sale) throw saleErr;

    const itemRows = items.map(i => ({
      shop_id: shopId,
      stock_sale_id: (sale as any).id,
      batch_product_id: i.batchProductId,
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: i.subtotal
    }));
    const { error: itemsErr } = await this.sb.from('stock_sale_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

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

  private async doUpdateStockSale(
    saleId: number,
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<boolean> {
    if (!saleId) return false;
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('update_stock_sale_with_items', {
      p_shop_id: shopId,
      p_sale_id: saleId,
      p_customer_id: customerId || null,
      p_customer_name: customerName,
      p_sale_channel: saleChannel,
      p_total_amount: totalAmount,
      p_items: this.toStockSaleRpcItems(items)
    });

    if (!error) {
      return Boolean(data);
    }

    if (!this.isMissingRpcError(error)) {
      console.error(`[db] Error updating stock sale ${saleId} through RPC:`, error);
      return false;
    }

    return this.doUpdateStockSaleClientScoped(saleId, customerId, customerName, saleChannel, totalAmount, items);
  }

  private async doUpdateStockSaleClientScoped(
    saleId: number,
    customerId: number | null,
    customerName: string,
    saleChannel: string,
    totalAmount: number,
    items: StockSaleItem[]
  ): Promise<boolean> {
    if (!saleId) return false;
    const shopId = this.requireActiveShopId();

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
      shop_id: shopId,
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

  private async doDeleteStockSale(saleId: number): Promise<boolean> {
    if (!saleId) return false;
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('delete_cancelled_stock_sale', {
      p_shop_id: shopId,
      p_sale_id: saleId
    });

    if (!error) {
      return Boolean(data);
    }

    if (!this.isMissingRpcError(error)) {
      console.error(`[db] Error deleting stock sale ${saleId} through RPC:`, error);
      return false;
    }

    return this.doDeleteStockSaleClientScoped(saleId);
  }

  private async doDeleteStockSaleClientScoped(saleId: number): Promise<boolean> {
    if (!saleId) return false;
    const { data: sale, error: saleErr } = await this.scopeShopQuery(
      this.sb.from('stock_sales').select('status')
    ).eq('id', saleId).maybeSingle();
    if (saleErr || !sale) return false;
    if ((sale as any).status !== 'cancelled') return false;

    const { error: deleteErr } = await this.scopeShopQuery(this.sb.from('stock_sales').delete()).eq('id', saleId);
    return !deleteErr;
  }

  private async doCloseStockSale(saleId: number, closedByUserId: number | null): Promise<boolean> {
    if (!this.activeShopId || !saleId) return false;
    const updatePayload: Record<string, any> = {
      status: 'closed',
      closed_at: new Date().toISOString()
    };
    if (closedByUserId) {
      updatePayload['closed_by'] = closedByUserId;
    }

    const { data, error } = await this.scopeShopQuery(
      this.sb.from('stock_sales').update(updatePayload)
    ).eq('id', saleId).eq('status', 'open').select('id').maybeSingle();
    return !error && !!data;
  }

  private async doCancelStockSale(saleId: number): Promise<boolean> {
    if (!saleId) return false;
    const shopId = this.requireActiveShopId();
    const { data, error } = await (this.sb as any).rpc('cancel_stock_sale_with_stock_restore', {
      p_shop_id: shopId,
      p_sale_id: saleId
    });

    if (!error) {
      return Boolean(data);
    }

    if (!this.isMissingRpcError(error)) {
      console.error(`[db] Error cancelling stock sale ${saleId} through RPC:`, error);
      return false;
    }

    return this.doCancelStockSaleClientScoped(saleId);
  }

  private async doCancelStockSaleClientScoped(saleId: number): Promise<boolean> {
    if (!saleId) return false;
    const { data: sale, error: saleErr } = await this.scopeShopQuery(
      this.sb.from('stock_sales').select('status')
    ).eq('id', saleId).maybeSingle();
    if (saleErr || !sale || (sale as any).status !== 'open') return false;

    const { data: existingItems, error: existingErr } = await this.scopeShopQuery(
      this.sb.from('stock_sale_items').select('product_id, quantity')
    ).eq('stock_sale_id', saleId);
    if (existingErr) return false;

    const { data: updatedSale, error: updateErr } = await this.scopeShopQuery(
      this.sb.from('stock_sales').update({ status: 'cancelled' })
    ).eq('id', saleId).eq('status', 'open').select('id').maybeSingle();
    if (updateErr || !updatedSale) return false;

    await this.adjustProductStock(existingItems || [], 1);
    return true;
  }

  private toStockSaleRpcItems(items: StockSaleItem[]): any[] {
    return (items || []).map(item => ({
      batchProductId: item.batchProductId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    }));
  }

  private async adjustProductStock(
    items: Array<{ productId?: number; product_id?: number; quantity?: number }>,
    direction: 1 | -1
  ): Promise<void> {
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
}
