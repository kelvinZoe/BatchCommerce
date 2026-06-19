import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchListSectionComponent,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import {
  ActionOption,
  TableColumn,
  TableComponent,
  TableFilterConfig,
  TableMetadata
} from '../../components/table/table.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { OrderBatch } from '../../models';

interface LedgerRow {
  // Aggregated per-client row
  clientId: number | null;
  clientName: string;
  clientPhone?: string | null;
  batchName: string | null;
  totalFee: number;
  paidAmount: number;
  status: 'unpaid'|'partial'|'paid';
  sentToDeliveries?: boolean;
  // Damage allocation data
  damagedQty?: number;       // Total damaged for this client in batch
  hasAllocation?: boolean;   // Whether this client has any damage allocation
}

@Component({
  selector: 'app-shipping-ledger',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, StatCardsComponent, TableComponent],
  template: `
    <div class="sl-page">
      <div class="sl-toast sl-toast-success" *ngIf="successMessage">
        <span class="material-icons">check_circle</span>
        <span>{{ successMessage }}</span>
      </div>

      <!-- PAGE HEADER -->
      <div class="sl-header">
        <div class="sl-header-left">
          <div class="sl-header-icon"><span class="material-icons">receipt_long</span></div>
          <div>
            <h1 class="sl-header-title">Shipping Ledger</h1>
            <p class="sl-header-sub">Track client shipping payments per batch</p>
          </div>
        </div>
      </div>

      <div class="sl-card">

        <!-- BATCHES VIEW -->
        <ng-container *ngIf="viewingBatches">
          <app-batch-list-section
            [loading]="loading"
            [items]="paginatedBatchItems"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="filteredBatches.length"
            [searchTerm]="batchSearchTerm"
            [selectedMonth]="batchFilterMonth"
            [selectedYear]="batchFilterYear"
            [currentYear]="currentYear"
            [searchPlaceholder]="'Search batches...'"
            [emptyTitle]="'No ledger batches yet'"
            [emptyDescription]="'Shipping fee batches will appear here once they are created.'"
            [titleResolver]="ledgerBatchTitleResolver"
            [subtitleResolver]="ledgerBatchSubtitleResolver"
            [iconResolver]="ledgerBatchIconResolver"
            [tagsResolver]="ledgerBatchTagsResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (dateSelectionChange)="onBatchMonthYearChange($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="openBatch($event)">
            <ng-template batchSectionFooter let-batch>
              <button class="sl-card-action-btn sl-cab-primary sl-open-btn" (click)="$event.stopPropagation(); openBatch(batch)">
                <span class="material-icons">open_in_new</span> View Ledger
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <!-- LEDGER VIEW -->
        <ng-container *ngIf="!viewingBatches">

          <!-- Detail header -->
          <div class="sl-detail-header">
            <button class="sl-back-btn" (click)="closeBatch()">
              <span class="material-icons">arrow_back</span> Batches
            </button>
            <div class="sl-detail-title-group">
              <div class="sl-detail-icon"><span class="material-icons">receipt_long</span></div>
              <div>
                <div class="sl-detail-name">{{ selectedBatch || 'All Batches' }}</div>
                <div class="sl-detail-sub">Client shipping payment records</div>
              </div>
            </div>
          </div>

          <app-stat-cards [config]="ledgerStatCards"></app-stat-cards>

          <app-table
            [columns]="ledgerColumns"
            [data]="ledgerTableRows"
            [metadata]="ledgerMetadata"
            [filters]="ledgerFilters"
            [showSearchRow]="true"
            [initialLoading]="loading && ledgerTableRows.length === 0"
            [searching]="searchLoading || (loading && ledgerTableRows.length > 0)"
            [skeletonRows]="5"
            [tableLabel]="'Client Ledger'"
            [summaryLabel]="'Clients'"
            [summaryValue]="displayRows.length"
            (searchChange)="onLedgerTableSearchChange($event)"
            (filterChange)="onLedgerTableFilterChange($event)"
            (inputChange)="onLedgerTableInputChange($event)"
            (actionClick)="onLedgerTableActionClick($event)"
            (pageChange)="setItemPage($event)">
          </app-table>
        </ng-container>

    <!-- ITEMS MODAL (outside card, full-screen overlay) -->
    <div class="sl-modal-overlay" *ngIf="showItemsModal" (click)="closeItemsModal()">
      <div class="sl-modal" (click)="$event.stopPropagation()">
        <div class="sl-modal-header">
          <div class="sl-modal-title-group">
            <div class="sl-modal-avatar">{{ (modalClientName || '?').charAt(0).toUpperCase() }}</div>
            <div>
              <div class="sl-modal-name">{{ modalClientName }}</div>
              <div class="sl-modal-phone" *ngIf="modalClientPhone">
                <span class="material-icons" style="font-size:13px;vertical-align:middle;margin-right:2px">phone</span>{{ modalClientPhone }}
              </div>
            </div>
          </div>
          <button class="sl-modal-close" (click)="closeItemsModal()"><span class="material-icons">close</span></button>
        </div>

        <div class="sl-modal-body">
          <div class="sl-modal-section-lbl">Order Items</div>
          <div *ngIf="modalItems.length; else noItems" class="sl-modal-items">
            <div class="sl-modal-item" *ngFor="let it of modalItems; let i = index">
              <div class="sl-modal-item-num">{{ i + 1 }}</div>
              <div class="sl-modal-item-name">{{ it.productName }}</div>
              <div class="sl-modal-item-qty">×{{ it.quantity }}</div>
              <div class="sl-modal-item-price">{{ ((it.fee || 0) * (it.quantity || 0)) | number:'1.2-2' }}</div>
            </div>
          </div>
          <ng-template #noItems><div class="sl-modal-empty">No items found</div></ng-template>

          <div class="sl-modal-summary" *ngIf="modalRow">
            <div class="sl-modal-sum-row"><span>Total</span><strong>{{ modalRow.totalFee | number:'1.2-2' }}</strong></div>
            <div class="sl-modal-sum-row"><span>Paid</span><strong class="sl-sum-paid">{{ modalRow.paidAmount | number:'1.2-2' }}</strong></div>
            <div class="sl-modal-sum-row sl-sum-balance-row">
              <span>Balance</span>
              <strong [class.sl-sum-zero]="(modalRow.totalFee - modalRow.paidAmount) === 0"
                      [class.sl-sum-due]="(modalRow.totalFee - modalRow.paidAmount) > 0">{{ (modalRow.totalFee - modalRow.paidAmount) | number:'1.2-2' }}</strong>
            </div>
          </div>
        </div>

        <div class="sl-modal-footer">
          <button class="sl-modal-btn sl-modal-btn-wa" (click)="sendWhatsappMessage()" [disabled]="!modalClientPhone">
            <span class="material-icons" style="font-size:15px">chat</span> WhatsApp
          </button>
          <button class="sl-modal-btn sl-modal-btn-copy" (click)="copyLedgerMessage()">
            <span class="material-icons" style="font-size:15px">content_copy</span> Copy
          </button>
          <button class="sl-modal-btn sl-modal-btn-close" (click)="closeItemsModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* PAGE */
    .sl-page { position: relative; }
    .sl-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .sl-header-left { display: flex; align-items: center; gap: 14px; }
    .sl-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .sl-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .sl-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }

    .sl-toast {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 1100;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid transparent;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
      font-size: 13px;
      font-weight: 700;
      animation: sl-toast-in 0.18s ease-out;
    }

    .sl-toast .material-icons {
      font-size: 18px;
    }

    .sl-toast-success {
      background: #ecfdf5;
      color: #166534;
      border-color: #bbf7d0;
    }

    @keyframes sl-toast-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* CARD */
    .sl-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    .sl-card-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.12s; }
    .sl-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .sl-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .sl-open-btn { width: 100%; justify-content: center; }

    /* DETAIL HEADER */
    .sl-detail-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ccc; margin-bottom: 16px; flex-wrap: wrap; }
    .sl-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: 1px solid #ccc; border-radius: 9px; background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; }
    .sl-back-btn:hover { background: #e2e8f0; }
    .sl-back-btn .material-icons { font-size: 16px; }
    .sl-detail-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .sl-detail-icon { width: 36px; height: 36px; border-radius: 9px; background: rgba(99,102,241,0.1); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .sl-detail-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .sl-detail-sub { font-size: 11px; color: #94a3b8; }
    /* MODAL */
    .sl-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); }
    .sl-modal { background: #fff; border-radius: 16px; width: 480px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.18); overflow: hidden; display: flex; flex-direction: column; }
    .sl-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 16px; border-bottom: 1px solid #f1f5f9; background: linear-gradient(135deg, #f8faff 0%, #fff 100%); }
    .sl-modal-title-group { display: flex; align-items: center; gap: 12px; }
    .sl-modal-avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; flex-shrink: 0; }
    .sl-modal-name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .sl-modal-phone { font-size: 12px; color: #64748b; margin-top: 2px; }
    .sl-modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; border-radius: 6px; line-height: 0; }
    .sl-modal-close:hover { background: #f1f5f9; color: #475569; }
    .sl-modal-body { padding: 20px; overflow-y: auto; max-height: 55vh; }
    .sl-modal-section-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 10px; }
    .sl-modal-items { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .sl-modal-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .sl-modal-item-num { width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; color: #64748b; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sl-modal-item-name { flex: 1; font-size: 13px; font-weight: 500; color: #1e293b; }
    .sl-modal-item-qty { background: rgba(99,102,241,0.12); color: var(--primary-dark, #4f46e5); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
    .sl-modal-item-price { font-size: 13px; font-weight: 700; color: #0f172a; min-width: 70px; text-align: right; }
    .sl-modal-empty { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
    .sl-modal-summary { border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; flex-direction: column; gap: 4px; }
    .sl-modal-sum-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; color: #64748b; }
    .sl-modal-sum-row strong { color: #0f172a; font-size: 14px; }
    .sl-sum-balance-row { border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 10px; }
    .sl-sum-paid { color: #059669 !important; }
    .sl-sum-zero { color: #059669 !important; }
    .sl-sum-due { color: #dc2626 !important; }
    .sl-modal-footer { padding: 14px 20px; border-top: 1px solid #f1f5f9; background: #fafafa; display: flex; justify-content: flex-end; gap: 8px; }
    .sl-modal-btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
    .sl-modal-btn-wa { background: #25d366; color: #fff; }
    .sl-modal-btn-wa:hover:not(:disabled) { background: #1ebe5d; }
    .sl-modal-btn-wa:disabled { opacity: 0.45; cursor: default; }
    .sl-modal-btn-copy { background: rgba(99,102,241,0.12); color: var(--primary-dark, #4f46e5); }
    .sl-modal-btn-copy:hover { background: rgba(99,102,241,0.22); }
    .sl-modal-btn-close { background: #f1f5f9; color: #475569; }
    .sl-modal-btn-close:hover { background: #e2e8f0; }
  `]
})
export class ShippingLedgerComponent implements OnInit, OnDestroy {
  loading = true;
  viewingBatches = true;
  viewingBatch = false;
  batchPage = 1;
  batchPageSize = 20;
  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();
  rows: LedgerRow[] = [];
  allRows: LedgerRow[] = [];
  displayRows: LedgerRow[] = [];
  searchTerm = '';
  statusFilter: 'all'|'unpaid'|'partial'|'paid' = 'all';
  itemPage = 1;
  itemPageSize = 20;
  pageSizeOptions: number[] = [5, 10, 20, 50];
  Math = Math;
  Number = Number;
  ledgerColumns: TableColumn[] = [];
  batches: OrderBatch[] = [];
  selectedBatch: string | null = null;
  sendingKeys = new Set<string>();
  searchLoading = false;
  clientItems: { [clientId: string]: Array<{ productName: string; fee: number; quantity: number }> } = {};
  batchCounts: { [k: string]: number } = {};
  totalExpected = 0;
  totalReceived = 0;
  currentExpected = 0;
  currentReceived = 0;
  previousExpected = 0;
  previousReceived = 0;
  unpaidCount = 0;
  totalCount = 0;
  // per-client save debounce timers and states
  private saveTimers: { [clientKey: string]: any } = {};
  private searchTimer: any = null;
  savingSet = new Set<string>();
  pendingSet = new Set<string>();
  recentlySaved = new Set<string>();
  successMessage: string | null = null;
  private successTimer: any = null;

