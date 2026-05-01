import { Component, OnInit } from '@angular/core';
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
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import {
  Delivery, OrderBatch,
  DeliveryItemStatus,
  DELIVERY_CATEGORIES
} from '../../models';

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, StatCardsComponent, TableComponent, DateFilterComponent],
  template: `
    <div class="dv-page">
      <div class="dv-toast dv-toast-success" *ngIf="successMessage">
        <span class="material-icons">check_circle</span>
        <span>{{ successMessage }}</span>
      </div>

      <div class="dv-page-header">
        <div class="dv-header-left">
          <div class="dv-header-icon">
            <span class="material-icons">local_shipping</span>
          </div>
          <div>
            <h1 class="dv-title">Deliveries</h1>
            <p class="dv-subtitle">Manage customer delivery batches and statuses</p>
          </div>
        </div>
      </div>

      <div class="dv-card">

      <!-- BATCH GRID VIEW -->
      <ng-container *ngIf="!selectedBatch">
        <app-batch-list-section
          [loading]="loading"
          [items]="paginatedDeliveryBatches"
          [page]="batchPage"
          [pageSize]="batchPageSize"
          [total]="filteredDeliveryBatches.length"
          [searchTerm]="batchSearchTerm"
          [selectedMonth]="batchFilterMonth"
          [selectedYear]="batchFilterYear"
          [currentYear]="currentYear"
          [searchPlaceholder]="'Search batches...'"
          [emptyTitle]="'No delivery batches yet'"
          [emptyDescription]="'Items will appear here after clients are sent to deliveries from the Shipping Ledger.'"
          [titleResolver]="deliveryBatchTitleResolver"
          [subtitleResolver]="deliveryBatchSubtitleResolver"
          [iconResolver]="deliveryBatchIconResolver"
          [tagsResolver]="deliveryBatchTagsResolver"
          (searchTermChange)="onBatchSearchInput($event)"
          (dateSelectionChange)="onBatchMonthYearChange($event)"
          (pageChange)="setBatchPage($event)"
          (cardClick)="openBatch($event)">
          <ng-template batchSectionFooter let-batch>
            <button class="dv-card-action-btn dv-cab-primary dv-open-btn" (click)="$event.stopPropagation(); openBatch(batch)">
              <span class="material-icons">open_in_new</span> View Deliveries
            </button>
          </ng-template>
        </app-batch-list-section>

      </ng-container>

      <!-- BATCH DETAIL VIEW -->
      <ng-container *ngIf="selectedBatch">

        <div class="dv-detail-header">
          <button class="dv-back-btn" (click)="goBack()">
            <span class="material-icons">arrow_back</span>
          </button>
          <div class="dv-detail-icon">
            <span class="material-icons">inventory_2</span>
          </div>
          <div class="dv-detail-title-wrap">
            <h2 class="dv-detail-title">{{ selectedBatch.name }}</h2>
            <p class="dv-detail-sub">Batch deliveries</p>
          </div>
        </div>

        <app-stat-cards [config]="deliveryStatCards"></app-stat-cards>

        <app-table
          [columns]="deliveryColumns"
          [data]="deliveryTableRows"
          [metadata]="deliveryMetadata"
          [filters]="deliveryFilters"
          [showSearchRow]="true"
          [showToolbarStart]="true"
          [initialLoading]="loadingDetail"
          [tableLabel]="'Clients'"
          [summaryLabel]="'Clients'"
          [summaryValue]="filteredDeliveries.length"
          (searchChange)="onDeliveryTableSearchChange($event)"
          (filterChange)="onDeliveryTableFilterChange($event)"
          (inputChange)="onDeliveryTableInputChange($event)"
          (dropdownChange)="onDeliveryTableDropdownChange($event)"
          (actionClick)="onDeliveryTableActionClick($event)"
          (pageChange)="setDeliveryPage($event)">
          <app-date-filter
            table-toolbar-start
            (dateChange)="onDeliveryDateChange($event)">
          </app-date-filter>
        </app-table>

      </ng-container>

      </div><!-- /dv-card -->

      <!-- DELIVERY ITEMS MODAL -->
      <div class="dv-modal-overlay" *ngIf="showItemsModal" (click)="closeItemsModal()">
        <div class="dv-modal" (click)="$event.stopPropagation()">
          <div class="dv-modal-header">
            <div class="dv-modal-title-row">
              <span class="material-icons dv-modal-icon">person</span>
              <div>
                <h3 class="dv-modal-title">{{ viewingDelivery?.clientName || 'Client' }}</h3>
                <p class="dv-modal-sub">{{ viewingDelivery?.clientPhone || '—' }}</p>
              </div>
            </div>
            <button class="dv-close-btn" (click)="closeItemsModal()">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="dv-modal-body">
            <div class="dv-info-grid">
              <div class="dv-info-item">
                <span class="dv-info-label">Address</span>
                <span class="dv-info-value">{{ viewingDelivery?.clientAddress || viewingDelivery?.deliveryAddress || '—' }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">Delivery Type</span>
                <span class="dv-info-value">{{ viewingDelivery?.deliveryCategory ? getDeliveryCategoryLabel(viewingDelivery!.deliveryCategory) : '—' }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">Delivery Fee</span>
                <span class="dv-info-value">GHS {{ (viewingDelivery?.deliveryFee || 0) | number:'1.2-2' }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">Status</span>
                <span [class]="'dv-istatus-pill dv-istatus-pill-' + (viewingDelivery?.deliveryItemStatus || 'pending')">
                  {{ viewingDelivery?.deliveryItemStatus || 'pending' }}
                </span>
              </div>
            </div>

            <div class="dv-modal-section">
              <h4 class="dv-modal-section-title">Items Ordered</h4>
              <div class="dv-items-chips">
                <span class="dv-item-chip" *ngFor="let item of viewingDeliveryItemsList">{{ item }}</span>
                <span class="dv-dash" *ngIf="viewingDeliveryItemsList.length === 0">No items</span>
              </div>
            </div>

            <div class="dv-modal-section" *ngIf="authService.can('edit','deliveries')">
              <h4 class="dv-modal-section-title">Update Status</h4>
              <div class="dv-status-btns">
                <button
                  *ngFor="let s of ['pending','packaged','delivering','delivered']"
                  [class]="'dv-qstatus-btn dv-qstatus-' + s"
                  [class.dv-qstatus-active]="viewingDelivery?.deliveryItemStatus === s"
                  (click)="quickUpdateStatus(s)"
                >
                  {{ s | titlecase }}
                </button>
              </div>
            </div>

            <div class="dv-modal-section dv-damage-section" *ngIf="authService.can('edit','damaged_items')">
              <h4 class="dv-modal-section-title">Report Damaged Item</h4>
              <div class="dv-damage-form">
                <div class="dv-damage-row">
                  <label>Product</label>
                  <select [(ngModel)]="damageProductId">
                    <option [ngValue]="null">Select product</option>
                    <option *ngFor="let p of products" [ngValue]="p.id">{{ p.name }}</option>
                  </select>
                </div>
                <div class="dv-damage-row">
                  <label>Quantity</label>
                  <input type="number" [(ngModel)]="damageQuantity" min="1" />
                </div>
                <div class="dv-damage-row">
                  <label>Note</label>
                  <input type="text" [(ngModel)]="damageNote" placeholder="Optional note" />
                </div>
                <button class="dv-damage-btn" (click)="reportDamagedFromDelivery()">
                  <span class="material-icons">warning</span> Record Damaged
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dv-modal-overlay" *ngIf="showStatusConfirmModal" (click)="closeStatusConfirmModal()">
        <div class="dv-modal dv-confirm-modal" (click)="$event.stopPropagation()">
          <div class="dv-modal-header">
            <div class="dv-modal-title-row">
              <span class="material-icons dv-modal-icon">inventory</span>
              <div>
                <h3 class="dv-modal-title">{{ statusConfirmTitle }}</h3>
                <p class="dv-modal-sub">{{ statusConfirmDelivery?.clientName || 'Client' }}</p>
              </div>
            </div>
            <button class="dv-close-btn" (click)="closeStatusConfirmModal()" [disabled]="statusConfirmSubmitting">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="dv-modal-body">
            <p class="dv-confirm-copy">{{ statusConfirmBody }}</p>

            <div class="dv-info-grid dv-confirm-grid">
              <div class="dv-info-item">
                <span class="dv-info-label">Current Status</span>
                <span class="dv-info-value">{{ getStatusLabel(statusConfirmCurrentStatus) }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">New Status</span>
                <span class="dv-info-value">{{ getStatusLabel(statusConfirmNextStatus) }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">Batch</span>
                <span class="dv-info-value">{{ statusConfirmDelivery?.batchName || '—' }}</span>
              </div>
              <div class="dv-info-item">
                <span class="dv-info-label">Total Quantity</span>
                <span class="dv-info-value">{{ statusConfirmDelivery?.quantity || 0 }}</span>
              </div>
            </div>

            <div class="dv-modal-section" *ngIf="statusConfirmItemsList.length > 0">
              <h4 class="dv-modal-section-title">Affected Items</h4>
              <div class="dv-items-chips">
                <span class="dv-item-chip" *ngFor="let item of statusConfirmItemsList">{{ item }}</span>
              </div>
            </div>

            <p class="dv-confirm-note" *ngIf="statusConfirmItemsList.length === 0">
              The linked delivery items for this client will be {{ statusConfirmIsRemovingStock ? 'removed from' : 'returned to' }} stock.
            </p>
          </div>

          <div class="dv-modal-footer">
            <button class="dv-modal-btn dv-modal-btn-ghost" (click)="closeStatusConfirmModal()" [disabled]="statusConfirmSubmitting">
              Cancel
            </button>
            <button
              class="dv-modal-btn"
              [class.dv-modal-btn-danger]="statusConfirmIsRemovingStock"
              [class.dv-modal-btn-primary]="!statusConfirmIsRemovingStock"
              (click)="confirmStatusChange()"
              [disabled]="statusConfirmSubmitting">
              <span class="dv-btn-spinner" *ngIf="statusConfirmSubmitting"></span>
              <span *ngIf="!statusConfirmSubmitting">{{ statusConfirmActionLabel }}</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dv-page { max-width: 1400px; }

    .dv-toast {
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
      animation: dv-toast-in 0.18s ease-out;
    }

    .dv-toast .material-icons {
      font-size: 18px;
    }

    .dv-toast-success {
      background: #ecfdf5;
      color: #166534;
      border-color: #bbf7d0;
    }

    @keyframes dv-toast-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dv-card {
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 14px;
      padding: 20px;
      overflow: hidden;
    }

    .dv-page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .dv-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .dv-header-icon {
      width: 46px;
      height: 46px;
      background: var(--primary-color, #6366f1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .dv-header-icon .material-icons { color: #fff; font-size: 24px; }
    .dv-title { margin: 0; font-size: 20px; font-weight: 700; }
    .dv-subtitle { margin: 2px 0 0; font-size: 13px; color: #64748b; }

    .dv-card-action-btn {
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
    .dv-cab-primary {
      background: var(--primary-color, #6366f1);
      color: #fff;
      border-color: var(--primary-color, #6366f1);
    }
    .dv-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .dv-open-btn { width: 100%; justify-content: center; }

    @keyframes dv-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .dv-sk {
      border-radius: 6px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: dv-shimmer 1.4s infinite;
    }
    .dv-sk-title  { height: 18px; width: 70%; margin-bottom: 10px; }
    .dv-sk-line   { height: 13px; margin-bottom: 8px; }
    .dv-sk-chip   { height: 22px; width: 80px; border-radius: 20px; margin-top: 4px; }
    .dv-sk-cell   { height: 16px; }
    .dv-skeleton-card { pointer-events: none; }

    .dv-batch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .dv-batch-card {
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 14px;
      padding: 20px;
      cursor: pointer;
      transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
    }
    .dv-batch-card:hover {
      border-color: var(--primary-color, #6366f1);
      box-shadow: 0 4px 18px rgba(99,102,241,0.12);
      transform: translateY(-2px);
    }
    .dv-batch-completed { opacity: 0.7; }
    .dv-batch-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .dv-batch-icon {
      width: 36px;
      height: 36px;
      background: #ede9fe;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dv-batch-icon .material-icons { font-size: 20px; color: #7c3aed; }
    .dv-batch-name {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dv-batch-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .dv-batch-meta span { display: flex; align-items: center; gap: 3px; }
    .dv-meta-icon { font-size: 14px !important; }
    .dv-batch-progress {
      height: 4px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .dv-batch-progress-fill {
      height: 100%;
      background: #10b981;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .dv-batch-status-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 20px;
    }
    .dv-dstatus-pending    { background: #fef3c7; color: #92400e; }
    .dv-dstatus-in_progress{ background: #dbeafe; color: #1e40af; }
    .dv-dstatus-completed  { background: #d1fae5; color: #065f46; }
    .dv-dstatus-not_sent   { background: #f1f5f9; color: #475569; }

    .dv-empty {
      text-align: center;
      padding: 64px 24px;
      color: #94a3b8;
    }
    .dv-empty .material-icons { font-size: 48px; margin-bottom: 12px; display: block; }
    .dv-empty h3 { margin: 0 0 8px; color: #475569; font-size: 16px; }
    .dv-empty p  { margin: 0; font-size: 14px; }

    .dv-detail-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 18px;
      border-bottom: 1px solid #ccc;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .dv-back-btn {
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
    .dv-back-btn:hover { background: #e2e8f0; }
    .dv-back-btn .material-icons { font-size: 20px; }
    .dv-detail-icon {
      width: 40px;
      height: 40px;
      background: #ede9fe;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .dv-detail-icon .material-icons { font-size: 20px; color: #7c3aed; }
    .dv-detail-title-wrap { flex: 1; min-width: 0; }
    .dv-detail-title { margin: 0; font-size: 17px; font-weight: 700; }
    .dv-detail-sub { margin: 2px 0 0; font-size: 12px; color: #64748b; }
    .dv-detail-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .dv-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .dv-chip .material-icons { font-size: 14px; }
    .dv-chip-pending    { background: #fef3c7; color: #92400e; }
    .dv-chip-packaged   { background: #e0e7ff; color: #3730a3; }
    .dv-chip-delivering { background: #dbeafe; color: #1e40af; }
    .dv-chip-delivered  { background: #d1fae5; color: #065f46; }

    .dv-stats-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    @media (max-width: 900px) { .dv-stats-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 560px) { .dv-stats-row { grid-template-columns: repeat(2, 1fr); } }
    .dv-stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 12px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      text-align: center;
    }
    .dv-stat-card .material-icons { font-size: 22px; }
    .dv-stat-num { font-size: 24px; font-weight: 700; line-height: 1.1; }
    .dv-stat-num-fee { font-size: 15px; }
    .dv-stat-lbl { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

    .dv-stat-pending   { border-top: 3px solid #f59e0b; }
    .dv-stat-pending   .material-icons { color: #f59e0b; }
    .dv-stat-pending   .dv-stat-num    { color: #92400e; }

    .dv-stat-packaged  { border-top: 3px solid #6366f1; }
    .dv-stat-packaged  .material-icons { color: #6366f1; }
    .dv-stat-packaged  .dv-stat-num    { color: #3730a3; }

    .dv-stat-delivering { border-top: 3px solid #3b82f6; }
    .dv-stat-delivering .material-icons { color: #3b82f6; }
    .dv-stat-delivering .dv-stat-num    { color: #1e40af; }

    .dv-stat-delivered  { border-top: 3px solid #10b981; }
    .dv-stat-delivered  .material-icons { color: #10b981; }
    .dv-stat-delivered  .dv-stat-num    { color: #065f46; }

    .dv-stat-fees       { border-top: 3px solid #8b5cf6; }
    .dv-stat-fees       .material-icons { color: #8b5cf6; }
    .dv-stat-fees       .dv-stat-num    { color: #5b21b6; }

    .dv-action-cell { white-space: nowrap; display: flex; align-items: center; gap: 6px; }
    .dv-edit-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: #f1f5f9; color: #64748b;
      border: 1px solid #e2e8f0; border-radius: 8px;
      cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .dv-edit-btn .material-icons { font-size: 16px; }
    .dv-edit-btn:hover { background: #dbeafe; color: #2563eb; border-color: #93c5fd; }
    .dv-cancel-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: #fee2e2; color: #dc2626;
      border: 1px solid #fca5a5; border-radius: 8px;
      cursor: pointer; transition: background 0.15s;
    }
    .dv-cancel-btn .material-icons { font-size: 16px; }
    .dv-cancel-btn:hover:not([disabled]) { background: #fecaca; }
    .dv-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .dv-toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .dv-search-wrap { position: relative; flex: 1; min-width: 180px; }
    .dv-search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px !important;
      color: #94a3b8;
      pointer-events: none;
    }
    .dv-search {
      width: 100%;
      padding: 8px 12px 8px 36px;
      border: 1px solid #ccc;
      border-radius: 10px;
      font-size: 13px;
      background: #fff;
      box-sizing: border-box;
    }
    .dv-search:focus { outline: none; border-color: var(--primary-color, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .dv-dd-list { list-style: none; margin: 0; padding: 0; }
    .dv-dd-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #334155;
      cursor: pointer; transition: background 0.12s, color 0.12s; white-space: nowrap;
    }
    .dv-dd-item:hover { background: rgba(var(--primary-rgb, 99,102,241), 0.07); color: var(--primary-color, #6366f1); }
    .dv-dd-active { color: var(--primary-color, #6366f1); font-weight: 700; }
    .dv-dd-check { font-size: 16px; color: var(--primary-color, #6366f1); visibility: hidden; flex-shrink: 0; }
    .dv-dd-active .dv-dd-check { visibility: visible; }

    .dv-table-wrap {
      margin: 0 -20px -20px;
      border-top: 1px solid #ccc;
      overflow-x: auto;
    }
    .dv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .dv-table thead tr { background: #f8fafc; }
    .dv-table thead th {
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.04em;
      white-space: nowrap;
      border-bottom: 1px solid #e2e8f0;
    }
    .dv-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
    .dv-table tbody tr:last-child { border-bottom: none; }
    .dv-table tbody tr:hover { background: #fafafe; }
    .dv-table tbody td { padding: 10px 14px; vertical-align: middle; }
    .dv-client-name { font-weight: 600; font-size: 13px; }
    .dv-client-phone { font-size: 12px; color: #64748b; margin-top: 2px; }
    .dv-date-cell { white-space: nowrap; color: #64748b; }
    .dv-dash { color: #94a3b8; font-style: italic; }
    .dv-empty-row { text-align: center; padding: 32px !important; color: #94a3b8; }
    .dv-empty-row .material-icons { font-size: 28px; vertical-align: middle; margin-right: 8px; }

    @keyframes dv-saved-flash {
      0%   { background: #d1fae5; }
      100% { background: transparent; }
    }
    .dv-row-saved { animation: dv-saved-flash 1.4s ease-out forwards; }

    .dv-items-link {
      background: none;
      border: none;
      color: var(--primary-color, #6366f1);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }
    .dv-items-link:hover { color: #4f46e5; }

    .dv-type-select {
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 13px;
      background: #fff;
      min-width: 120px;
    }
    .dv-type-select:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .dv-type-select:focus { outline: none; border-color: var(--primary-color, #6366f1); }

    .dv-fee-input {
      width: 100px;
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 13px;
      text-align: right;
      background: #fff;
    }
    .dv-fee-input:focus { outline: none; border-color: var(--primary-color, #6366f1); }
    .dv-fee-input:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .dv-fee-locked { border-color: #e2e8f0 !important; }

    .dv-status-select {
      padding: 5px 10px;
      border-radius: 8px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .dv-status-select:disabled { opacity: 0.7; cursor: not-allowed; }
    .dv-istatus-pending    { background: #fef3c7; color: #92400e; }
    .dv-istatus-packaged   { background: #e0e7ff; color: #3730a3; }
    .dv-istatus-delivering { background: #dbeafe; color: #1e40af; }
    .dv-istatus-delivered  { background: #d1fae5; color: #065f46; }

    .dv-save-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-color, #6366f1);
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, opacity 0.15s;
    }
    .dv-save-btn .material-icons { font-size: 16px; }
    .dv-save-btn:hover:not([disabled]) { background: #4f46e5; }
    .dv-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .dv-btn-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: dv-spin 0.7s linear infinite;
    }
    @keyframes dv-spin { to { transform: rotate(360deg); } }

    .dv-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-top: 1px solid #ccc;
      font-size: 13px;
      color: #64748b;
    }
    .dv-page-btns { display: flex; align-items: center; gap: 4px; }
    .dv-page-btns button {
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .dv-page-btns button .material-icons { font-size: 18px; }
    .dv-page-btns button:disabled { opacity: 0.4; cursor: not-allowed; }
    .dv-page-btns button:hover:not([disabled]) { background: #f1f5f9; }
    .dv-page-num { font-size: 13px; padding: 0 6px; }

    .dv-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .dv-modal {
      background: #fff;
      border-radius: 16px;
      width: 100%;
      max-width: 600px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .dv-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .dv-modal-title-row { display: flex; align-items: center; gap: 12px; }
    .dv-modal-icon { color: var(--primary-color, #6366f1); font-size: 28px !important; }
    .dv-modal-title { margin: 0; font-size: 16px; font-weight: 700; }
    .dv-modal-sub { margin: 2px 0 0; font-size: 12px; color: #64748b; }
    .dv-close-btn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: #f1f5f9;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .dv-close-btn .material-icons { font-size: 18px; color: #64748b; }
    .dv-close-btn:hover { background: #e2e8f0; }
    .dv-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .dv-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 20px 20px;
      border-top: 1px solid #f1f5f9;
    }
    .dv-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 18px;
    }
    .dv-info-item { display: flex; flex-direction: column; gap: 2px; }
    .dv-info-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .dv-info-value { font-size: 13px; font-weight: 500; }
    .dv-modal-section { margin-bottom: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
    .dv-modal-section-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #475569; }
    .dv-items-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .dv-item-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
    }
    .dv-status-btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .dv-qstatus-btn {
      padding: 6px 14px;
      border-radius: 8px;
      border: 1.5px solid transparent;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.12s;
    }
    .dv-qstatus-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .dv-qstatus-active { outline: 2px solid #6366f1; outline-offset: 2px; }
    .dv-qstatus-pending    { background: #fef3c7; color: #92400e; border-color: #f59e0b; }
    .dv-qstatus-packaged   { background: #e0e7ff; color: #3730a3; border-color: #6366f1; }
    .dv-qstatus-delivering { background: #dbeafe; color: #1e40af; border-color: #3b82f6; }
    .dv-qstatus-delivered  { background: #d1fae5; color: #065f46; border-color: #10b981; }

    .dv-istatus-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .dv-istatus-pill-pending    { background: #fef3c7; color: #92400e; }
    .dv-istatus-pill-packaged   { background: #e0e7ff; color: #3730a3; }
    .dv-istatus-pill-delivering { background: #dbeafe; color: #1e40af; }
    .dv-istatus-pill-delivered  { background: #d1fae5; color: #065f46; }
    .dv-confirm-modal { max-width: 520px; }
    .dv-confirm-grid { margin-bottom: 0; }
    .dv-confirm-copy {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .dv-confirm-note {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .dv-modal-btn {
      min-width: 148px;
      padding: 10px 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    .dv-modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .dv-modal-btn-ghost {
      background: #fff;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .dv-modal-btn-ghost:hover:not([disabled]) { background: #f8fafc; }
    .dv-modal-btn-primary {
      background: var(--primary-color, #6366f1);
      color: #fff;
    }
    .dv-modal-btn-primary:hover:not([disabled]) { background: #4f46e5; }
    .dv-modal-btn-danger {
      background: #dc2626;
      color: #fff;
    }
    .dv-modal-btn-danger:hover:not([disabled]) { background: #b91c1c; }

    .dv-damage-section {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px;
      padding: 14px;
    }
    .dv-damage-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .dv-damage-row label { width: 90px; font-size: 12px; font-weight: 600; color: #92400e; flex-shrink: 0; }
    .dv-damage-row select,
    .dv-damage-row input {
      flex: 1;
      padding: 7px 10px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      background: #fff;
      font-size: 13px;
    }
    .dv-damage-row select:focus,
    .dv-damage-row input:focus { outline: none; border-color: #f59e0b; }
    .dv-damage-row input[type="number"] { max-width: 100px; text-align: right; }
    .dv-damage-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #ef4444;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 6px;
    }
    .dv-damage-btn .material-icons { font-size: 16px; }
    .dv-damage-btn:hover { background: #dc2626; }
  `]
})
export class DeliveriesComponent implements OnInit {
  loading = true;
  loadingDetail = false;

