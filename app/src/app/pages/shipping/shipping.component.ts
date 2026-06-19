import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchListSectionComponent,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import {
  ActionOption,
  TableColumn,
  TableComponent,
  TableFilterConfig,
  TableMetadata
} from '../../components/table/table.component';
import { ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';

interface ShippingBatch {
  name: string;
}

interface ShippingItemClient {
  clientId: number | null;
  clientName: string;
  quantity: number;
  originalQuantity?: number | null;
  adjustedQuantity?: number | null;
  damagedQuantity?: number;
}

interface ShippingItem {
  id: number;
  rowIds?: number[];
  productId: number | null;
  productName: string;
  quantity: number;
  fee: number | null;
  batchName: string;
  clients: ShippingItemClient[];
  // Damage allocation fields
  damagedQty?: number;       // Total damaged for product in batch
  hasAllocation?: boolean;   // Whether product has damage allocation
}

@Component({
  selector: 'app-shipping',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, DateFilterComponent, StatCardsComponent, TableComponent, ModalShellComponent],
  template: `
    <div class="sh-page">

      <!-- PAGE HEADER -->
      <div class="sh-header">
        <div class="sh-header-left">
          <div class="sh-header-icon"><span class="material-icons">local_shipping</span></div>
          <div>
            <h1 class="sh-header-title">Shipping</h1>
            <p class="sh-header-sub">Manage shipping fees for batches</p>
          </div>
        </div>
        <div class="sh-header-actions">
          <button class="sh-btn sh-btn-outline"
                  *ngIf="!viewingBatch && !viewingLedger && batches.length > 0"
                  (click)="viewLedger()">
            <span class="material-icons">menu_book</span> Ledger
          </button>
          <ng-container *ngIf="viewingBatch">
          </ng-container>
        </div>
      </div>

      <div class="sh-card">

        <!-- BATCHES VIEW -->
        <ng-container *ngIf="!viewingBatch && !viewingLedger">
          <app-batch-list-section
            [loading]="loading"
            [items]="paginatedBatchItems"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="filteredBatches.length"
            [searchTerm]="batchSearchTerm"
            [showDateFilter]="false"
            [searchPlaceholder]="'Search batches...'"
            [emptyTitle]="'No shipping batches yet'"
            [emptyDescription]="'Shipping batches will appear here once orders are processed.'"
            [titleResolver]="shippingBatchTitleResolver"
            [iconResolver]="shippingBatchIconResolver"
            [tagsResolver]="shippingBatchTagsResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="openBatch($event)">
            <ng-template batchSectionFooter let-batch>
              <button class="sh-card-action-btn sh-cab-primary sh-open-btn" (click)="$event.stopPropagation(); openBatch(batch)">
                <span class="material-icons">open_in_new</span> View Shipping
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <!-- ITEMS VIEW -->
        <ng-container *ngIf="viewingBatch">

          <div class="sh-detail-header">
            <button class="sh-back-btn" (click)="closeBatch()">
              <span class="material-icons">arrow_back</span> Batches
            </button>
            <div class="sh-detail-title-group">
              <div class="sh-detail-icon"><span class="material-icons">local_shipping</span></div>
              <div>
                <div class="sh-detail-name">{{ currentBatch }}</div>
                <div class="sh-detail-sub">Set and manage shipping fees per product</div>
              </div>
            </div>
          </div>

          <app-stat-cards [config]="shippingStatCards"></app-stat-cards>

          <app-table
            [columns]="shippingColumns"
            [data]="shippingTableRows"
            [metadata]="shippingMetadata"
            [filters]="shippingTableFilters"
            [showSearchRow]="true"
            [initialLoading]="itemsLoading && shippingTableRows.length === 0"
            [searching]="itemsLoading && shippingTableRows.length > 0"
            [skeletonRows]="5"
            [tableLabel]="'Shipping Items'"
            [summaryLabel]="'Items'"
            [summaryValue]="itemTotal"
            [showToolbarStart]="true"
            (searchChange)="onShippingTableSearchChange($event)"
            (filterChange)="onShippingTableFilterChange($event)"
            (inputChange)="onShippingTableInputChange($event)"
            (actionClick)="onShippingTableActionClick($event)"
            (pageChange)="setItemPage($event)">
            <app-date-filter table-toolbar-start (dateChange)="onShippingDateChange($event)"></app-date-filter>
          </app-table>
        </ng-container>

        <!-- LEDGER VIEW -->
        <ng-container *ngIf="viewingLedger">
          <div class="sh-detail-header">
            <button class="sh-back-btn" (click)="closeLedger()">
              <span class="material-icons">arrow_back</span> Batches
            </button>
            <div class="sh-detail-title-group">
              <div class="sh-detail-icon"><span class="material-icons">menu_book</span></div>
              <div>
                <div class="sh-detail-name">Shipping Ledger</div>
                <div class="sh-detail-sub">Total shipping fees per client</div>
              </div>
            </div>
          </div>

          <div *ngIf="ledger.length === 0" class="sh-empty">
            <div class="sh-empty-icon"><span class="material-icons">menu_book</span></div>
            <h3>No shipping fees saved yet</h3>
            <p>Set fees on shipping batches to populate the ledger.</p>
          </div>

          <div *ngIf="ledger.length > 0" class="sh-table-wrap">
            <table class="sh-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th class="sh-tr">Total Shipping Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let l of ledger">
                  <td><span class="sh-client-name">{{ l.clientName }}</span></td>
                  <td class="sh-tr"><strong>{{ l.totalFee | number:'1.2-2' }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>

      </div>

      <!-- CLIENTS MODAL -->
      <app-modal
        *ngIf="selectedItemForClientsModal"
        [title]="'Clients for ' + selectedItemForClientsModal.productName"
        [sub-heading]="'Clients who bought this product in the current batch'"
        [icon]="'group'"
        [size]="'lg'"
        (closeRequested)="closeClientsModal()">
        <div *ngIf="selectedItemForClientsModal.clients.length === 0" class="sh-modal-empty">
          <span class="material-icons">inbox</span>
          <p>No clients for this product</p>
        </div>
        <app-table
          *ngIf="selectedItemForClientsModal.clients.length > 0"
          [columns]="clientsModalColumns"
          [data]="paginatedClientsModalData"
          [metadata]="clientsModalMetadata"
          [showSearchRow]="false"
          [tableLabel]="'Clients'"
          [summaryLabel]="'Buyers'"
          [summaryValue]="selectedItemForClientsModal.clients.length"
          (pageChange)="setClientsModalPage($event)">
        </app-table>
      </app-modal>

    </div>
  `,
  styles: [`
    .sh-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    /* HEADER */
    .sh-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
    .sh-header-left { display: flex; align-items: center; gap: 14px; }
    .sh-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .sh-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .sh-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    .sh-header-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

    /* BUTTONS */
    .sh-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.13s, opacity 0.13s; }
    .sh-btn .material-icons { font-size: 18px; }
    .sh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sh-btn-outline { background: transparent; color: #475569; border: 1px solid #ccc; }
    .sh-btn-outline:hover:not(:disabled) { background: #f1f5f9; }

    .sh-card-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.12s; }
    .sh-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .sh-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .sh-open-btn { width: 100%; justify-content: center; }

    /* DETAIL HEADER */
    .sh-detail-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ccc; margin-bottom: 16px; flex-wrap: wrap; }
    .sh-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: 1px solid #ccc; border-radius: 9px; background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; }
    .sh-back-btn:hover { background: #e2e8f0; }
    .sh-back-btn .material-icons { font-size: 16px; }
    .sh-detail-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .sh-detail-icon { width: 36px; height: 36px; border-radius: 9px; background: rgba(99,102,241,0.1); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .sh-detail-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .sh-detail-sub { font-size: 11px; color: #94a3b8; }
    /* EMPTY STATE */
    .sh-empty { text-align: center; padding: 48px 24px; }
    .sh-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(99,102,241,0.08); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
    .sh-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .sh-empty p { font-size: 13px; color: #64748b; margin: 0; }

    .sh-modal-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #94a3b8; padding: 32px 16px; }
    .sh-modal-empty .material-icons { font-size: 32px; }
    .sh-modal-empty p { font-size: 13px; margin: 0; }
  `]
})
export class ShippingComponent implements OnInit {
  Math = Math; // Make Math available in templates
  loading = true;
  savingItemId: number | null = null;
  savingSelected = false;
  savingAll = false;
  batches: string[] = [];
  batchCounts: { [k: string]: number } = {};
  batchPage = 1;
  batchPageSize = 20;
  batchSearchTerm = '';
  pageSizeOptions = [10, 20, 50, 100];
  get filteredBatches() {
    const term = this.batchSearchTerm.trim().toLowerCase();
    if (!term) return this.batches;
    return this.batches.filter(batch => batch.toLowerCase().includes(term));
  }
  get paginatedBatchItems() {
    const start = (this.batchPage - 1) * this.batchPageSize;
    return this.filteredBatches.slice(start, start + this.batchPageSize);
  }
  get totalBatchPages() { return Math.ceil(this.filteredBatches.length / this.batchPageSize) || 1; }

