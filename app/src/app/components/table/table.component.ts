import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

export type ColumnType =
  | 'string'
  | 'date'
  | 'time'
  | 'boolean'
  | 'checkbox'
  | 'input'
  | 'dropdown'
  | 'status'
  | 'actions'
  | 'custom';

export type TagColor = 'red' | 'green' | 'orange' | 'gray' | 'blue' | 'violet';

export interface StatusOption {
  value: string | number | boolean;
  label?: string;
  color: TagColor;
}

export interface TableColumn {
  key: string;
  label?: string;
  type?: ColumnType;
  customTemplate?: TemplateRef<any> | null;
  headerTemplate?: TemplateRef<any> | null;
  searchable?: boolean;
  filterable?: boolean;
  disabledKey?: string;
  badgeKey?: string;
  inputType?: 'text' | 'number';
  inputMin?: number;
  inputMax?: number;
  inputStep?: number;
  inputPlaceholder?: string;
  inputUpdateOn?: 'input' | 'change';
  statusOptions?: StatusOption[];
  statusDefault?: { label?: string; color: TagColor };
  statusColorKey?: string;
}

export interface TableFilterConfig {
  key: string;
  label: string;
  options: { label: string; value: any }[];
  value?: any;
  selection?: 'single' | 'multi';
  values?: any[];
  disabled?: boolean;
  disableAll?: boolean;
}

export interface TableMetadata {
  pageNumber: number;
  totalCount: number;
  pageSize: number;
  totalPages: number;
}

export interface ActionOption {
  id: string;
  label: string;
  icon: string;
  color?: 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'black';
  disabled?: boolean;
  loading?: boolean;
}

export interface ToolbarButtonConfig {
  icon: string;
  buttonName: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbDropdownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="table-wrapper"
      [style.--base-color]="baseColor"
      [style.--table-column-count]="columns.length || 1"
      [style.position]="'relative'"
      [class.table-searching]="isRefreshing"
      [class.table-loading]="showInitialLoader"
      [attr.aria-busy]="isBusy">
      <!-- INITIAL LOADING SKELETON -->
      <div *ngIf="showInitialLoader" class="table-initial-loader">
        <div class="table-skeleton">
          <div class="table-skeleton__head">
            <div class="table-skeleton__th" *ngFor="let col of columns"></div>
          </div>
          <div class="table-skeleton__row" *ngFor="let row of skeletonRowIndices">
            <div class="table-skeleton__td" *ngFor="let col of columns"></div>
          </div>
        </div>
      </div>
      <!-- TOOLBAR (hidden during initial load) -->
      <div *ngIf="!showInitialLoader && (tableLabel || summaryLabel || (filters && filters.length > 0) || showToolbarStart || showToolbarEnd || toolbarButton)" class="table-toolbar">
        <!-- Row 1: Label & Summary -->
        <div *ngIf="tableLabel || summaryLabel" class="table-toolbar__row ms-3 me-3 mt-2">
          <div class="table-toolbar__left">
            <span *ngIf="tableLabel" class="table-toolbar__label">{{ tableLabel }}</span>
          </div>
          <div class="table-toolbar__right">
            <span *ngIf="summaryLabel" class="table-toolbar__summary">
              <span class="table-toolbar__summary-label">{{ summaryLabel }}</span>
              <span *ngIf="summaryValue !== null && summaryValue !== undefined" class="table-toolbar__summary-value">
                {{ summaryValue }}
              </span>
            </span>
          </div>
        </div>
        <div *ngIf="tableLabel || summaryLabel" class="table-toolbar__divider"></div>

        <!-- Row 2: Filters -->
        <div *ngIf="(filters && filters.length > 0) || showToolbarStart || showToolbarEnd || toolbarButton" class="table-toolbar__row ms-2 me-2">
          <div class="table-toolbar__left">
            <div class="table-filters" *ngIf="filters && filters.length > 0">
              <div *ngFor="let filter of filters" class="btn-group" ngbDropdown #dd="ngbDropdown" [autoClose]="true" container="body">
                <button
                  type="button"
                  class="table-filters__btn table-filters__btn--pill table-filters__btn--filter"
                  ngbDropdownToggle
                  [disabled]="!!filter.disabled">
                  <span class="table-filters__btn-text">{{ getFilterButtonLabel(filter) }}</span>
                  <i class="bi bi-chevron-down table-filters__btn-icon"></i>
                </button>

                <div ngbDropdownMenu>
                  <button
                    *ngIf="!filter.disableAll"
                    type="button"
                    class="dropdown-item"
                    [class.active]="isFilterAll(filter.key)"
                    (click)="onFilterSelectionChange(filter.key, null); dd.close()">
                    All
                  </button>