  get paginatedDisplayRows() { const s = (this.itemPage-1)*this.itemPageSize; return this.displayRows.slice(s, s+this.itemPageSize); }

  get filteredBatches() {
    const term = this.batchSearchTerm.trim().toLowerCase();
    return this.batches.filter(batch => {
      if (term && !batch.name.toLowerCase().includes(term)) {
        return false;
      }

      if (this.batchFilterMonth === null || this.batchFilterYear === null) {
        return true;
      }

      if (!batch.createdAt) {
        return false;
      }

      const createdAt = new Date(batch.createdAt);
      return createdAt.getFullYear() === this.batchFilterYear && createdAt.getMonth() === this.batchFilterMonth;
    });
  }

  get paginatedBatchItems() {
    const start = (this.batchPage - 1) * this.batchPageSize;
    return this.filteredBatches.slice(start, start + this.batchPageSize);
  }

  get totalBatchPages() { return Math.ceil(this.filteredBatches.length / this.batchPageSize) || 1; }

  constructor(
    private db: DatabaseService,
    public authService: AuthService
  ) {
    this.initLedgerColumns();
  }

  get canEditLedger(): boolean {
    // Composite check: user must have at least one edit permission
    return this.authService.canPerformShippingLedgerOperation('canAddAmountPaid') ||
           this.authService.canPerformShippingLedgerOperation('canMoveToDeliveries') ||
           this.authService.canPerformShippingLedgerOperation('canEditAmountPaidAfterMove');
  }

