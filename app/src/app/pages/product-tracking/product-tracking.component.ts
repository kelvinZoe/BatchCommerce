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
import { ActionOption, TableColumn, TableComponent, TableMetadata } from '../../components/table/table.component';
import { DatabaseService } from '../../services/database.service';
import { OrderBatch } from '../../models';

interface TrackingItem {
  id: number;
  batchId: number;
  batchProductId: number;
  productId: number;
  productName: string;
  confirmedQty: number;
  damagedQty?: number;
  hasAllocation?: boolean;
  trackingNumber: string;
  measurements: string;
  cbm: number;
  moq: number;
}

@Component({
  selector: 'app-product-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, DateFilterComponent, StatCardsComponent, TableComponent],
  template: `
    <div class="pt-page">

      <!-- PAGE HEADER -->
      <div class="pt-header">
        <div class="pt-header-left">
          <div class="pt-header-icon"><span class="material-icons">local_shipping</span></div>
          <div>
            <h1 class="pt-header-title">Product Tracking</h1>
            <p class="pt-header-sub">Manage shipment details for confirmed arrivals</p>
          </div>
        </div>
        <div class="pt-header-actions">
          <button class="pt-btn pt-btn-primary"
                  *ngIf="selectedBatch"
                  [disabled]="items.length === 0 || savingAll || loadingItems"
                  (click)="saveAll()">
            <span class="pt-spinner" *ngIf="savingAll"></span>
            <span class="material-icons" *ngIf="!savingAll">save</span>
            {{ savingAll ? 'Saving...' : 'Save Page' }}
          </button>
        </div>
      </div>

      <div class="pt-card">

        <!-- BATCHES VIEW -->
        <ng-container *ngIf="!selectedBatch">
          <app-batch-list-section
            [loading]="loadingBatches"
            [items]="batches"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="batchTotal"
            [searchTerm]="batchSearchTerm"
            [showDateFilter]="false"
            [searchPlaceholder]="'Search batches...'"
            [emptyTitle]="'No tracking batches yet'"
            [emptyDescription]="'Confirm arrivals to start tracking products.'"
            [titleResolver]="trackingBatchTitleResolver"
            [subtitleResolver]="trackingBatchSubtitleResolver"
            [iconResolver]="trackingBatchIconResolver"
            [tagsResolver]="trackingBatchTagsResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="viewBatchItems($event)">
            <ng-template batchSectionFooter let-batch>
              <button class="pt-card-action-btn pt-cab-primary pt-open-btn" (click)="$event.stopPropagation(); viewBatchItems(batch)">
                <span class="material-icons">open_in_new</span> View Tracking
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <!-- ITEMS VIEW -->
        <ng-container *ngIf="selectedBatch">

          <div class="pt-detail-header">
            <button class="pt-back-btn" (click)="closeBatch()">
              <span class="material-icons">arrow_back</span> Batches
            </button>
            <div class="pt-detail-title-group">
              <div class="pt-detail-icon"><span class="material-icons">local_shipping</span></div>
              <div>
                <div class="pt-detail-name">{{ selectedBatch.name }}</div>
                <div class="pt-detail-sub">Track shipment details for confirmed items</div>
              </div>
            </div>
          </div>

          <app-stat-cards [config]="trackingStatCards"></app-stat-cards>

          <app-table
            [columns]="trackingColumns"
            [data]="trackingTableRows"
            [metadata]="trackingMetadata"
            [showSearchRow]="true"
            [initialLoading]="loadingItems && trackingTableRows.length === 0"
            [searching]="loadingItems && trackingTableRows.length > 0"
            [skeletonRows]="4"
            [tableLabel]="'Tracked Products'"
            [summaryLabel]="'Items'"
            [summaryValue]="itemTotal"
            [showToolbarStart]="true"
            (searchChange)="onTrackingTableSearchChange($event)"
            (inputChange)="onTrackingTableInputChange($event)"
            (actionClick)="onTrackingTableActionClick($event)"
            (pageChange)="setItemPage($event)">
            <app-date-filter table-toolbar-start (dateChange)="onDateChange($event)"></app-date-filter>
          </app-table>

        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .pt-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    .pt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .pt-header-left { display: flex; align-items: center; gap: 14px; }
    .pt-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .pt-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .pt-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    .pt-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

    .pt-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.13s, opacity 0.13s; }
    .pt-btn .material-icons { font-size: 18px; }
    .pt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pt-btn-primary { background: var(--primary-color, #6366f1); color: #fff; }
    .pt-btn-primary:hover:not(:disabled) { background: var(--primary-dark, #4f46e5); }
    .pt-card-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.12s; }
    .pt-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .pt-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .pt-open-btn { width: 100%; justify-content: center; }

    .pt-detail-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ccc; margin-bottom: 16px; flex-wrap: wrap; }
    .pt-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: 1px solid #ccc; border-radius: 9px; background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; }
    .pt-back-btn:hover { background: #e2e8f0; }
    .pt-back-btn .material-icons { font-size: 16px; }
    .pt-detail-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .pt-detail-icon { width: 36px; height: 36px; border-radius: 9px; background: rgba(var(--primary-rgb, 99,102,241), 0.1); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .pt-detail-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .pt-detail-sub { font-size: 11px; color: #94a3b8; }
    .pt-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: pt-spin 0.6s linear infinite; display: inline-block; flex-shrink: 0; }
    @keyframes pt-spin { to { transform: rotate(360deg); } }
  `]
})
export class ProductTrackingComponent implements OnInit {
  loadingBatches = true;
  loadingItems = false;