                  <button
                    *ngFor="let opt of filter.options"
                    type="button"
                    class="dropdown-item"
                    [class.active]="isFilterActive(filter.key, opt.value)"
                    (click)="onFilterSelectionChange(filter.key, opt.value); dd.close()">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="table-toolbar__start" *ngIf="showToolbarStart">
              <ng-content select="[table-toolbar-start]"></ng-content>
            </div>
          </div>
          <div class="table-toolbar__right" *ngIf="showToolbarEnd || toolbarButton">
            <button
              *ngIf="toolbarButton"
              type="button"
              class="table-toolbar__action-btn"
              (click)="toolbarButtonAction.emit()">
              <span class="material-icons">{{ toolbarButton.icon }}</span>
              {{ toolbarButton.buttonName }}
            </button>
            <ng-content select="[table-toolbar-end]"></ng-content>
          </div>
        </div>
        <div *ngIf="(filters && filters.length > 0) || showToolbarStart || showToolbarEnd || toolbarButton" class="table-toolbar__divider"></div>
      </div>

      <!-- TABLE (hidden during initial load) -->
      <div *ngIf="!showInitialLoader" class="table-content" [class.table-content--muted]="isRefreshing">
      <table class="data-table">
        <thead>
          <tr style="background: #faf8f9; border-bottom: 1px solid #e7e8e8;">
            <th
              *ngFor="let col of columns"
              class="table-head"
              [class.sortable]="isSortable(col)"
              (click)="onSort(col)">
              <ng-container *ngIf="col.headerTemplate; else defaultHeaderTpl">
                <ng-container [ngTemplateOutlet]="col.headerTemplate"></ng-container>
              </ng-container>
              <ng-template #defaultHeaderTpl>
                <span class="table-head__label">{{ col.label }}</span>
              </ng-template>
              <i *ngIf="isSortable(col)" [class]="'bi ' + getSortIcon(col)"></i>
            </th>
          </tr>

          <!-- Search Row -->
          <tr *ngIf="showSearchRow" class="table-search-row">
            <th *ngFor="let col of columns" class="search-cell">
              <div *ngIf="col.searchable || col.filterable" class="search-filter">
                <div *ngIf="col.searchable" class="table-search-input-wrapper">
                  <i class="bi bi-search table-search-icon"></i>
                  <input
                    type="text"
                    class="table-search-input"
                    placeholder="Search..."
                    [value]="columnQueries[col.key] || ''"
                    (input)="onSearchInput(col.key, $any($event.target).value)" />
                </div>
              </div>
            </th>
          </tr>
        </thead>

        <!-- LOADING STATE -->
        <tbody *ngIf="!data">
          <tr>
            <td [attr.colspan]="columns.length" class="no-data">
              <div class="table-loader">Loading...</div>
            </td>
          </tr>
        </tbody>

        <!-- DATA ROWS -->
        <tbody *ngIf="data && data.length > 0; else noData" [style.pointerEvents]="isRefreshing ? 'none' : 'auto'">
          <tr *ngFor="let item of sortedData; let i = index; trackBy: trackByRow" [class]="item.rowClass || ''">
            <td *ngFor="let col of columns; let isFirst = first; trackBy: trackByColumn" [style.display]="isFirst ? 'table-cell' : 'auto'" [class.first-cell]="isFirst">
              <ng-container [ngSwitch]="col.type">
                <!-- Date -->
                <ng-container *ngSwitchCase="'date'">
                  {{ getCellValue(item, col.key) | date: 'mediumDate' }}
                </ng-container>

                <!-- Time -->
                <ng-container *ngSwitchCase="'time'">
                  {{ formatTime(getCellValue(item, col.key)) }}
                </ng-container>

                <!-- Boolean -->
                <ng-container *ngSwitchCase="'boolean'">
                  <span
                    [class.text-success]="getCellValue(item, col.key)"
                    [class.text-danger]="!getCellValue(item, col.key)">
                    {{ getCellValue(item, col.key) ? 'Yes' : 'No' }}
                  </span>
                </ng-container>

                <!-- Checkbox -->
                <ng-container *ngSwitchCase="'checkbox'">
                  <div class="table-checkbox-cell">
                    <span *ngIf="getCellBadge(item, col)" class="table-inline-badge">
                      {{ getCellBadge(item, col) }}
                    </span>
                    <input
                      *ngIf="!getCellBadge(item, col)"
                      type="checkbox"
                      class="table-checkbox"
                      [checked]="!!getCellValue(item, col.key)"
                      [disabled]="isCellDisabled(item, col)"
                      (change)="onCheckboxToggle(col, item, $any($event.target).checked)" />
                  </div>
                </ng-container>

