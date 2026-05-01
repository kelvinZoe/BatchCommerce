import { CommonModule } from '@angular/common';
import {
  Component,
  ContentChild,
  Directive,
  EventEmitter,
  Input,
  Output,
  TemplateRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BatchCardComponent, BatchCardTagConfig } from '../batch-card/batch-card.component';
import { MonthYearPickerComponent } from '../month-year-picker/month-year-picker.component';

@Directive({
  selector: 'ng-template[batchSectionTopRight]',
  standalone: true
})
export class BatchSectionTopRightDirective {
  constructor(public template: TemplateRef<any>) {}
}

@Directive({
  selector: 'ng-template[batchSectionBody]',
  standalone: true
})
export class BatchSectionBodyDirective {
  constructor(public template: TemplateRef<any>) {}
}

@Directive({
  selector: 'ng-template[batchSectionFooter]',
  standalone: true
})
export class BatchSectionFooterDirective {
  constructor(public template: TemplateRef<any>) {}
}

@Component({
  selector: 'app-batch-list-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BatchCardComponent,
    MonthYearPickerComponent,
    BatchSectionTopRightDirective,
    BatchSectionBodyDirective,
    BatchSectionFooterDirective
  ],
  template: `
    <div class="bls-section">
      <div class="bls-toolbar" *ngIf="showToolbar">
        <div class="bls-search-wrap">
          <span class="material-icons bls-search-icon">search</span>
          <input
            class="bls-search-input"
            type="text"
            [placeholder]="searchPlaceholder"
            [ngModel]="searchTerm"
            (ngModelChange)="searchTermChange.emit($event)" />
        </div>

        <div class="bls-toolbar-filters">
          <ng-content select="[batchSectionFilters]"></ng-content>
        </div>

        <app-month-year-picker
          *ngIf="showDateFilter"
          [selectedMonth]="selectedMonth"
          [selectedYear]="selectedYear"
          [currentYear]="currentYear"
          (selectionChange)="dateSelectionChange.emit($event)">
        </app-month-year-picker>
      </div>

      <ng-container *ngIf="loading; else contentTpl">
        <div class="bls-skeleton-grid">
          <div class="bls-skeleton-card" *ngFor="let item of skeletonCards">
            <div class="bls-sk bls-sk-icon"></div>
            <div class="bls-sk-body">
              <div class="bls-sk bls-sk-line bls-sk-line-lg"></div>
              <div class="bls-sk bls-sk-line bls-sk-line-sm"></div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #contentTpl>
        <div *ngIf="!items?.length" class="bls-empty">
          <div class="bls-empty-icon"><span class="material-icons">folder_open</span></div>
          <h3>{{ emptyTitle }}</h3>
          <p>{{ emptyDescription }}</p>
          <div class="bls-empty-action">
            <ng-content select="[batchSectionEmptyAction]"></ng-content>
          </div>
        </div>

        <div *ngIf="items?.length" class="bls-grid">
          <app-batch-card
            *ngFor="let item of items; trackBy: trackByItem"
            [title]="resolveTitle(item)"
            [subtitle]="resolveSubtitle(item)"
            [icon]="resolveIcon(item)"
            [tag]="resolveTag(item)"
            [tags]="resolveTags(item)"
            [active]="resolveActive(item)"
            [muted]="resolveMuted(item)"
            [iconMuted]="resolveIconMuted(item)"
            (cardClick)="cardClick.emit(item)">
            <ng-container *ngIf="topRightTpl">
              <ng-template
                [ngTemplateOutlet]="topRightTpl.template"
                [ngTemplateOutletContext]="{ $implicit: item, item: item }">
              </ng-template>
            </ng-container>

            <ng-container *ngIf="bodyTpl">
              <div batchCardBody>
                <ng-template
                  [ngTemplateOutlet]="bodyTpl.template"
                  [ngTemplateOutletContext]="{ $implicit: item, item: item }">
                </ng-template>
              </div>
            </ng-container>

            <ng-container *ngIf="footerTpl">
              <div batchCardFooter>
                <ng-template
                  [ngTemplateOutlet]="footerTpl.template"
                  [ngTemplateOutletContext]="{ $implicit: item, item: item }">
                </ng-template>
              </div>
            </ng-container>
          </app-batch-card>
        </div>

        <div class="bls-pagination" *ngIf="total > pageSize">
          <span class="bls-pg-info">{{ rangeStart }}–{{ rangeEnd }} of {{ total }}</span>
          <div class="bls-pg-btns">
            <button (click)="pageChange.emit(1)" [disabled]="page === 1"><span class="material-icons">first_page</span></button>
            <button (click)="pageChange.emit(page - 1)" [disabled]="page === 1"><span class="material-icons">chevron_left</span></button>
            <span class="bls-pg-cur">{{ page }} / {{ totalPages }}</span>
            <button (click)="pageChange.emit(page + 1)" [disabled]="page >= totalPages"><span class="material-icons">chevron_right</span></button>
            <button (click)="pageChange.emit(totalPages)" [disabled]="page >= totalPages"><span class="material-icons">last_page</span></button>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .bls-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bls-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bls-search-wrap {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 360px;
    }

    .bls-search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      color: #94a3b8;
      pointer-events: none;
    }

    .bls-search-input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border: 1px solid #d7dde6;
      border-radius: 10px;
      font-size: 13px;
      background: #f8fafc;
      color: #1e293b;
      box-sizing: border-box;
      transition: border-color 0.13s, box-shadow 0.13s, background 0.13s;
    }

    .bls-search-input:focus {
      outline: none;
      border-color: var(--primary-light, #a5b4fc);
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.12);
      background: #fff;
    }

    .bls-toolbar-filters {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bls-grid,
    .bls-skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
    }

    .bls-empty {
      text-align: center;
      padding: 48px 24px;
    }

    .bls-empty-icon {
      width: 60px;
      height: 60px;
      border-radius: 16px;
      background: rgba(var(--primary-rgb, 99,102,241), 0.08);
      color: var(--primary-color, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin: 0 auto 16px;
    }

    .bls-empty h3 {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px;
    }

    .bls-empty p {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }

    .bls-empty-action:empty {
      display: none;
    }

    .bls-empty-action {
      margin-top: 16px;
    }

    .bls-skeleton-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 1px solid #f1f5f9;
      border-radius: 14px;
      background: #fff;
    }

    .bls-sk {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: bls-shimmer 1.4s infinite;
      border-radius: 6px;
    }

    @keyframes bls-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .bls-sk-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .bls-sk-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bls-sk-line {
      height: 12px;
    }

    .bls-sk-line-lg {
      width: 70%;
    }

    .bls-sk-line-sm {
      width: 40%;
    }

    .bls-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      margin-top: 4px;
      border-top: 1px solid #ccc;
      gap: 12px;
      flex-wrap: wrap;
    }

    .bls-pg-info {
      font-size: 12px;
      color: #64748b;
    }

    .bls-pg-btns {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .bls-pg-btns button {
      width: 30px;
      height: 30px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      background: #f8fafc;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
      transition: background 0.12s;
    }

    .bls-pg-btns button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .bls-pg-btns button:hover:not(:disabled) {
      background: #e2e8f0;
    }

    .bls-pg-cur {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      padding: 0 8px;
    }

    @media (max-width: 768px) {
      .bls-toolbar {
        align-items: stretch;
      }

      .bls-search-wrap {
        max-width: none;
      }
    }
  `]
})
export class BatchListSectionComponent<T = any> {
  @ContentChild(BatchSectionTopRightDirective) topRightTpl?: BatchSectionTopRightDirective;
  @ContentChild(BatchSectionBodyDirective) bodyTpl?: BatchSectionBodyDirective;
  @ContentChild(BatchSectionFooterDirective) footerTpl?: BatchSectionFooterDirective;

