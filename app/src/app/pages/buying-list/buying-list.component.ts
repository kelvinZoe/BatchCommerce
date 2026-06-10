import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  BatchListSectionComponent,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import { BatchDetailHeaderComponent, BatchDetailHeaderTagConfig } from '../../components/batch-detail-header/batch-detail-header.component';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { ModalButtonConfig, ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import { ActionOption, TableComponent, TableColumn, TableFilterConfig, TableMetadata } from '../../components/table/table.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { BatchProduct, BuyingListItem, BuyingStatus, OrderBatch, Product } from '../../models';

@Component({
  selector: 'app-buying-list',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, DateFilterComponent, ModalShellComponent, TableComponent, BatchDetailHeaderComponent, StatCardsComponent],
  template: `
    <div class="bl-page">

      <!-- ══ PAGE HEADER ══ -->
      <div class="bl-header">
        <div class="bl-header-left">
          <div class="bl-header-icon"><span class="material-icons">shopping_bag</span></div>
          <div>
            <h1 class="bl-header-title">Buying List</h1>
            <p class="bl-header-sub">Track products to buy per batch</p>
          </div>
        </div>
        <div class="bl-header-actions">
          <button class="bl-btn bl-btn-primary"
                  *ngIf="activeTab === 'items' && selectedBatch && authService.canPerformBuyingListOperation('canAddItemToBuyingList')"
                  (click)="openModal()">
            <span class="material-icons">add</span> Add Item
          </button>
        </div>
      </div>

      <div class="bl-card">

        <!-- ══ BATCHES VIEW ══ -->
        <ng-container *ngIf="activeTab === 'batches'">

          <app-batch-list-section
            [loading]="loading"
            [items]="buyingBatches"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="batchTotal"
            [searchTerm]="batchSearchTerm"
            [selectedMonth]="batchFilterMonth"
            [selectedYear]="batchFilterYear"
            [currentYear]="currentYear"
            [emptyTitle]="'No batches yet'"
            [emptyDescription]="'Close a batch to send items to the buying list.'"
            [titleResolver]="buyingBatchTitleResolver"
            [subtitleResolver]="buyingBatchSubtitleResolver"
            [iconResolver]="buyingBatchIconResolver"
            [tagsResolver]="buyingBatchTagsResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (dateSelectionChange)="onBatchMonthYearChange($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="viewBatchItems($event)">
            <ng-template batchSectionFooter let-batch>
              <button class="bl-card-action-btn bl-cab-primary bl-open-btn" (click)="$event.stopPropagation(); viewBatchItems(batch)">
                <span class="material-icons">visibility</span> View Items
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <!-- ══ ITEMS VIEW ══ -->
        <ng-container *ngIf="activeTab === 'items'">

          <!-- No batch selected (fallback) -->
          <ng-container *ngIf="!selectedBatch">
            <div class="bl-empty">
              <div class="bl-empty-icon"><span class="material-icons">folder_open</span></div>
              <h3>Select a batch</h3>
              <p>Choose a batch to view its buying list items.</p>
              <button class="bl-btn bl-btn-primary" (click)="activeTab = 'batches'">
                <span class="material-icons">folder</span> View Batches
              </button>
            </div>
          </ng-container>

          <ng-container *ngIf="selectedBatch">

            <!-- Detail header -->
            <app-batch-detail-header
              [backLabel]="'Batches'"
              [title]="selectedBatch.name"
              [subtitle]="selectedBatch.createdAt | date:'mediumDate'"
              [icon]="'folder'"
              [tag]="selectedBuyingBatchHeaderTag"
              (backClick)="activeTab = 'batches'">
              <button
                batchDetailHeaderAction
                class="bl-btn bl-btn-primary bl-btn-sm"
                *ngIf="canSendToArrivals"
                [disabled]="selectedArrivalIds.size === 0 || sendingToArrivals"
                (click)="sendSelectedToArrivals()">
                <span class="material-icons">inventory</span>
                {{ sendingToArrivals ? 'Sending…' : 'Send to Arrivals' }}
              </button>
            </app-batch-detail-header>

            <!-- Stats row -->
            <app-stat-cards [config]="buyingItemStatCards"></app-stat-cards>

            <app-table
              [columns]="itemColumns"
              [data]="itemTableRows"
              [metadata]="itemMetadata"
              [showSearchRow]="true"
              [initialLoading]="loading"
              [searching]="loading"
              [skeletonRows]="5"
              [filters]="itemFilters"
              [tableLabel]="'Buying Items'"
              [summaryLabel]="'Rows'"
              [summaryValue]="itemTotal"
              [baseColor]="baseColor"
              [showToolbarStart]="true"
              (searchChange)="onItemTableSearchChange($event)"
              (filterChange)="onItemTableFilterChange($event)"
              (checkboxChange)="onItemTableCheckboxChange($event)"
              (inputChange)="onItemTableInputChange($event)"
              (dropdownChange)="onItemTableDropdownChange($event)"
              (actionClick)="onItemTableActionClick($event)"
              (pageChange)="setItemPage($event)">
              <app-date-filter table-toolbar-start (dateChange)="onDateChange($event)"></app-date-filter>
            </app-table>
          </ng-container>
        </ng-container>

      </div><!-- /bl-card -->

      <!-- ══ ADD / EDIT ITEM MODAL ══ -->
      <div class="bl-modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="bl-modal" (click)="$event.stopPropagation()">
          <div class="bl-modal-header">
            <h3 class="bl-modal-title">{{ editingItem ? 'Edit Item' : 'Add Item' }}</h3>
            <button class="bl-modal-close" (click)="closeModal()"><span class="material-icons">close</span></button>
          </div>
          <div class="bl-modal-body">
            <div class="bl-form-group">
              <label class="bl-label">Batch</label>
              <input class="bl-input" type="text" [value]="selectedBatch?.name || ''" disabled />
            </div>
            <div class="bl-form-group">
              <label class="bl-label">Product *</label>
              <select class="bl-input" [(ngModel)]="formData.batchProductId" (ngModelChange)="onBatchProductChange($event)">
                <option [ngValue]="null" disabled>Select product</option>
                <option *ngFor="let bp of batchProducts" [ngValue]="bp.id">{{ bp.productName || 'Product' }}</option>
              </select>
            </div>
            <div class="bl-form-row">
              <div class="bl-form-group">
                <label class="bl-label">Requested Qty *</label>
                <input class="bl-input" type="number" [(ngModel)]="formData.requestedQuantity" min="1" />
              </div>
              <div class="bl-form-group">
                <label class="bl-label">Qty Ordered</label>
                <input class="bl-input" type="number" [(ngModel)]="formData.orderedQuantity" min="0" />
              </div>
            </div>
          </div>
          <div class="bl-modal-footer">
            <button class="bl-btn bl-btn-ghost" (click)="closeModal()">Cancel</button>
            <button class="bl-btn bl-btn-primary" (click)="saveItem()" [disabled]="saving">
              <span class="bl-spinner" *ngIf="saving"></span>
              {{ saving ? 'Saving…' : (editingItem ? 'Update' : 'Add') + ' Item' }}
            </button>
          </div>
        </div>
      </div>

      <app-modal
        *ngIf="showBuyersModal && viewingItem"
        size="lg"
        icon="visibility"
        title="Buying Item Details"
        [sub-heading]="buyersModalSubtitle"
        [buttons]="buyersModalButtons"
        (closeRequested)="closeBuyersModal()"
        (buttonClick)="onBuyersModalButton($event)">
        <div class="bl-detail-modal-body">
          <div class="bl-detail-modal-hero">
            <div class="bl-detail-product">
              <div class="bl-detail-product-avatar">{{ (viewingItem.productName || '?').charAt(0).toUpperCase() }}</div>
              <div class="bl-detail-product-copy">
                <div class="bl-detail-product-name">{{ viewingItem.productName }}</div>
                <div class="bl-detail-product-sub">{{ selectedBatch?.name || viewingItem.batchName || 'Buying list item' }}</div>
              </div>
            </div>
            <span class="bl-detail-status" [class]="'bl-detail-status bl-detail-status-' + viewingItem.status">{{ viewingItem.status }}</span>
          </div>

          <div class="bl-detail-stats">
            <div class="bl-detail-stat">
              <span class="material-icons">groups</span>
              <div>
                <div class="bl-detail-stat-value">{{ buyersTotal }}</div>
                <div class="bl-detail-stat-label">People who bought it</div>
              </div>
            </div>
            <div class="bl-detail-stat">
              <span class="material-icons">shopping_cart</span>
              <div>
                <div class="bl-detail-stat-value">{{ buyersTotalQty }}</div>
                <div class="bl-detail-stat-label">Total buyer quantity</div>
              </div>
            </div>
            <div class="bl-detail-stat">
              <span class="material-icons">inventory_2</span>
              <div>
                <div class="bl-detail-stat-value">{{ viewingItem.orderedQuantity || 0 }}/{{ viewingItem.requestedQuantity }}</div>
                <div class="bl-detail-stat-label">Ordered vs requested</div>
              </div>
            </div>
            <div class="bl-detail-stat">
              <span class="material-icons">warehouse</span>
              <div>
                <div class="bl-detail-stat-value">{{ getStockForItem(viewingItem) }}</div>
                <div class="bl-detail-stat-label">Current stock</div>
              </div>
            </div>
          </div>

          <div *ngIf="viewingItem.source === 'shop'" class="bl-detail-note">
            This item was added directly by the shop, so there may be no customer buyer list for it.
          </div>

          <app-table
            [columns]="buyersColumns"
            [data]="buyers"
            [metadata]="buyersMetadata"
            [showSearchRow]="false"
            [initialLoading]="loadingBuyers"
            [searching]="loadingBuyers"
            [skeletonRows]="4"
            [tableLabel]="'Buyer List'"
            [summaryLabel]="'People'"
            [summaryValue]="buyersTotal"
            [baseColor]="baseColor"
            (pageChange)="setBuyersPage($event)">
          </app-table>
        </div>
      </app-modal>

      <ng-template #itemSelectHeaderTpl>
        <input
          *ngIf="canSendToArrivals"
          type="checkbox"
          [checked]="isAllArrivedSelected"
          (change)="toggleSelectAllArrived($event)"
          [disabled]="sendingToArrivals"
          class="bl-checkbox" />
      </ng-template>

    </div><!-- /bl-page -->
  `,
  styles: [`
    /* ── Layout ── */
    .bl-page { padding: 0; }
    .bl-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    /* ── Header ── */
    .bl-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .bl-header-left { display: flex; align-items: center; gap: 14px; }
    .bl-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .bl-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .bl-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    .bl-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

    /* ── Buttons ── */
    .bl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.13s, opacity 0.13s; }
    .bl-btn .material-icons { font-size: 18px; }
    .bl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .bl-btn-primary { background: var(--primary-color, #6366f1); color: #fff; }
    .bl-btn-primary:hover:not(:disabled) { background: var(--primary-dark, #4f46e5); }
    .bl-btn-ghost { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .bl-btn-ghost:hover:not(:disabled) { background: #e2e8f0; }
    .bl-btn-sm { padding: 6px 12px; font-size: 12px; }

    /* ── Batch card grid ── */
    .bl-batch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 4px 0 16px; }
    .bl-batch-card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; background: #fff; }
    .bl-batch-card:hover { border-color: var(--primary-color, #6366f1); box-shadow: 0 4px 16px rgba(var(--primary-rgb, 99,102,241), 0.12); }
    .bl-batch-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .bl-batch-card-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(var(--primary-rgb,99,102,241),0.1); color: var(--primary-color,#6366f1); display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .bl-batch-card-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bl-batch-card-date { font-size: 11px; color: #94a3b8; margin-bottom: 12px; }
    .bl-batch-card-footer { display: flex; }
    .bl-batch-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; min-height: 22px; }
    .bl-bpill { display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .bl-bpill-pending { background: rgba(245, 158, 11, 0.12); color: rgba(245, 158, 11, 0.8); }
    .bl-bpill-ordered { background: rgba(59, 130, 246, 0.12); color: rgba(59, 130, 246, 0.8); }
    .bl-bpill-shipped { background: rgba(168, 85, 247, 0.12); color: rgba(168, 85, 247, 0.8); }
    .bl-bpill-arrived { background: rgba(16, 185, 129, 0.12); color: rgba(16, 185, 129, 0.8); }
    .bl-bpill-empty   { background: #f1f5f9; color: #94a3b8; }
    .bl-card-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.12s; }
    .bl-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .bl-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .bl-open-btn { width: 100%; justify-content: center; }

    /* ── Status badge ── */
    .bl-status-badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .bl-sb-closed { background: rgba(var(--primary-rgb,99,102,241),0.1); color: var(--primary-color,#6366f1); }

    /* ── Detail header ── */
    .bl-detail-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ccc; margin-bottom: 16px; flex-wrap: wrap; }
    .bl-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: 1px solid #ccc; border-radius: 9px; background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: background 0.12s; white-space: nowrap; }
    .bl-back-btn:hover { background: #e2e8f0; }
    .bl-back-btn .material-icons { font-size: 16px; }
    .bl-detail-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .bl-detail-batch-icon { width: 36px; height: 36px; border-radius: 9px; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .bl-detail-batch-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .bl-detail-batch-date { font-size: 11px; color: #94a3b8; }
    .bl-detail-actions { display: flex; gap: 8px; flex-shrink: 0; margin-left: auto; }

    /* ── Stats row ── */
    .bl-stats-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .bl-stat { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #ccc; border-radius: 12px; padding: 12px 18px; flex: 1; min-width: 120px; }
    .bl-stat-icon { font-size: 24px; }
    .bl-si-blue { color: #3b82f6; }
    .bl-si-yellow { color: #f59e0b; }
    .bl-si-green { color: #10b981; }
    .bl-stat-value { font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .bl-stat-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }

    /* ── Tables ── */
    .bl-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #ccc; }
    .bl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .bl-table th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #ccc; white-space: nowrap; }
    .bl-table td { padding: 11px 12px; border-bottom: 1px solid #ccc; vertical-align: middle; }
    .bl-table tr:last-child td { border-bottom: none; }
    .bl-table tr:hover td { background: #fafbff; }
    .bl-table tfoot td { border-top: 2px solid #ccc; border-bottom: none; }
    .bl-row-index { color: #94a3b8; font-size: 12px; font-weight: 700; }
    .bl-product-cell { display: flex; align-items: center; gap: 10px; min-width: 220px; }
    .bl-product-cell-muted { opacity: 0.62; }
    .bl-product-avatar { width: 34px; height: 34px; border-radius: 12px; background: rgba(var(--primary-rgb, 99,102,241), 0.12); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
    .bl-product-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .bl-product-name { font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bl-product-meta { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: #94a3b8; }
    .bl-meta-divider { color: #cbd5e1; }
    .bl-qty-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 38px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .bl-qty-chip-static { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
    .bl-qty-chip-stock { background: rgba(16, 185, 129, 0.1); color: #047857; border: 1px solid rgba(16, 185, 129, 0.16); }
    .bl-select-cell { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; }
    .bl-cell-dash { color: #cbd5e1; font-size: 14px; }
    .bl-checkbox { width: 15px; height: 15px; cursor: pointer; accent-color: var(--primary-color, #6366f1); }
    .bl-editable-cell { display: inline-flex; align-items: center; gap: 8px; min-width: 120px; }
    .bl-editable-cell-status { min-width: 160px; }
    .bl-inline-input { width: 88px; padding: 8px 10px; border: 1px solid #d7dde6; border-radius: 10px; font-size: 13px; font-weight: 600; text-align: center; background: #f8fafc; color: #0f172a; }
    .bl-inline-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.12); background: #fff; }
    .bl-inline-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
    .bl-status-select { min-width: 118px; padding: 8px 12px; border: 1px solid transparent; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .bl-status-select:disabled { cursor: not-allowed; opacity: 0.7; }
    .bl-ss-pending  { background: #fef3c7; color: #92400e; }
    .bl-ss-ordered  { background: #dbeafe; color: #1e40af; }
    .bl-ss-shipped  { background: #fef3c7; color: #92400e; }
    .bl-ss-arrived  { background: #d1fae5; color: #065f46; }
    .bl-dirty-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15); }
    .bl-row-actions { display: inline-flex; align-items: center; gap: 8px; }
    .bl-icon-action { width: 34px; height: 34px; border: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease; }
    .bl-icon-action .material-icons { font-size: 18px; }
    .bl-icon-action:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12); }
    .bl-icon-action:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
    .bl-icon-action-view { background: #d0e8f9; color: #0066cc; }
    .bl-icon-action-save { background: #d0f9d0; color: #00a63e; }

    /* ── Badges ── */
    .bl-badge { display: inline-block; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; }
    .bl-badge-sent { background: #e5e7eb; color: #374151; }

    /* ── Detail Modal ── */
    .bl-detail-modal-body { display: flex; flex-direction: column; gap: 18px; }
    .bl-detail-modal-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 1px solid #e6ebf2; border-radius: 16px; background: linear-gradient(135deg, rgba(var(--primary-rgb, 99,102,241), 0.05), #fff); flex-wrap: wrap; }
    .bl-detail-product { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .bl-detail-product-avatar { width: 46px; height: 46px; border-radius: 14px; background: rgba(var(--primary-rgb, 99,102,241), 0.12); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; text-transform: uppercase; }
    .bl-detail-product-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .bl-detail-product-name { font-size: 17px; font-weight: 700; color: #0f172a; }
    .bl-detail-product-sub { font-size: 12px; color: #64748b; }
    .bl-detail-status { display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .bl-detail-status-pending { background: #fef3c7; color: #92400e; }
    .bl-detail-status-ordered { background: #dbeafe; color: #1e40af; }
    .bl-detail-status-shipped { background: #fde68a; color: #92400e; }
    .bl-detail-status-arrived { background: #d1fae5; color: #065f46; }
    .bl-detail-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .bl-detail-stat { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border: 1px solid #e6ebf2; border-radius: 14px; background: #f8fafc; }
    .bl-detail-stat .material-icons { font-size: 22px; color: var(--primary-color, #6366f1); }
    .bl-detail-stat-value { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .bl-detail-stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .bl-detail-note { padding: 12px 14px; border-radius: 12px; border: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 13px; }

    /* ── Empty state ── */
    .bl-empty { text-align: center; padding: 48px 24px; }
    .bl-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(var(--primary-rgb, 99,102,241), 0.08); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
    .bl-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .bl-empty p { font-size: 13px; color: #64748b; margin: 0 0 16px; }

    /* ── Skeleton ── */
    .bl-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 4px 0 16px; }
    .bl-skeleton-batch-card { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid #f1f5f9; border-radius: 14px; }
    .bl-sk { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: bl-shimmer 1.4s infinite; border-radius: 6px; }
    @keyframes bl-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .bl-sk-icon { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
    .bl-sk-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .bl-sk-line { height: 12px; }
    .bl-sk-line-lg { width: 70%; }
    .bl-sk-line-sm { width: 40%; }
    .bl-sk-table { margin-top: 8px; }
    .bl-sk-thead { display: flex; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; }
    .bl-sk-th { height: 14px; flex: 1; border-radius: 4px; }
    .bl-sk-row { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f8fafc; }
    .bl-sk-td { height: 14px; flex: 1; border-radius: 4px; }

    /* ── Modal ── */
    .bl-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .bl-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
    .bl-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #ccc; }
    .bl-modal-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .bl-modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; padding: 2px; border-radius: 6px; }
    .bl-modal-close:hover { color: #475569; background: #f1f5f9; }
    .bl-modal-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .bl-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #ccc; }
    .bl-form-group { display: flex; flex-direction: column; gap: 5px; }
    .bl-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .bl-label { font-size: 12px; font-weight: 600; color: #475569; }
    .bl-input { padding: 9px 12px; border: 1px solid #ccc; border-radius: 9px; font-size: 13px; background: #f8fafc; color: #1e293b; transition: border-color 0.13s; width: 100%; box-sizing: border-box; }
    .bl-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.12); background: #fff; }
    .bl-input:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }

    /* ── Spinner ── */
    .bl-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: bl-spin 0.6s linear infinite; display: inline-block; }
    .bl-spinner-dark { border-color: rgba(15, 23, 42, 0.12); border-top-color: currentColor; }
    @keyframes bl-spin { to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
      .bl-header { align-items: flex-start; }
      .bl-header-actions { width: 100%; justify-content: flex-start; }
      .bl-detail-actions { margin-left: 0; width: 100%; }
    }
  `]
})
export class BuyingListComponent implements OnInit {
  @ViewChild('itemSelectHeaderTpl', { static: true }) itemSelectHeaderTpl!: TemplateRef<any>;