  get currentBatchLabel(): string {
    return this.selectedBatch ? `Current: ${this.selectedBatch}` : 'Current Batch';
  }

  get ledgerStatCards(): StatCardConfig[] {
    return [
      { icon: 'payments', statName: 'Total Expected', statValue: this.totalExpected.toFixed(2), color: 'blue' },
      { icon: 'task_alt', statName: 'Total Received', statValue: this.totalReceived.toFixed(2), color: 'green' },
      { icon: 'groups', statName: 'Clients', statValue: this.totalCount, color: 'base' },
      { icon: 'pending_actions', statName: 'Unpaid', statValue: this.unpaidCount, color: 'orange' }
    ];
  }

  get ledgerMetadata(): TableMetadata | null {
    if (this.viewingBatches) return null;
    const totalPages = Math.ceil(this.displayRows.length / this.itemPageSize) || 1;
    return {
      pageNumber: this.itemPage,
      totalCount: this.displayRows.length,
      pageSize: this.itemPageSize,
      totalPages
    };
  }

  get ledgerFilters(): TableFilterConfig[] {
    return [
      {
        key: 'status',
        label: 'All statuses',
        value: this.statusFilter,
        disableAll: true,
        options: [
          { label: 'All statuses', value: 'all' },
          { label: 'Unpaid', value: 'unpaid' },
          { label: 'Partial', value: 'partial' },
          { label: 'Paid', value: 'paid' }
        ]
      }
    ];
  }