  allBatches: OrderBatch[] = [];
  deliveryBatches: OrderBatch[] = [];
  allDeliveries: Delivery[] = [];
  filteredDeliveries: Delivery[] = [];

  selectedBatch: OrderBatch | null = null;

  searchTerm = '';
  statusFilter = 'all';
  deliveryTypeFilter = 'all';

  readonly statusOptions = [
    { value: 'all',        label: 'All Status'  },
    { value: 'pending',    label: 'Pending'     },
    { value: 'packaged',   label: 'Packaged'    },
    { value: 'delivering', label: 'Delivering'  },
    { value: 'delivered',  label: 'Delivered'   },
  ];

  readonly typeOptions = [
    { value: 'all',                  label: 'All Types'   },
    { value: 'station_car_delivery', label: 'Station Car' },
    { value: 'riders',               label: 'Riders'      },
    { value: 'ghana_post',           label: 'Ghana Post'  },
  ];

  get statusFilterLabel() {
    return this.statusOptions.find(o => o.value === this.statusFilter)?.label ?? 'All Status';
  }

  get typeFilterLabel() {
    return this.typeOptions.find(o => o.value === this.deliveryTypeFilter)?.label ?? 'All Types';
  }
  dateFrom = '';
  dateTo = '';
  batchPage = 1;
  batchPageSize = 20;
  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();

