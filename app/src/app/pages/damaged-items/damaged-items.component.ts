import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchListSectionComponent,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import {
  ActionOption,
  TableColumn,
  TableComponent,
  TableMetadata
} from '../../components/table/table.component';
import { DatabaseService } from '../../services/database.service';

interface DamagedBatchCard {
  name: string;
  createdAt?: string | null;
  count: number;
  isUnlinked?: boolean;
}

@Component({
  selector: 'app-damaged-items',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, TableComponent],
  template: `
    <div class="dm-page">
      <div class="dm-page-header">
        <div class="dm-header-left">
          <div class="dm-header-icon">
            <span class="material-icons">warning</span>
          </div>
          <div>
            <h1 class="dm-title">Damaged Items</h1>
            <p class="dm-subtitle">Track damaged stock from arrivals and deliveries</p>
          </div>
        </div>
      </div>

      <div class="dm-card">
        <ng-container *ngIf="!selectedBatchName; else damagedDetailTpl">
          <app-batch-list-section
            [loading]="loading"
            [items]="paginatedBatchCards"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="filteredBatchCards.length"
            [searchTerm]="batchSearchTerm"
            [selectedMonth]="batchFilterMonth"
            [selectedYear]="batchFilterYear"
            [currentYear]="currentYear"
            [searchPlaceholder]="'Search batches...'"
            [emptyTitle]="'No damaged batches yet'"
            [emptyDescription]="'Damaged items will appear here when recorded from arrivals or deliveries.'"
            [titleResolver]="damagedBatchTitleResolver"
            [subtitleResolver]="damagedBatchSubtitleResolver"
            [iconResolver]="damagedBatchIconResolver"
            [tagsResolver]="damagedBatchTagsResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (dateSelectionChange)="onBatchMonthYearChange($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="viewBatch($event.name)">
            <ng-template batchSectionFooter let-batch>
              <button class="dm-card-action-btn dm-cab-primary dm-open-btn" (click)="$event.stopPropagation(); viewBatch(batch.name)">
                <span class="material-icons">open_in_new</span> View Damages
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <ng-template #damagedDetailTpl>
          <div class="dm-detail-header">
            <button class="dm-back-btn" (click)="backToBatches()">
              <span class="material-icons">arrow_back</span>
            </button>
            <div class="dm-detail-icon">
              <span class="material-icons">inventory_2</span>
            </div>
            <div class="dm-detail-title-wrap">
              <h2 class="dm-detail-title">Damaged Items</h2>
              <p class="dm-detail-sub">{{ selectedBatchLabel }}</p>
            </div>
          </div>

          <app-table
            [columns]="damagedColumns"
            [data]="damagedTableRows"
            [metadata]="damagedMetadata"
            [showSearchRow]="true"
            [initialLoading]="loading && damagedTableRows.length === 0"
            [searching]="loading && damagedTableRows.length > 0"
            [tableLabel]="'Damaged Items'"
            [summaryLabel]="'Items'"
            [summaryValue]="filteredDamagedItems.length"
            (searchChange)="onDamagedTableSearchChange($event)"
            (inputChange)="onDamagedTableInputChange($event)"
            (actionClick)="onDamagedTableActionClick($event)"
            (pageChange)="setItemPage($event)">
          </app-table>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .dm-page { max-width: 1400px; }

    .dm-page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .dm-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .dm-header-icon {
      width: 46px;
      height: 46px;
      background: #dc2626;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dm-header-icon .material-icons { color: #fff; font-size: 24px; }
    .dm-title { margin: 0; font-size: 20px; font-weight: 700; }
    .dm-subtitle { margin: 2px 0 0; font-size: 13px; color: #64748b; }

    .dm-card {
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 14px;
      padding: 20px;
      overflow: hidden;
    }

    .dm-card-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      background: transparent;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: background 0.12s;
    }

    .dm-cab-primary {
      background: var(--primary-color, #6366f1);
      color: #fff;
      border-color: var(--primary-color, #6366f1);
    }

    .dm-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .dm-open-btn { width: 100%; justify-content: center; }

    .dm-detail-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 18px;
      border-bottom: 1px solid #ccc;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .dm-back-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #ccc;
      border-radius: 10px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .dm-back-btn:hover { background: #e2e8f0; }
    .dm-back-btn .material-icons { font-size: 20px; }

    .dm-detail-icon {
      width: 40px;
      height: 40px;
      background: #fee2e2;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dm-detail-icon .material-icons { font-size: 20px; color: #dc2626; }
    .dm-detail-title-wrap { flex: 1; min-width: 0; }
    .dm-detail-title { margin: 0; font-size: 17px; font-weight: 700; }
    .dm-detail-sub { margin: 2px 0 0; font-size: 12px; color: #64748b; }
  `]
})
export class DamagedItemsComponent implements OnInit {
  loading = true;
  damagedAll: any[] = [];
  damaged: any[] = [];
  batches: any[] = [];
  displayBatches: any[] = [];
  selectedBatchName = '';
  batchStats: { [batchName: string]: { count: number } } = {};
  unlinkedCount = 0;