  viewingBatch = false;
  currentBatch: string | null = null;
  items: ShippingItem[] = [];
  shippingColumns: TableColumn[] = [];
  clientsModalColumns: TableColumn[] = [];
  checked: boolean[] = [];
    // per-row edit state keyed by shipping_fees id
    editing = new Set<string>();
    // store original fee value when entering edit mode to detect conflicts
    originalFees = new Map<string, number>();
    // track server-saved fee values per row to disable Save unless editing
    savedFees = new Map<number, number | null>();
  selectedIds = new Set<number>();
  savedItemIds = new Set<number>();
  itemPage = 1;
  itemPageSize = 20;
  itemTotal = 0;
  searchTerm: string = '';
  dateFrom = '';
  dateTo = '';
  filterEmptyOnly = false;
  filterShowOnlyAdded: boolean | null = null; // null = all, true = only added, false = only not added
  itemsLoading = false;
  summary = { expectedTotal: 0, completedQty: 0, remainingQty: 0 };
  searchDebounceTimer: any = null;

  get totalItemPages() { return Math.ceil(this.itemTotal / this.itemPageSize) || 1; }

  get itemRangeStart() {
    if (this.itemTotal === 0) return 0;
    return (this.itemPage - 1) * this.itemPageSize + 1;
  }

