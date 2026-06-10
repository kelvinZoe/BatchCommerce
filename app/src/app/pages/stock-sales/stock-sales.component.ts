import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { Client, StockProduct, StockSale, StockSaleItem, StockSalesPermissionConfig } from '../../models';

interface CartItem {
  product: StockProduct;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

@Component({
  selector: 'app-stock-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, DateFilterComponent],
  template: `
    <div class="ss-page">

      <!-- PAGE HEADER -->
      <div class="ss-page-header">
        <div class="ss-header-left">
          <div class="ss-header-icon"><span class="material-icons">storefront</span></div>
          <div>
            <h1 class="ss-title">Stock Sales</h1>
            <p class="ss-subtitle">Sell in-stock items to walk-in or online customers</p>
          </div>
        </div>
        <button class="ss-btn ss-btn-primary"
                *ngIf="authService.canPerformStockSalesOperation('canAddSale')"
                (click)="openNewSale()">
          <span class="material-icons">add_shopping_cart</span> New Sale
        </button>
      </div>

      <!-- MAIN CARD -->
      <div class="ss-card">

        <!-- TOOLBAR -->
        <div class="ss-toolbar">
          <div class="ss-search-wrap">
            <span class="material-icons ss-search-icon">search</span>
            <input class="ss-search" type="text" placeholder="Search by customer…"
                   [(ngModel)]="searchTerm" (input)="onSearch()" />
          </div>
          <app-date-filter (dateChange)="dateFrom=$event.from; dateTo=$event.to; loadSales()"></app-date-filter>
        </div>

        <!-- SKELETONS -->
        <div class="ss-table-wrap" *ngIf="loading">
          <table class="ss-table">
            <thead><tr>
              <th *ngFor="let h of ['Reference','Customer','Channel','Items','Total','Date','']">{{h}}</th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let i of [1,2,3,4,5]">
                <td *ngFor="let c of [1,2,3,4,5,6,7]"><div class="ss-sk ss-sk-cell"></div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- SALES TABLE -->
        <div class="ss-table-wrap" *ngIf="!loading">
          <table class="ss-table">
            <thead><tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Channel</th>
              <th>Items</th>
              <th>Total</th>
              <th>Date</th>
              <th></th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let s of sales">
                <td>
                  <span class="ss-ref">#SS-{{ s.id }}</span>
                </td>
                <td>
                  <span class="ss-customer-name">{{ s.customerName || 'Walk-in' }}</span>
                </td>
                <td>
                  <span class="ss-channel-pill" [class.ss-ch-online]="s.saleChannel==='online'">
                    <span class="material-icons">{{ s.saleChannel==='online' ? 'wifi' : 'store' }}</span>
                    {{ s.saleChannel === 'online' ? 'Online' : 'Walk-in' }}
                  </span>
                </td>
                <td><span class="ss-items-chip">{{ s.itemCount }} item{{ s.itemCount !== 1 ? 's' : '' }}</span></td>
                <td><strong class="ss-total-val">GHS {{ (s.totalAmount || 0) | number:'1.2-2' }}</strong></td>
                <td class="ss-date-cell">{{ s.createdAt | date:'mediumDate' }}</td>
                <td>
                  <button class="ss-icon-btn" title="View receipt" (click)="viewReceipt(s)">
                    <span class="material-icons">receipt_long</span>
                  </button>
                  <button class="ss-icon-btn" title="Edit sale"
                          *ngIf="authService.canPerformStockSalesOperation('canEditSale')"
                          (click)="openEditSale(s)">
                    <span class="material-icons">edit</span>
                  </button>
                  <button class="ss-icon-btn ss-icon-btn-danger" title="Delete sale"
                          *ngIf="authService.canPerformStockSalesOperation('canDeleteSale')"
                          (click)="deleteSale(s)">
                    <span class="material-icons">delete</span>
                  </button>
                </td>
              </tr>
              <tr *ngIf="sales.length === 0">
                <td colspan="7" class="ss-empty-row">
                  <span class="material-icons">storefront</span>
                  No sales yet. Click <strong>New Sale</strong> to record one.
                </td>
              </tr>
            </tbody>
          </table>

          <!-- PAGINATION -->
          <div class="ss-pagination" *ngIf="total > pageSize">
            <span class="ss-page-info">{{ pageRangeStart }}–{{ pageRangeEnd }} of {{ total }}</span>
            <div class="ss-page-btns">
              <button (click)="setPage(1)" [disabled]="page===1"><span class="material-icons">first_page</span></button>
              <button (click)="setPage(page-1)" [disabled]="page===1"><span class="material-icons">chevron_left</span></button>
              <button (click)="setPage(page+1)" [disabled]="page>=totalPages"><span class="material-icons">chevron_right</span></button>
              <button (click)="setPage(totalPages)" [disabled]="page>=totalPages"><span class="material-icons">last_page</span></button>
            </div>
          </div>
        </div>

      </div><!-- /ss-card -->

      <!-- ══ NEW SALE MODAL ══ -->
      <div class="ss-modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="ss-modal" (click)="$event.stopPropagation()">

          <!-- Modal header -->
          <div class="ss-modal-header">
            <div class="ss-modal-header-icon"><span class="material-icons">add_shopping_cart</span></div>
            <div class="ss-modal-header-text">
              <div class="ss-modal-title">{{ editingSale ? 'Edit Stock Sale' : 'New Stock Sale' }}</div>
              <div class="ss-modal-sub">{{ editingSale ? 'Update products and customer details' : 'Select products and record a sale' }}</div>
            </div>
            <button class="ss-modal-close" (click)="closeModal()"><span class="material-icons">close</span></button>
          </div>

          <!-- Modal body: two-panel -->
          <div class="ss-modal-body">

            <!-- LEFT PANEL: customer + product picker -->
            <div class="ss-left-panel">

              <!-- Channel toggle -->
              <div class="ss-section-label">Sale Channel</div>
              <div class="ss-pill-toggle" style="margin-bottom:14px">
                <button class="ss-pill" [class.ss-pill-active]="saleChannel==='walk_in'" (click)="saleChannel='walk_in'">
                  <span class="material-icons">store</span> Walk-in
                </button>
                <button class="ss-pill" [class.ss-pill-active]="saleChannel==='online'" (click)="saleChannel='online'">
                  <span class="material-icons">wifi</span> Online
                </button>
              </div>

              <!-- Customer -->
              <div class="ss-section-label">Customer</div>
              <div class="ss-pill-toggle" style="margin-bottom:10px">
                <button class="ss-pill" [class.ss-pill-active]="customerMode==='walkin'" (click)="setCustomerMode('walkin')">
                  <span class="material-icons">person</span> Walk-in
                </button>
                <button class="ss-pill" [class.ss-pill-active]="customerMode==='existing'" (click)="setCustomerMode('existing')">
                  <span class="material-icons">people</span> Existing
                </button>
                <button class="ss-pill" [class.ss-pill-active]="customerMode==='new'" (click)="setCustomerMode('new')">
                  <span class="material-icons">person_add</span> New
                </button>
              </div>

              <div *ngIf="customerMode==='existing'" class="ss-form-group">
                <app-searchable-select
                  [items]="clients"
                  labelKey="name"
                  valueKey="id"
                  placeholder="Search customer…"
                  searchPlaceholder="Type name or phone…"
                  noResultsText="No customer found"
                  [(ngModel)]="selectedClientId"
                  (ngModelChange)="onClientSelected($event)">
                </app-searchable-select>
                <div class="ss-client-phone" *ngIf="selectedClientPhone">
                  <span class="material-icons">whatsapp</span> {{ selectedClientPhone }}
                </div>
              </div>

              <div *ngIf="customerMode==='new'" class="ss-form-row">
                <div class="ss-form-group">
                  <input class="ss-input" type="text" placeholder="Full name *" [(ngModel)]="newClientName" />
                </div>
                <div class="ss-form-group">
                  <input class="ss-input" type="text" placeholder="WhatsApp number" [(ngModel)]="newClientPhone" />
                </div>
                <button class="ss-btn ss-btn-sm ss-btn-ghost"
                        [disabled]="!newClientName.trim() || savingClient"
                        (click)="saveNewClient()">
                  <span *ngIf="savingClient" class="ss-spinner ss-spinner-sm"></span>
                  {{ savingClient ? 'Saving…' : 'Save' }}
                </button>
                <div class="ss-client-saved" *ngIf="clientSaved">
                  <span class="material-icons">check_circle</span> Saved
                </div>
              </div>

              <!-- Divider -->
              <div class="ss-divider"><span>Products</span></div>

              <!-- Product search -->
              <div class="ss-product-search-wrap">
                <span class="material-icons ss-search-icon">search</span>
                <input class="ss-search" type="text" placeholder="Search products…"
                       [(ngModel)]="productSearch" />
              </div>

              <!-- Product list -->
              <div class="ss-product-list" *ngIf="!loadingProducts">
                <div class="ss-no-products" *ngIf="filteredProducts.length === 0">
                  <span class="material-icons">inventory_2</span>
                  <p>{{ availableProducts.length === 0 ? 'No products are currently in stock.' : 'No products match your search.' }}</p>
                </div>
                <div class="ss-product-card"
                     *ngFor="let p of filteredProducts"
                     [class.ss-product-in-cart]="getCartQty(p.id) > 0">
                  <div class="ss-product-info">
                    <div class="ss-product-name">{{ p.name }}</div>
                    <div class="ss-product-meta">
                      <span class="ss-stock-badge" [class.ss-stock-low]="p.stock <= 5">
                        <span class="material-icons">inventory_2</span>{{ p.stock }} in stock
                      </span>
                      <span class="ss-price-badge">
                        GHS {{ getEffectivePrice(p, getCartQty(p.id) || 1) | number:'1.2-2' }}
                        <span class="ss-discount-hint" *ngIf="p.stockDiscountMinQty > 0 && getCartQty(p.id) >= p.stockDiscountMinQty">
                          discount applied
                        </span>
                      </span>
                    </div>
                    <div class="ss-discount-info" *ngIf="p.stockDiscountMinQty > 0">
                      <span class="material-icons">local_offer</span>
                      GHS {{ p.stockDiscountPrice | number:'1.2-2' }} for {{ p.stockDiscountMinQty }}+ items
                    </div>
                  </div>
                  <div class="ss-product-action">
                    <ng-container *ngIf="getCartQty(p.id) === 0">
                      <button class="ss-add-btn" (click)="addToCart(p)" [disabled]="p.stock === 0">
                        <span class="material-icons">add</span>
                      </button>
                    </ng-container>
                    <ng-container *ngIf="getCartQty(p.id) > 0">
                      <div class="ss-stepper">
                        <button (click)="decrementCart(p.id)"><span class="material-icons">remove</span></button>
                        <input type="number" [value]="getCartQty(p.id)"
                               (change)="setCartQty(p.id, $any($event.target).value)"
                               min="1" [max]="p.stock" class="ss-stepper-input" />
                        <button (click)="incrementCart(p.id)" [disabled]="getCartQty(p.id) >= p.stock">
                          <span class="material-icons">add</span>
                        </button>
                      </div>
                    </ng-container>
                  </div>
                </div>
              </div>

              <div class="ss-product-loading" *ngIf="loadingProducts">
                <span class="ss-spinner"></span> Loading products…
              </div>

            </div><!-- /ss-left-panel -->

            <!-- RIGHT PANEL: cart -->
            <div class="ss-right-panel">
              <div class="ss-section-label">Cart</div>

              <div class="ss-empty-cart" *ngIf="cart.length === 0">
                <span class="material-icons">shopping_cart</span>
                <p>No items added yet. Select products on the left.</p>
              </div>

              <div class="ss-cart-table-wrap" *ngIf="cart.length > 0">
                <table class="ss-cart-table">
                  <thead><tr>
                    <th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th></th>
                  </tr></thead>
                  <tbody>
                    <tr *ngFor="let item of cart; let i = index">
                      <td class="ss-cart-name">{{ item.product.name }}</td>
                      <td>
                        <input type="number" class="ss-qty-input"
                               [value]="item.qty"
                               (change)="setCartQtyByIndex(i, $any($event.target).value)"
                               min="1" [max]="item.product.stock" />
                      </td>
                      <td>GHS {{ item.unitPrice | number:'1.2-2' }}</td>
                      <td><strong>GHS {{ item.subtotal | number:'1.2-2' }}</strong></td>
                      <td>
                        <button class="ss-remove-btn" (click)="removeFromCart(i)">
                          <span class="material-icons">delete_outline</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Total -->
              <div class="ss-total-row" *ngIf="cart.length > 0">
                <span>Total</span>
                <strong>GHS {{ cartTotal | number:'1.2-2' }}</strong>
              </div>

              <!-- Receipt actions -->
              <div class="ss-receipt-actions" *ngIf="cart.length > 0">
                <button class="ss-btn ss-btn-ghost ss-btn-sm" (click)="copyReceipt()">
                  <span class="material-icons">{{ receiptCopied ? 'check' : 'content_copy' }}</span>
                  {{ receiptCopied ? 'Copied!' : 'Copy Receipt' }}
                </button>
                <button class="ss-btn ss-btn-ghost ss-btn-sm ss-btn-whatsapp"
                        *ngIf="receiptPhone"
                        (click)="sendWhatsApp()">
                  <span class="material-icons">whatsapp</span> Send Receipt
                </button>
              </div>

            </div><!-- /ss-right-panel -->

          </div><!-- /ss-modal-body -->

          <!-- Modal footer -->
          <div class="ss-modal-footer">
            <button class="ss-btn ss-btn-ghost" (click)="closeModal()" [disabled]="saving">Cancel</button>
            <button class="ss-btn ss-btn-primary"
                    [disabled]="cart.length === 0 || saving"
                    (click)="recordSale()">
              <span *ngIf="saving" class="ss-spinner ss-spinner-sm"></span>
              {{ saving ? 'Saving…' : (editingSale ? 'Save Sale' : 'Record Sale') }}
            </button>
          </div>

        </div><!-- /ss-modal -->
      </div><!-- /overlay -->

      <!-- ══ RECEIPT MODAL ══ -->
      <div class="ss-modal-overlay" *ngIf="viewingReceiptSale" (click)="closeReceiptModal()">
        <div class="ss-modal ss-modal-sm" (click)="$event.stopPropagation()">
          <div class="ss-modal-header">
            <div class="ss-modal-header-icon"><span class="material-icons">receipt_long</span></div>
            <div class="ss-modal-header-text">
              <div class="ss-modal-title">Receipt #SS-{{ viewingReceiptSale.id }}</div>
              <div class="ss-modal-sub">{{ viewingReceiptSale.createdAt | date:'mediumDate' }}</div>
            </div>
            <button class="ss-modal-close" (click)="closeReceiptModal()"><span class="material-icons">close</span></button>
          </div>
          <div class="ss-modal-body ss-receipt-body" *ngIf="!loadingReceipt">
            <div class="ss-receipt-customer">
              <span class="material-icons">person</span>
              {{ viewingReceiptSale.customerName || 'Walk-in Customer' }}
              <span class="ss-channel-pill" [class.ss-ch-online]="viewingReceiptSale.saleChannel==='online'" style="margin-left:8px">
                {{ viewingReceiptSale.saleChannel === 'online' ? 'Online' : 'Walk-in' }}
              </span>
            </div>
            <table class="ss-cart-table" style="margin-top:12px">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead>
              <tbody>
                <tr *ngFor="let item of viewingReceiptSale.items">
                  <td>{{ item.productName }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>GHS {{ item.unitPrice | number:'1.2-2' }}</td>
                  <td><strong>GHS {{ item.subtotal | number:'1.2-2' }}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="ss-total-row" style="margin-top:12px">
              <span>Total</span>
              <strong>GHS {{ viewingReceiptSale.totalAmount | number:'1.2-2' }}</strong>
            </div>
          </div>
          <div class="ss-modal-body" *ngIf="loadingReceipt" style="display:flex;align-items:center;gap:10px;color:#94a3b8">
            <span class="ss-spinner"></span> Loading receipt…
          </div>
          <div class="ss-modal-footer">
            <button class="ss-btn ss-btn-ghost" (click)="closeReceiptModal()">Close</button>
            <button class="ss-btn ss-btn-ghost" (click)="copyReceiptFromDetail()">
              <span class="material-icons">{{ detailReceiptCopied ? 'check' : 'content_copy' }}</span>
              {{ detailReceiptCopied ? 'Copied!' : 'Copy Receipt' }}
            </button>
          </div>
        </div>
      </div>

    </div><!-- /ss-page -->
  `,
  styles: [`
    .ss-page { padding: 0; max-width: 1400px; }

    /* ── Page header ── */
    .ss-page-header { display:flex; align-items:center; justify-content:space-between; padding:20px 0 16px; gap:12px; flex-wrap:wrap; }
    .ss-header-left  { display:flex; align-items:center; gap:14px; }
    .ss-header-icon  { width:46px; height:46px; border-radius:12px; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
    .ss-title        { margin:0; font-size:22px; font-weight:800; color:#0f172a; }
    .ss-subtitle     { margin:2px 0 0; font-size:12px; color:#64748b; }

    /* ── Card ── */
    .ss-card { background:#fff; border:1px solid #ccc; border-radius:14px; padding:20px; overflow:hidden; }

    /* ── Buttons ── */
    .ss-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:background 0.15s; }
    .ss-btn .material-icons { font-size:17px; }
    .ss-btn:disabled { opacity:0.45; cursor:default; pointer-events:none; }
    .ss-btn-primary  { background:var(--primary-color,#6366f1); color:#fff; }
    .ss-btn-primary:hover:not(:disabled) { background:var(--primary-dark,#4f46e5); }
    .ss-btn-ghost    { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
    .ss-btn-ghost:hover:not(:disabled) { background:#e2e8f0; }
    .ss-btn-sm       { padding:6px 12px; font-size:12px; }
    .ss-btn-whatsapp { color:#16a34a; border-color:#bbf7d0; background:#f0fdf4; }
    .ss-btn-whatsapp:hover:not(:disabled) { background:#dcfce7; }

    /* ── Toolbar ── */
    .ss-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .ss-search-wrap { display:flex; align-items:center; gap:8px; border:1px solid #ccc; border-radius:9px; padding:0 12px; background:#f8fafc; flex:1; min-width:180px; max-width:320px; }
    .ss-search-icon  { font-size:18px; color:#94a3b8; flex-shrink:0; }
    .ss-search       { border:none; background:transparent; font-size:13px; color:#334155; outline:none; width:100%; padding:9px 0; }

    /* ── Skeleton ── */
    .ss-sk { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size:200% 100%; animation: ss-shimmer 1.4s infinite; border-radius:6px; }
    .ss-sk-cell { height:14px; width:80%; }
    @keyframes ss-shimmer { to { background-position: -200% 0; } }

    /* ── Table ── */
    .ss-table-wrap  { margin:0 -20px -20px; border-top:1px solid #ccc; overflow-x:auto; }
    .ss-table       { width:100%; border-collapse:collapse; font-size:13px; }
    .ss-table th    { padding:11px 16px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; background:#f8fafc; border-bottom:1px solid #ccc; white-space:nowrap; }
    .ss-table td    { padding:12px 16px; border-bottom:1px solid #f1f5f9; color:#334155; vertical-align:middle; }
    .ss-table tbody tr:last-child td { border-bottom:none; }
    .ss-table tbody tr:hover td { background:#fafafe; }

    .ss-ref         { font-weight:700; color:var(--primary-color,#6366f1); font-size:12px; }
    .ss-customer-name { font-weight:600; color:#0f172a; }
    .ss-channel-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:20px; font-size:11px; font-weight:700; background:#f1f5f9; color:#475569; }
    .ss-channel-pill .material-icons { font-size:13px; }
    .ss-ch-online   { background:#eff6ff; color:#1d4ed8; }
    .ss-items-chip  { background:#f1f5f9; color:#475569; border-radius:20px; padding:2px 8px; font-size:11px; font-weight:600; }
    .ss-total-val   { color:#0f172a; }
    .ss-date-cell   { color:#64748b; white-space:nowrap; }
    .ss-icon-btn    { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:7px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; color:#64748b; transition:all 0.13s; }
    .ss-icon-btn:hover { background:#e0e7ff; border-color:#a5b4fc; color:var(--primary-color,#6366f1); }
    .ss-icon-btn-danger:hover { background:#fee2e2; border-color:#fecaca; color:#dc2626; }

    .ss-empty-row   { text-align:center; padding:40px 16px !important; color:#94a3b8; }
    .ss-empty-row .material-icons { display:block; font-size:40px; margin-bottom:8px; }

    /* ── Pagination ── */
    .ss-pagination   { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #f1f5f9; }
    .ss-page-info    { font-size:12px; color:#64748b; margin-right:8px; }
    .ss-page-btns    { display:flex; gap:4px; }
    .ss-page-btns button { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:7px; border:1px solid #ccc; background:#fff; cursor:pointer; color:#475569; }
    .ss-page-btns button:disabled { opacity:.4; cursor:default; }
    .ss-page-btns button .material-icons { font-size:18px; }

    /* ── Modal ── */
    .ss-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .ss-modal { background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.2); width:100%; max-width:960px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }
    .ss-modal-sm { max-width:520px; }

    .ss-modal-header { display:flex; align-items:center; gap:14px; padding:18px 20px; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .ss-modal-header-icon { width:38px; height:38px; border-radius:10px; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
    .ss-modal-title  { font-size:15px; font-weight:700; color:#0f172a; }
    .ss-modal-sub    { font-size:12px; color:#64748b; }
    .ss-modal-close  { margin-left:auto; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:none; background:#f1f5f9; border-radius:8px; cursor:pointer; color:#475569; }
    .ss-modal-close:hover { background:#e2e8f0; }

    .ss-modal-body   { display:flex; gap:0; flex:1; overflow:hidden; }
    .ss-modal-footer { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #e2e8f0; flex-shrink:0; }

    /* ── Two-panel layout ── */
    .ss-left-panel   { width:55%; border-right:1px solid #e2e8f0; padding:18px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:0; }
    .ss-right-panel  { flex:1; padding:18px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }

    /* ── Misc form ── */
    .ss-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-bottom:6px; display:block; }
    .ss-divider       { display:flex; align-items:center; gap:10px; margin:16px 0 12px; }
    .ss-divider::before, .ss-divider::after { content:''; flex:1; height:1px; background:#e2e8f0; }
    .ss-divider span  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; white-space:nowrap; }

    .ss-pill-toggle  { display:inline-flex; gap:3px; padding:3px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; }
    .ss-pill         { display:inline-flex; align-items:center; gap:5px; padding:6px 12px; border-radius:7px; border:none; background:transparent; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; transition:all 0.13s; }
    .ss-pill .material-icons { font-size:14px; }
    .ss-pill-active  { background:#fff; color:var(--primary-color,#6366f1); box-shadow:0 1px 4px rgba(0,0,0,0.1); }

    .ss-form-group   { margin-bottom:10px; }
    .ss-form-row     { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:10px; }
    .ss-form-row .ss-form-group { flex:1; margin-bottom:0; min-width:120px; }
    .ss-input        { width:100%; padding:8px 11px; border:1px solid #ccc; border-radius:8px; font-size:13px; color:#334155; background:#f8fafc; box-sizing:border-box; }
    .ss-input:focus  { outline:none; border-color:var(--primary-color,#6366f1); }
    .ss-client-phone { display:flex; align-items:center; gap:6px; font-size:12px; color:#16a34a; margin-top:6px; font-weight:600; }
    .ss-client-phone .material-icons { font-size:15px; }
    .ss-client-saved { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#16a34a; }
    .ss-client-saved .material-icons { font-size:15px; }

    /* ── Product search + list ── */
    .ss-product-search-wrap { display:flex; align-items:center; gap:8px; border:1px solid #ccc; border-radius:9px; padding:0 12px; background:#f8fafc; margin-bottom:10px; }
    .ss-product-list { display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height:340px; padding-right:2px; }
    .ss-product-card { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; background:#fafafe; transition:border-color .13s; }
    .ss-product-card:hover { border-color:var(--primary-light,#a5b4fc); }
    .ss-product-in-cart { border-color:var(--primary-color,#6366f1); background:#f5f3ff; }
    .ss-product-name { font-weight:700; font-size:13px; color:#0f172a; margin-bottom:4px; }
    .ss-product-meta { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .ss-stock-badge  { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#334155; background:#f1f5f9; padding:2px 7px; border-radius:20px; }
    .ss-stock-badge .material-icons { font-size:12px; }
    .ss-stock-low    { background:#fef3c7; color:#92400e; }
    .ss-price-badge  { font-size:12px; font-weight:700; color:var(--primary-color,#6366f1); }
    .ss-discount-hint { font-size:10px; font-weight:600; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:4px; margin-left:4px; }
    .ss-discount-info { display:flex; align-items:center; gap:4px; font-size:11px; color:#64748b; margin-top:4px; }
    .ss-discount-info .material-icons { font-size:13px; color:#f59e0b; }
    .ss-add-btn      { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:none; background:var(--primary-color,#6366f1); color:#fff; cursor:pointer; flex-shrink:0; }
    .ss-add-btn:disabled { background:#e2e8f0; color:#94a3b8; cursor:default; }
    .ss-stepper      { display:flex; align-items:center; gap:4px; flex-shrink:0; }
    .ss-stepper button { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; color:#475569; }
    .ss-stepper button:disabled { opacity:.4; cursor:default; }
    .ss-stepper-input { width:40px; text-align:center; border:1px solid #e2e8f0; border-radius:7px; padding:4px; font-size:13px; font-weight:700; color:#0f172a; }
    .ss-no-products  { text-align:center; padding:24px; color:#94a3b8; }
    .ss-no-products .material-icons { font-size:36px; display:block; margin:0 auto 8px; }
    .ss-no-products p { margin:0; font-size:13px; }
    .ss-product-loading { display:flex; align-items:center; gap:8px; color:#94a3b8; font-size:13px; padding:20px 0; }

    /* ── Cart ── */
    .ss-empty-cart   { text-align:center; padding:32px 16px; color:#94a3b8; }
    .ss-empty-cart .material-icons { font-size:40px; display:block; margin:0 auto 8px; }
    .ss-empty-cart p { margin:0; font-size:13px; }
    .ss-cart-table-wrap { overflow-x:auto; }
    .ss-cart-table   { width:100%; border-collapse:collapse; font-size:12px; }
    .ss-cart-table th { padding:8px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
    .ss-cart-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; color:#334155; }
    .ss-cart-name    { font-weight:600; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ss-qty-input    { width:50px; border:1px solid #ccc; border-radius:7px; padding:4px 6px; font-size:12px; text-align:center; }
    .ss-remove-btn   { display:flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer; color:#ef4444; padding:2px; }
    .ss-remove-btn:hover { color:#b91c1c; }
    .ss-total-row    { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:2px solid #e2e8f0; font-size:14px; margin-top:4px; }
    .ss-total-row strong { font-size:16px; color:#0f172a; }
    .ss-receipt-actions { display:flex; gap:8px; flex-wrap:wrap; }

    /* ── Receipt body ── */
    .ss-receipt-body { flex-direction:column; padding:20px; overflow-y:auto; }
    .ss-receipt-customer { display:flex; align-items:center; gap:8px; font-weight:700; color:#0f172a; font-size:14px; }
    .ss-receipt-customer .material-icons { font-size:18px; color:#6366f1; }

    /* ── Spinner ── */
    .ss-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:ss-spin .7s linear infinite; display:inline-block; flex-shrink:0; }
    .ss-spinner-sm { width:14px; height:14px; border-color:rgba(99,102,241,0.3); border-top-color:var(--primary-color,#6366f1); }
    @keyframes ss-spin { to { transform:rotate(360deg); } }
  `]
})
export class StockSalesComponent implements OnInit {