  deliveryPage = 1;
  deliveryPageSize = 20;
  deliveryColumns: TableColumn[] = [];

  get filteredDeliveryBatches() {
    const term = this.batchSearchTerm.trim().toLowerCase();
    return this.deliveryBatches.filter(batch => {
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

  get paginatedDeliveryBatches() {
    const start = (this.batchPage - 1) * this.batchPageSize;
    return this.filteredDeliveryBatches.slice(start, start + this.batchPageSize);
  }

  get totalBatchPages() {
    return Math.ceil(this.filteredDeliveryBatches.length / this.batchPageSize) || 1;
  }

  get paginatedDeliveries() {
    const start = (this.deliveryPage - 1) * this.deliveryPageSize;
    return this.filteredDeliveries.slice(start, start + this.deliveryPageSize);
  }

  get totalDeliveryPages() {
    return Math.ceil(this.filteredDeliveries.length / this.deliveryPageSize) || 1;
  }

  get totalDeliveryFee(): number {
    return this.batchDeliveries.reduce((sum, d) => sum + (Number(d.deliveryFee) || 0), 0);
  }

  get deliveryStatCards(): StatCardConfig[] {
    return [
      { icon: 'hourglass_empty', statName: 'Pending', statValue: this.statusCounts.pending, color: 'orange' },
      { icon: 'inventory_2', statName: 'Packaged', statValue: this.statusCounts.packaged, color: 'violet' },
      { icon: 'local_shipping', statName: 'Delivering', statValue: this.statusCounts.delivering, color: 'blue' },
      { icon: 'check_circle', statName: 'Delivered', statValue: this.statusCounts.delivered, color: 'green' },
      { icon: 'payments', statName: 'Total Fees', statValue: `GHS ${this.totalDeliveryFee.toFixed(2)}`, color: 'green' }
    ];
  }

  get deliveryMetadata(): TableMetadata | null {
    if (!this.selectedBatch) return null;
    return {
      pageNumber: this.deliveryPage,
      totalCount: this.filteredDeliveries.length,
      pageSize: this.deliveryPageSize,
      totalPages: this.totalDeliveryPages
    };
  }

  get deliveryFilters(): TableFilterConfig[] {
    return [
      {
        key: 'status',
        label: 'All statuses',
        value: this.statusFilter,
        disableAll: true,
        options: this.statusOptions.map(opt => ({ label: opt.label, value: opt.value }))
      },
      {
        key: 'deliveryType',
        label: 'All types',
        value: this.deliveryTypeFilter,
        disableAll: true,
        options: this.typeOptions.map(opt => ({ label: opt.label, value: opt.value }))
      }
    ];
  }

  get deliveryTableRows(): any[] {
    return this.paginatedDeliveries.map(delivery => {
      const id = delivery.id ?? 0;
      const saving = this.savingDeliveryIds.has(id);
      const canEdit = this.authService.can('edit', 'deliveries');
      const isGhanaPost = delivery.deliveryCategory === 'ghana_post';

      const actions: ActionOption[] = [
        { id: 'view-items', label: 'View Items', icon: 'eye', color: 'blue' }
      ];

      if (canEdit) {
        actions.push(
          { id: 'save', label: 'Save', icon: 'check2', color: 'green', loading: saving, disabled: saving }
        );
      }

      return {
        deliveryKey: id,
        clientName: delivery.clientName || 'Unknown',
        clientPhone: delivery.clientPhone || '—',
        itemsCount: `${this.getItemCount(delivery)} item${this.getItemCount(delivery) !== 1 ? 's' : ''}`,
        deliveryCategory: delivery.deliveryCategory ?? 'none',
        deliveryFee: Number(delivery.deliveryFee || 0),
        deliveryItemStatus: delivery.deliveryItemStatus || 'pending',
        deliveryDate: delivery.deliveryDate || delivery.createdAt || null,
        categoryDisabled: !canEdit || saving,
        feeDisabled: !canEdit || saving || !isGhanaPost,
        statusDisabled: !canEdit || saving,
        actions
      };
    });
  }

  statusCounts = { pending: 0, packaged: 0, delivering: 0, delivered: 0 };
  batchDeliveryStats: { [name: string]: { clients: number; totalQty: number; delivered: number } } = {};

  savingDeliveryIds     = new Set<number>();
  savedDeliveryIds      = new Set<number>();
  editableDeliveryIds   = new Set<number>();
  private snapshotMap   = new Map<number, { deliveryCategory: any; deliveryFee: any; deliveryItemStatus: any }>();
  batchDeliveries: Delivery[] = [];
  private searchDebounceTimer: any = null;
  successMessage: string | null = null;
  private successTimer: any = null;

  showItemsModal = false;
  viewingDelivery: Delivery | null = null;
  viewingDeliveryItemsList: string[] = [];
  showStatusConfirmModal = false;
  statusConfirmSubmitting = false;
  statusConfirmMode: 'row' | 'quick' | null = null;
  statusConfirmDelivery: Delivery | null = null;
  statusConfirmCurrentStatus: DeliveryItemStatus = 'pending';
  statusConfirmNextStatus: DeliveryItemStatus = 'pending';
  products: { id?: number; name: string }[] = [];
  damageProductId: number | null = null;
  damageQuantity = 1;
  damageNote = '';

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService
  ) {
    this.initDeliveryColumns();
  }

  ngOnInit() { 
    this.loadData();
    // Reload batches when a batch is deleted elsewhere
    this.dbService.batchDeleted$.subscribe(() => {
      this.loadData();
    });
  }

  onSearchInput() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => this.filterDeliveries(), 300);
  }