                <!-- Dropdown -->
                <ng-container *ngSwitchCase="'dropdown'">
                  <div class="table-dropdown-cell" ngbDropdown #cellDd="ngbDropdown" container="body" [autoClose]="true">
                    <button
                      type="button"
                      class="table-filters__btn table-filters__btn--pill table-filters__btn--filter table-cell-dropdown"
                      [class.table-cell-dropdown--green]="getStatusTag(col, getCellValue(item, col.key), item).color === 'green'"
                      [class.table-cell-dropdown--blue]="getStatusTag(col, getCellValue(item, col.key), item).color === 'blue'"
                      [class.table-cell-dropdown--orange]="getStatusTag(col, getCellValue(item, col.key), item).color === 'orange'"
                      [class.table-cell-dropdown--red]="getStatusTag(col, getCellValue(item, col.key), item).color === 'red'"
                      [class.table-cell-dropdown--gray]="getStatusTag(col, getCellValue(item, col.key), item).color === 'gray'"
                      [class.table-cell-dropdown--violet]="getStatusTag(col, getCellValue(item, col.key), item).color === 'violet'"
                      ngbDropdownToggle
                      [disabled]="isCellDisabled(item, col)">
                      <span class="table-filters__btn-text">{{ getStatusTag(col, getCellValue(item, col.key), item).label }}</span>
                      <i class="bi bi-chevron-down table-filters__btn-icon"></i>
                    </button>

                    <div ngbDropdownMenu>
                      <button
                        *ngFor="let opt of (col.statusOptions || [])"
                        type="button"
                        class="dropdown-item"
                        [class.active]="isDropdownOptionSelected(item, col, opt.value)"
                        (click)="onDropdownSelection(col, item, opt.value); cellDd.close()">
                        {{ opt.label ?? opt.value }}
                      </button>
                    </div>
                  </div>
                </ng-container>

                <!-- Input -->
                <ng-container *ngSwitchCase="'input'">
                  <div class="table-input-cell">
                    <input
                      class="table-inline-input"
                      [type]="col.inputType || 'text'"
                      [value]="getCellValue(item, col.key) ?? ''"
                      [attr.min]="col.inputMin ?? null"
                      [attr.max]="col.inputMax ?? null"
                      [attr.step]="col.inputStep ?? null"
                      [attr.placeholder]="col.inputPlaceholder || null"
                      [disabled]="isCellDisabled(item, col)"
                      (focus)="onInputFocus(col, item, $event)"
                      (input)="col.inputUpdateOn !== 'change' && onInputValueChange(col, item, $any($event.target).value)"
                      (change)="col.inputUpdateOn === 'change' && onInputValueChange(col, item, $any($event.target).value)" />
                  </div>
                </ng-container>

                <!-- Status Tag -->
                <ng-container *ngSwitchCase="'status'">
                    <span
                      class="status-tag"
                    [ngClass]="'tag-' + getStatusTag(col, getCellValue(item, col.key), item).color">
                    {{ getStatusTag(col, getCellValue(item, col.key), item).label }}
                  </span>
                </ng-container>

                <!-- Actions -->
                <ng-container *ngSwitchCase="'actions'">
                  <div class="actions-cell">
                    <button
                      *ngFor="let action of (item.actions ? item.actions : actionOptions)"
                      type="button"
                      [class]="'action-btn action-' + (action.color || 'black')"
                      [disabled]="!!action.disabled"
                      (click)="onActionClick(action, item)"
                      [title]="action.label">
                      <span *ngIf="action.loading" class="table-action-spinner"></span>
                      <i *ngIf="!action.loading" [class]="'bi bi-' + action.icon"></i>
                    </button>
                  </div>
                </ng-container>

                <!-- Custom Template -->
                <ng-container *ngSwitchCase="'custom'">
                  <ng-template
                    *ngIf="col.customTemplate"
                    [ngTemplateOutlet]="col.customTemplate"
                    [ngTemplateOutletContext]="{ $implicit: item, item: item, row: item }">
                  </ng-template>
                </ng-container>

                <!-- Default (String) -->
                <ng-container *ngSwitchDefault>
                  <div class="cell-content-with-avatar">
                    <div *ngIf="isFirst" class="avatar" [title]="getCellValue(item, col.key)">
                      {{ getInitials(getCellValue(item, col.key)) }}
                    </div>
                    <span>{{ getCellValue(item, col.key) }}</span>
                  </div>
                </ng-container>
              </ng-container>
            </td>
          </tr>
        </tbody>