  @Input() loading = false;
  @Input() items: T[] = [];
  @Input() page = 1;
  @Input() pageSize = 20;
  @Input() total = 0;
  @Input() searchTerm = '';
  @Input() searchPlaceholder = 'Search batches...';
  @Input() selectedMonth: number | null = null;
  @Input() selectedYear: number | null = null;
  @Input() currentYear = new Date().getFullYear();
  @Input() showDateFilter = true;
  @Input() showToolbar = true;
  @Input() emptyTitle = 'No batches yet';
  @Input() emptyDescription = 'There are no batches to show yet.';
  @Input() titleResolver: (item: T) => string = (item: any) => item?.name || '';
  @Input() subtitleResolver: (item: T) => string | null = (item: any) => item?.createdAt || item?.created_at || null;
  @Input() iconResolver: (item: T) => string = (item: any) => item?.status === 'open' ? 'folder_open' : 'folder';
  @Input() tagResolver: (item: T) => BatchCardTagConfig | null = () => null;
  @Input() tagsResolver: (item: T) => BatchCardTagConfig[] = () => [];
  @Input() activeResolver: (item: T) => boolean = () => false;
  @Input() mutedResolver: (item: T) => boolean = () => false;
  @Input() iconMutedResolver: (item: T) => boolean = () => false;

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() dateSelectionChange = new EventEmitter<{ month: number | null; year: number | null }>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() cardClick = new EventEmitter<T>();

  readonly skeletonCards = [1, 2, 3, 4, 5, 6];

  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangeStart() {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd() {
    return Math.min(this.page * this.pageSize, this.total);
  }

  resolveTitle(item: T) {
    return this.titleResolver(item);
  }

  resolveSubtitle(item: T) {
    return this.subtitleResolver(item);
  }

  resolveIcon(item: T) {
    return this.iconResolver(item);
  }

  resolveTag(item: T) {
    return this.tagResolver(item);
  }

  resolveTags(item: T) {
    return this.tagsResolver(item);
  }

  resolveActive(item: T) {
    return this.activeResolver(item);
  }

  resolveMuted(item: T) {
    return this.mutedResolver(item);
  }

  resolveIconMuted(item: T) {
    return this.iconMutedResolver(item);
  }

  trackByItem(index: number, item: any) {
    return item?.id ?? index;
  }
}