  get itemRangeEnd() {
    return Math.min(this.itemPage * this.itemPageSize, this.itemTotal);
  }

  viewingLedger = false;
  ledger: { clientName: string; totalFee: number }[] = [];

  constructor(
    private db: DatabaseService,
    public authService: AuthService
  ) {}

  ngOnInit(): void { 
    this.initShippingColumns();
    this.loadBatches();
    // Reload batches when a batch is deleted elsewhere
    this.db.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  loadBatches() {
    this.loading = true;
    this.db.getShippingQueueBatches().subscribe(b => {
      this.batches = b;
      // compute counts
      this.db.getShippingQueueCounts().subscribe(c => {
        this.batchCounts = c;
        if (this.batchPage > this.totalBatchPages) {
          this.batchPage = this.totalBatchPages;
        }
        this.loading = false;
      });
    });
  }

  onBatchSearchInput(value: string) {
    this.batchSearchTerm = value;
    this.batchPage = 1;
  }

  setBatchPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalBatchPages));
    if (next === this.batchPage) return;
    this.batchPage = next;
  }

  openBatch(name: string) {
    this.currentBatch = name;
    this.viewingBatch = true;
    this.viewingLedger = false;
    this.itemPage = 1;
    this.refreshItems();
  }

  onFilterChange() {
    this.itemPage = 1;
    // Debounce search by 1000ms
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.refreshItems();
      this.searchDebounceTimer = null;
    }, 1000);
  }

  onFilterToggle() {
    this.itemPage = 1;
    this.refreshItems();
  }

  refreshItems() {
    if (!this.currentBatch) return;
    this.itemsLoading = true;
    this.refreshSummary();

    this.db.getShippingQueuePageWithDamage(
      this.currentBatch,
      this.itemPage,
      this.itemPageSize,
      this.searchTerm || null,
      this.filterEmptyOnly,
      this.filterShowOnlyAdded,
      this.dateFrom ? `${this.dateFrom}T00:00:00` : null,
      this.dateTo ? `${this.dateTo}T23:59:59` : null
    ).subscribe(({ data, total }) => {
      this.items = (data || []).map(it => ({ ...it, fee: it.fee ?? 0 }));
      this.itemTotal = total || 0;
      this.savedFees.clear();
      for (const it of (data || [])) {
        this.savedFees.set(it.id, Number(it.fee ?? 0));
      }
      this.checked = new Array(this.items.length).fill(false);
      this.selectedIds.clear();
      this.itemsLoading = false;
      if (this.itemPage > this.totalItemPages) {
        this.itemPage = this.totalItemPages;
        this.refreshItems();
      }
    }, _err => { this.itemsLoading = false; });
  }

  refreshSummary() {
    if (!this.currentBatch) return;
    this.db.getShippingQueueSummary(this.currentBatch).subscribe(sum => {
      this.summary = sum;
      this.batchTotalValue = sum.expectedTotal;
    });
  }

  private closeBatchImpl() { this.viewingBatch = false; this.currentBatch = null; this.loadBatches(); }
  public closeBatch() { this.closeBatchImpl(); }

  onCheckChange(index: number, it: ShippingItem) {
    if (this.checked[index]) this.selectedIds.add(it.id);
    else this.selectedIds.delete(it.id);
  }

  get allChecked(): boolean { return this.items.length > 0 && this.checked.length === this.items.length && this.checked.every(c => c); }

  toggleAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.checked = this.items.map(() => checked);
    this.selectedIds.clear();
    if (checked) this.items.forEach(it => this.selectedIds.add(it.id));
  }

  saveItem(it: ShippingItem) {
    if (!this.canEditShippingFees()) return;
    const key = String(it.id);
    if (!this.isDirty(it)) return;
    this.savingItemId = it.id;
    const rows = this.getFeeUpdateRows(it);
    this.db.updateShippingQueueFees(rows).subscribe(ok => {
      this.savingItemId = null;
      if (!ok) { alert('Failed to save fee'); return; }
      this.editing.delete(key);
      this.originalFees.delete(key);
      this.savedFees.set(it.id, Number(it.fee ?? 0));
      this.savedItemIds.add(it.id);
      setTimeout(() => this.savedItemIds.delete(it.id), 700);
      if (it.batchName) this.refreshSummary();
    });
  }

  startEdit(it: ShippingItem) {
    const key = String(it.id);
    this.editing.add(key);
    this.originalFees.set(key, Number(it.fee ?? 0));
    // Clear the 0 value so user can type without manual deletion
    if (it.fee === 0) {
      it.fee = null as any;
    }
    // Focus the input after the view updates
    setTimeout(() => {
      const input = document.querySelector(`input[data-item-id="${it.id}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  onFeeInputFocus(event: any) {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  cancelEdit(it: ShippingItem) {
    const key = String(it.id);
    const saved = this.savedFees.get(it.id);
    it.fee = saved ?? 0;
    this.editing.delete(key);
    this.originalFees.delete(key);
  }

  saveSelected() {
    if (!this.canEditShippingFees()) return;
    const rows = this.items
      .filter((_, i) => this.checked[i] && this.isDirty(this.items[i]))
      .flatMap(it => this.getFeeUpdateRows(it));
    if (rows.length === 0) return;
    this.savingSelected = true;
    this.db.updateShippingQueueFees(rows).subscribe(ok => {
      this.savingSelected = false;
      if (!ok) { alert('Failed to save fees'); return; }
      for (const r of rows) {
        const key = String(r.id);
        this.savedFees.set(r.id, Number(r.fee ?? 0));
        this.editing.delete(key);
        this.originalFees.delete(key);
        this.savedItemIds.add(r.id);
        setTimeout(() => this.savedItemIds.delete(r.id), 700);
      }
      if (this.currentBatch) this.refreshSummary();
    });
  }

  saveAll() {
    if (!this.canEditShippingFees()) return;
    const rows = this.items.filter(it => this.isDirty(it)).flatMap(it => this.getFeeUpdateRows(it));
    if (rows.length === 0 || !this.currentBatch) return;
    this.savingAll = true;
    this.db.updateShippingQueueFees(rows).subscribe(ok => {
      this.savingAll = false;
      if (!ok) { alert('Failed to save fees'); return; }
      for (const r of rows) {
        const key = String(r.id);
        this.savedFees.set(r.id, Number(r.fee ?? 0));
        this.editing.delete(key);
        this.originalFees.delete(key);
        this.savedItemIds.add(r.id);
        setTimeout(() => this.savedItemIds.delete(r.id), 700);
      }
      if (this.currentBatch) this.refreshSummary();
      this.refreshItems();
    });
  }

  viewLedger() {
    this.viewingLedger = true;
    this.viewingBatch = false;
    this.loadLedgerForBatch();
  }

  // Sum of fees currently entered on the batch (reflects unsaved inputs too)
  // persisted canonical batch total (fetched from DB)
  batchTotalValue = 0;

  // Batch total comes from the backend summary for the whole batch, not the current page.
  get batchTotal(): number { return this.batchTotalValue || 0; }

  // total for the currently visible page (computed client-side)
  get pageTotal(): number { return (this.items || []).reduce((s, it) => s + (Number(it.fee || 0) * Number(it.quantity || 0)), 0); }

  get completedQty(): number { return this.summary.completedQty || 0; }
  get remainingQty(): number { return this.summary.remainingQty || 0; }

  isDirty(it: ShippingItem): boolean {
    const saved = Number(this.savedFees.get(it.id) ?? 0);
    return Number(it.fee ?? 0) !== saved;
  }

  get hasDirtyRows(): boolean {
    return (this.items || []).some(it => this.isDirty(it));
  }

  get hasDirtySelected(): boolean {
    return (this.items || []).some((it, i) => this.checked[i] && this.isDirty(it));
  }

  setItemPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalItemPages));
    if (next === this.itemPage) return;
    this.itemPage = next;
    this.refreshItems();
  }

  loadLedgerForBatch(batchName?: string) {
    this.db.getClientsShippingTotals(batchName || null).subscribe(l => { this.ledger = l; this.viewingLedger = true; });
  }

  closeLedger() {
    this.viewingLedger = false;
    this.loadBatches();
  }

  selectedItemForClientsModal: ShippingItem | null = null;
  clientsModalPage = 1;
  clientsModalPageSize = 20;

  get clientsModalTotalPages() {
    if (!this.selectedItemForClientsModal) return 1;
    return Math.ceil((this.selectedItemForClientsModal.clients.length || 0) / this.clientsModalPageSize) || 1;
  }

  get paginatedClientsModalData() {
    if (!this.selectedItemForClientsModal) return [];
    const start = (this.clientsModalPage - 1) * this.clientsModalPageSize;
    const end = start + this.clientsModalPageSize;
    return this.selectedItemForClientsModal.clients.slice(start, end).map(client => ({
      clientName: client.clientName,
      orderedQuantity: client.originalQuantity ?? client.quantity,
      shippingQuantity: client.quantity,
      shortfallQuantity: client.damagedQuantity || 0
    }));
  }

  get clientsModalMetadata(): TableMetadata | null {
    if (!this.selectedItemForClientsModal) return null;
    return {
      pageNumber: this.clientsModalPage,
      totalCount: this.selectedItemForClientsModal.clients.length,
      pageSize: this.clientsModalPageSize,
      totalPages: this.clientsModalTotalPages
    };
  }

  showClientsModal(it: ShippingItem) {
    this.selectedItemForClientsModal = it;
    this.clientsModalPage = 1;
  }

  closeClientsModal() {
    this.selectedItemForClientsModal = null;
    this.clientsModalPage = 1;
  }

  setClientsModalPage(page: number) {
    const next = Math.max(1, Math.min(page, this.clientsModalTotalPages));
    if (next === this.clientsModalPage) return;
    this.clientsModalPage = next;
  }

  get shippingStatCards(): StatCardConfig[] {
    return [
      { icon: 'payments', statName: 'Total Fee', statValue: this.batchTotal.toFixed(2), color: 'green' },
      { icon: 'check_circle', statName: 'Done', statValue: this.completedQty, color: 'green' },
      { icon: 'pending', statName: 'Remaining', statValue: this.remainingQty, color: 'orange' }
    ];
  }

  get shippingMetadata(): TableMetadata | null {
    if (!this.viewingBatch) return null;
    return {
      pageNumber: this.itemPage,
      totalCount: this.itemTotal,
      pageSize: this.itemPageSize,
      totalPages: this.totalItemPages
    };
  }

  get shippingTableFilters(): TableFilterConfig[] {
    return [
      {
        key: 'added',
        label: 'Added',
        value: this.filterShowOnlyAdded,
        options: [
          { label: 'Added', value: true },
          { label: 'Not Added', value: false }
        ]
      }
    ];
  }

  get shippingTableRows(): any[] {
    return this.items.map(item => ({
      ...item,
      clientsCount: item.clients.length,
      damages: item.damagedQty ? `${item.damagedQty} Damaged` : 'No Damage',
      damagesColor: item.damagedQty ? 'red' : 'gray',
      shippingTotal: ((Number(item.fee || 0) * Number(item.quantity || 0))).toFixed(2),
      feeDisabled: !this.canEditShippingFees() || this.savingItemId === item.id || this.savingSelected || this.savingAll,
      actions: [
        {
          id: 'view-clients',
          label: 'View Clients',
          icon: 'people',
          color: 'blue'
        },
        {
          id: 'save',
          label: 'Save',
          icon: 'floppy',
          color: 'green',
          disabled: !this.canEditShippingFees() || !this.isDirty(item) || this.savingSelected || this.savingAll,
          loading: this.savingItemId === item.id
        }
      ] as ActionOption[]
    }));
  }

  onShippingTableSearchChange(query: Record<string, string>) {
    this.searchTerm = (query['productName'] || '').trim();
    this.onFilterChange();
  }

  onShippingTableFilterChange(filters: Record<string, any>) {
    const next = filters['added'];
    this.filterShowOnlyAdded = next === undefined ? null : next;
    this.onFilterToggle();
  }

  onShippingDateChange(range: { from: string; to: string }) {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.itemPage = 1;
    this.refreshItems();
  }

  onShippingTableInputChange(event: { column: TableColumn; item: ShippingItem; value: any }) {
    if (!this.canEditShippingFees()) return;
    const target = this.items.find(item => item.id === event.item.id);
    if (!target) return;
    const key = event.column.key as keyof ShippingItem;
    (target as any)[key] = event.value;
  }

  onShippingTableActionClick(event: { action: ActionOption; item: ShippingItem }) {
    if (event.action.id === 'view-clients') {
      this.showClientsModal(event.item);
      return;
    }
    if (event.action.id === 'save') {
      this.saveItem(event.item);
    }
  }

  readonly shippingBatchTitleResolver = (batch: string) => batch;
  readonly shippingBatchIconResolver = () => 'local_shipping';
  readonly shippingBatchTagsResolver = (batch: string): BatchCardTagConfig[] => {
    const count = Number(this.batchCounts[batch] || 0);
    return [
      {
        tagName: `${count} Item${count !== 1 ? 's' : ''}`,
        color: count > 0 ? 'blue' : 'gray',
        icon: 'inventory_2'
      }
    ];
  };

  private getFeeUpdateRows(item: ShippingItem): Array<{ id: number; fee: number }> {
    const fee = item.fee ?? 0;
    const ids = (item.rowIds && item.rowIds.length > 0 ? item.rowIds : [item.id]).filter(Boolean);
    return ids.map(id => ({ id, fee }));
  }

  private initShippingColumns() {
    this.shippingColumns = [
      { key: 'productName', label: 'Product', type: 'string', searchable: true },
      { key: 'clientsCount', label: 'Clients', type: 'string' },
      { key: 'quantity', label: 'Qty', type: 'string' },
      { key: 'damages', label: 'Damages', type: 'status', statusColorKey: 'damagesColor' },
      {
        key: 'fee',
        label: 'Shipping Fee',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 0.01,
        inputPlaceholder: '0.00',
        inputUpdateOn: 'change',
        disabledKey: 'feeDisabled'
      },
      { key: 'shippingTotal', label: 'Total', type: 'string' },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];

    this.clientsModalColumns = [
      { key: 'clientName', label: 'Client', type: 'string' },
      { key: 'orderedQuantity', label: 'Ordered', type: 'string' },
      { key: 'shippingQuantity', label: 'Shipping Qty', type: 'string' },
      { key: 'shortfallQuantity', label: 'Shortfall', type: 'string' }
    ];
  }

  private canEditShippingFees(): boolean {
    return this.authService.canPerformShippingOperation('canEditShippingItem')
      || this.authService.canPerformShippingOperation('canChangeShippingValue');
  }
}