        <!-- EMPTY STATE -->
        <ng-template #noData>
          <tbody>
            <tr>
              <td [attr.colspan]="columns.length" class="no-data">
                <div class="text-center py-5">
                  <i class="bi bi-inbox" style="font-size: 3rem; color: #cbd5e1; display: block; margin-bottom: 12px;"></i>
                  <p style="color: #94a3b8; margin: 0;">No data available</p>
                </div>
              </td>
            </tr>
          </tbody>
        </ng-template>
      </table>
      </div>
    </div>

    <!-- PAGINATION -->
    <div
      *ngIf="!showInitialLoader && metadata && metadata.pageSize > 0 && metadata.totalPages > 0"
      class="pagination-container"
      [class.pagination-container--muted]="isRefreshing"
      [style.pointerEvents]="isRefreshing ? 'none' : 'auto'">
      <button
        class="pagination-btn prev-btn"
        [disabled]="metadata.pageNumber <= 1"
        (click)="onPageChange(metadata.pageNumber - 1)"
        title="Previous">
        <i class="bi bi-chevron-left"></i>
      </button>

      <button
        *ngFor="let page of pages"
        class="pagination-btn"
        [class.active]="page === metadata.pageNumber"
        (click)="onPageChange(page)">
        {{ page }}
      </button>

      <button
        class="pagination-btn next-btn"
        [disabled]="metadata.pageNumber >= metadata.totalPages"
        (click)="onPageChange(metadata.pageNumber + 1)"
        title="Next">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  `,
  styles: [`
    .table-wrapper {
      width: 100%;
      border-radius: 16px;
      border: 1px solid #e5e7e8;
      overflow: visible;
      position: relative;
      background: #fff;
    }

    .table-wrapper.table-loading {
      min-height: 200px;
    }

    .table-searching {
      cursor: wait;
    }

    .table-initial-loader {
      padding: 16px;
      background: #fff;
      z-index: 10;
      border-radius: 16px;
    }

    .table-skeleton {
      display: grid;
      gap: 10px;
    }

    .table-skeleton__head,
    .table-skeleton__row {
      display: grid;
      grid-template-columns: repeat(var(--table-column-count, 1), minmax(0, 1fr));
      gap: 12px;
    }

    .table-skeleton__head {
      margin-bottom: 2px;
    }

    .table-skeleton__th,
    .table-skeleton__td {
      border-radius: 6px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e6e6e6 50%, #f0f0f0 75%);
      background-size: 400% 100%;
      animation: table-shimmer 1.4s linear infinite;
    }

    .table-skeleton__th {
      height: 14px;
    }

    .table-skeleton__td {
      height: 36px;
      background: linear-gradient(90deg, #f8f8f8 25%, #f0f0f0 50%, #f8f8f8 75%);
      background-size: 400% 100%;
    }

    @keyframes table-shimmer {
      0% { background-position: -400% 0; }
      100% { background-position: 400% 0; }
    }

    .table-toolbar {
      display: flex;
      flex-direction: column;
      // gap: 10px;
      position: relative;
      z-index: 2;
      border-radius: 16px 16px 0 0;
      background: #fff;
    }

    .table-content {
      overflow: hidden;
      border-radius: 0 0 16px 16px;
      background: #fff;
      transition: filter 0.2s ease, opacity 0.2s ease;
    }

    .table-content--muted {
      opacity: 0.55;
      filter: grayscale(0.15) saturate(0.65);
    }

    .table-toolbar__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
    }

    .table-toolbar__divider {
      height: 1px;
      background: #e5e7e8;
      width: 100%;
    }