  get ledgerTableRows(): any[] {
    return this.paginatedDisplayRows.map(row => {
      const key = this.rowKey(row);
      return {
        ledgerKey: key,
        clientName: row.clientName,
        batchName: row.batchName || '—',
        totalFee: Number(row.totalFee || 0).toFixed(2),
        paidAmount: Number(row.paidAmount || 0),
        balance: Math.max(0, Number(row.totalFee || 0) - Number(row.paidAmount || 0)).toFixed(2),
        damages: row.damagedQty ? `${row.damagedQty} Damaged` : 'No Damage',
        damagesColor: row.damagedQty ? 'red' : 'gray',
        status: row.status,
        sentToDeliveries: row.sentToDeliveries ? 'Sent' : 'Pending',
        deliveryColor: row.sentToDeliveries ? 'blue' : 'gray',
        paidDisabled: !this.canEditPaidAmount(row) || this.sendingKeys.has(key) || this.savingSet.has(key),
        actions: [
          {
            id: 'view-items',
            label: 'View Items',
            icon: 'eye',
            color: 'blue'
          },
          {
            id: 'send-to-deliveries',
            label: 'Send to Deliveries',
            icon: 'truck',
            color: 'green',
            disabled: !this.authService.canPerformShippingLedgerOperation('canMoveToDeliveries') || !!row.sentToDeliveries || row.status !== 'paid' || this.sendingKeys.has(key) || this.pendingSet.has(key) || this.savingSet.has(key) || !row.clientId || !row.batchName,
            loading: this.sendingKeys.has(key)
          }
        ] as ActionOption[]
      };
    });
  }