  batches: OrderBatch[] = [];
  batchStats: { [batchName: string]: { count: number; tracked: number } } = {};

  selectedBatch: OrderBatch | null = null;
  batchSearchTerm = '';

  searchTerm = '';
  dateFrom = '';
  dateTo = '';

  batchPage = 1;
  batchPageSize = 20;
  batchTotal = 0;

  itemPage = 1;
  itemPageSize = 20;
  itemTotal = 0;

  items: TrackingItem[] = [];
  trackingColumns: TableColumn[] = [];

  savingIds = new Set<number>();
  savedIds = new Set<number>();
  savingAll = false;

  constructor(private db: DatabaseService) {}

  ngOnInit(): void {
    this.initTrackingColumns();
    this.loadBatches();
    
    // Reload batches when a batch is deleted elsewhere
    this.db.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  get totalBatchPages() { return Math.max(1, Math.ceil(this.batchTotal / this.batchPageSize)); }

  get totalItemPages() { return Math.max(1, Math.ceil(this.itemTotal / this.itemPageSize)); }

  get batchRangeStart() {
    if (this.batchTotal === 0) return 0;
    return (this.batchPage - 1) * this.batchPageSize + 1;
  }

  get batchRangeEnd() {
    return Math.min(this.batchPage * this.batchPageSize, this.batchTotal);
  }

  get itemRangeStart() {
    if (this.itemTotal === 0) return 0;
    return (this.itemPage - 1) * this.itemPageSize + 1;
  }

  get itemRangeEnd() {
    return Math.min(this.itemPage * this.itemPageSize, this.itemTotal);
  }

  get trackingStatCards(): StatCardConfig[] {
    const stats = this.selectedBatch ? (this.batchStats[this.selectedBatch.name] || { count: 0, tracked: 0 }) : { count: 0, tracked: 0 };
    return [
      { icon: 'inventory_2', statName: 'Items', statValue: stats.count, color: 'blue' },
      { icon: 'track_changes', statName: 'Tracked', statValue: stats.tracked, color: 'green' }
    ];
  }

  get trackingMetadata(): TableMetadata | null {
    if (!this.selectedBatch) return null;
    return {
      pageNumber: this.itemPage,
      totalCount: this.itemTotal,
      pageSize: this.itemPageSize,
      totalPages: this.totalItemPages
    };
  }

  get trackingTableRows(): any[] {
    return this.items.map(item => ({
      ...item,
      shortfall: item.damagedQty ? `${item.damagedQty} Short` : 'No Shortfall',
      shortfallColor: item.damagedQty ? 'red' : 'gray',
      actions: [
        {
          id: 'save',
          label: 'Save',
          icon: 'floppy',
          color: 'green',
          disabled: this.savingAll,
          loading: this.savingIds.has(item.id)
        }
      ] as ActionOption[]
    }));
  }

  loadBatches() {
    this.loadingBatches = true;
    this.db.getTrackingBatchesPage(this.batchPage, this.batchPageSize, this.batchSearchTerm.trim()).subscribe(({ data, total }) => {
      this.batches = data || [];
      this.batchTotal = total || 0;
      if (this.batchPage > this.totalBatchPages) {
        this.batchPage = this.totalBatchPages;
        this.loadBatches();
        return;
      }
      this.loadingBatches = false;
      this.loadBatchStats();
    });
  }

  loadBatchStats() {
    this.batchStats = {};
    this.batches.forEach(batch => {
      if (!batch.id) return;
      this.db.getTrackingBatchStats(batch.id).subscribe(stats => {
        this.batchStats[batch.name] = stats;
      });
    });
  }

  viewBatchItems(batch: OrderBatch) {
    this.selectedBatch = batch;
    this.searchTerm = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.itemPage = 1;
    this.loadItems();
  }

  closeBatch() {
    this.selectedBatch = null;
    this.items = [];
    this.itemTotal = 0;
  }

  onBatchSearchInput(value: string) {
    this.batchSearchTerm = value;
    this.batchPage = 1;
    this.loadBatches();
  }

  filterItems() {
    this.itemPage = 1;
    this.loadItems();
  }

  onDateChange(range: { from: string; to: string }) {
    this.dateFrom = range.from;
    this.dateTo = range.to;
    this.filterItems();
  }

  onTrackingTableSearchChange(query: Record<string, string>) {
    this.searchTerm = (query['productName'] || '').trim();
    this.filterItems();
  }

  onTrackingTableInputChange(event: { column: TableColumn; item: TrackingItem; value: any }) {
    const key = event.column.key as keyof TrackingItem;
    const target = this.items.find(item => item.id === event.item.id);
    if (!target) return;
    (target as any)[key] = event.value;
  }

  onTrackingTableActionClick(event: { action: ActionOption; item: TrackingItem }) {
    if (event.action.id === 'save') {
      this.saveItem(event.item);
    }
  }

  loadItems() {
    if (!this.selectedBatch?.id) return;
    this.loadingItems = true;
    const dateFrom = this.dateFrom ? `${this.dateFrom}T00:00:00` : '';
    const dateTo = this.dateTo ? `${this.dateTo}T23:59:59` : '';
    this.db.getTrackingItemsByBatchPage(
      this.selectedBatch.id,
      this.itemPage,
      this.itemPageSize,
      this.searchTerm.trim(),
      dateFrom,
      dateTo
    ).subscribe({
      next: ({ data, total }) => {
        this.items = (data || []) as TrackingItem[];
        this.itemTotal = total || 0;
        this.loadingItems = false;
        if (this.itemPage > this.totalItemPages) { this.itemPage = this.totalItemPages; this.loadItems(); }
      },
      error: () => { this.loadingItems = false; }
    });
  }

  setBatchPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalBatchPages));
    if (next === this.batchPage) return;
    this.batchPage = next;
    this.loadBatches();
  }

  setItemPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalItemPages));
    if (next === this.itemPage) return;
    this.itemPage = next;
    this.loadItems();
  }

  saveItem(item: TrackingItem) {
    if (this.savingIds.has(item.id) || this.savingAll) return;
    this.savingIds.add(item.id);
    this.db.saveTrackingItems([this.toTrackingRow(item)]).subscribe(ok => {
      this.savingIds.delete(item.id);
      if (ok) {
        this.savedIds.add(item.id);
        setTimeout(() => this.savedIds.delete(item.id), 700);
        this.loadBatchStats();
      } else { alert('Failed to save tracking'); }
    });
  }

  saveAll() {
    if (this.items.length === 0 || this.savingAll) return;
    this.savingAll = true;
    this.db.saveTrackingItems(this.items.map(i => this.toTrackingRow(i))).subscribe(ok => {
      this.savingAll = false;
      if (ok) {
        this.items.forEach(i => { this.savedIds.add(i.id); setTimeout(() => this.savedIds.delete(i.id), 700); });
        this.loadBatchStats();
      } else { alert('Failed to save tracking'); }
    });
  }

  isItemTracked(item: TrackingItem): boolean {
    return !!(
      (item.trackingNumber && item.trackingNumber.trim() !== '') ||
      (item.measurements && item.measurements.trim() !== '') ||
      (item.cbm && Number(item.cbm) > 0) ||
      (item.moq && Number(item.moq) > 0)
    );
  }

  trackingBatchTitleResolver = (batch: OrderBatch) => batch.name;
  trackingBatchSubtitleResolver = (batch: OrderBatch) => batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : '';
  trackingBatchIconResolver = () => 'local_shipping';
  trackingBatchTagsResolver = (batch: OrderBatch): BatchCardTagConfig[] => {
    const stats = this.batchStats[batch.name] || { count: 0, tracked: 0 };
    return [
      { tagName: `${stats.count} Item${stats.count !== 1 ? 's' : ''}`, color: 'gray', icon: 'inventory_2' },
      { tagName: `${stats.tracked} Tracked`, color: 'green', icon: 'track_changes' }
    ];
  };

  private initTrackingColumns() {
    this.trackingColumns = [
      { key: 'productName', label: 'Product', type: 'string', searchable: true },
      { key: 'confirmedQty', label: 'Confirmed Qty', type: 'string' },
      { key: 'shortfall', label: 'Shortfall', type: 'status', statusColorKey: 'shortfallColor' },
      {
        key: 'trackingNumber',
        label: 'Tracking Number',
        type: 'input',
        inputType: 'text',
        inputPlaceholder: 'e.g. CN123456789',
        inputUpdateOn: 'change'
      },
      {
        key: 'measurements',
        label: 'Measurements',
        type: 'input',
        inputType: 'text',
        inputPlaceholder: 'e.g. 30x20x10 cm',
        inputUpdateOn: 'change'
      },
      {
        key: 'cbm',
        label: 'CBM',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 0.01,
        inputPlaceholder: '0.00',
        inputUpdateOn: 'change'
      },
      {
        key: 'moq',
        label: 'MOQ',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 1,
        inputPlaceholder: '0',
        inputUpdateOn: 'change'
      },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];
  }

  private toTrackingRow(item: TrackingItem) {
    return {
      batchId: item.batchId,
      batchProductId: item.batchProductId,
      productId: item.productId,
      trackingNumber: (item.trackingNumber || '').trim(),
      measurements: (item.measurements || '').trim(),
      cbm: Number(item.cbm || 0),
      moq: Number(item.moq || 0)
    };
  }
}