  loading        = true;
  loadingProducts = true;
  loadingReceipt = false;
  saving         = false;
  savingClient   = false;
  clientSaved    = false;

  sales: StockSale[] = [];
  total     = 0;
  page      = 1;
  pageSize  = 20;

  searchTerm = '';
  dateFrom   = '';
  dateTo     = '';

  availableProducts: StockProduct[] = [];
  productSearch = '';

  clients: Client[] = [];

  showModal   = false;
  saleChannel = 'walk_in';

  customerMode     = 'walkin';   // 'walkin' | 'existing' | 'new'
  selectedClientId: number | null = null;
  selectedClientPhone = '';
  newClientName    = '';
  newClientPhone   = '';
  savedClientId: number | null = null;
  savedClientName  = '';

  cart: CartItem[] = [];
  receiptCopied = false;

  viewingReceiptSale: StockSale | null = null;
  editingSale: StockSale | null = null;
  detailReceiptCopied = false;

  constructor(
    private db: DatabaseService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadSales();
  }

  // ── Computed ────────────────────────────────────────────

  get totalPages() { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageRangeStart() { return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1; }
  get pageRangeEnd()   { return Math.min(this.page * this.pageSize, this.total); }

  get filteredProducts(): StockProduct[] {
    const t = this.productSearch.trim().toLowerCase();
    return t ? this.availableProducts.filter(p => p.name.toLowerCase().includes(t)) : this.availableProducts;
  }

  get cartTotal(): number {
    return this.cart.reduce((s, i) => s + i.subtotal, 0);
  }

  get receiptPhone(): string {
    if (this.customerMode === 'existing') return this.selectedClientPhone;
    if (this.customerMode === 'new')      return this.newClientPhone;
    return '';
  }

  // ── Load data ────────────────────────────────────────────

  loadSales() {
    this.loading = true;
    this.db.getStockSalesPage(this.page, this.pageSize, this.searchTerm, this.dateFrom, this.dateTo)
      .subscribe(({ data, total }) => {
        this.sales = data;
        this.total = total;
        this.loading = false;
      });
  }

  onSearch() {
    this.page = 1;
    this.loadSales();
  }

  setPage(p: number) {
    const next = Math.max(1, Math.min(p, this.totalPages));
    if (next === this.page) return;
    this.page = next;
    this.loadSales();
  }

  // ── Modal ────────────────────────────────────────────────

  openNewSale() {
    if (!this.authService.canPerformStockSalesOperation('canAddSale')) return;
    this.resetModal();
    this.showModal = true;
    this.loadAvailableProducts();
    this.loadClients();
  }

  openEditSale(sale: StockSale) {
    if (!sale.id || !this.authService.canPerformStockSalesOperation('canEditSale')) return;
    this.resetModal();
    this.editingSale = sale;
    this.showModal = true;
    this.loadClients();
    this.loadingProducts = true;

    this.db.getStockSaleDetail(sale.id).subscribe(detail => {
      if (!detail) {
        this.loadingProducts = false;
        alert('Unable to load sale details.');
        return;
      }

      this.db.getStockAvailableProducts().subscribe(products => {
        const productsById = new Map<number, StockProduct>();
        products.forEach(product => productsById.set(product.id, product));

        this.saleChannel = detail.saleChannel || 'walk_in';
        this.customerMode = detail.customerId ? 'existing' : 'walkin';
        this.selectedClientId = detail.customerId || null;
        this.cart = (detail.items || []).map(item => {
          const currentProduct = productsById.get(item.productId);
          const product: StockProduct = currentProduct
            ? { ...currentProduct, stock: Number(currentProduct.stock || 0) + Number(item.quantity || 0) }
            : {
                id: item.productId,
                name: item.productName || 'Product',
                stock: Number(item.quantity || 0),
                stockPrice: Number(item.unitPrice || 0),
                stockDiscountMinQty: 0,
                stockDiscountPrice: 0,
                latestBatchProductId: item.batchProductId || null
              };

          productsById.set(product.id, product);
          return {
            product,
            qty: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            subtotal: Number(item.subtotal || 0)
          };
        });

        this.availableProducts = Array.from(productsById.values()).sort((a, b) => a.name.localeCompare(b.name));
        this.loadingProducts = false;
      });
    });
  }

  closeModal() {
    this.showModal = false;
    this.editingSale = null;
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('ss-modal-overlay')) {
      this.closeModal();
    }
  }