  loading = true;
  items: BuyingListItem[] = [];
  products: Product[] = [];
  batchProducts: BatchProduct[] = [];
  buyingBatches: OrderBatch[] = [];
  batchStats = new Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>();
  itemColumns: TableColumn[] = [];
  buyersColumns: TableColumn[] = [];
  itemFilters: TableFilterConfig[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Ordered', value: 'ordered' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Arrived', value: 'arrived' }
      ]
    }
  ];
  readonly baseColor = 'var(--primary-color, #6366f1)';
  private itemDrafts = new Map<number, { orderedQuantity: number; status: BuyingStatus }>();
  private rowSavingIds = new Set<number>();
  readonly buyersModalButtons: ModalButtonConfig[] = [{ buttonName: 'Close', color: 'secondary', action: 'close' }];

  activeTab: 'batches' | 'items' = 'batches';
  selectedBatch: OrderBatch | null = null;

  get selectedBuyingBatchHeaderTag(): BatchDetailHeaderTagConfig | null {
    return this.selectedBatch
      ? { label: 'Closed', color: 'gray', icon: 'task_alt' }
      : null;
  }

  get buyingItemStatCards(): StatCardConfig[] {
    return [
      {
        icon: 'shopping_bag',
        statName: 'Items',
        statValue: this.itemStats.count,
        color: 'blue'
      },
      {
        icon: 'local_shipping',
        statName: 'Ordered',
        statValue: this.itemStats.ordered,
        color: 'orange'
      },
      {
        icon: 'inventory_2',
        statName: 'Requested',
        statValue: this.itemStats.requested,
        color: 'green'
      }
    ];
  }

  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();
  searchTerm = '';
  dateFrom = '';
  dateTo = '';
  statusFilter = '';

  selectedArrivalIds = new Set<number>();
  sendingToArrivals = false;

  // Pagination
  batchPage = 1;
  batchPageSize = 20;
  batchTotal = 0;
  itemPage = 1;
  itemPageSize = 20;
  itemTotal = 0;
  buyersPage = 1;
  buyersPageSize = 20;
  buyersTotal = 0;
  private batchSearchTimer: any;

  get totalBatchPages() { return Math.max(1, Math.ceil(this.batchTotal / this.batchPageSize)); }
  get totalItemPages() { return Math.max(1, Math.ceil(this.itemTotal / this.itemPageSize)); }
  get canSendToArrivals(): boolean {
    return this.authService.canPerformBuyingListOperation('canSendToArrivals');
  }

  private canEditSentItem(item: BuyingListItem): boolean {
    return !item.movedToArrivals || this.authService.canPerformBuyingListOperation('canEditAfterSent');
  }

  get itemMetadata(): TableMetadata | null {
    if (this.itemTotal === 0) return null;
    return {
      pageNumber: this.itemPage,
      totalCount: this.itemTotal,
      pageSize: this.itemPageSize,
      totalPages: this.totalItemPages
    };
  }

  get itemTableRows() {
    return this.items.map((item, index) => ({
      ...item,
      displayIndex: this.itemRangeStart + index,
      inStockDisplay: this.getStockForItem(item),
      orderedQuantityDraft: this.getDraftOrderedQuantity(item),
      arrivalSelected: item.id ? this.selectedArrivalIds.has(item.id) : false,
      arrivalSelectionDisabled: !this.isArrivalSelectable(item) || this.sendingToArrivals || item.movedToArrivals,
      arrivalSelectionBadge: item.movedToArrivals ? 'Sent' : '',
      statusDraft: this.getDraftStatus(item),
      statusDisabled: !this.canEditStatus(item) || this.isRowSaving(item),
      orderedQuantityDisabled: !this.canEditOrderedQuantity(item) || this.isRowSaving(item),
      actions: [
        {
          id: 'view',
          label: 'View item details',
          icon: 'eye',
          color: 'black'
        },
        {
          id: 'save',
          label: 'Save row changes',
          icon: 'check2',
          color: 'green',
          disabled: !this.isItemDirty(item) || !this.canSaveItem(item) || this.isRowSaving(item),
          loading: this.isRowSaving(item)
        }
      ] as ActionOption[]
    }));
  }

  get buyersMetadata(): TableMetadata | null {
    if (this.buyersTotal === 0) return null;
    return {
      pageNumber: this.buyersPage,
      totalCount: this.buyersTotal,
      pageSize: this.buyersPageSize,
      totalPages: Math.max(1, Math.ceil(this.buyersTotal / this.buyersPageSize))
    };
  }

  get buyersModalSubtitle(): string {
    if (!this.viewingItem) return '';
    const batchLabel = this.selectedBatch?.name || this.viewingItem.batchName || 'Selected batch';
    return `${batchLabel} • ${this.viewingItem.productName}`;
  }

  readonly buyingBatchTitleResolver = (batch: OrderBatch) => batch.name;
  readonly buyingBatchSubtitleResolver = (batch: OrderBatch) =>
    batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  readonly buyingBatchIconResolver = () => 'folder';
  readonly buyingBatchTagsResolver = (batch: OrderBatch): BatchCardTagConfig[] => {
    const total = this.batchStatTotal(batch.id!);
    if (total === 0) {
      return [{ tagName: 'No Items', color: 'gray', icon: 'inventory_2' }];
    }

    const pending = this.batchStats.get(batch.id!)?.pending ?? 0;
    const ordered = this.getBatchStatCumulative(batch.id!, 'ordered');
    const arrived = this.batchStats.get(batch.id!)?.arrived ?? 0;

    return [
      { tagName: `${pending} Pending`, color: pending > 0 ? 'orange' : 'gray', icon: 'schedule' },
      { tagName: `${ordered} Ordered`, color: ordered > 0 ? 'blue' : 'gray', icon: 'shopping_bag' },
      { tagName: `${arrived} Arrived`, color: arrived > 0 ? 'green' : 'gray', icon: 'check_circle' }
    ];
  };
  batchStatTotal(batchId: number): number {
    const s = this.batchStats.get(batchId);
    if (!s) return 0;
    return s.pending + s.ordered + s.shipped + s.arrived;
  }

  getBatchStatCumulative(batchId: number, type: 'ordered' | 'shipped'): number {
    const s = this.batchStats.get(batchId);
    if (!s) return 0;
    if (type === 'ordered') {
      // ordered + shipped + arrived = all items that have been ordered or further
      return s.ordered + s.shipped + s.arrived;
    } else if (type === 'shipped') {
      // shipped + arrived = all items that have been shipped or further
      return s.shipped + s.arrived;
    }
    return 0;
  }

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

  itemStats = { count: 0, requested: 0, ordered: 0 };

  get canEditBuyingList(): boolean {
    // Composite check: user must have at least one edit permission
    return this.authService.canPerformBuyingListOperation('canEditQuantityOrdered') ||
           this.authService.canPerformBuyingListOperation('canChangeStatus') ||
           this.authService.canPerformBuyingListOperation('canSendToArrivals');
  }

  showModal = false;
  editingItem: BuyingListItem | null = null;
  saving = false;

  showOutOfStockModal = false;
  outOfStockProducts: Product[] = [];
  selectedOutOfStockIds = new Set<number>();
  outOfStockQty: { [productId: number]: number } = {};

  // Track items already moved to arrivals
  movedItemIds = new Set<number>();

  formData: BuyingListItem = {
    batchId: undefined,
    batchProductId: undefined,
    productId: undefined,
    productName: '',
    requestedQuantity: 1,
    orderedQuantity: 0,
    status: 'pending',
    source: 'shop'
  };

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.setupTableConfigs();
    this.loadBatches();
    this.loadProducts();
    
    // Reload batches when a batch is deleted elsewhere
    this.dbService.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  private setupTableConfigs() {
    const columns: TableColumn[] = [
      { key: 'displayIndex', label: '#', type: 'string' },
      { key: 'productName', label: 'Product Name', type: 'string', searchable: true },
      { key: 'requestedQuantity', label: 'Requested', type: 'string' },
      { key: 'inStockDisplay', label: 'In Stock', type: 'string' },
      {
        key: 'orderedQuantityDraft',
        label: 'Qty Ordered',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 1,
        disabledKey: 'orderedQuantityDisabled'
      },
      {
        key: 'statusDraft',
        label: 'Status',
        type: 'dropdown',
        disabledKey: 'statusDisabled',
        statusOptions: [
          { label: 'Pending', value: 'pending', color: 'orange' },
          { label: 'Ordered', value: 'ordered', color: 'blue' },
          { label: 'Shipped', value: 'shipped', color: 'orange' },
          { label: 'Arrived', value: 'arrived', color: 'green' }
        ]
      },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];

    if (this.canSendToArrivals) {
      columns.unshift({
        key: 'arrivalSelected',
        label: '',
        type: 'checkbox',
        headerTemplate: this.itemSelectHeaderTpl,
        disabledKey: 'arrivalSelectionDisabled',
        badgeKey: 'arrivalSelectionBadge'
      });
    }

    this.itemColumns = columns;
    this.buyersColumns = [
      { key: 'clientName', label: 'Client', type: 'string' },
      { key: 'clientPhone', label: 'Phone', type: 'string' },
      { key: 'quantity', label: 'Qty Ordered', type: 'string' }
    ];
  }

  loadBatches() {
    this.loading = true;
    const monthYear = this.batchFilterMonth !== null && this.batchFilterYear !== null
      ? { month: this.batchFilterMonth, year: this.batchFilterYear }
      : undefined;
    this.dbService.getOrderBatchesPage(this.batchPage, this.batchPageSize, this.batchSearchTerm.trim(), 'closed', monthYear).subscribe(({ data, total }) => {
      this.buyingBatches = data;
      this.batchTotal = total;
      this.loading = false;
      if (this.batchPage > this.totalBatchPages) {
        this.batchPage = this.totalBatchPages;
        this.loadBatches();
      }
      const ids = data.map((b: any) => b.id).filter(Boolean);
      if (ids.length) {
        this.dbService.getBatchesPreviewStats(ids).subscribe(stats => { this.batchStats = stats; });
      }
    });
  }

  onBatchSearchInput(term: string) {
    this.batchSearchTerm = term;
    clearTimeout(this.batchSearchTimer);
    this.batchSearchTimer = setTimeout(() => {
      this.batchPage = 1;
      this.loadBatches();
    }, 350);
  }

  onBatchMonthYearChange(selection: { month: number | null; year: number | null }) {
    this.batchFilterMonth = selection.month;
    this.batchFilterYear = selection.year;
    this.batchPage = 1;
    this.loadBatches();
  }

  loadItems() {
    if (!this.selectedBatch?.id) {
      this.items = [];
      this.itemTotal = 0;
      this.itemStats = { count: 0, requested: 0, ordered: 0 };
      this.resetItemDrafts();
      return;
    }
    this.loading = true;
    const term = this.searchTerm.trim();
    const dateFrom = this.dateFrom ? `${this.dateFrom}T00:00:00` : '';
    const dateTo = this.dateTo ? `${this.dateTo}T23:59:59` : '';
    forkJoin({
      page: this.dbService.getBuyingListItemsByBatchPage(
        this.selectedBatch.id,
        this.itemPage,
        this.itemPageSize,
        term,
        dateFrom,
        dateTo,
        this.statusFilter
      ),
      stats: this.dbService.getBuyingListItemsSummary(
        this.selectedBatch.id,
        term,
        dateFrom,
        dateTo,
        this.statusFilter
      )
    }).subscribe(({ page, stats }) => {
      this.items = page.data;
      this.itemTotal = page.total;
      this.itemStats = stats;
      this.resetItemDrafts();
      this.selectedArrivalIds.clear();
      this.loading = false;
      if (this.itemPage > this.totalItemPages) {
        this.itemPage = this.totalItemPages;
        this.loadItems();
      }
    });
  }

  loadItemStats() {
    if (!this.selectedBatch?.id) {
      this.itemStats = { count: 0, requested: 0, ordered: 0 };
      return;
    }
    const term = this.searchTerm.trim();
    const dateFrom = this.dateFrom ? `${this.dateFrom}T00:00:00` : '';
    const dateTo = this.dateTo ? `${this.dateTo}T23:59:59` : '';
    this.dbService.getBuyingListItemsSummary(this.selectedBatch.id, term, dateFrom, dateTo, this.statusFilter)
      .subscribe(stats => {
        this.itemStats = stats;
      });
  }

  loadProducts() {
    this.dbService.getProducts().subscribe(products => {
      this.products = products;
      this.updateOutOfStockProducts();
    });
  }

  loadBatchProducts() {
    if (!this.selectedBatch?.id) {
      this.batchProducts = [];
      return;
    }
    this.dbService.getBatchProducts(this.selectedBatch.id).subscribe(products => {
      this.batchProducts = products;
    });
  }

  viewBatchItems(batch: OrderBatch) {
    this.selectedBatch = batch;
    this.activeTab = 'items';
    this.itemPage = 1;
    this.searchTerm = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.statusFilter = '';
    this.movedItemIds.clear();
    this.selectedArrivalIds.clear();
    this.resetItemDrafts();
    this.updateOutOfStockProducts();
    this.loadBatchProducts();
    this.loadItems();
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

  onItemTableSearchChange(query: Record<string, string>) {
    this.searchTerm = (query['productName'] || '').trim();
    this.filterItems();
  }

  onItemTableFilterChange(filters: Record<string, string | null | undefined>) {
    this.statusFilter = (filters['status'] || '').trim();
    this.filterItems();
  }

  onItemTableCheckboxChange(event: { item: BuyingListItem; checked: boolean }) {
    this.setArrivalSelection(event.item, event.checked);
  }

  onItemTableInputChange(event: { item: BuyingListItem; value: any }) {
    if (!this.canEditOrderedQuantity(event.item)) return;
    this.onOrderedQuantityDraftChange(event.item, String(event.value ?? ''));
  }

  onItemTableDropdownChange(event: { item: BuyingListItem; value: any }) {
    if (!this.canEditStatus(event.item)) return;
    const next = String(event.value ?? '') as BuyingStatus;
    if ((event.item as any).statusDraft !== undefined) {
      (event.item as any).statusDraft = next;
    }
    this.onStatusDraftChange(event.item, next);
  }

  onItemTableActionClick(event: { action: ActionOption; item: BuyingListItem }) {
    if (event.action.id === 'view') {
      this.viewBuyers(event.item);
      return;
    }

    if (event.action.id === 'save') {
      this.saveItemDraft(event.item);
    }
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

  

  

  openModal(item?: BuyingListItem) {
    if (!this.selectedBatch?.id) {
      alert('Select a batch first');
      return;
    }
    if (!item && !this.authService.canPerformBuyingListOperation('canAddItemToBuyingList')) {
      alert('You do not have permission to add buying list items');
      return;
    }
    if (item && !this.canSaveItem(item)) {
      alert('You do not have permission to edit this buying list item');
      return;
    }
    if (this.batchProducts.length === 0) {
      this.loadBatchProducts();
    }
    this.editingItem = item || null;
    if (item) {
      this.formData = {
        ...item,
        batchId: item.batchId ?? this.selectedBatch.id,
        orderedQuantity: item.orderedQuantity ?? item.requestedQuantity
      };
      if (this.formData.batchProductId) {
        this.syncFormBatchProduct(this.formData.batchProductId);
      }
    } else {
      const first = this.batchProducts[0];
      this.formData = {
        batchId: this.selectedBatch.id,
        batchProductId: first?.id,
        productId: first?.productId,
        productName: first?.productName || '',
        requestedQuantity: 1,
        orderedQuantity: 0,
        status: 'pending',
        source: 'shop'
      };
    }
    this.showModal = true;
  }

  onBatchProductChange(value: number | null) {
    if (!value) return;
    this.syncFormBatchProduct(value);
  }

  private syncFormBatchProduct(batchProductId: number) {
    const selected = this.batchProducts.find(bp => bp.id === batchProductId);
    if (!selected) return;
    this.formData.batchProductId = selected.id;
    this.formData.productId = selected.productId;
    this.formData.productName = selected.productName || '';
  }

  closeModal() {
    this.showModal = false;
    this.editingItem = null;
  }

  editItem(item: BuyingListItem) {
    this.openModal(item);
  }

  getStockForItem(item: BuyingListItem): number {
    if (!item.productId) return 0;
    const product = this.products.find(p => p.id === item.productId);
    return product?.stock ?? 0;
  }

  private resetItemDrafts() {
    this.itemDrafts.clear();
    this.rowSavingIds.clear();
  }

  private getItemDraft(item: BuyingListItem) {
    if (!item.id) return null;
    let draft = this.itemDrafts.get(item.id);
    if (!draft) {
      draft = {
        orderedQuantity: Number(item.orderedQuantity ?? item.orderedQty ?? 0),
        status: item.status
      };
      this.itemDrafts.set(item.id, draft);
    }
    return draft;
  }

  getDraftOrderedQuantity(item: BuyingListItem): number {
    return this.getItemDraft(item)?.orderedQuantity ?? Number(item.orderedQuantity ?? item.orderedQty ?? 0);
  }

  getDraftStatus(item: BuyingListItem): BuyingStatus {
    return this.getItemDraft(item)?.status ?? item.status;
  }

  onOrderedQuantityDraftChange(item: BuyingListItem, value: string) {
    const draft = this.getItemDraft(item);
    if (!draft) return;
    const parsed = Number(value);
    draft.orderedQuantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  onStatusDraftChange(item: BuyingListItem, value: string) {
    const draft = this.getItemDraft(item);
    if (!draft) return;
    draft.status = value as BuyingStatus;
  }

  canEditOrderedQuantity(item: BuyingListItem): boolean {
    return this.authService.canPerformBuyingListOperation('canEditQuantityOrdered') &&
      !(item.status === 'arrived' && !this.authService.canPerformBuyingListOperation('canEditAfterArrived')) &&
      this.canEditSentItem(item);
  }

  canEditStatus(item: BuyingListItem): boolean {
    return this.authService.canPerformBuyingListOperation('canChangeStatus') &&
      !(item.status === 'arrived' && !this.authService.canPerformBuyingListOperation('canEditAfterArrived')) &&
      this.canEditSentItem(item);
  }

  canSaveItem(item: BuyingListItem): boolean {
    return this.canEditOrderedQuantity(item) || this.canEditStatus(item);
  }

  isItemDirty(item: BuyingListItem): boolean {
    const draft = this.getItemDraft(item);
    if (!draft) return false;
    const ordered = Number(item.orderedQuantity ?? item.orderedQty ?? 0);
    return draft.orderedQuantity !== ordered || draft.status !== item.status;
  }

  isRowSaving(item: BuyingListItem): boolean {
    return !!item.id && this.rowSavingIds.has(item.id);
  }

  saveItemDraft(item: BuyingListItem) {
    if (!item.id || !this.isItemDirty(item) || !this.canSaveItem(item) || this.isRowSaving(item)) return;
    const draft = this.getItemDraft(item);
    if (!draft) return;

    const updated: BuyingListItem = {
      ...item,
      orderedQuantity: draft.orderedQuantity,
      orderedQty: draft.orderedQuantity,
      status: draft.status
    };

    this.rowSavingIds.add(item.id);
    this.dbService.updateBuyingListItem(updated).subscribe({
      next: ok => {
        this.rowSavingIds.delete(item.id!);
        if (!ok) return;
        item.orderedQuantity = draft.orderedQuantity;
        item.orderedQty = draft.orderedQuantity;
        item.status = draft.status;
        if (!this.isArrivalSelectable(item) && item.id) {
          this.selectedArrivalIds.delete(item.id);
        }
        this.loadItems();
      },
      error: () => {
        this.rowSavingIds.delete(item.id!);
      }
    });
  }

  isArrivalSelectable(item: BuyingListItem): boolean {
    return item.status === 'arrived' && !item.movedToArrivals;
  }

  get isAllArrivedSelected(): boolean {
    const eligible = this.items.filter(i => i.id && this.isArrivalSelectable(i));
    return eligible.length > 0 && eligible.every(i => this.selectedArrivalIds.has(i.id!));
  }

  toggleSelectArrival(item: BuyingListItem, event: Event) {
    if (!item.id) return;
    this.setArrivalSelection(item, (event.target as HTMLInputElement).checked);
  }

  private setArrivalSelection(item: BuyingListItem, checked: boolean) {
    if (!item.id) return;
    if (checked) this.selectedArrivalIds.add(item.id);
    else this.selectedArrivalIds.delete(item.id);
  }

  toggleSelectAllArrived(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedArrivalIds.clear();
    if (!checked) return;
    this.items
      .filter(i => i.id && this.isArrivalSelectable(i))
      .forEach(i => this.selectedArrivalIds.add(i.id!));
  }

  sendSelectedToArrivals() {
    if (!this.authService.canPerformBuyingListOperation('canSendToArrivals')) return;
    if (this.sendingToArrivals) return;
    const selected = this.items.filter(i => i.id && this.selectedArrivalIds.has(i.id));
    const eligible = selected.filter(i => this.isArrivalSelectable(i));
    if (eligible.length === 0) {
      alert('Select arrived items to send to Arrivals');
      return;
    }
    this.sendingToArrivals = true;
    const requests = eligible.map(i => this.dbService.createArrivalForBuyingItem(i.id!));
    forkJoin(requests).subscribe({
      next: results => {
        results.forEach((ok, idx) => {
          if (!ok) return;
          const item = eligible[idx];
          item.movedToArrivals = true;
          if (item.id) this.selectedArrivalIds.delete(item.id);
        });
        this.sendingToArrivals = false;
        this.loadItems();
      },
      error: () => {
        this.sendingToArrivals = false;
      }
    });
  }

  // Move a single item to arrivals for the active batch
  moveItemToArrivals(item: BuyingListItem) {
    if (!item.id) return;
    if (!this.authService.canPerformBuyingListOperation('canSendToArrivals')) return;
    const batchLabel = this.selectedBatch?.name || item.batchName || 'this batch';
    if (!confirm(`Move "${item.productName}" to Arrivals for batch "${batchLabel}"?`)) return;
    // Optimistically mark as moved to prevent duplicate clicks
    item.movedToArrivals = true;
    this.movedItemIds.add(item.id!);
    this.dbService.createArrivalForBuyingItem(item.id).subscribe(ok => {
      if (ok) {
        alert('Item moved to Arrivals');
        // refresh data to reflect any server-side changes
        this.loadItems();
      } else {
        // revert optimistic state
        item.movedToArrivals = false;
        this.movedItemIds.delete(item.id!);
        alert('Failed to move item to Arrivals');
      }
    }, err => {
      item.movedToArrivals = false;
      this.movedItemIds.delete(item.id!);
      alert('Failed to move item to Arrivals');
    });
  }

  

  

  openOutOfStockModal() {
    if (!this.selectedBatch) return;
    this.selectedOutOfStockIds.clear();
    this.updateOutOfStockProducts();
    this.showOutOfStockModal = true;
  }

  closeOutOfStockModal() {
    this.showOutOfStockModal = false;
  }

  updateOutOfStockProducts() {
    if (!this.selectedBatch) {
      this.outOfStockProducts = [];
      return;
    }
    this.outOfStockProducts = this.products.filter(p => (p.stock ?? 0) <= 0);
    this.outOfStockProducts.forEach(p => {
      if (!this.outOfStockQty[p.id || 0]) this.outOfStockQty[p.id || 0] = 1;
    });
  }

  isAlreadyInList(product: Product): boolean {
    if (!this.selectedBatch) return false;
    return this.items.some(i => i.productId === product.id);
  }

  addOutOfStockProduct(product: Product) {
    if (!this.selectedBatch || !product.id) return;
    if (this.isAlreadyInList(product)) return;
    const batchProduct = this.batchProducts.find(bp => bp.productId === product.id);
    if (!batchProduct?.id) {
      alert('Add this product to the batch before adding it to the buying list');
      return;
    }
    const qty = Math.max(1, Number(this.outOfStockQty[product.id]) || 1);
    const item: BuyingListItem = {
      batchId: this.selectedBatch.id,
      batchProductId: batchProduct.id,
      productId: product.id,
      productName: product.name,
      requestedQuantity: qty,
      orderedQuantity: qty,
      status: 'ordered',
      source: 'shop'
    };
    this.dbService.createBuyingListItem(item).subscribe(() => {
      this.loadItems();
    });
  }

  selectAllOutOfStock() {
    this.outOfStockProducts.forEach(p => {
      if (p.id && !this.isAlreadyInList(p)) this.selectedOutOfStockIds.add(p.id);
    });
  }

  toggleSelectOutOfStock(product: Product, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (!product.id) return;
    if (checked) this.selectedOutOfStockIds.add(product.id);
    else this.selectedOutOfStockIds.delete(product.id);
  }

  get isAllOutOfStockSelected(): boolean {
    const ids = this.outOfStockProducts.map(p => p.id).filter((id): id is number => typeof id === 'number');
    return ids.length > 0 && ids.every(id => this.selectedOutOfStockIds.has(id) || this.isAlreadyInList({ id } as Product));
  }

  toggleSelectAllOutOfStock(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedOutOfStockIds.clear();
    if (checked) this.selectAllOutOfStock();
  }

  addSelectedOutOfStock() {
    const products = this.outOfStockProducts.filter(p => p.id && this.selectedOutOfStockIds.has(p.id));
    products.forEach(p => this.addOutOfStockProduct(p));
    this.selectedOutOfStockIds.clear();
  }

  saveItem() {
    if (!this.selectedBatch?.id) {
      alert('Select a batch first');
      return;
    }
    if (!this.editingItem && !this.authService.canPerformBuyingListOperation('canAddItemToBuyingList')) {
      alert('You do not have permission to add buying list items');
      return;
    }
    if (this.editingItem && !this.canSaveItem(this.editingItem)) {
      alert('You do not have permission to edit this buying list item');
      return;
    }

    if (!this.formData.batchProductId || !this.formData.productId) {
      alert('Please select a product');
      return;
    }

    if (!this.formData.requestedQuantity || this.formData.requestedQuantity < 1) {
      alert('Please enter a valid quantity');
      return;
    }

    if (this.formData.orderedQuantity == null) {
      this.formData.orderedQuantity = this.formData.requestedQuantity;
    }

    const payload: BuyingListItem = {
      ...this.formData,
      batchId: this.selectedBatch.id
    };

    this.saving = true;
    if (this.editingItem) {
      payload.id = this.editingItem.id;
      this.dbService.updateBuyingListItem(payload).subscribe(() => {
        this.saving = false;
        this.closeModal();
        this.loadItems();
      });
    } else {
      this.dbService.createBuyingListItem(payload).subscribe(() => {
        this.saving = false;
        this.closeModal();
        this.loadItems();
      });
    }
  }

  deleteItem(item: BuyingListItem) {
    if (confirm('Are you sure you want to delete "' + item.productName + '"?')) {
      this.dbService.deleteBuyingListItem(item.id!).subscribe(() => {
        this.loadItems();
      });
    }
  }

  // ─── Buyers Modal ────────────────────────────────
  showBuyersModal = false;
  viewingItem: BuyingListItem | null = null;
  loadingBuyers = false;
  buyers: { clientName: string; clientPhone: string; quantity: number }[] = [];
  buyersTotalQty = 0;

  viewBuyers(item: BuyingListItem) {
    this.viewingItem = item;
    this.buyers = [];
    this.buyersPage = 1;
    this.buyersTotal = 0;
    this.buyersTotalQty = 0;
    this.showBuyersModal = true;
    this.loadBuyersPage();
  }

  loadBuyersPage() {
    if (!this.viewingItem) return;
    if (this.viewingItem.source === 'shop' || !this.viewingItem.productId || !this.viewingItem.batchId) {
      this.buyers = [];
      this.buyersTotal = 0;
      this.buyersTotalQty = 0;
      this.loadingBuyers = false;
      return;
    }

    this.loadingBuyers = true;
    this.dbService.getBuyersForProductPage(this.viewingItem.productId, this.viewingItem.batchId, this.buyersPage, this.buyersPageSize).subscribe(result => {
      this.buyers = result.data;
      this.buyersTotal = result.total;
      this.buyersTotalQty = result.totalQty;
      this.loadingBuyers = false;
    });
  }

  setBuyersPage(page: number) {
    const totalPages = Math.max(1, Math.ceil(this.buyersTotal / this.buyersPageSize));
    const next = Math.max(1, Math.min(page, totalPages));
    if (next === this.buyersPage) return;
    this.buyersPage = next;
    this.loadBuyersPage();
  }

  onBuyersModalButton(button: ModalButtonConfig) {
    if (button.action === 'close') {
      this.closeBuyersModal();
    }
  }

  closeBuyersModal() {
    this.showBuyersModal = false;
    this.viewingItem = null;
    this.buyers = [];
    this.buyersPage = 1;
    this.buyersTotal = 0;
    this.buyersTotalQty = 0;
    this.loadingBuyers = false;
  }
}