    .table-toolbar__left {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .table-toolbar__start {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .table-toolbar__label {
      font-size: 15px;
      font-weight: 600;
      color: #2f3337;
    }

    .table-toolbar__summary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #6b7280;
    }

    .table-toolbar__summary-label {
      font-weight: 500;
    }

    .table-toolbar__summary-value {
      font-weight: 600;
      color: #111827;
    }

    .table-toolbar__right {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .table-toolbar__action-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border: 1px solid #d7dde6;
      border-radius: 12px;
      background: #f8fafc;
      color: #475569;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }

    .table-toolbar__action-btn .material-icons {
      font-size: 17px;
    }

    .table-toolbar__action-btn:hover {
      border-color: rgba(var(--primary-rgb, 99,102,241), 0.22);
      background: #fff;
      color: var(--primary-color, #6366f1);
    }

    .table-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .table-filters__btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #e5e7e8;
      background: #fff;
      color: #3a3c3f;
      font-size: 14px;
      font-weight: 500;
      padding: 0px 10px;
      height: 32px;
    }

    .table-filters__btn--pill {
      border-radius: 4px;
    }

    .table-filters__btn--filter {
    }

    .table-filters__btn--filter.dropdown-toggle::after {
      display: none;
    }

    .table-filters__btn-text {
      white-space: nowrap;
      font-size: 13px;
    }

    .table-filters__btn-icon {
      font-size: 16px;
      color: #9aa0a6;
      transition: transform 0.15s ease;
    }

    .btn-group.show .table-filters__btn-icon {
      transform: rotate(180deg);
    }

    .data-table {
      width: 100%;
      background-color: #fff;
      border-collapse: collapse;
    }

    .data-table thead th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 400;
      font-size: 13px;
      color: #555a61;
    }

    .data-table tbody tr {
      border-bottom: 1px solid #e9ecef;
    }

    .data-table tbody tr:hover {
      background-color: #f8f9fa;
    }

    .data-table tbody tr:last-child {
      border-bottom: none;
    }

    .data-table tbody td {
      padding: 8px 16px;
      font-size: 14px;
      color: #212529;
    }

    .table-head {
      cursor: default;
      user-select: none;
    }

    .table-head.sortable {
      cursor: pointer;
    }

    .table-head__label {
      margin-right: 6px;
    }

    .table-head__icon {
      font-size: 14px;
      color: #9aa0a6;
    }

    .table-search-row th {
      padding-top: 0.25rem;
      padding-bottom: 0.75rem;
      background: transparent;
    }

    .search-cell {
      padding: 0 !important;
    }

    .search-filter {
      display: flex;
      align-items: center;
      padding: 8px 16px;
    }

    .search-input {
      max-width: 220px;
    }

    .search-input .input-group-text {
      background: #fff;
      border-right: 0;
      border: 1px solid #e5e7e8;
    }

    .search-input .form-control {
      border-left: 0;
      border: 1px solid #e5e7e8;
      font-size: 13px;
    }

    .search-input .form-control:focus {
      border-color: #6366f1;
    }

    .no-data {
      text-align: center;
      padding: 0;
      height: 320px;
      vertical-align: middle;
    }

    .table-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
    }

    /* Status Tags */
    .status-tag {
      display: inline-block;
      padding: 1px 5px;
      font-size: 10px;
      line-height: 1.4;
      border-radius: 999px;
      font-weight: 600;
      border: 1px solid transparent;
      text-align: center;
    }

    .tag-green {
      color: #1f7620;
      background-color: #f2fcf1;
      border-color: #c2f1c1;
    }

    .tag-blue {
      border-color: #b8e4ff;
      background-color: #eff8ff;
      color: #062c4b;
    }

    .tag-red {
      color: #b52022;
      background-color: #fef2f2;
      border-color: #fdcbcc;
    }

    .tag-orange {
      color: #ae7c33;
      background-color: #fff4e5;
      border-color: #f5dcb8;
    }

    .tag-gray {
      color: #3a3c3f;
      background-color: #faf8f9;
      border-color: #d4dae3;
    }

    .tag-violet {
      color: #5b2e91;
      background-color: #f5f0fc;
      border-color: #d9caf6;
    }

    .text-success {
      color: #28a745;
    }

    .text-danger {
      color: #dc3545;
    }

    .table-checkbox-cell {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .table-checkbox {
      width: 15px;
      height: 15px;
      cursor: pointer;
      accent-color: var(--base-color, #6366f1);
    }

    .table-inline-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #e5e7eb;
      color: #374151;
    }

    .table-dropdown-cell {
      display: inline-flex;
      align-items: center;
    }

    .table-input-cell {
      display: inline-flex;
      align-items: center;
    }

    .table-inline-input {
      width: 88px;
      padding: 8px 10px;
      border: 1px solid #d7dde6;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      background: #f8fafc;
      color: #0f172a;
      transition: border-color 0.13s, background 0.13s;
    }

    .table-inline-input:focus {
      outline: none;
      border-color: var(--base-color, #6366f1);
      background: #fff;
    }

    .table-inline-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #f1f5f9;
    }

    .table-cell-dropdown {
      min-width: 112px;
      justify-content: space-between;
      padding-inline: 10px;
    }

    .table-cell-dropdown--green {
      background: #d1fae5;
      border-color: transparent;
      color: #065f46;
    }

    .table-cell-dropdown--blue {
      background: #dbeafe;
      border-color: transparent;
      color: #1d4ed8;
    }

    .table-cell-dropdown--orange {
      background: #fef3c7;
      border-color: transparent;
      color: #92400e;
    }

    .table-cell-dropdown--red {
      background: #fee2e2;
      border-color: transparent;
      color: #b91c1c;
    }

    .table-cell-dropdown--gray {
      background: #f3f4f6;
      border-color: transparent;
      color: #4b5563;
    }

    .table-cell-dropdown--violet {
      background: #ede9fe;
      border-color: transparent;
      color: #6d28d9;
    }

    .actions-cell {
      display: flex;
      justify-content: center;
      gap: 6px;
    }

    .action-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .action-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }

    .action-btn:hover {
      transform: scale(1.1);
    }

    .action-btn:hover:disabled {
      transform: none;
    }

    .action-blue {
      background: #d0e8f9;
      color: #0066cc;
    }

    .action-red {
      background: #f9d0d0;
      color: #cc0000;
    }

    .action-green {
      background: #d0f9d0;
      color: #00cc00;
    }

    .table-action-spinner {
      width: 13px;
      height: 13px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      display: inline-block;
      animation: table-spin 0.7s linear infinite;
    }

    @keyframes table-spin {
      to { transform: rotate(360deg); }
    }

    .action-yellow {
      background: #f9f9d0;
      color: #cccc00;
    }

    .action-orange {
      background: #f9e0d0;
      color: #ff6600;
    }

    .action-purple {
      background: #e6d0f9;
      color: #7700cc;
    }

    .action-black {
      background: #e0e0e0;
      color: #333333;
    }

    /* Search Input Styles */
    .table-search-input-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 6px 8px;
      background-color: #f9fafb;
      transition: all 0.2s ease;
    }

    .table-search-input-wrapper:focus-within {
      border-color: var(--base-color, #6366f1);
      background-color: #fff;
    }

    .table-search-icon {
      font-size: 14px;
      color: #9ca3af;
      flex-shrink: 0;
    }

    .table-search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 12px;
      color: #374151;
      outline: none;
      padding: 0;
      font-family: inherit;
    }

    .table-search-input::placeholder {
      color: #d1d5db;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--base-color, #6366f1);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      text-transform: uppercase;
    }

    .cell-content-with-avatar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 100%;
    }

    .first-cell {
      padding: 8px 12px;
    }

    /* Pagination */
    .pagination-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 16px;
      gap: 4px;
      padding-bottom: 12px;
      transition: opacity 0.2s ease, filter 0.2s ease;
    }

    .pagination-container--muted {
      opacity: 0.5;
      filter: grayscale(0.15);
    }

    .pagination-btn {
      min-width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e5e7e8;
      background-color: #fff;
      color: #555a61;
      font-size: 14px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pagination-btn:hover:not(:disabled):not(.active) {
      background-color: #f8f9fa;
      border-color: #dee2e6;
    }

    .pagination-btn.active {
      background-color: #fff;
      color: #000;
      border-color: #000;
      font-weight: 500;
    }

    .pagination-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .pagination-btn.next-btn i,
    .pagination-btn.prev-btn i {
      font-size: 18px;
    }
    .first-cell {
      padding: 8px 12px;
    }

    @media (max-width: 760px) {
      .table-wrapper {
        border-radius: 14px;
        overflow: hidden;
      }

      .table-toolbar {
        border: 1px solid #e5e7e8;
        border-width: 0 0 1px 0;
        border-radius: 14px 14px 0 0;
        overflow: hidden;
        margin-bottom: 0;
      }

      .table-toolbar__row {
        align-items: stretch;
        flex-direction: column;
        margin: 0 !important;
        padding: 10px 12px;
      }

      .table-toolbar__left,
      .table-toolbar__right,
      .table-toolbar__start,
      .table-filters {
        width: 100%;
      }

      .table-toolbar__right,
      .table-toolbar__start {
        justify-content: stretch;
      }

      .table-toolbar__action-btn,
      .table-filters__btn,
      .table-filters .btn-group {
        width: 100%;
      }

      .table-content {
        overflow-x: auto;
        border-radius: 0 0 14px 14px;
        -webkit-overflow-scrolling: touch;
      }

      .data-table {
        min-width: 720px;
      }

      .pagination-container {
        flex-wrap: wrap;
        padding-bottom: 8px;
      }
    }
  `]
})
export class TableComponent implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] | undefined | null = undefined;
  @Input() metadata: TableMetadata | null = null;
  @Input() actionOptions: ActionOption[] = [];
  @Input() showSearchRow = true;
  @Input() searchDebounce = 300;
  @Input() searching = false;
  @Input() initialLoading = false;
  @Input() filters: TableFilterConfig[] = [];
  @Input() tableLabel = '';
  @Input() summaryLabel = '';
  @Input() summaryValue: string | number | null = null;
  @Input() baseColor = '#6366f1';
  @Input() avatarField = 'name';
  @Input() skeletonRows = 5;
  @Input() showToolbarStart = false;
  @Input() showToolbarEnd = false;
  @Input() toolbarButton: ToolbarButtonConfig | null = null;

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() actionClick = new EventEmitter<{ action: ActionOption; item: any }>();
  @Output() searchChange = new EventEmitter<Record<string, string>>();
  @Output() filterChange = new EventEmitter<Record<string, any>>();
  @Output() checkboxChange = new EventEmitter<{ column: TableColumn; item: any; checked: boolean }>();
  @Output() inputChange = new EventEmitter<{ column: TableColumn; item: any; value: any }>();
  @Output() dropdownChange = new EventEmitter<{ column: TableColumn; item: any; value: any }>();
  @Output() sortChange = new EventEmitter<{ sortKey: string | null; sortDir: 'asc' | 'desc' | null }>();
  @Output() toolbarButtonAction = new EventEmitter<void>();

  pages: number[] = [];
  columnQueries: Record<string, string> = {};
  sortKey: string | null = null;
  sortDir: 'asc' | 'desc' | null = null;
  filterSelections: Record<string, any> = {};
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private initialLoadResolved = false;

  get skeletonRowIndices(): number[] {
    return Array.from({ length: Math.max(1, this.skeletonRows || 5) }, (_, i) => i);
  }

  get showInitialLoader(): boolean {
    return !!this.initialLoading && !this.initialLoadResolved && !this.hasRows;
  }

  get isRefreshing(): boolean {
    return !this.showInitialLoader && (!!this.searching || !!this.initialLoading);
  }

  get isBusy(): boolean {
    return this.showInitialLoader || this.isRefreshing;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['metadata'] && this.metadata) {
      const totalPages = this.metadata.totalPages && this.metadata.totalPages > 0 ? this.metadata.totalPages : 1;
      this.pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
        const start = Math.max(1, this.metadata!.pageNumber - 2);
        return start + i;
      });
    }

    if (changes['filters'] && Array.isArray(this.filters)) {
      this.filters.forEach(filter => {
        if (!this.filterSelections.hasOwnProperty(filter.key)) {
          if (typeof filter.value !== 'undefined') {
            this.filterSelections[filter.key] = filter.value;
          } else if (filter.selection === 'multi' && Array.isArray(filter.values)) {
            this.filterSelections[filter.key] = filter.values;
          }
        }
      });
    }

    if (changes['data'] || changes['initialLoading']) {
      this.resolveInitialLoadState();
    }
  }

  private get hasRows(): boolean {
    return Array.isArray(this.data) && this.data.length > 0;
  }

  private resolveInitialLoadState(): void {
    if (this.initialLoadResolved) return;
    if (this.hasRows || (!this.initialLoading && Array.isArray(this.data))) {
      this.initialLoadResolved = true;
    }
  }

  get sortedData(): any[] {
    const data = this.data ?? [];
    if (!this.sortKey || !this.sortDir) return data;
    const column = this.columns.find(c => c.key === this.sortKey);
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const sorted = [...data];
    sorted.sort((a, b) => {
      const av = this.getSortValue(a, this.sortKey!, column);
      const bv = this.getSortValue(b, this.sortKey!, column);
      if (av === null && bv === null) return 0;
      if (av === null) return 1 * dir;
      if (bv === null) return -1 * dir;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }

  private getSortValue(item: any, key: string, column?: TableColumn): any {
    const raw = key.split('.').reduce((acc, part) => acc && acc[part], item);
    if (raw === undefined || raw === null) return null;
    if (column?.type === 'date' || column?.type === 'time') {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? String(raw).toLowerCase() : d.getTime();
    }
    if (typeof raw === 'number') return raw;
    return String(raw).trim().toLowerCase();
  }

  getCellValue(item: any, key: string): any {
    return key.split('.').reduce((acc, part) => acc && acc[part], item);
  }

  getInitials(value: any): string {
    if (!value) return '?';
    const str = String(value).trim().toUpperCase();
    return str[0];
  }

  formatTime(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const mins = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${mins} ${ampm}`;
  }

  getStatusTag(column: TableColumn, value: any, item?: any): { label: string; color: TagColor } {
    const opts = column.statusOptions || [];
    const key = String(value).trim().toLowerCase();
    const match = opts.find(o => String(o.value).trim().toLowerCase() === key);
    if (match) {
      return {
        label: match.label ?? String(value),
        color: match.color,
      };
    }
    const rowColor = column.statusColorKey && item ? this.getCellValue(item, column.statusColorKey) : null;
    const fallbackColor = (rowColor as TagColor) || column.statusDefault?.color || 'gray';
    const fallbackLabel = column.statusDefault?.label ?? String(value);
    return { label: fallbackLabel, color: fallbackColor };
  }

  isCellDisabled(item: any, column: TableColumn): boolean {
    if (!column.disabledKey) return false;
    return !!this.getCellValue(item, column.disabledKey);
  }

  getCellBadge(item: any, column: TableColumn): string {
    if (!column.badgeKey) return '';
    const value = this.getCellValue(item, column.badgeKey);
    return value == null ? '' : String(value);
  }

  isSortable(column: TableColumn): boolean {
    return column.type !== 'actions' && column.type !== 'custom' && column.type !== 'checkbox' && column.type !== 'dropdown';
  }

  getSortIcon(column: TableColumn): string {
    if (this.sortKey !== column.key || !this.sortDir) return 'bi-arrow-down-up';
    return this.sortDir === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }

  onSort(column: TableColumn): void {
    if (!this.isSortable(column)) return;
    if (this.sortKey !== column.key) {
      this.sortKey = column.key;
      this.sortDir = 'asc';
    } else if (this.sortDir === 'asc') {
      this.sortDir = 'desc';
    } else if (this.sortDir === 'desc') {
      this.sortDir = null;
      this.sortKey = null;
    } else {
      this.sortDir = 'asc';
    }
    this.sortChange.emit({ sortKey: this.sortKey, sortDir: this.sortDir });
  }

  onSearchInput(columnKey: string, value: string): void {
    this.columnQueries[columnKey] = value;
    const prev = this.timers.get(columnKey);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.searchChange.emit({ ...this.columnQueries });
    }, this.searchDebounce);
    this.timers.set(columnKey, t);
  }

  onFilterSelectionChange(key: string, value: any): void {
    this.filterSelections[key] = value;
    this.filterChange.emit({ ...this.filterSelections });
  }

  onCheckboxToggle(column: TableColumn, item: any, checked: boolean): void {
    if (item && column.key) {
      item[column.key] = checked;
    }
    this.checkboxChange.emit({ column, item, checked });
  }

  onDropdownSelection(column: TableColumn, item: any, value: any): void {
    if (item && column.key) {
      item[column.key] = value;
    }
    this.dropdownChange.emit({ column, item, value });
  }

  onInputValueChange(column: TableColumn, item: any, value: any): void {
    const normalizedValue =
      column.inputType === 'number'
        ? (value === '' || value === null ? '' : Number(value))
        : value;
    if (item && column.key) {
      item[column.key] = normalizedValue;
    }
    this.inputChange.emit({ column, item, value: normalizedValue });
  }

  onInputFocus(column: TableColumn, item: any, event: FocusEvent): void {
    if (column.inputType !== 'number') return;

    const currentValue = item?.[column.key];
    if (currentValue !== 0 && currentValue !== '0') return;

    if (item && column.key) {
      item[column.key] = '';
    }

    const input = event.target as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  isDropdownOptionSelected(item: any, column: TableColumn, value: any): boolean {
    return this.getCellValue(item, column.key) === value;
  }

  isFilterAll(key: string): boolean {
    const value = this.filterSelections?.[key];
    return value === null || typeof value === 'undefined';
  }

  isFilterActive(key: string, value: any): boolean {
    const current = this.filterSelections?.[key];
    if (Array.isArray(current)) return current.includes(value);
    return current === value;
  }

  getFilterButtonLabel(filter: TableFilterConfig): string {
    const value = this.filterSelections?.[filter.key];
    if (value === null || typeof value === 'undefined') {
      return `${filter.label} (All)`;
    }
    if (Array.isArray(value)) {
      return `${filter.label} (${value.length})`;
    }
    const option = (filter.options ?? []).find(o => o.value === value);
    return option?.label ?? filter.label;
  }

  onPageChange(page: number): void {
    if (
      this.metadata &&
      this.metadata.totalPages &&
      this.metadata.totalPages > 0 &&
      page >= 1 &&
      page <= this.metadata.totalPages &&
      page !== this.metadata.pageNumber
    ) {
      this.pageChange.emit(page);
    }
  }

  onActionClick(action: ActionOption, item: any): void {
    this.actionClick.emit({ action, item });
  }

  trackByRow(index: number, item: any): any {
    return item?.id ?? item?.uuid ?? item?.orderUuid ?? item?.displayIndex ?? index;
  }

  trackByColumn(index: number, column: TableColumn): string {
    return column.key || String(index);
  }

  getRowArray(): any[] {
    return Array(5).fill(0); // 5 rows for skeleton
  }

  getCellArray(): any[] {
    return Array(4).fill(0); // 4 columns for skeleton
  }
}