  resetModal() {
    this.saleChannel      = 'walk_in';
    this.customerMode     = 'walkin';
    this.selectedClientId = null;
    this.selectedClientPhone = '';
    this.newClientName    = '';
    this.newClientPhone   = '';
    this.savedClientId    = null;
    this.savedClientName  = '';
    this.clientSaved      = false;
    this.productSearch    = '';
    this.cart             = [];
    this.receiptCopied    = false;
    this.saving           = false;
    this.editingSale      = null;
  }

  loadAvailableProducts() {
    this.loadingProducts = true;
    this.db.getStockAvailableProducts().subscribe(products => {
      this.availableProducts = products;
      this.loadingProducts   = false;
    });
  }

  loadClients() {
    this.db.getClients().subscribe(clients => {
      this.clients = clients;
    });
  }

  // ── Customer ─────────────────────────────────────────────

  setCustomerMode(mode: string) {
    this.customerMode     = mode;
    this.selectedClientId = null;
    this.selectedClientPhone = '';
    this.clientSaved      = false;
  }

  onClientSelected(id: number | null) {
    this.selectedClientId = id;
    const c = this.clients.find(x => x.id === Number(id));
    this.selectedClientPhone = c?.phone || c?.whatsappNumber || '';
  }

  saveNewClient() {
    if (!this.newClientName.trim()) return;
    this.savingClient = true;
    this.db.createClient({ name: this.newClientName.trim(), phone: this.newClientPhone.trim(), whatsappNumber: this.newClientPhone.trim() })
      .subscribe(id => {
        this.savedClientId   = id;
        this.savedClientName = this.newClientName.trim();
        this.savingClient    = false;
        this.clientSaved     = true;
        // Refresh client list
        this.db.getClients().subscribe(c => this.clients = c);
      });
  }