  ngOnInit(): void { 
    this.loadBatches();
    // Reload batches when a batch is deleted elsewhere
    this.db.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  ngOnDestroy(): void {
    // clear any pending timers
    for (const k of Object.keys(this.saveTimers)) {
      clearTimeout(this.saveTimers[k]);
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
    this.saveTimers = {};
  }

  loadBatches() {
    this.loading = true;
    this.db.getShippingLedgerBatches().subscribe(bs => {
      this.batches = bs || [];
      this.db.getShippingLedgerCounts().subscribe(cnts => {
        this.batchCounts = cnts || {};
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

  onBatchMonthYearChange(selection: { month: number | null; year: number | null }) {
    this.batchFilterMonth = selection.month;
    this.batchFilterYear = selection.year;
    this.batchPage = 1;
  }

  setBatchPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalBatchPages));
    if (next === this.batchPage) return;
    this.batchPage = next;
  }

  setItemPage(page: number) {
    const totalPages = this.ledgerMetadata?.totalPages || 1;
    const next = Math.max(1, Math.min(page, totalPages));
    if (next === this.itemPage) return;
    this.itemPage = next;
  }

  loadLedger() {
    this.loading = true;
    // ensure batches are loaded then fetch ledger for selected batch
    this.db.getShippingLedgerBatches().subscribe(bs => {
      this.batches = bs || [];
      this.db.getShippingLedgerCounts().subscribe(cnts => { this.batchCounts = cnts || {}; });
      this.fetchLedgerTotals();
      this.fetchLedgerFromDb(true, false);
    });
  }

  private refreshLedgerSilently() {
    this.fetchLedgerFromDb(false, true);
    this.fetchLedgerTotals();
  }

  private fetchLedgerTotals() {
    this.db.getShippingLedger(this.selectedBatch ?? null, null, 'all').subscribe(rows => {
      this.allRows = (rows || []) as LedgerRow[];
      this.computeTotals();
    });
  }

  private fetchLedgerFromDb(resetPage = true, silent = false) {
    if (!silent) this.loading = true;
    this.db.getShippingLedger(this.selectedBatch ?? null, this.searchTerm, this.statusFilter).subscribe(rows => {
      this.rows = (rows || []) as LedgerRow[];
      this.enrichRowsWithDamageData();
      this.applyFilters(resetPage);
      this.loading = false;
      this.searchLoading = false;
    });
  }

  private enrichRowsWithDamageData() {
    // Get all damage allocations for the selected batch to enrich rows
    if (!this.selectedBatch) return;
    
    // For now, we'll mark rows with damage based on simple logic
    // In a real scenario, you might fetch damage allocations separately
    // and map them to the rows
    this.rows.forEach(row => {
      row.damagedQty = row.damagedQty || 0;
      row.hasAllocation = (row.damagedQty || 0) > 0;
    });
  }

  applyFilters(resetPage = true) {
    this.displayRows = this.rows || [];
    if (resetPage) {
      this.itemPage = 1;
    } else {
      const maxPage = Math.ceil(this.displayRows.length / this.itemPageSize) || 1;
      if (this.itemPage > maxPage) this.itemPage = maxPage;
    }
    this.computeTotals();
  }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchLoading = true;
    this.searchTimer = setTimeout(() => {
      this.fetchLedgerFromDb(true, true);
    }, 1000);
  }

  onStatusChange() {
    this.fetchLedgerFromDb(true, true);
  }

  onLedgerTableSearchChange(query: Record<string, string>) {
    this.searchTerm = (query['clientName'] || '').trim();
    this.onSearchChange();
  }

  onLedgerTableFilterChange(filters: Record<string, any>) {
    this.statusFilter = (filters['status'] || 'all') as 'all'|'unpaid'|'partial'|'paid';
    this.onStatusChange();
  }

  onLedgerTableInputChange(event: { column: TableColumn; item: any; value: any }) {
    const target = this.findLedgerRowByKey(event.item?.ledgerKey);
    if (!target) return;
    this.onPaidChange(target, event.value);
  }

  onLedgerTableActionClick(event: { action: ActionOption; item: any }) {
    const target = this.findLedgerRowByKey(event.item?.ledgerKey);
    if (!target) return;
    if (event.action.id === 'view-items') {
      this.toggleItems(target);
      return;
    }
    if (event.action.id === 'send-to-deliveries') {
      this.sendToDeliveries(target);
    }
  }

  computeTotals() {
    const rows = (this.allRows && this.allRows.length > 0) ? this.allRows : (this.rows || []);
    this.totalExpected = rows.reduce((s, r) => s + Number(r.totalFee || 0), 0);
    this.totalReceived = rows.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
    if (this.selectedBatch) {
      const currentRows = rows.filter(r => r.batchName === this.selectedBatch);
      const prevRows = rows.filter(r => r.batchName !== this.selectedBatch);
      this.currentExpected = currentRows.reduce((s, r) => s + Number(r.totalFee || 0), 0);
      this.currentReceived = currentRows.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
      this.previousExpected = prevRows.reduce((s, r) => s + Number(r.totalFee || 0), 0);
      this.previousReceived = prevRows.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
    } else {
      this.currentExpected = this.totalExpected;
      this.currentReceived = this.totalReceived;
      this.previousExpected = 0;
      this.previousReceived = 0;
    }
    this.totalCount = rows.length;
    this.unpaidCount = rows.filter(r => r.status !== 'paid').length;
  }

  onPaidInputFocus(r: LedgerRow) {
    // Clear 0 value on focus
    if (Number(r.paidAmount ?? 0) === 0) {
      r.paidAmount = null as any;
    }
  }

  rowKey(r: LedgerRow): string {
    const cid = r.clientId == null ? '__no' : String(r.clientId);
    const bname = r.batchName || '';
    return `${cid}::${bname}`;
  }

  onPaidChange(r: LedgerRow, val: number | string) {
    if (!this.canEditPaidAmount(r)) return;
    const paid = Number(val || 0);
    let newPaid = isNaN(paid) ? 0 : paid;
    if ((r.totalFee || 0) === 0) {
      // zero-fee items are considered paid by default
      r.paidAmount = 0;
      r.status = 'paid';
    } else {
      if (newPaid > (r.totalFee || 0)) newPaid = Number(r.totalFee || 0);
      r.paidAmount = newPaid;
      if (r.paidAmount <= 0) r.status = 'unpaid';
      else if (r.paidAmount >= (r.totalFee || 0)) r.status = 'paid';
      else r.status = 'partial';
    }
    this.syncLedgerRowState(r);
    this.computeTotals();
    this.scheduleClientSave(r);
  }

  private scheduleClientSave(r: LedgerRow) {
    const key = this.rowKey(r);
    this.pendingSet.add(key);
    if (this.saveTimers[key]) clearTimeout(this.saveTimers[key]);
    this.saveTimers[key] = setTimeout(() => {
      delete this.saveTimers[key];
      this.pendingSet.delete(key);
      this.performClientSave(r);
    }, 1000);
  }

  private performClientSave(r: LedgerRow) {
    const key = this.rowKey(r);
    this.savingSet.add(key);
    if (!this.canEditPaidAmount(r)) { this.savingSet.delete(key); return; }
    const clientId = r.clientId ?? 0;
    if (!clientId) { this.savingSet.delete(key); return; }
    this.db.saveClientPayments(r.batchName ?? null, clientId, Number(r.paidAmount || 0)).subscribe(ok => {
      this.savingSet.delete(key);
      if (!ok) { alert('Failed to save payment'); return; }
      this.recentlySaved.add(key);
      setTimeout(() => this.recentlySaved.delete(key), 1500);
      this.showSuccess('Payment saved successfully.');
      this.refreshLedgerSilently();
    });
  }

  sendToDeliveries(r: LedgerRow) {
    if (!r.clientId || !r.batchName) return;
    if (!this.authService.canPerformShippingLedgerOperation('canMoveToDeliveries')) return;
    if (r.sentToDeliveries || r.status !== 'paid') return;
    const key = this.rowKey(r);
    if (this.sendingKeys.has(key)) return;
    this.sendingKeys.add(key);
    this.db.sendPaidClientToDeliveries(r.batchName, r.clientId).subscribe(ok => {
      this.sendingKeys.delete(key);
      if (!ok) { alert('Failed to send to deliveries'); return; }
      r.sentToDeliveries = true;
      this.syncLedgerRowState(r);
      this.computeTotals();
      this.showSuccess('Sent to deliveries successfully.');
    });
  }

  toggleItems(r: LedgerRow) {
    this.openItemsModal(r);
  }

  private canEditPaidAmount(row: LedgerRow): boolean {
    if (!this.authService.canPerformShippingLedgerOperation('canAddAmountPaid')) return false;
    if (!row.sentToDeliveries) return true;
    return this.authService.canPerformShippingLedgerOperation('canEditAmountPaidAfterMove');
  }

  private async ensureClientItems(row: LedgerRow): Promise<Array<{ productName: string; fee: number; quantity: number }>> {
    const key = this.rowKey(row);
    if (!this.clientItems[key] || this.clientItems[key].length === 0) {
      if (row.clientId != null) {
        const includeDelivered = !!row.sentToDeliveries;
        await this.db.getShippingItemsForClient(row.batchName ?? null, row.clientId, includeDelivered)
          .toPromise()
          .then(items => this.clientItems[key] = items || []);
      } else {
        this.clientItems[key] = [];
      }
    }
    return this.clientItems[key] || [];
  }

  private buildLedgerMessage(row: LedgerRow, items: Array<{ productName: string; fee: number; quantity: number }>): string {
    const clientName = row.clientName || 'Client';
    let body = `Hello ${clientName},\n\nYour shipping fees:\n`;
    if (row.batchName) body += `Batch: ${row.batchName}\n`;
    items.forEach(it => {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.fee || 0);
      const lineTotal = unit * qty;
      body += `- ${it.productName} x${qty} @ ${unit.toFixed(2)} = ${lineTotal.toFixed(2)}\n`;
    });
    const total = Number(row.totalFee || 0);
    const paid = Number(row.paidAmount || 0);
    const bal = total - paid;
    body += `\nTotal: ${total.toFixed(2)}\nPaid: ${paid.toFixed(2)}\nBalance: ${bal.toFixed(2)}\n\nThank you.`;
    return body;
  }

  async copyLedgerMessage() {
    const row = this.modalRow;
    if (!row) return;
    const items = await this.ensureClientItems(row);
    const body = this.buildLedgerMessage(row, items);
    try {
      await navigator.clipboard.writeText(body);
      alert('Message copied to clipboard');
    } catch (e) {
      // fallback: prompt
      prompt('Copy message', body);
    }
  }

  async sendWhatsappMessage() {
    const row = this.modalRow;
    if (!row) return;
    const phone = (row.clientPhone || '').replace(/\D/g, '');
    if (!phone) {
      alert('No WhatsApp number for this client');
      return;
    }
    const items = await this.ensureClientItems(row);
    const body = this.buildLedgerMessage(row, items);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  }

  // Modal state for items
  showItemsModal = false;
  modalClientId: number | null = null;
  modalClientName = '';
  modalClientPhone = '';
  modalBatchName: string | null = null;
  modalRow: LedgerRow | null = null;
  modalRowKey = '';
  modalItems: Array<{ productName: string; fee: number; quantity: number }> = [];

  openItemsModal(r: LedgerRow) {
    this.modalRow = r;
    this.modalRowKey = this.rowKey(r);
    this.modalClientId = r.clientId ?? null;
    this.modalBatchName = r.batchName ?? null;
    this.modalClientName = r.clientName || 'Client';
    this.modalClientPhone = r.clientPhone || '';
    const key = this.modalRowKey;
    if (this.clientItems[key]) {
      this.modalItems = this.clientItems[key];
      this.showItemsModal = true;
      return;
    }
    if (r.clientId == null) { this.modalItems = []; this.showItemsModal = true; return; }
    const includeDelivered = !!r.sentToDeliveries;
    this.db.getShippingItemsForClient(r.batchName ?? null, r.clientId, includeDelivered).subscribe(items => {
      this.clientItems[key] = items || [];
      this.modalItems = this.clientItems[key];
      this.showItemsModal = true;
    });
  }

  closeItemsModal() {
    this.showItemsModal = false;
    this.modalClientId = null;
    this.modalBatchName = null;
    this.modalRow = null;
    this.modalRowKey = '';
    this.modalClientName = '';
    this.modalClientPhone = '';
    this.modalItems = [];
  }

  viewBatch(batch: OrderBatch | string | null) {
    this.selectedBatch = typeof batch === 'string' ? batch : batch?.name || null;
    this.loadLedger();
  }

  readonly ledgerBatchTitleResolver = (batch: OrderBatch) => batch.name;
  readonly ledgerBatchSubtitleResolver = (batch: OrderBatch) =>
    batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  readonly ledgerBatchIconResolver = () => 'receipt_long';
  readonly ledgerBatchTagsResolver = (batch: OrderBatch): BatchCardTagConfig[] => {
    const count = Number(this.batchCounts[batch.name] || 0);
    return [{
      tagName: `${count} ${count === 1 ? 'Entry' : 'Entries'}`,
      color: count > 0 ? 'blue' : 'gray',
      icon: 'receipt_long'
    }];
  };

  openBatch(batch: OrderBatch | string | null) {
    this.selectedBatch = typeof batch === 'string' ? batch : batch?.name || null;
    this.viewingBatches = false;
    this.viewingBatch = true;
    this.itemPage = 1;
    this.loadLedger();
  }

  

  closeBatch() {
    this.viewingBatches = true;
    this.viewingBatch = false;
    this.selectedBatch = null;
    this.loadBatches();
  }

  onBatchSelect(e: Event) {
    const val = (e.target as HTMLSelectElement)?.value ?? '';
    if (!val) this.openBatch(null);
    else this.openBatch(val);
  }

  private initLedgerColumns() {
    this.ledgerColumns = [
      { key: 'clientName', label: 'Client', type: 'string', searchable: true },
      { key: 'batchName', label: 'Batch', type: 'string' },
      { key: 'damages', label: 'Damages', type: 'status', statusColorKey: 'damagesColor' },
      { key: 'totalFee', label: 'Total Fee', type: 'string' },
      {
        key: 'paidAmount',
        label: 'Paid',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 0.01,
        inputPlaceholder: '0.00',
        inputUpdateOn: 'change',
        disabledKey: 'paidDisabled'
      },
      { key: 'balance', label: 'Balance', type: 'string' },
      {
        key: 'status',
        label: 'Status',
        type: 'status',
        statusOptions: [
          { value: 'unpaid', label: 'Unpaid', color: 'red' },
          { value: 'partial', label: 'Partial', color: 'orange' },
          { value: 'paid', label: 'Paid', color: 'green' }
        ]
      },
      { key: 'sentToDeliveries', label: 'Delivery', type: 'status', statusColorKey: 'deliveryColor' },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];
  }

  private findLedgerRowByKey(key: string | undefined): LedgerRow | undefined {
    if (!key) return undefined;
    return this.rows.find(row => this.rowKey(row) === key)
      || this.displayRows.find(row => this.rowKey(row) === key)
      || this.allRows.find(row => this.rowKey(row) === key);
  }

  private syncLedgerRowState(source: LedgerRow) {
    const key = this.rowKey(source);
    [this.rows, this.displayRows, this.allRows].forEach(collection => {
      const match = collection.find(row => this.rowKey(row) === key);
      if (!match || match === source) return;
      match.paidAmount = source.paidAmount;
      match.status = source.status;
      match.sentToDeliveries = source.sentToDeliveries;
      match.damagedQty = source.damagedQty;
      match.hasAllocation = source.hasAllocation;
    });
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.successTimer = setTimeout(() => {
      this.successMessage = null;
      this.successTimer = null;
    }, 2200);
  }
}