  initDeliveryColumns() {
    this.deliveryColumns = [
      { key: 'clientName', label: 'Client', searchable: true },
      { key: 'clientPhone', label: 'Phone' },
      { key: 'itemsCount', label: 'Items' },
      {
        key: 'deliveryCategory',
        label: 'Delivery Type',
        type: 'dropdown',
        disabledKey: 'categoryDisabled',
        statusOptions: [
          { value: 'none', label: 'Select Type', color: 'gray' },
          { value: 'ghana_post', label: 'Ghana Post', color: 'orange' },
          { value: 'riders', label: 'Rider', color: 'blue' },
          { value: 'station_car_delivery', label: 'Station Car', color: 'violet' }
        ]
      },
      {
        key: 'deliveryFee',
        label: 'Delivery Fee',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 0.01,
        inputPlaceholder: '0.00',
        inputUpdateOn: 'change',
        disabledKey: 'feeDisabled'
      },
      {
        key: 'deliveryItemStatus',
        label: 'Status',
        type: 'dropdown',
        disabledKey: 'statusDisabled',
        statusOptions: [
          { value: 'pending', label: 'Pending', color: 'orange' },
          { value: 'packaged', label: 'Packaged', color: 'violet' },
          { value: 'delivering', label: 'Delivering', color: 'blue' },
          { value: 'delivered', label: 'Delivered', color: 'green' }
        ]
      },
      { key: 'deliveryDate', label: 'Date', type: 'date' },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];
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

  setDeliveryPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalDeliveryPages));
    if (next === this.deliveryPage) return;
    this.deliveryPage = next;
  }

  loadData() {
    this.loading = true;
    this.dbService.getOrderBatches().subscribe(batches => {
      this.allBatches = batches;
      this.dbService.getDeliveries().subscribe(deliveries => {
        this.dbService.getProducts().subscribe(ps => this.products = ps.map(p => ({ id: p.id, name: p.name })));
        this.allDeliveries = deliveries;
        this.buildDeliveryBatches();
        this.calculateBatchStats();
        this.loading = false;
      });
    });
  }

  buildDeliveryBatches() {
    const batchNames = new Set(this.allDeliveries.map(d => d.batchName).filter(Boolean));
    this.deliveryBatches = this.allBatches
      .filter(b => batchNames.has(b.name))
      .map(b => ({ ...b, deliveryStatus: b.deliveryStatus || 'pending' }));
    if (this.batchPage > this.totalBatchPages) {
      this.batchPage = this.totalBatchPages;
    }
  }

  calculateBatchStats() {
    this.batchDeliveryStats = {};
    this.allDeliveries.forEach(d => {
      const name = d.batchName || '';
      if (!name) return;
      if (!this.batchDeliveryStats[name]) {
        this.batchDeliveryStats[name] = { clients: 0, totalQty: 0, delivered: 0 };
      }
      this.batchDeliveryStats[name].clients++;
      this.batchDeliveryStats[name].totalQty += d.quantity;
      if (d.deliveryItemStatus === 'delivered' || d.status === 'delivered') {
        this.batchDeliveryStats[name].delivered++;
      }
    });
  }

  getDeliveredPct(batch: OrderBatch): number {
    const s = this.batchDeliveryStats[batch.name];
    if (!s || !s.clients) return 0;
    return Math.round((s.delivered / s.clients) * 100);
  }

  readonly deliveryBatchTitleResolver = (batch: OrderBatch) => batch.name;
  readonly deliveryBatchSubtitleResolver = (batch: OrderBatch) =>
    batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  readonly deliveryBatchIconResolver = () => 'local_shipping';
  readonly deliveryBatchTagsResolver = (batch: OrderBatch): BatchCardTagConfig[] => {
    const stats = this.batchDeliveryStats[batch.name] || { clients: 0, totalQty: 0, delivered: 0 };
    return [
      {
        tagName: this.getBatchStatusLabel(batch.deliveryStatus),
        color: batch.deliveryStatus === 'completed' ? 'green' : batch.deliveryStatus === 'in_progress' ? 'blue' : 'orange',
        icon: batch.deliveryStatus === 'completed' ? 'task_alt' : batch.deliveryStatus === 'in_progress' ? 'local_shipping' : 'pending'
      },
      {
        tagName: `${stats.clients} ${stats.clients === 1 ? 'Client' : 'Clients'}`,
        color: stats.clients > 0 ? 'blue' : 'gray',
        icon: 'group'
      },
      {
        tagName: `${stats.delivered} Delivered`,
        color: stats.delivered > 0 ? 'green' : 'gray',
        icon: 'check_circle'
      }
    ];
  };

  openBatch(batch: OrderBatch) {
    this.selectedBatch = batch;
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.deliveryTypeFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.editableDeliveryIds.clear();
    this.snapshotMap.clear();
    this.loadingDetail = true;
    this.dbService.getDeliveriesByBatch(batch.name).subscribe(deliveries => {
      this.batchDeliveries = deliveries;
      this.filterDeliveries();
      this.loadingDetail = false;
    });
  }

  goBack() {
    this.selectedBatch = null;
    this.filteredDeliveries = [];
  }

  computeStatusCounts() {
    const c = { pending: 0, packaged: 0, delivering: 0, delivered: 0 } as { [k: string]: number };
    this.batchDeliveries.forEach(d => {
      const s = (d.deliveryItemStatus || 'pending') as string;
      if (c[s] !== undefined) c[s]++;
    });
    this.statusCounts = {
      pending: c['pending'],
      packaged: c['packaged'],
      delivering: c['delivering'],
      delivered: c['delivered']
    };
  }

  filterDeliveries() {
    let filtered = this.batchDeliveries;
    this.computeStatusCounts();
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.clientName?.toLowerCase().includes(term) ||
        d.items?.toLowerCase().includes(term)
      );
    }
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(d => (d.deliveryItemStatus || 'pending') === this.statusFilter);
    }
    if (this.deliveryTypeFilter !== 'all') {
      filtered = filtered.filter(d => d.deliveryCategory === this.deliveryTypeFilter);
    }
    if (this.dateFrom) {
      filtered = filtered.filter(d => (d.createdAt || '').substring(0, 10) >= this.dateFrom);
    }
    if (this.dateTo) {
      filtered = filtered.filter(d => (d.createdAt || '').substring(0, 10) <= this.dateTo);
    }
    this.filteredDeliveries = filtered;
    this.deliveryPage = 1;
  }

  onDeliveryTableSearchChange(query: Record<string, string>) {
    this.searchTerm = (query['clientName'] || '').trim();
    this.filterDeliveries();
  }

  onDeliveryTableFilterChange(filters: Record<string, any>) {
    this.statusFilter = filters['status'] || 'all';
    this.deliveryTypeFilter = filters['deliveryType'] || 'all';
    this.filterDeliveries();
  }

  onDeliveryDateChange(selection: { from: string; to: string }) {
    this.dateFrom = selection.from;
    this.dateTo = selection.to;
    this.filterDeliveries();
  }

  onDeliveryTableInputChange(event: { column: TableColumn; item: any; value: any }) {
    if (event.column.key !== 'deliveryFee') return;
    const delivery = this.findDeliveryByKey(event.item?.deliveryKey);
    if (!delivery) return;
    this.ensureDeliverySnapshot(delivery);
    delivery.deliveryFee = Number(event.value || 0);
  }

  onDeliveryTableDropdownChange(event: { column: TableColumn; item: any; value: any }) {
    const delivery = this.findDeliveryByKey(event.item?.deliveryKey);
    if (!delivery) return;
    this.ensureDeliverySnapshot(delivery);

    if (event.column.key === 'deliveryCategory') {
      delivery.deliveryCategory = event.value === 'none' ? undefined : event.value;
      if (delivery.deliveryCategory !== 'ghana_post') {
        delivery.deliveryFee = 0;
      }
      return;
    }

    if (event.column.key === 'deliveryItemStatus') {
      delivery.deliveryItemStatus = event.value as DeliveryItemStatus;
    }
  }

  onDeliveryTableActionClick(event: { action: ActionOption; item: any }) {
    const delivery = this.findDeliveryByKey(event.item?.deliveryKey);
    if (!delivery) return;

    if (event.action.id === 'view-items') {
      this.viewDeliveryItems(delivery);
      return;
    }

    if (event.action.id === 'save') {
      this.saveDeliveryRow(delivery);
    }
  }

  editRow(d: Delivery) {
    if (!d.id) return;
    this.snapshotMap.set(d.id, {
      deliveryCategory: d.deliveryCategory,
      deliveryFee: d.deliveryFee,
      deliveryItemStatus: d.deliveryItemStatus
    });
    this.editableDeliveryIds.add(d.id);
  }

  cancelEditRow(d: Delivery) {
    if (!d.id) return;
    const snap = this.snapshotMap.get(d.id);
    if (snap) {
      d.deliveryCategory  = snap.deliveryCategory;
      d.deliveryFee       = snap.deliveryFee;
      d.deliveryItemStatus = snap.deliveryItemStatus;
    }
    this.editableDeliveryIds.delete(d.id);
    this.snapshotMap.delete(d.id);
  }

  saveDeliveryRow(d: Delivery) {
    if (!d.id) return;
    const nextStatus = (d.deliveryItemStatus || 'pending') as DeliveryItemStatus;
    const currentStatus = (this.snapshotMap.get(d.id)?.deliveryItemStatus || d.deliveryItemStatus || 'pending') as DeliveryItemStatus;
    if (this.needsStockStatusConfirmation(currentStatus, nextStatus)) {
      this.openStatusConfirmModal(d, currentStatus, nextStatus, 'row');
      return;
    }
    this.persistDeliveryRow(d, nextStatus);
  }

  private persistDeliveryRow(d: Delivery, nextStatus: DeliveryItemStatus) {
    if (!d.id) return;
    // Enforce: Station Car / Riders fee stays 0
    if (d.deliveryCategory && d.deliveryCategory !== 'ghana_post') {
      d.deliveryFee = 0;
    }
    const id = d.id;
    this.savingDeliveryIds.add(id);
    this.dbService.updateDeliveryInfo(id, d.deliveryCategory ?? null, Number(d.deliveryFee || 0))
      .subscribe(infoOk => {
        if (!infoOk) {
          this.savingDeliveryIds.delete(id);
          this.statusConfirmSubmitting = false;
          alert('Failed to update delivery details.');
          return;
        }

        this.dbService.updateDeliveryItemStatus(id, nextStatus)
          .subscribe(statusOk => {
            this.savingDeliveryIds.delete(id);
            this.statusConfirmSubmitting = false;
            if (!statusOk) {
              alert('Failed to update delivery status.');
              return;
            }

            this.applyDeliveryStatusLocally(d, nextStatus);
            this.savedDeliveryIds.add(id);
            this.editableDeliveryIds.delete(id);
            this.snapshotMap.delete(id);
            this.calculateBatchStats();
            this.computeStatusCounts();
            this.closeStatusConfirmModal();
            this.showSuccessToast('Delivery updated successfully.');
            setTimeout(() => this.savedDeliveryIds.delete(id), 1400);
          });
      });
  }

  findDeliveryByKey(key: number | string | undefined): Delivery | undefined {
    const numericKey = Number(key);
    if (!Number.isFinite(numericKey)) return undefined;
    return this.batchDeliveries.find(delivery => delivery.id === numericKey);
  }

  getItemCount(delivery: Delivery): number {
    if (!delivery.items) return 0;
    return delivery.items.split(',').filter(s => s.trim()).length;
  }

  getDeliveryCategoryLabel(cat: string | undefined): string {
    if (!cat) return '—';
    const found = DELIVERY_CATEGORIES.find(c => c.value === cat);
    return found ? found.label : String(cat);
  }

  getBatchStatusLabel(status: string | undefined): string {
    const labels: Record<string, string> = {
      not_sent: 'Not Sent',
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return labels[status || 'pending'] || 'Pending';
  }


  viewDeliveryItems(delivery: Delivery) {
    this.viewingDelivery = delivery;
    this.viewingDeliveryItemsList = delivery.items
      ? delivery.items.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    this.showItemsModal = true;
  }

  closeItemsModal() {
    this.showItemsModal = false;
    this.viewingDelivery = null;
  }

  quickUpdateStatus(status: string, bypassStatusConfirmation = false) {
    if (!this.viewingDelivery) return;
    const s = status as DeliveryItemStatus;
    const currentStatus = (this.viewingDelivery.deliveryItemStatus || 'pending') as DeliveryItemStatus;
    if (currentStatus === s && !bypassStatusConfirmation) return;
    if (!bypassStatusConfirmation && this.needsStockStatusConfirmation(currentStatus, s)) {
      this.openStatusConfirmModal(this.viewingDelivery, currentStatus, s, 'quick');
      return;
    }

    this.dbService.updateDeliveryItemStatus(this.viewingDelivery.id!, s).subscribe(ok => {
      this.statusConfirmSubmitting = false;
      if (!ok) {
        alert('Failed to update delivery status.');
        return;
      }

      this.applyDeliveryStatusLocally(this.viewingDelivery!, s);
      this.calculateBatchStats();
      this.filterDeliveries();
      this.closeStatusConfirmModal();
      this.showSuccessToast('Delivery status updated successfully.');
    });
  }

  get statusConfirmItemsList(): string[] {
    return this.getDeliveryItemsList(this.statusConfirmDelivery);
  }

  get statusConfirmIsRemovingStock(): boolean {
    return !this.deliveryStatusConsumesStock(this.statusConfirmCurrentStatus)
      && this.deliveryStatusConsumesStock(this.statusConfirmNextStatus);
  }

  get statusConfirmTitle(): string {
    return this.statusConfirmIsRemovingStock ? 'Remove items from stock?' : 'Return items to stock?';
  }

  get statusConfirmBody(): string {
    if (this.statusConfirmIsRemovingStock) {
      return `Changing this delivery to ${this.getStatusLabel(this.statusConfirmNextStatus)} will remove its linked items from product stock. If the status is changed back to Pending or Packaged later, the same quantities will be returned to stock.`;
    }

    return `Changing this delivery back to ${this.getStatusLabel(this.statusConfirmNextStatus)} will return its linked items to product stock until it is marked Delivering or Delivered again.`;
  }

  get statusConfirmActionLabel(): string {
    return this.statusConfirmIsRemovingStock ? 'Remove From Stock' : 'Return To Stock';
  }

  getStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  closeStatusConfirmModal() {
    if (this.statusConfirmSubmitting) return;
    this.showStatusConfirmModal = false;
    this.statusConfirmMode = null;
    this.statusConfirmDelivery = null;
    this.statusConfirmCurrentStatus = 'pending';
    this.statusConfirmNextStatus = 'pending';
    this.statusConfirmSubmitting = false;
  }

  confirmStatusChange() {
    if (!this.statusConfirmDelivery) return;
    this.statusConfirmSubmitting = true;

    if (this.statusConfirmMode === 'row') {
      this.persistDeliveryRow(this.statusConfirmDelivery, this.statusConfirmNextStatus);
      return;
    }

    this.quickUpdateStatus(this.statusConfirmNextStatus, true);
  }

  private openStatusConfirmModal(
    delivery: Delivery,
    currentStatus: DeliveryItemStatus,
    nextStatus: DeliveryItemStatus,
    mode: 'row' | 'quick'
  ) {
    this.statusConfirmMode = mode;
    this.statusConfirmDelivery = delivery;
    this.statusConfirmCurrentStatus = currentStatus;
    this.statusConfirmNextStatus = nextStatus;
    this.showStatusConfirmModal = true;
  }

  private ensureDeliverySnapshot(delivery: Delivery) {
    if (!delivery.id || this.snapshotMap.has(delivery.id)) return;
    this.snapshotMap.set(delivery.id, {
      deliveryCategory: delivery.deliveryCategory,
      deliveryFee: delivery.deliveryFee,
      deliveryItemStatus: delivery.deliveryItemStatus || 'pending'
    });
  }

  private deliveryStatusConsumesStock(status: DeliveryItemStatus | null | undefined): boolean {
    return status === 'delivering' || status === 'delivered';
  }

  private needsStockStatusConfirmation(
    currentStatus: DeliveryItemStatus | null | undefined,
    nextStatus: DeliveryItemStatus
  ): boolean {
    return this.deliveryStatusConsumesStock(currentStatus) !== this.deliveryStatusConsumesStock(nextStatus);
  }

  private applyDeliveryStatusLocally(delivery: Delivery, status: DeliveryItemStatus) {
    delivery.deliveryItemStatus = status;
    if (status === 'delivered') {
      delivery.status = 'delivered';
      delivery.deliveryDate = new Date().toISOString().split('T')[0];
      return;
    }

    if (status === 'delivering') {
      delivery.status = 'in_transit';
      return;
    }

    delivery.status = 'pending';
    delivery.deliveryDate = null;
  }

  private getDeliveryItemsList(delivery: Delivery | null): string[] {
    if (!delivery?.items) return [];
    return delivery.items.split(',').map(item => item.trim()).filter(Boolean);
  }

  reportDamagedFromDelivery() {
    if (!this.damageProductId || !this.viewingDelivery) return alert('Select a product and quantity');
    const qty = Number(this.damageQuantity || 0);
    if (qty <= 0) return alert('Quantity must be > 0');
    this.dbService.createDamagedFromDelivery(
      this.damageProductId, qty, this.damageNote || '', this.viewingDelivery.batchName
    ).subscribe(ok => {
      if (ok) {
        this.showSuccessToast('Damaged item recorded successfully.');
        this.damageProductId = null;
        this.damageQuantity = 1;
        this.damageNote = '';
        this.dbService.getProducts().subscribe(ps => this.products = ps.map(p => ({ id: p.id, name: p.name })));
        this.loadData();
      } else {
        alert('Failed to record damaged item');
      }
    });
  }

  private showSuccessToast(message: string) {
    this.successMessage = message;
    if (this.successTimer) {
      clearTimeout(this.successTimer);
    }
    this.successTimer = setTimeout(() => {
      this.successMessage = null;
      this.successTimer = null;
    }, 2400);
  }
}