  // ── Cart ─────────────────────────────────────────────────

  getCartQty(productId: number): number {
    return this.cart.find(i => i.product.id === productId)?.qty ?? 0;
  }

  getEffectivePrice(p: StockProduct, qty: number): number {
    if (p.stockDiscountMinQty > 0 && qty >= p.stockDiscountMinQty && p.stockDiscountPrice > 0) {
      return p.stockDiscountPrice;
    }
    return p.stockPrice;
  }

  addToCart(product: StockProduct) {
    const existing = this.cart.find(i => i.product.id === product.id);
    if (existing) return; // already in cart
    const unitPrice = this.getEffectivePrice(product, 1);
    this.cart.push({ product, qty: 1, unitPrice, subtotal: unitPrice });
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
  }

  decrementCart(productId: number) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;
    if (item.qty <= 1) { this.cart = this.cart.filter(i => i.product.id !== productId); return; }
    item.qty--;
    this.recalcItem(item);
  }

  incrementCart(productId: number) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;
    if (item.qty >= item.product.stock) return;
    item.qty++;
    this.recalcItem(item);
  }

  setCartQty(productId: number, rawVal: string) {
    const item = this.cart.find(i => i.product.id === productId);
    if (!item) return;
    const qty = Math.max(1, Math.min(Number(rawVal) || 1, item.product.stock));
    item.qty = qty;
    this.recalcItem(item);
  }

  setCartQtyByIndex(index: number, rawVal: string) {
    const item = this.cart[index];
    if (!item) return;
    const qty = Math.max(1, Math.min(Number(rawVal) || 1, item.product.stock));
    item.qty = qty;
    this.recalcItem(item);
  }

  private recalcItem(item: CartItem) {
    item.unitPrice = this.getEffectivePrice(item.product, item.qty);
    item.subtotal  = item.unitPrice * item.qty;
  }

  // ── Record sale ──────────────────────────────────────────

  recordSale() {
    if (this.cart.length === 0 || this.saving) return;
    if (this.editingSale && !this.authService.canPerformStockSalesOperation('canEditSale')) return;
    if (!this.editingSale && !this.authService.canPerformStockSalesOperation('canAddSale')) return;
    this.saving = true;

    // Resolve customer
    let customerId: number | null = null;
    let customerName = 'Walk-in';
    if (this.customerMode === 'existing' && this.selectedClientId) {
      customerId   = Number(this.selectedClientId);
      customerName = this.clients.find(c => c.id === customerId)?.name || 'Customer';
    } else if (this.customerMode === 'new') {
      if (this.savedClientId) {
        customerId   = this.savedClientId;
        customerName = this.savedClientName;
      } else {
        customerName = this.newClientName.trim() || 'Walk-in';
      }
    }

    const items: StockSaleItem[] = this.cart.map(i => ({
      batchProductId: i.product.latestBatchProductId ?? 0,
      productId:      i.product.id,
      quantity:       i.qty,
      unitPrice:      i.unitPrice,
      subtotal:       i.subtotal
    }));

    const request: any = this.editingSale?.id
      ? this.db.updateStockSale(this.editingSale.id, customerId, customerName, this.saleChannel, this.cartTotal, items)
      : this.db.createStockSale(customerId, customerName, this.saleChannel, this.cartTotal, items);

    request
      .subscribe({
        next: () => {
          this.saving = false;
          this.closeModal();
          this.page = 1;
          this.loadSales();
          this.loadAvailableProducts(); // refresh stock counts
        },
        error: (err: any) => {
          this.saving = false;
          const message = err?.message || 'Failed to record sale and update stock. Please try again.';
          alert(message);
        }
      });
  }

  deleteSale(sale: StockSale) {
    if (!sale.id || !this.authService.canPerformStockSalesOperation('canDeleteSale')) return;
    if (!confirm(`Delete stock sale #SS-${sale.id}? Product stock will be restored.`)) return;
    this.db.deleteStockSale(sale.id).subscribe(ok => {
      if (!ok) {
        alert('Failed to delete stock sale.');
        return;
      }
      this.loadSales();
      this.loadAvailableProducts();
    });
  }

  // ── Receipt ──────────────────────────────────────────────

  buildReceiptText(sale?: StockSale, items?: CartItem[]): string {
    const shopName = 'Shakhis Commerce';
    const date     = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    let lines: string[] = [];
    lines.push(`*${shopName} - Receipt*`);
    if (sale) {
      lines.push(`Ref: #SS-${sale.id}`);
      lines.push(`Customer: ${sale.customerName || 'Walk-in'}`);
      lines.push(`Date: ${new Date(sale.createdAt!).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`);
    } else {
      lines.push(`Date: ${date}`);
    }
    lines.push('');
    lines.push('*Items:*');
    if (items) {
      for (const i of items) {
        lines.push(`• ${i.product.name} x${i.qty} = GHS ${i.subtotal.toFixed(2)}`);
      }
    } else if (sale?.items) {
      for (const i of sale.items) {
        lines.push(`• ${i.productName} x${i.quantity} = GHS ${i.subtotal.toFixed(2)}`);
      }
    }
    lines.push('');
    const total = items ? this.cartTotal : (sale?.totalAmount ?? 0);
    lines.push(`*Total: GHS ${total.toFixed(2)}*`);
    lines.push('');
    lines.push('Thank you for your purchase! 🙏');
    return lines.join('\n');
  }

  copyReceipt() {
    const text = this.buildReceiptText(undefined, this.cart);
    navigator.clipboard.writeText(text).then(() => {
      this.receiptCopied = true;
      setTimeout(() => this.receiptCopied = false, 2500);
    });
  }

  sendWhatsApp() {
    const phone = (this.receiptPhone || '').replace(/\D/g, '');
    const text  = encodeURIComponent(this.buildReceiptText(undefined, this.cart));
    const url   = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  // ── Detail / Receipt modal ───────────────────────────────

  viewReceipt(sale: StockSale) {
    this.viewingReceiptSale = sale;
    this.detailReceiptCopied = false;
    if (!sale.items) {
      this.loadingReceipt = true;
      this.db.getStockSaleDetail(sale.id!).subscribe(detail => {
        this.viewingReceiptSale = detail;
        this.loadingReceipt     = false;
      });
    }
  }

  closeReceiptModal() {
    this.viewingReceiptSale  = null;
    this.detailReceiptCopied = false;
  }

  copyReceiptFromDetail() {
    if (!this.viewingReceiptSale) return;
    const text = this.buildReceiptText(this.viewingReceiptSale);
    navigator.clipboard.writeText(text).then(() => {
      this.detailReceiptCopied = true;
      setTimeout(() => this.detailReceiptCopied = false, 2500);
    });
  }
}