  batchPage = 1;
  batchPageSize = 20;
  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();

  itemPage = 1;
  itemPageSize = 20;
  productSearchTerm = '';
  batchColumnSearchTerm = '';
  damagedColumns: TableColumn[] = [];

  readonly damagedBatchTitleResolver = (batch: DamagedBatchCard) => batch.name === 'unlinked' ? 'Unlinked' : batch.name;
  readonly damagedBatchSubtitleResolver = (batch: DamagedBatchCard) =>
    batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Damaged records';
  readonly damagedBatchIconResolver = () => 'inventory_2';
  readonly damagedBatchTagsResolver = (batch: DamagedBatchCard): BatchCardTagConfig[] => [
    {
      tagName: `${batch.count} ${batch.count === 1 ? 'Item' : 'Items'}`,
      color: batch.count > 0 ? 'red' : 'gray',
      icon: 'warning'
    }
  ];

  constructor(private db: DatabaseService) {
    this.initDamagedColumns();
  }

  ngOnInit(): void {
    this.loadBatches();
    this.load();

    this.db.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  get batchCards(): DamagedBatchCard[] {
    const linked: DamagedBatchCard[] = (this.displayBatches || []).map(batch => ({
      name: batch.name,
      createdAt: batch.createdAt || null,
      count: this.batchStats[batch.name]?.count || 0
    }));

    if (this.unlinkedCount > 0) {
      linked.push({
        name: 'unlinked',
        createdAt: null,
        count: this.unlinkedCount,
        isUnlinked: true
      });
    }

    return linked;
  }

  get filteredBatchCards(): DamagedBatchCard[] {
    const term = this.batchSearchTerm.trim().toLowerCase();
    return this.batchCards.filter(batch => {
      const title = batch.name === 'unlinked' ? 'unlinked' : batch.name.toLowerCase();
      if (term && !title.includes(term)) {
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

  get paginatedBatchCards(): DamagedBatchCard[] {
    const start = (this.batchPage - 1) * this.batchPageSize;
    return this.filteredBatchCards.slice(start, start + this.batchPageSize);
  }

  get totalBatchPages() {
    return Math.ceil(this.filteredBatchCards.length / this.batchPageSize) || 1;
  }

  get filteredDamagedItems(): any[] {
    return this.damaged.filter(item => {
      const productMatches = !this.productSearchTerm || (item.productName || '').toLowerCase().includes(this.productSearchTerm);
      const batchMatches = !this.batchColumnSearchTerm || ((item.batchName || 'Unlinked').toLowerCase().includes(this.batchColumnSearchTerm));
      return productMatches && batchMatches;
    });
  }

  get paginatedDamagedItems(): any[] {
    const start = (this.itemPage - 1) * this.itemPageSize;
    return this.filteredDamagedItems.slice(start, start + this.itemPageSize);
  }

  get totalItemPages() {
    return Math.ceil(this.filteredDamagedItems.length / this.itemPageSize) || 1;
  }

  get damagedMetadata(): TableMetadata | null {
    if (!this.selectedBatchName) return null;
    return {
      pageNumber: this.itemPage,
      totalCount: this.filteredDamagedItems.length,
      pageSize: this.itemPageSize,
      totalPages: this.totalItemPages
    };
  }

  get damagedTableRows(): any[] {
    return this.paginatedDamagedItems.map((item, index) => ({
      damageKey: item.id,
      serial: (this.itemPage - 1) * this.itemPageSize + index + 1,
      productName: item.productName || '—',
      batchName: item.batchName || 'Unlinked',
      origin: item.origin || 'delivery',
      damagedQuantity: Number(item.damagedQuantity || 0),
      notes: item.notes || '',
      createdAt: item.createdAt,
      quantityDisabled: item.origin === 'arrival',
      notesDisabled: item.origin === 'arrival',
      actions: [
        {
          id: 'delete',
          label: 'Delete',
          icon: 'trash',
          color: 'red'
        }
      ] as ActionOption[]
    }));
  }

  get selectedBatchLabel() {
    return this.selectedBatchName === 'unlinked' ? 'Unlinked' : this.selectedBatchName;
  }

  initDamagedColumns() {
    this.damagedColumns = [
      { key: 'serial', label: 'S/N' },
      { key: 'productName', label: 'Product', searchable: true },
      { key: 'batchName', label: 'Batch', searchable: true },
      {
        key: 'origin',
        label: 'Origin',
        type: 'status',
        statusOptions: [
          { value: 'arrival', label: 'Arrival', color: 'orange' },
          { value: 'delivery', label: 'Delivery', color: 'blue' }
        ],
        statusDefault: { label: 'Delivery', color: 'blue' }
      },
      {
        key: 'damagedQuantity',
        label: 'Damaged',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 1,
        inputUpdateOn: 'change',
        disabledKey: 'quantityDisabled'
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'input',
        inputType: 'text',
        inputPlaceholder: 'Add note',
        inputUpdateOn: 'change',
        disabledKey: 'notesDisabled'
      },
      { key: 'createdAt', label: 'Created', type: 'date' },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];
  }

  loadBatches() {
    this.db.getOrderBatches().subscribe(batches => {
      this.batches = batches || [];
      if (this.damagedAll.length > 0) {
        this.buildBatchStatsFromDamaged();
      }
    });
  }

  load() {
    this.loading = true;
    this.db.getDamagedItems().subscribe(items => {
      this.damagedAll = (items || []).map(item => ({ ...item, productName: item.productName || '' }));
      this.buildBatchStatsFromDamaged();
      this.applyBatchFilter(false);
      this.loading = false;
    });
  }

  buildBatchStatsFromDamaged() {
    this.batchStats = {};
    this.unlinkedCount = 0;
    const names = new Set<string>();

    this.damagedAll.forEach(item => {
      const name = item.batchName || null;
      if (!name) {
        this.unlinkedCount++;
        return;
      }
      names.add(name);
      if (!this.batchStats[name]) {
        this.batchStats[name] = { count: 0 };
      }
      this.batchStats[name].count++;
    });

    this.displayBatches = (this.batches || []).filter(batch => names.has(batch.name));
    if (this.batchPage > this.totalBatchPages) {
      this.batchPage = this.totalBatchPages;
    }
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
    const next = Math.max(1, Math.min(page, this.totalItemPages));
    if (next === this.itemPage) return;
    this.itemPage = next;
  }

  applyBatchFilter(resetPage = true) {
    if (!this.selectedBatchName) {
      this.damaged = [];
    } else if (this.selectedBatchName === 'unlinked') {
      this.damaged = this.damagedAll.filter(item => !item.batchName);
    } else {
      this.damaged = this.damagedAll.filter(item => (item.batchName || '') === this.selectedBatchName);
    }

    if (resetPage) {
      this.itemPage = 1;
    } else if (this.itemPage > this.totalItemPages) {
      this.itemPage = this.totalItemPages;
    }
  }

  viewBatch(name: string) {
    this.selectedBatchName = name;
    this.productSearchTerm = '';
    this.batchColumnSearchTerm = '';
    this.applyBatchFilter();
  }

  backToBatches() {
    this.selectedBatchName = '';
    this.productSearchTerm = '';
    this.batchColumnSearchTerm = '';
    this.itemPage = 1;
    this.applyBatchFilter();
  }

  onDamagedTableSearchChange(query: Record<string, string>) {
    this.productSearchTerm = (query['productName'] || '').trim().toLowerCase();
    this.batchColumnSearchTerm = (query['batchName'] || '').trim().toLowerCase();
    this.itemPage = 1;
  }

  onDamagedTableInputChange(event: { column: TableColumn; item: any; value: any }) {
    const target = this.findDamagedItem(event.item?.damageKey);
    if (!target) return;

    if (event.column.key === 'damagedQuantity') {
      target.damagedQuantity = Number(event.value || 0);
    }

    if (event.column.key === 'notes') {
      target.notes = event.value || '';
    }

    this.save(target);
  }

  onDamagedTableActionClick(event: { action: ActionOption; item: any }) {
    const target = this.findDamagedItem(event.item?.damageKey);
    if (!target) return;

    if (event.action.id === 'delete') {
      this.remove(target);
    }
  }

  findDamagedItem(id: number): any | undefined {
    return this.damaged.find(item => item.id === id);
  }

  save(item: any) {
    this.db.updateDamagedItem(item.id, {
      damagedQuantity: item.damagedQuantity,
      notes: item.notes
    }).subscribe();
  }

  remove(item: any) {
    if (!confirm('Delete this damaged record?')) return;
    this.db.deleteDamagedItem(item.id).subscribe(ok => {
      if (ok) {
        this.load();
      }
    });
  }
}
