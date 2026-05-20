import { Injectable, NgZone } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from './database.service';
import { Product, Client, BuyingListItem, Delivery } from '../models';

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  constructor(
    private dbService: DatabaseService,
    private ngZone: NgZone
  ) {}

  async parseExcelFromBuffer(buffer: ArrayBuffer): Promise<any> {
    const XLSX = await import('xlsx');
    return XLSX.read(buffer, { type: 'array' });
  }

  getSheetNames(workbook: any): string[] {
    return workbook?.SheetNames || [];
  }

  // ─── Column finder helpers ───────────────────────────
  /** Return the column index whose header best matches one of the given patterns */
  private findCol(headers: string[], ...patterns: RegExp[]): number {
    const lower = headers.map(h => h.toLowerCase());
    for (const p of patterns) {
      const idx = lower.findIndex(h => p.test(h));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /** Detect whether the sheet has a double-header (row 0 = title, row 1 = sub-headers) */
  private detectHeaderRow(data: any[][]): number {
    if (data.length < 2) return 0;
    // If second row looks more like headers (all strings, no numbers), use row 1
    const row1 = data[1] || [];
    const allStrings = row1.every((c: any) => typeof c === 'string' || c === '' || c === undefined);
    // Legacy PRICES sheet has 2 header rows
    if (allStrings && row1.some((c: any) => typeof c === 'string' && c.length > 0)) {
      return 1;
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════
  //  PRODUCTS — smart header detection
  // ═══════════════════════════════════════════════════════
  async importProductsFromSheet(ws: any): Promise<ImportResult> {
    const result: ImportResult = { success: false, totalRows: 0, importedRows: 0, errors: [] };
    try {
      const XLSX = await import('xlsx');
      const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (data.length < 2) { result.errors.push('Sheet is empty'); return result; }

      const headerRow = data[0].map((h: any) => String(h || ''));
      const dataStart = this.detectHeaderRow(data) + 1;

      // Find columns by header name
      const nameCol      = this.findCol(headerRow, /product.?name|^name$/i, /product/i, /item/i);
      const preorderCol  = this.findCol(headerRow, /preorder/i, /pre.?order/i);
      const localCol     = this.findCol(headerRow, /local.?price/i, /selling/i, /price/i);
      const purchaseCol  = this.findCol(headerRow, /purchase|cost|buy.?price|buying.?price/i);
      const descCol      = this.findCol(headerRow, /desc/i, /note/i);
      const stockCol     = this.findCol(headerRow, /stock/i, /available/i);

      // Fallback to position-based if no name column found
      const nCol = nameCol >= 0 ? nameCol : 1;

      result.totalRows = data.length - dataStart;

      for (let i = dataStart; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[nCol]) continue;

        const product: Product = {
          name: String(row[nCol] || '').trim(),
          preorderPrice: preorderCol >= 0 ? this.parseNumber(row[preorderCol]) : null,
          purchasePrice: purchaseCol >= 0 ? this.parseNumber(row[purchaseCol]) : null,
          description: descCol >= 0 ? String(row[descCol] || '').trim() : ''
        };

        if (product.name) {
          try {
            await firstValueFrom(this.dbService.createProduct(product));
            result.importedRows++;
          } catch (err: any) {
            result.errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
      }
      result.success = result.importedRows > 0;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  CLIENTS — new
  // ═══════════════════════════════════════════════════════
  async importClientsFromSheet(ws: any): Promise<ImportResult> {
    const result: ImportResult = { success: false, totalRows: 0, importedRows: 0, errors: [] };
    try {
      const XLSX = await import('xlsx');
      const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (data.length < 2) { result.errors.push('Sheet is empty'); return result; }

      const headerRow = data[0].map((h: any) => String(h || ''));

      const nameCol     = this.findCol(headerRow, /client.?name|customer.?name|^name$/i);
      const phoneCol    = this.findCol(headerRow, /phone|mobile|tel/i);
      const waCol       = this.findCol(headerRow, /whatsapp|wa/i);
      const addressCol  = this.findCol(headerRow, /address|location/i);
      const notesCol    = this.findCol(headerRow, /note|comment|remark/i);

      const nCol = nameCol >= 0 ? nameCol : 0;
      result.totalRows = data.length - 1;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[nCol]) continue;

        const client: Client = {
          name: String(row[nCol] || '').trim(),
          phone: phoneCol >= 0 ? String(row[phoneCol] || '').trim() : '',
          whatsappNumber: waCol >= 0 ? String(row[waCol] || '').trim() : (phoneCol >= 0 ? String(row[phoneCol] || '').trim() : ''),
          address: addressCol >= 0 ? String(row[addressCol] || '').trim() : '',
          notes: notesCol >= 0 ? String(row[notesCol] || '').trim() : 'Imported from Excel'
        };

        if (client.name) {
          try {
            await firstValueFrom(this.dbService.createClient(client));
            result.importedRows++;
          } catch (err: any) {
            result.errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
      }
      result.success = result.importedRows > 0;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  BUYING LIST — smart header detection
  // ═══════════════════════════════════════════════════════
  async importBuyingListFromSheet(ws: any, batchName: string): Promise<ImportResult> {
    const result: ImportResult = { success: false, totalRows: 0, importedRows: 0, errors: [] };
    try {
      const XLSX = await import('xlsx');
      const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (data.length < 2) { result.errors.push('Sheet is empty'); return result; }

      const headerRow = data[0].map((h: any) => String(h || ''));

      const nameCol     = this.findCol(headerRow, /product.?name|^name$|item/i, /product/i);
      const reqCol      = this.findCol(headerRow, /request/i);
      const ordCol      = this.findCol(headerRow, /ordered|qty|quantity/i);

      const nCol = nameCol >= 0 ? nameCol : 1;
      result.totalRows = data.length - 1;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[nCol]) continue;

        const item: BuyingListItem = {
          productName: String(row[nCol] || '').trim(),
          requestedQuantity: reqCol >= 0 ? (this.parseNumber(row[reqCol]) || 0) : 0,
          orderedQuantity: ordCol >= 0 ? (this.parseNumber(row[ordCol]) || 0) : 0,
          batchName: batchName,
          status: 'pending'
        };

        if (!item.orderedQuantity) {
          item.orderedQuantity = item.requestedQuantity;
        }

        if (item.productName) {
          try {
            await firstValueFrom(this.dbService.createBuyingListItem(item));
            result.importedRows++;
          } catch (err: any) {
            result.errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
      }
      result.success = result.importedRows > 0;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  ITEMS SORTING — smart header detection
  // ═══════════════════════════════════════════════════════
  async importItemsSortingFromSheet(ws: any): Promise<ImportResult> {
    const result: ImportResult = { success: false, totalRows: 0, importedRows: 0, errors: [] };
    try {
      const XLSX = await import('xlsx');
      const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (data.length < 2) { result.errors.push('Sheet is empty'); return result; }

      const headerRow = data[0].map((h: any) => String(h || ''));

      const prodCol   = this.findCol(headerRow, /product/i, /item/i);
      const clientCol = this.findCol(headerRow, /client|customer|name/i);
      const qtyCol    = this.findCol(headerRow, /qty|quantity|count/i);

      const pCol = prodCol >= 0 ? prodCol : 1;
      const cCol = clientCol >= 0 ? clientCol : 2;
      const qCol = qtyCol >= 0 ? qtyCol : 3;

      result.totalRows = data.length - 1;

      let currentProduct = '';
      const clientOrders: Map<string, { product: string; quantity: number }[]> = new Map();

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        if (row[pCol] && String(row[pCol]).trim()) {
          currentProduct = String(row[pCol]).trim();
        }

        let clientName = String(row[cCol] || '').trim();
        if (!clientName) continue;

        clientName = clientName.replace(/^\d+\.\s*/, '').trim();
        const quantity = this.parseNumber(row[qCol]) || 1;

        if (clientName && currentProduct) {
          if (!clientOrders.has(clientName)) {
            clientOrders.set(clientName, []);
          }
          clientOrders.get(clientName)!.push({ product: currentProduct, quantity });
          result.importedRows++;
        }
      }

      for (const clientName of clientOrders.keys()) {
        try {
          const existing = await firstValueFrom(this.dbService.searchClients(clientName));
          if (!existing || existing.length === 0) {
            await firstValueFrom(this.dbService.createClient({
              name: clientName,
              phone: '',
              notes: 'Imported from Excel'
            }));
          }
        } catch (err: any) {
          result.errors.push(`Client ${clientName}: ${err.message}`);
        }
      }
      result.success = result.importedRows > 0;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  DELIVERIES — smart header detection
  // ═══════════════════════════════════════════════════════
  async importDeliveriesFromSheet(ws: any): Promise<ImportResult> {
    const result: ImportResult = { success: false, totalRows: 0, importedRows: 0, errors: [] };
    try {
      const XLSX = await import('xlsx');
      const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (data.length < 2) { result.errors.push('Sheet is empty'); return result; }

      const headerRow = data[0].map((h: any) => String(h || ''));

      const clientCol = this.findCol(headerRow, /client|customer|name/i);
      const itemsCol  = this.findCol(headerRow, /item|product|description/i);
      const qtyCol    = this.findCol(headerRow, /qty|quantity|count/i);
      const dateCol   = this.findCol(headerRow, /date|deliver.*date/i);
      const feeCol    = this.findCol(headerRow, /fee|cost|charge/i);

      const cCol = clientCol >= 0 ? clientCol : 1;
      const iCol = itemsCol >= 0 ? itemsCol : 2;
      const qCol = qtyCol >= 0 ? qtyCol : 3;

      result.totalRows = data.length - 1;

      let currentClientName = '';
      let currentClientId = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        if (row[cCol] && String(row[cCol]).trim()) {
          currentClientName = String(row[cCol]).trim();

          const existing = await firstValueFrom(this.dbService.searchClients(currentClientName));
          if (existing && existing.length > 0) {
            currentClientId = existing[0].id!;
          } else {
            currentClientId = await firstValueFrom(this.dbService.createClient({
              name: currentClientName,
              phone: '',
              notes: 'Imported from delivery sheet'
            })) || 0;
          }
        }

        const items = String(row[iCol] || '').trim();
        const quantity = this.parseNumber(row[qCol]) || 1;
        const deliveryDate = dateCol >= 0 ? this.parseExcelDate(row[dateCol]) : null;
        const deliveryFee = feeCol >= 0 ? (this.parseNumber(row[feeCol]) || 0) : 0;

        if (items && currentClientId) {
          try {
            await firstValueFrom(this.dbService.createDelivery({
              orderId: 0,
              clientId: currentClientId,
              items: items,
              quantity: quantity,
              deliveryFee: deliveryFee,
              deliveryDate: deliveryDate,
              status: deliveryDate ? 'delivered' : 'pending'
            }));
            result.importedRows++;
          } catch (err: any) {
            result.errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
      }
      result.success = result.importedRows > 0;
    } catch (err: any) {
      result.errors.push(`Import failed: ${err.message}`);
    }
    return result;
  }

  // ─── Legacy wrappers (keep backward compat) ──────────
  async importProducts(workbook: any): Promise<ImportResult> {
    const ws = workbook.Sheets['PRICES'];
    if (!ws) return { success: false, totalRows: 0, importedRows: 0, errors: ['PRICES sheet not found'] };
    return this.importProductsFromSheet(ws);
  }

  async importBuyingList(workbook: any, batchName: string): Promise<ImportResult> {
    const ws = workbook.Sheets['Buying List'];
    if (!ws) return { success: false, totalRows: 0, importedRows: 0, errors: ['Buying List sheet not found'] };
    return this.importBuyingListFromSheet(ws, batchName);
  }

  async importItemsSorting(workbook: any): Promise<ImportResult> {
    const ws = workbook.Sheets['ITEMS SORTING'];
    if (!ws) return { success: false, totalRows: 0, importedRows: 0, errors: ['ITEMS SORTING sheet not found'] };
    return this.importItemsSortingFromSheet(ws);
  }

  async importDeliveries(workbook: any): Promise<ImportResult> {
    const ws = workbook.Sheets['Delivery'];
    if (!ws) return { success: false, totalRows: 0, importedRows: 0, errors: ['Delivery sheet not found'] };
    return this.importDeliveriesFromSheet(ws);
  }

  // ─── Utility helpers ────────────────────────────────
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
  }

  private parseBool(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const s = String(value || '').toLowerCase().trim();
    return ['true', 'yes', '1', 'y', 'in stock', 'available'].includes(s);
  }

  private parseExcelDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return null;
  }

  // ─── Export ─────────────────────────────────────────
  async exportToExcel(data: any[], filename: string): Promise<void> {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
  }

  async exportWorkbook(
    sheets: Array<{ name: string; data: any[] }>,
    filename: string
  ): Promise<void> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const safeName = String(sheet.name || 'Sheet')
        .replace(/[\\\/?*\[\]:]/g, ' ')
        .trim()
        .slice(0, 31) || 'Sheet';
      const rows = Array.isArray(sheet.data) && sheet.data.length ? sheet.data : [{ message: 'No data' }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
    }

    XLSX.writeFile(workbook, filename);
  }

  async downloadSampleTemplate(): Promise<void> {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // PRICES / Products sheet
    const pricesData = [
      ['#', 'Product Name', 'Preorder Price', 'Local Price', 'Shipping Fee'],
      [1, 'Sample Product A', 1500, 2000, 300],
      [2, 'Sample Product B', 2500, 3000, 500],
      [3, 'Sample Product C', 800, 1200, 200]
    ];
    const wsPrices = XLSX.utils.aoa_to_sheet(pricesData);
    wsPrices['!cols'] = [{ wch: 4 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPrices, 'Products');

    // Clients sheet
    const clientsData = [
      ['Name', 'Phone', 'WhatsApp', 'Address', 'Notes'],
      ['John Doe', '+971501234567', '+971501234567', 'Dubai Marina', 'VIP client'],
      ['Jane Smith', '+971509876543', '', 'Abu Dhabi', ''],
      ['Ali Hassan', '+971507654321', '+971507654321', 'Sharjah', 'Prefers evening delivery']
    ];
    const wsClients = XLSX.utils.aoa_to_sheet(clientsData);
    wsClients['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clients');

    // Buying List sheet
    const buyingData = [
      ['#', 'Product Name', 'Requested Qty', 'Qty Ordered'],
      [1, 'Sample Product A', 10, 8],
      [2, 'Sample Product B', 5, 5],
      [3, 'Sample Product C', 20, 20]
    ];
    const wsBuying = XLSX.utils.aoa_to_sheet(buyingData);
    wsBuying['!cols'] = [{ wch: 4 }, { wch: 25 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsBuying, 'Buying List');

    // ITEMS SORTING sheet
    const sortingData = [
      ['#', 'Product', 'Client Name', 'Quantity'],
      ['', 'Sample Product A', '1. John Doe', 2],
      ['', '', '2. Jane Smith', 1],
      ['', 'Sample Product B', '1. John Doe', 3],
      ['', '', '2. Ali Hassan', 1]
    ];
    const wsSorting = XLSX.utils.aoa_to_sheet(sortingData);
    wsSorting['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSorting, 'ITEMS SORTING');

    // Delivery sheet
    const deliveryData = [
      ['#', 'Client Name', 'Items', 'Quantity', 'Delivery Date'],
      ['', 'John Doe', 'Sample Product A x2', 2, '2026-02-10'],
      ['', '', 'Sample Product B x3', 3, ''],
      ['', 'Jane Smith', 'Sample Product A x1', 1, '2026-02-08']
    ];
    const wsDelivery = XLSX.utils.aoa_to_sheet(deliveryData);
    wsDelivery['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsDelivery, 'Delivery');

    XLSX.writeFile(wb, 'Shakhis_Import_Template.xlsx');
  }

  async getSheetRawData(workbook: any, sheetName: string): Promise<any[][]> {
    const XLSX = await import('xlsx');
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
  }
}
