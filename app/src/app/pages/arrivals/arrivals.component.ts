import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  BatchListSectionComponent,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import { BatchDetailHeaderComponent } from '../../components/batch-detail-header/batch-detail-header.component';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { ModalButtonConfig, ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import { ActionOption, TableColumn, TableComponent } from '../../components/table/table.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { ArrivalItem, OrderBatch, ArrivalsPermissionConfig } from '../../models';

// Damage allocation breakdown per client
interface DamageAllocationClient {
  orderItemId: number;
  clientId: number;
  clientName: string;
  originalQuantity: number;
  adjustedQuantity: number;
  batchProductId?: number;
}

@Component({
  selector: 'app-arrivals',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionFooterDirective, BatchDetailHeaderComponent, DateFilterComponent, ModalShellComponent, StatCardsComponent, TableComponent],
  template: `
    <div class="arr-page">
      <div class="arr-toast arr-toast-success" *ngIf="successMessage">
        <span class="material-icons">check_circle</span>
        <span>{{ successMessage }}</span>
      </div>

      <!-- ══ PAGE HEADER ══ -->
      <div class="arr-header">
        <div class="arr-header-left">
          <div class="arr-header-icon"><span class="material-icons">inventory</span></div>
          <div>
            <h1 class="arr-header-title">Arrivals</h1>
            <p class="arr-header-sub">Track incoming stock from your buying list</p>
          </div>
        </div>
      </div>

      <div class="arr-card">

        <!-- ══ BATCHES VIEW ══ -->
        <ng-container *ngIf="activeTab === 'batches'">
          <app-batch-list-section
            [loading]="loadingBatches"
            [items]="batches"
            [page]="batchPage"
            [pageSize]="batchPageSize"
            [total]="batchTotal"
            [searchTerm]="batchSearchTerm"
            [selectedMonth]="batchFilterMonth"
            [selectedYear]="batchFilterYear"
            [currentYear]="currentYear"
            [emptyTitle]="'No arrival batches yet'"
            [emptyDescription]="'Send a batch from the Buying List to Arrivals.'"
            [titleResolver]="arrivalBatchTitleResolver"
            [subtitleResolver]="arrivalBatchSubtitleResolver"
            [iconResolver]="arrivalBatchIconResolver"
            [tagsResolver]="arrivalBatchTagsResolver"
            [activeResolver]="arrivalBatchActiveResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (dateSelectionChange)="onBatchMonthYearChange($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="viewBatchItems($event)">
            <ng-template batchSectionFooter let-batch>
              <button class="arr-card-action-btn arr-cab-primary arr-open-btn" (click)="$event.stopPropagation(); viewBatchItems(batch)">
                <span class="material-icons">visibility</span> View Arrivals
              </button>
            </ng-template>
          </app-batch-list-section>
        </ng-container>

        <!-- ══ ITEMS VIEW ══ -->
        <ng-container *ngIf="activeTab === 'items'">

          <!-- No batch selected -->
          <ng-container *ngIf="!selectedBatch">
            <div class="arr-empty">
              <div class="arr-empty-icon"><span class="material-icons">folder_open</span></div>
              <h3>Select a batch</h3>
              <p>Choose a batch to view its arrivals.</p>
              <button class="arr-btn arr-btn-primary" (click)="activeTab = 'batches'">
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
              [icon]="'inventory_2'"
              (backClick)="activeTab = 'batches'">
              <button
                batchDetailHeaderAction
                class="arr-btn arr-btn-primary arr-btn-sm"
                *ngIf="authService.canPerformArrivalsOperation('canSendToShipping')"
                [disabled]="pendingConfirmedCount === 0 || sendingBatch"
                (click)="sendAllConfirmed()">
                <span class="arr-spinner" *ngIf="sendingBatch"></span>
                <span class="material-icons" *ngIf="!sendingBatch">local_shipping</span>
                {{ sendingBatch ? 'Sending…' : 'Send All Confirmed' }}
              </button>
            </app-batch-detail-header>

            <!-- Stats row -->
            <app-stat-cards [config]="arrivalStatCards"></app-stat-cards>

            <!-- Toolbar -->
            <div class="arr-toolbar">
              <div class="arr-search-wrap">
                <span class="material-icons arr-search-icon">search</span>
                <input class="arr-search-input" type="text" placeholder="Search products…"
                       [(ngModel)]="searchTerm" (input)="onSearchInput()" />
              </div>
              <app-date-filter (dateChange)="onDateChange($event)"></app-date-filter>
            </div>

            <!-- Two-column tables -->
            <div class="arr-cols">

                <!-- LEFT: Incoming -->
                <div class="arr-col-panel">
                  <div class="arr-col-header">
                    <span class="material-icons arr-col-icon arr-col-icon-incoming">arrow_downward</span>
                    <span class="arr-col-title">Incoming</span>
                    <span class="arr-col-badge">{{ incomingItems.length }}</span>
                  </div>
                  <div *ngIf="!loadingItems && incomingItems.length === 0" class="arr-col-empty">
                    <span class="material-icons">check_circle_outline</span>
                    <span>All items confirmed</span>
                  </div>
                  <div *ngIf="loadingItems || incomingItems.length > 0" class="arr-table-wrap">
                    <app-table
                      [columns]="incomingColumns"
                      [data]="incomingTableRows"
                      [metadata]="null"
                      [showSearchRow]="false"
                      [initialLoading]="loadingItems && incomingTableRows.length === 0"
                      [searching]="loadingItems && incomingTableRows.length > 0"
                      [skeletonRows]="4"
                      [baseColor]="baseColor"
                      (inputChange)="onIncomingTableInputChange($event)"
                      (actionClick)="onIncomingTableActionClick($event)">
                    </app-table>
                  </div>
                </div>

                <!-- RIGHT: Confirmed -->
                <div class="arr-col-panel">
                  <div class="arr-col-header">
                    <span class="material-icons arr-col-icon arr-col-icon-confirmed">check_circle</span>
                    <span class="arr-col-title">Confirmed</span>
                    <span class="arr-col-badge arr-col-badge-green">{{ confirmedItems.length }}</span>
                  </div>
                  <div *ngIf="!loadingItems && confirmedItems.length === 0" class="arr-col-empty">
                    <span class="material-icons">hourglass_empty</span>
                    <span>No confirmed items yet</span>
                  </div>
                  <div *ngIf="loadingItems || confirmedItems.length > 0" class="arr-table-wrap">
                    <app-table
                      [columns]="confirmedColumns"
                      [data]="confirmedTableRows"
                      [metadata]="null"
                      [showSearchRow]="false"
                      [initialLoading]="loadingItems && confirmedTableRows.length === 0"
                      [searching]="loadingItems && confirmedTableRows.length > 0"
                      [skeletonRows]="4"
                      [baseColor]="baseColor"
                      (actionClick)="onConfirmedTableActionClick($event)">
                    </app-table>
                  </div>
                </div>

              </div><!-- /arr-cols -->

              <!-- Pagination -->
              <div class="arr-pagination" *ngIf="itemTotal > 0">
                <span class="arr-pg-info">{{ itemRangeStart }}–{{ itemRangeEnd }} of {{ itemTotal }}</span>
                <div class="arr-pg-btns">
                  <button (click)="setItemPage(1)" [disabled]="itemPage === 1"><span class="material-icons" style="font-size:16px">first_page</span></button>
                  <button (click)="setItemPage(itemPage - 1)" [disabled]="itemPage === 1"><span class="material-icons" style="font-size:16px">chevron_left</span></button>
                  <span class="arr-pg-cur">{{ itemPage }} / {{ totalItemPages }}</span>
                  <button (click)="setItemPage(itemPage + 1)" [disabled]="itemPage >= totalItemPages"><span class="material-icons" style="font-size:16px">chevron_right</span></button>
                  <button (click)="setItemPage(totalItemPages)" [disabled]="itemPage >= totalItemPages"><span class="material-icons" style="font-size:16px">last_page</span></button>
                </div>
              </div>

          </ng-container>
        </ng-container>

      </div><!-- /arr-card -->

      <!-- ══ DEFICIT MODAL ══ -->
      <div class="arr-modal-overlay" *ngIf="showDeficitModal">
        <div class="arr-modal" (click)="$event.stopPropagation()">
          <div class="arr-modal-header">
            <h3 class="arr-modal-title">
              {{ deficitMode === 'surplus' ? 'Surplus Received' : 'Deficit Detected' }}
              <span class="arr-modal-sub">— {{ deficitItem?.productName }}</span>
            </h3>
            <button class="arr-modal-close" (click)="cancelDeficit()"><span class="material-icons">close</span></button>
          </div>
          <div class="arr-modal-body">
            <div class="arr-deficit-info" [class.arr-deficit-surplus]="deficitMode === 'surplus'">
              <span class="material-icons">{{ deficitMode === 'surplus' ? 'add_circle' : 'warning' }}</span>
              <p *ngIf="deficitMode === 'ordered'">You ordered <strong>{{ deficitOrderedValue }}</strong> but received <strong>{{ deficitReceivedValue }}</strong> — deficit of <strong>{{ deficitAmount }}</strong>.</p>
              <p *ngIf="deficitMode === 'surplus'">You received <strong>{{ deficitReceivedValue }}</strong> which exceeds ordered (<strong>{{ deficitOrderedValue }}</strong>). Add the extra <strong>{{ deficitAmount }}</strong> to stock?</p>
              <p *ngIf="deficitMode === 'requested'">Expected <strong>{{ deficitExpected }}</strong> — missing <strong>{{ deficitAmount }}</strong>.</p>
            </div>
            <div *ngIf="deficitMode !== 'surplus'">
              <p class="arr-reason-label">Select a reason:</p>
              <div class="arr-reason-grid">
                <div *ngFor="let r of deficitReasons"
                     class="arr-reason-card"
                     [class.arr-reason-active]="deficitReason === r"
                     (click)="deficitReason = r">{{ r }}</div>
              </div>
            </div>
          </div>
          <div class="arr-modal-footer">
            <button class="arr-btn arr-btn-ghost" (click)="cancelDeficit()" [disabled]="modalSaving">Cancel</button>
            <button *ngIf="deficitMode === 'surplus' && authService.canPerformArrivalsOperation('canChangeReceivedValue')" class="arr-btn arr-btn-primary" (click)="confirmSurplus()" [disabled]="modalSaving">
              <span class="arr-spinner" *ngIf="modalSaving"></span>
              Add Extra to Stock
            </button>
            <button *ngIf="deficitMode !== 'surplus' && authService.canPerformArrivalsOperation('canConfirmReceivedItems')" class="arr-btn arr-btn-danger" (click)="confirmDeficit()" [disabled]="modalSaving">
              <span class="arr-spinner" *ngIf="modalSaving"></span>
              Record Damaged
            </button>
          </div>
        </div>
      </div>

      <!-- ══ DAMAGE ALLOCATION MODAL ══ -->
      <div class="arr-modal-overlay" *ngIf="showDamageAllocationModal">
        <div class="arr-modal arr-modal-lg" (click)="$event.stopPropagation()">
          <div class="arr-modal-header">
            <h3 class="arr-modal-title">
              Allocate Damage
              <span class="arr-modal-sub">— {{ damageAllocationItem?.productName }}</span>
            </h3>
            <button class="arr-modal-close" (click)="cancelDamageAllocation()"><span class="material-icons">close</span></button>
          </div>
          <div class="arr-modal-body">
            <!-- Loading state -->
            <ng-container *ngIf="loadingAllocationClients">
              <div class="arr-sk-table">
                <div class="arr-sk-thead"><div class="arr-sk arr-sk-th" *ngFor="let i of [1,2,3]"></div></div>
                <div class="arr-sk-row" *ngFor="let i of [1,2,3]"><div class="arr-sk arr-sk-td" *ngFor="let j of [1,2,3]"></div></div>
              </div>
            </ng-container>

            <!-- Allocation table -->
            <ng-container *ngIf="!loadingAllocationClients">
              <div class="arr-alloc-info">
                <div>Received: <strong>{{ allocationReceivedQty }} units</strong></div>
                <div>Damage available: <strong>{{ allocationAvailable }} units</strong></div>
                <div>Allocated: <strong>{{ allocationTotalAdjusted }} units</strong></div>
              </div>

              <!-- Reason selector -->
              <div class="arr-reason-section">
                <label class="arr-reason-label">Reason for damage:</label>
                <div class="arr-reason-grid">
                  <button *ngFor="let r of allocationReasons"
                          class="arr-reason-card"
                          [class.arr-reason-active]="allocationReason === r"
                          (click)="allocationReason = r"
                          type="button">
                    {{ r }}
                  </button>
                </div>
              </div>

              <div class="arr-alloc-table-wrap">
                <table class="arr-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th class="arr-tc">Original Qty</th>
                      <th class="arr-tc">Adjusted Qty</th>
                      <th class="arr-tc">Damaged</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let client of damageAllocationClients">
                      <td><span class="arr-product-name">{{ client.clientName }}</span></td>
                      <td class="arr-tc">{{ client.originalQuantity }}</td>
                      <td class="arr-tc">
                        <input type="number"
                               min="0"
                               [max]="client.originalQuantity"
                               class="arr-qty-input"
                               [(ngModel)]="client.adjustedQuantity"
                               (change)="updateClientAllocation(client, client.adjustedQuantity)" />
                      </td>
                      <td class="arr-tc">{{ client.originalQuantity - client.adjustedQuantity }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="!isAllocationValid" class="arr-alloc-warning">
                <span class="material-icons">warning</span>
                <span>Total adjusted must equal {{ allocationReceivedQty }} units</span>
              </div>
            </ng-container>
          </div>
          <div class="arr-modal-footer">
            <button class="arr-btn arr-btn-ghost" (click)="cancelDamageAllocation()" [disabled]="modalSaving">Cancel</button>
            <button class="arr-btn arr-btn-primary" (click)="confirmDamageAllocation()" [disabled]="!isAllocationValid || modalSaving">
              <span class="arr-spinner" *ngIf="modalSaving"></span>
              Save and Record Damages
            </button>
          </div>
        </div>
      </div>

      <!-- ══ SHIPPING CONFIRM MODAL ══ -->
      <app-modal
        *ngIf="showShippingConfirmModal"
        [title]="shippingConfirmTitle"
        [sub-heading]="shippingConfirmSubtitle"
        [icon]="'local_shipping'"
        [buttons]="shippingConfirmButtons"
        (closeRequested)="closeShippingConfirmModal()"
        (buttonClick)="onShippingConfirmButton($event)">
        <div class="arr-confirm-body">
          <div class="arr-confirm-highlight">
            <span class="material-icons">info</span>
            <div>
              <strong *ngIf="shippingConfirmMode === 'single'">{{ shippingConfirmItem?.productName }}</strong>
              <strong *ngIf="shippingConfirmMode === 'batch'">{{ pendingConfirmedCount }} confirmed item{{ pendingConfirmedCount !== 1 ? 's' : '' }}</strong>
              <span>{{ shippingConfirmBodyText }}</span>
            </div>
          </div>
        </div>
      </app-modal>

      <!-- ══ REVERSAL CONFIRM MODAL ══ -->
      <app-modal
        *ngIf="showReverseConfirmModal"
        size="sm"
        tone="warning"
        title="Confirm Reversal"
        sub-heading="Move item back to the buying list"
        icon="warning"
        [buttons]="reverseConfirmButtons"
        (closeRequested)="closeReverseConfirmModal()"
        (buttonClick)="onReverseConfirmButton($event)">
        <div class="arr-confirm-body">
          <div class="arr-confirm-highlight">
            <span class="material-icons">info</span>
            <div>
              <strong>{{ reverseConfirmItem?.productName }}</strong>
              <span>Are you sure you want to reverse this item back to the Buying List? This will remove the unconfirmed arrival row.</span>
            </div>
          </div>
        </div>
      </app-modal>

    </div><!-- /arr-page -->
  `,
  styles: [`
    /* ── Layout ── */
    .arr-page { padding: 0; }
    .arr-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    /* ── Header ── */
    .arr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .arr-header-left { display: flex; align-items: center; gap: 14px; }
    .arr-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .arr-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .arr-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    /* ── Buttons ── */
    .arr-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.13s, opacity 0.13s; }
    .arr-btn .material-icons { font-size: 18px; }
    .arr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .arr-btn-primary { background: var(--primary-color, #6366f1); color: #fff; }
    .arr-btn-primary:hover:not(:disabled) { background: var(--primary-dark, #4f46e5); }
    .arr-btn-ghost { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .arr-btn-ghost:hover:not(:disabled) { background: #e2e8f0; }
    .arr-btn-danger { background: #ef4444; color: #fff; }
    .arr-btn-danger:hover:not(:disabled) { background: #dc2626; }
    .arr-btn-sm { padding: 6px 10px; font-size: 12px; }
    .arr-confirm-body { display: flex; flex-direction: column; gap: 12px; }
    .arr-confirm-highlight { display: flex; align-items: flex-start; gap: 10px; padding: 14px; border: 1px solid #dbeafe; background: #f8fbff; border-radius: 12px; color: #334155; }
    .arr-confirm-highlight .material-icons { color: var(--primary-color, #6366f1); font-size: 20px; margin-top: 1px; }
    .arr-confirm-highlight strong { display: block; font-size: 14px; color: #0f172a; margin-bottom: 2px; }
    .arr-confirm-highlight span:last-child { font-size: 13px; color: #64748b; }

    .arr-card-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.12s; }
    .arr-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .arr-cab-primary:hover { background: var(--primary-dark, #4f46e5); }
    .arr-open-btn { width: 100%; justify-content: center; }

    /* ── Toolbar ── */
    .arr-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .arr-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 340px; }
    .arr-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 18px; pointer-events: none; }
    .arr-search-input { width: 100%; padding: 9px 12px 9px 36px; border: 1px solid #ccc; border-radius: 9px; font-size: 13px; background: #f8fafc; color: #1e293b; box-sizing: border-box; transition: border-color 0.13s, box-shadow 0.13s; }
    .arr-search-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.12); background: #fff; }

    /* ── Two column layout ── */
    .arr-cols { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; align-items: start; }
    .arr-col-panel { border: 1px solid #ccc; border-radius: 12px; overflow: hidden; }
    .arr-col-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #ccc; }
    .arr-col-icon { font-size: 18px; }
    .arr-col-icon-incoming { color: #f59e0b; }
    .arr-col-icon-confirmed { color: #10b981; }
    .arr-col-title { font-size: 13px; font-weight: 700; color: #0f172a; flex: 1; }
    .arr-col-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; }
    .arr-col-badge-green { background: #d1fae5; color: #065f46; }
    .arr-col-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 32px 16px; color: #94a3b8; font-size: 13px; }
    .arr-col-empty .material-icons { font-size: 20px; }

    /* ── Table ── */
    .arr-table-wrap { overflow-x: auto; }
    .arr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .arr-table th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #ccc; white-space: nowrap; }
    .arr-table td { padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
    .arr-table tr:last-child td { border-bottom: none; }
    .arr-table tr:hover td { background: #fafbff; }
    .arr-tc { text-align: center; }
    .arr-product-name { font-weight: 600; color: #0f172a; }
    .arr-qty-input { width: 72px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 8px; font-size: 13px; text-align: center; }
    .arr-qty-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); }
    /* ── Pagination ── */
    .arr-pagination { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; margin-top: 12px; border-top: 1px solid #ccc; }
    .arr-pg-info { font-size: 12px; color: #64748b; }
    .arr-pg-btns { display: flex; align-items: center; gap: 4px; }
    .arr-pg-btns button { width: 30px; height: 30px; border: 1px solid #e2e8f0; border-radius: 7px; background: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: background 0.12s; }
    .arr-pg-btns button:disabled { opacity: 0.4; cursor: not-allowed; }
    .arr-pg-btns button:hover:not(:disabled) { background: #e2e8f0; }
    .arr-pg-cur { font-size: 12px; font-weight: 600; color: #0f172a; padding: 0 8px; }

    /* ── Empty state ── */
    .arr-empty { text-align: center; padding: 48px 24px; }
    .arr-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(var(--primary-rgb, 99,102,241), 0.08); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
    .arr-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .arr-empty p { font-size: 13px; color: #64748b; margin: 0 0 16px; }

    /* ── Skeleton ── */
    .arr-sk { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: arr-shimmer 1.4s infinite; border-radius: 6px; }
    @keyframes arr-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .arr-sk-table { margin-top: 4px; }
    .arr-sk-thead { display: flex; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; }
    .arr-sk-th { height: 14px; flex: 1; border-radius: 4px; }
    .arr-sk-row { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f8fafc; }
    .arr-sk-td { height: 14px; flex: 1; border-radius: 4px; }

    /* ── Spinner ── */
    .arr-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: arr-spin 0.6s linear infinite; display: inline-block; flex-shrink: 0; }
    @keyframes arr-spin { to { transform: rotate(360deg); } }

    /* ── Modal ── */
    .arr-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .arr-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
    .arr-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #ccc; gap: 8px; }
    .arr-modal-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .arr-modal-sub { font-size: 13px; font-weight: 400; color: #64748b; }
    .arr-modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; padding: 2px; border-radius: 6px; flex-shrink: 0; }
    .arr-modal-close:hover { background: #f1f5f9; color: #475569; }
    .arr-modal-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
    .arr-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid #ccc; }
    .arr-deficit-info { display: flex; align-items: flex-start; gap: 10px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px; color: #9a3412; }
    .arr-deficit-info .material-icons { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .arr-deficit-info p { margin: 0; font-size: 13px; line-height: 1.5; }
    .arr-deficit-surplus { background: #f0fdf4; border-color: #bbf7d0; color: #14532d; }
    .arr-reason-label { font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 8px; }
    .arr-reason-grid { display: flex; flex-direction: column; gap: 6px; }
    .arr-reason-card { padding: 10px 14px; border: 1px solid #ccc; border-radius: 9px; font-size: 13px; font-weight: 500; color: #334155; cursor: pointer; transition: border-color 0.12s, background 0.12s; }
    .arr-reason-card:hover { background: #f8fafc; }
    .arr-reason-active { border-color: var(--primary-color, #6366f1); background: rgba(var(--primary-rgb,99,102,241),0.06); color: var(--primary-color,#6366f1); font-weight: 700; }
    
    /* Damage Allocation Modal Styles */
    .arr-modal-lg { max-width: 560px; }
    .arr-reason-section { margin-bottom: 16px; }
    .arr-alloc-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 8px; font-size: 12px; }
    .arr-alloc-info div { text-align: center; }
    .arr-alloc-info strong { display: block; font-size: 16px; color: #0f172a; margin-top: 4px; }
    .arr-alloc-table-wrap { overflow-x: auto; margin: 8px 0; }
    .arr-alloc-table-wrap .arr-table { width: 100%; }
    .arr-alloc-table-wrap .arr-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #ccc; }
    .arr-alloc-table-wrap .arr-table td { padding: 12px; border-bottom: 1px solid #eee; }
    .arr-alloc-table-wrap .arr-table tr:hover td { background: #fafbff; }
    .arr-alloc-table-wrap .arr-table tr:last-child td { border-bottom: none; }
    .arr-alloc-table-wrap .arr-qty-input { width: 72px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; text-align: center; }
    .arr-alloc-table-wrap .arr-qty-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99, 102, 241), 0.12); }
    .arr-alloc-warning { display: flex; align-items: center; gap: 8px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #9a3412; margin-top: 8px; }
    .arr-alloc-warning .material-icons { font-size: 18px; flex-shrink: 0; }

    /* ── Toast ── */
    .arr-toast {
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
      animation: arr-toast-in 0.18s ease-out;
    }
    .arr-toast .material-icons { font-size: 18px; }
    .arr-toast-success {
      background: #ecfdf5;
      color: #166534;
      border-color: #bbf7d0;
    }
    @keyframes arr-toast-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Reversing Row Gray Out ── */
    ::ng-deep .row-reversing td {
      opacity: 0.5;
      background-color: #f8fafc !important;
    }
    ::ng-deep .row-reversing {
      pointer-events: none;
    }
  `]
})

export class ArrivalsComponent implements OnInit, OnDestroy {
  readonly baseColor = 'var(--primary-color, #6366f1)';
  loadingBatches = true;
  loadingItems = false;
  activeTab: 'batches' | 'items' = 'batches';

  showReverseConfirmModal = false;
  reverseConfirmItem: ArrivalItem | null = null;
  successMessage: string | null = null;
  private successTimer: any = null;

  batches: OrderBatch[] = [];
  items: ArrivalItem[] = [];

  selectedBatchName = '';
  selectedBatch: OrderBatch | null = null;
  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();
  searchTerm = '';
  dateFrom = '';
  dateTo = '';

  batchPage = 1;
  batchPageSize = 20;
  batchTotal = 0;
  itemPage = 1;
  itemPageSize = 20;
  itemTotal = 0;
  incomingColumns: TableColumn[] = [];
  confirmedColumns: TableColumn[] = [];

  batchStats: { [batchName: string]: { count: number; ordered: number; received: number; confirmed: number } } = {};
  filteredStats = { count: 0, requested: 0, ordered: 0, received: 0, confirmed: 0 };
  // computed expected value shown in deficit modal (matches Requested semantics)
  deficitExpected = 0;
  // split items for two-column view
  movingIds = new Set<number | undefined>();
  // loading states for send actions
  sendingItemId: number | null = null;
  sendingBatch = false;
  undoingIds = new Set<number>();
  reversingToBuyingIds = new Set<number>();
  // search debounce
  searchTimeoutId: any = null;
  batchSearchTimeoutId: any = null;
  incomingItems: ArrivalItem[] = [];
  confirmedItems: ArrivalItem[] = [];
  // when a confirm triggers a deficit modal, hold the item here until user confirms/cancels
  pendingConfirmItem: ArrivalItem | null = null;
  // deficit modal
  showDeficitModal = false;
  deficitItem: ArrivalItem | null = null;
  deficitAmount = 0;
  deficitReason = '';
  deficitMode: 'ordered' | 'requested' | 'surplus' = 'requested';
  deficitOrderedValue = 0;
  deficitReceivedValue = 0;
  deficitReasons = [
    'Product Ordered but did not arrive',
    'Ordered lesser products',
    'Product damaged in transit'
  ];
  modalSaving = false;

  // ── Damage allocation modal ──
  showDamageAllocationModal = false;
  damageAllocationItem: ArrivalItem | null = null;
  damageAllocationClients: DamageAllocationClient[] = [];
  allocationReceivedQty = 0;
  allocationTotalAdjusted = 0;
  loadingAllocationClients = false;
  allocationReason = 'Damaged in transit';
  allocationReasons = ['Damaged in transit', 'Less product arrived'];
  showShippingConfirmModal = false;
  shippingConfirmMode: 'single' | 'batch' = 'single';
  shippingConfirmItem: ArrivalItem | null = null;

  constructor(private dbService: DatabaseService, public authService: AuthService) {}

  readonly arrivalBatchTitleResolver = (batch: OrderBatch) => batch.name;
  readonly arrivalBatchSubtitleResolver = (batch: OrderBatch) =>
    batch.createdAt
      ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
  readonly arrivalBatchIconResolver = () => 'inventory_2';
  readonly arrivalBatchActiveResolver = (batch: OrderBatch) => batch.name === this.selectedBatchName;
  readonly arrivalBatchTagsResolver = (batch: OrderBatch): BatchCardTagConfig[] => {
    const stats = this.batchStats[batch.name];
    return [
      { tagName: `${stats?.count || 0} Items`, color: (stats?.count || 0) > 0 ? 'gray' : 'gray', icon: 'inventory_2' },
      { tagName: `${stats?.received || 0} Received`, color: (stats?.received || 0) > 0 ? 'blue' : 'gray', icon: 'inbox' },
      { tagName: `${stats?.confirmed || 0} Confirmed`, color: (stats?.confirmed || 0) > 0 ? 'green' : 'gray', icon: 'check_circle' }
    ];
  };

  get arrivalStatCards(): StatCardConfig[] {
    return [
      { icon: 'inventory_2', statName: 'Items', statValue: this.filteredStats.count, color: 'blue' },
      { icon: 'shopping_cart', statName: 'Requested', statValue: this.filteredStats.requested, color: 'orange' },
      { icon: 'assignment', statName: 'Ordered', statValue: this.filteredStats.ordered, color: 'violet' },
      { icon: 'inbox', statName: 'Received', statValue: this.filteredStats.received, color: 'base' },
      { icon: 'check_circle', statName: 'Confirmed', statValue: this.filteredStats.confirmed, color: 'green' }
    ];
  }

  get incomingTableRows() {
    return this.incomingItems.map(item => ({
      ...item,
      rowClass: this.reversingToBuyingIds.has(item.id || 0) ? 'row-reversing' : '',
      requestedDisplay: item.requestedQuantity ?? item.boughtQuantity ?? item.orderedQuantity ?? 0,
      orderedDisplay: item.boughtQuantity || item.orderedQuantity || 0,
      stockDisplay: item.productStock || 0,
      receivedQuantityDraft: item.receivedQuantity,
      receivedQuantityDisabled: !this.authService.canPerformArrivalsOperation('canChangeReceivedValue') || this.movingIds.has(item.id) || this.reversingToBuyingIds.has(item.id || 0),
      actions: [
        ...(this.authService.canPerformArrivalsOperation('canReverseToBuyingList') ? [{
          id: 'reverse-to-buying',
          label: 'Reverse to Buying List',
          icon: 'arrow-return-left',
          color: 'orange',
          disabled: this.movingIds.has(item.id)
            || this.reversingToBuyingIds.has(item.id || 0)
            || Number(item.receivedQuantity || 0) > 0,
          loading: this.reversingToBuyingIds.has(item.id || 0)
        } as ActionOption] : []),
        {
          id: 'confirm',
          label: 'Move to confirmed',
          icon: 'arrow-right',
          color: 'blue',
          disabled: !this.authService.canPerformArrivalsOperation('canConfirmReceivedItems') || this.movingIds.has(item.id) || this.reversingToBuyingIds.has(item.id || 0),
          loading: this.movingIds.has(item.id)
        }
      ] as ActionOption[]
    }));
  }

  get confirmedTableRows() {
    return this.confirmedItems.map(item => ({
      ...item,
      shippingStatus: item.sentToShipping ? 'sent' : 'ready',
      actions: this.buildConfirmedActions(item)
    }));
  }

  ngOnInit(): void {
    this.setupTableConfigs();
    this.loadBatches();
    
    // Reload batches when a batch is deleted elsewhere
    this.dbService.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  ngOnDestroy(): void {
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
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

  get pendingConfirmedCount() {
    return (this.confirmedItems || []).filter(i => !i.sentToShipping).length;
  }

  get shippingConfirmTitle(): string {
    return this.shippingConfirmMode === 'single' ? 'Send to Shipping' : 'Send All Confirmed';
  }

  get shippingConfirmSubtitle(): string {
    return this.shippingConfirmMode === 'single'
      ? 'Move this confirmed item into the shipping workflow'
      : 'Move every confirmed item in this batch into the shipping workflow';
  }

  get shippingConfirmBodyText(): string {
    return this.shippingConfirmMode === 'single'
      ? 'This item will leave the arrivals queue and become available in Shipping.'
      : 'All confirmed items in this batch will leave the arrivals queue and become available in Shipping.';
  }

  get shippingConfirmButtons(): ModalButtonConfig[] {
    const loading = this.shippingConfirmMode === 'single'
      ? !!this.shippingConfirmItem?.id && this.sendingItemId === this.shippingConfirmItem.id
      : this.sendingBatch;

    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: loading },
      {
        buttonName: this.shippingConfirmMode === 'single' ? 'Send Item' : 'Send All',
        color: 'base_color',
        action: 'confirm',
        loading
      }
    ];
  }

  private setupTableConfigs() {
    this.incomingColumns = [
      { key: 'productName', label: 'Product', type: 'string' },
      { key: 'requestedDisplay', label: 'Req.', type: 'string' },
      { key: 'orderedDisplay', label: 'Ordered', type: 'string' },
      { key: 'stockDisplay', label: 'In Stock', type: 'string' },
      {
        key: 'receivedQuantityDraft',
        label: 'Received',
        type: 'input',
        inputType: 'number',
        inputMin: 0,
        inputStep: 1,
        inputUpdateOn: 'change',
        disabledKey: 'receivedQuantityDisabled'
      },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];

    this.confirmedColumns = [
      { key: 'productName', label: 'Product', type: 'string' },
      { key: 'receivedQuantity', label: 'Received', type: 'string' },
      {
        key: 'shippingStatus',
        label: 'Shipping',
        type: 'status',
        statusOptions: [
          { label: 'Ready', value: 'ready', color: 'blue' },
          { label: 'Sent', value: 'sent', color: 'green' }
        ]
      },
      { key: 'actions', label: 'Actions', type: 'actions' }
    ];
  }

  loadBatches() {
    this.loadingBatches = true;
    const monthYear = this.batchFilterMonth !== null && this.batchFilterYear !== null
      ? { month: this.batchFilterMonth, year: this.batchFilterYear }
      : undefined;
    this.dbService.getArrivalBatchesPage(this.batchPage, this.batchPageSize, this.batchSearchTerm.trim(), monthYear).subscribe(({ data, total }) => {
      this.batches = data;
      this.batchTotal = total;
      if (this.batchPage > this.totalBatchPages) {
        this.batchPage = this.totalBatchPages;
        this.loadBatches();
        return;
      }
      this.loadingBatches = false;
      if (this.selectedBatchName) {
        const found = this.batches.find(b => b.name === this.selectedBatchName);
        if (found) this.selectedBatch = found;
      }
      this.loadBatchStats();
    });
  }

  onBatchSearchInput(term: string) {
    this.batchSearchTerm = term;
    clearTimeout(this.batchSearchTimeoutId);
    this.batchSearchTimeoutId = setTimeout(() => {
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

  loadBatchStats() {
    this.batchStats = {};
    this.batches.forEach(batch => {
      if (!batch.id) return;
      this.dbService.getArrivalBatchStats(batch.id).subscribe(stats => {
        this.batchStats[batch.name] = stats;
      });
    });
  }

  loadItems(silent = false) {
    if (!this.selectedBatch?.id) {
      this.items = [];
      this.itemTotal = 0;
      this.incomingItems = [];
      this.confirmedItems = [];
      this.filteredStats = { count: 0, requested: 0, ordered: 0, received: 0, confirmed: 0 };
      this.loadingItems = false;
      return;
    }
    if (!silent) this.loadingItems = true;
    const term = this.searchTerm.trim();
    const dateFrom = this.dateFrom ? `${this.dateFrom}T00:00:00` : '';
    const dateTo = this.dateTo ? `${this.dateTo}T23:59:59` : '';
    forkJoin({
      page: this.dbService.getArrivalItemsByBatchPage(
        this.selectedBatch.id,
        this.itemPage,
        this.itemPageSize,
        term,
        dateFrom,
        dateTo
      ),
      stats: this.dbService.getArrivalItemsSummary(
        this.selectedBatch.id,
        '',
        '',
        ''
      )
    }).subscribe(({ page, stats }) => {
      this.items = page.data;
      this.itemTotal = page.total;
      this.filteredStats = stats;
      this.incomingItems = this.items.filter(i => !i.confirmed && !i.sentToShipping);
      this.confirmedItems = this.items.filter(i => i.confirmed);
      this.movingIds.clear();
      this.loadingItems = false;
      if (this.itemPage > this.totalItemPages) {
        this.itemPage = this.totalItemPages;
        this.loadItems();
      }
    });
  }

  viewBatchItems(batch: OrderBatch) {
    this.selectedBatchName = batch.name;
    this.selectedBatch = batch;
    this.activeTab = 'items';
    this.searchTerm = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.itemPage = 1;
    this.loadItems();
  }

  onSearchInput() {
    // Clear existing timeout if any
    if (this.searchTimeoutId) {
      clearTimeout(this.searchTimeoutId);
    }
    // Set new timeout for 500ms
    this.searchTimeoutId = setTimeout(() => {
      this.filterItems();
      this.searchTimeoutId = null;
    }, 500);
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

  updateReceivedQuantity(item: ArrivalItem, value: number) {
    if (!this.authService.canPerformArrivalsOperation('canChangeReceivedValue')) return;
    item.receivedQuantity = value;
    this.dbService.updateArrivalItem(item).subscribe(() => {
      this.loadItems(true);
      this.loadBatchStats();
    });
  }

  onIncomingTableInputChange(event: { item: ArrivalItem; value: any }) {
    const nextValue = Number(event.value);
    this.updateReceivedQuantity(event.item, Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : 0);
  }

  onIncomingTableActionClick(event: { action: ActionOption; item: ArrivalItem }) {
    if (event.action.id === 'reverse-to-buying') {
      this.reverseToBuyingList(event.item);
      return;
    }

    if (event.action.id === 'confirm') {
      this.confirmAndMove(event.item);
    }
  }

  onConfirmedTableActionClick(event: { action: ActionOption; item: ArrivalItem }) {
    if (event.action.id === 'undo') {
      this.undoConfirm(event.item);
      return;
    }

    if (event.action.id === 'ship') {
      this.sendToShipping(event.item);
    }
  }

  get isReversing(): boolean {
    return this.reverseConfirmItem?.id ? this.reversingToBuyingIds.has(this.reverseConfirmItem.id) : false;
  }

  get reverseConfirmButtons(): ModalButtonConfig[] {
    const loading = this.isReversing;
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: loading },
      {
        buttonName: 'Confirm Reversal',
        color: 'base_color',
        action: 'confirm',
        loading
      }
    ];
  }

  reverseToBuyingList(item: ArrivalItem) {
    if (!item.id) return;
    if (!this.authService.canPerformArrivalsOperation('canReverseToBuyingList')) return;
    if (Number(item.receivedQuantity || 0) > 0) {
      alert('Set received quantity back to 0 before reversing this item to the Buying List.');
      return;
    }

    this.reverseConfirmItem = item;
    this.showReverseConfirmModal = true;
  }

  onReverseConfirmButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeReverseConfirmModal();
      return;
    }

    if (button.action !== 'confirm') return;
    if (!this.reverseConfirmItem?.id) return;

    const item = this.reverseConfirmItem;
    this.reversingToBuyingIds.add(item.id!);

    this.dbService.reverseArrivalToBuyingList(item.id!).subscribe({
      next: ok => {
        this.reversingToBuyingIds.delete(item.id!);
        this.closeReverseConfirmModal();
        if (ok) {
          this.loadItems(true);
          this.loadBatchStats();
          this.loadBatches();
          this.showSuccess('Item successfully reversed to the Buying List.');
        } else {
          alert('Could not reverse this item. Confirmed or shipped arrivals must be undone first.');
        }
      },
      error: () => {
        this.reversingToBuyingIds.delete(item.id!);
        this.closeReverseConfirmModal();
        alert('Failed to reverse this item to the Buying List');
      }
    });
  }

  closeReverseConfirmModal() {
    this.showReverseConfirmModal = false;
    this.reverseConfirmItem = null;
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  // Confirm and animate move from incoming to confirmed column
  confirmAndMove(item: ArrivalItem) {
    if (item.confirmed) return;
    if (!this.authService.canPerformArrivalsOperation('canConfirmReceivedItems')) return;
    // mark as moving to trigger animation
    this.movingIds.add(item.id);
    // short timeout to let animation show
    setTimeout(() => {
      // compute deficit using requested vs (received + in-stock) BEFORE opening modal
      // derive values according to new semantics:
      // Requested = items requested by the client (requestedQuantity), fallback to boughtQuantity or orderedQuantity
      const requested = item.requestedQuantity ?? item.boughtQuantity ?? item.orderedQuantity ?? 0;
      const ordered = item.boughtQuantity ?? item.orderedQuantity ?? 0; // items the user ordered from buying list
      const received = item.receivedQuantity || 0;
      const inStock = item.productStock || 0;
      // deficit relative to requested considering in-stock
      const deficitRequested = requested - (received + inStock);
      // deficit relative to ordered (if received is less than what we ordered)
      const deficitOrdered = ordered - received;
      // choose the positive deficit to display
      const deficit = Math.max(0, deficitRequested, deficitOrdered);
      // store expected requested value for modal display
      const expectedForModal = requested;

      // Defer server confirmation until after surplus / deficit decisions are completed.
      this.movingIds.delete(item.id);
      if (received > ordered) {
        this.pendingConfirmItem = item;
        this.deficitExpected = expectedForModal;
        const surplus = received - ordered;
        this.openDeficitModal(item, surplus, 'surplus', ordered, received);
      } else if (deficit > 0) {
        this.pendingConfirmItem = item;
        this.openDamageAllocationModal(item, received);
      } else {
        this.dbService.confirmArrivalItem(item.id!, item.productId || null, received, false).subscribe(ok => {
          if (ok) {
            this.finalizeConfirmedItem(item);
          } else {
            alert('Failed to confirm arrival');
          }
        });
      }
    }, 250);
  }

  private finalizeConfirmedItem(item: ArrivalItem) {
    const itemId = item.id;
    const incomingIndex = this.incomingItems.findIndex(i => i.id === itemId);
    const sourceItem = incomingIndex >= 0 ? this.incomingItems[incomingIndex] : item;
    const confirmedItem: ArrivalItem = {
      ...sourceItem,
      confirmed: true
    };

    if (incomingIndex >= 0) {
      this.incomingItems.splice(incomingIndex, 1);
      this.incomingItems = [...this.incomingItems];
    }

    const allIndex = this.items.findIndex(i => i.id === itemId);
    if (allIndex >= 0) {
      this.items[allIndex] = { ...this.items[allIndex], confirmed: true };
      this.items = [...this.items];
    }

    this.confirmedItems = [...this.confirmedItems.filter(i => i.id !== itemId), confirmedItem];
    this.filteredStats = {
      ...this.filteredStats,
      confirmed: this.confirmedItems.length
    };

    this.loadItems(true);
    this.loadBatchStats();
  }

  openDeficitModal(item: ArrivalItem, deficit: number, mode: 'ordered' | 'requested' | 'surplus' = 'requested', ordered?: number, received?: number) {
    this.deficitItem = item;
    this.deficitAmount = deficit;
    this.deficitReason = this.deficitReasons[0];
    this.deficitMode = mode;
    this.deficitOrderedValue = ordered ?? 0;
    this.deficitReceivedValue = received ?? 0;
    this.showDeficitModal = true;
  }

  confirmDeficit() {
    if (!this.deficitItem) return;
    if (this.modalSaving) return;
    if (!this.authService.canPerformArrivalsOperation('canConfirmReceivedItems')) return;
    this.modalSaving = true;
    const item = this.deficitItem;
    const notes = `${this.deficitReason}`;
    this.dbService.createDamagedItem({
      arrivalItemId: item.id,
      productId: item.productId || null,
      expectedQuantity: this.deficitExpected || item.requestedQuantity || item.orderedQuantity || 0,
      damagedQuantity: this.deficitAmount,
      notes,
      batchName: item.batchName || undefined
    }).subscribe(ok => {
      this.modalSaving = false;
      if (!ok) {
        alert('Failed to record damaged item');
        return;
      }
      this.dbService.confirmArrivalItem(item.id!, item.productId || null, Number(item.receivedQuantity || 0), false).subscribe(confirmOk => {
        if (!confirmOk) {
          alert('Failed to confirm arrival');
          return;
        }
        // finalize pending confirmed item (move to confirmed list)
        if (this.pendingConfirmItem) {
          this.finalizeConfirmedItem(this.pendingConfirmItem);
          this.pendingConfirmItem = null;
        }
        this.showDeficitModal = false;
        this.deficitItem = null;
        this.deficitAmount = 0;
        this.deficitReason = '';
        this.deficitMode = 'requested';
        this.deficitOrderedValue = 0;
        this.deficitReceivedValue = 0;
        this.deficitExpected = 0;
        this.loadItems(true);
        this.loadBatchStats();
      });
    });

    // debug: surface payload in console for tracing
    console.info('createDamagedItem payload', {
      arrivalItemId: item.id,
      productId: item.productId || null,
      expectedQuantity: this.deficitExpected || item.requestedQuantity || item.orderedQuantity || 0,
      damagedQuantity: this.deficitAmount,
      notes,
      batchName: item.batchName || undefined
    });
  }

  // Confirm surplus: user accepted extra items — finalize the pending confirm
  confirmSurplus() {
    if (this.modalSaving) return;
    if (!this.pendingConfirmItem) return;
    if (!this.authService.canPerformArrivalsOperation('canChangeReceivedValue')) return;
    this.modalSaving = true;
    this.dbService.confirmArrivalItem(
      this.pendingConfirmItem.id!,
      this.pendingConfirmItem.productId || null,
      Number(this.pendingConfirmItem.receivedQuantity || 0),
      true
    ).subscribe(ok => {
      this.modalSaving = false;
      if (!ok) {
        alert('Failed to confirm arrival');
        return;
      }
      this.finalizeConfirmedItem(this.pendingConfirmItem!);
      this.pendingConfirmItem = null;
      this.showDeficitModal = false;
      this.deficitItem = null;
      this.deficitAmount = 0;
      this.deficitReason = '';
      this.deficitMode = 'requested';
      this.deficitOrderedValue = 0;
      this.deficitReceivedValue = 0;
      this.deficitExpected = 0;
    });
  }

  cancelDeficit() {
    this.pendingConfirmItem = null;
    this.showDeficitModal = false;
    this.deficitItem = null;
    this.deficitAmount = 0;
    this.deficitReason = '';
    this.deficitMode = 'requested';
    this.deficitOrderedValue = 0;
    this.deficitReceivedValue = 0;
    this.deficitExpected = 0;
  }

  // ════════════════════════════════════════════════════════════════════
  // Damage Allocation Modal Methods
  // ════════════════════════════════════════════════════════════════════

  /**
   * Open damage allocation modal to let user adjust quantities per client.
   * Called when there's damage detected and user confirms the item.
   */
  openDamageAllocationModal(item: ArrivalItem, receivedQty: number) {
    if (!item.productId || !item.batchName || !this.selectedBatch?.id) {
      alert('Unable to allocate damage: missing product or batch info');
      return;
    }

    this.damageAllocationItem = item;
    this.allocationReceivedQty = receivedQty;
    this.allocationTotalAdjusted = 0;
    this.damageAllocationClients = [];
    this.loadingAllocationClients = true;
    this.showDamageAllocationModal = true;

    // Load clients who ordered this product
    this.dbService.getClientsForProductInBatch(item.productId, this.selectedBatch.id)
      .subscribe(
        clients => {
          this.damageAllocationClients = clients.map(c => ({
            orderItemId: c.orderItemId,
            clientId: c.clientId,
            clientName: c.clientName,
            originalQuantity: c.orderedQuantity,
            adjustedQuantity: c.orderedQuantity,
            batchProductId: c.batchProductId
          }));
          this.allocationTotalAdjusted = this.damageAllocationClients.reduce((sum, c) => sum + c.adjustedQuantity, 0);
          this.loadingAllocationClients = false;
        },
        error => {
          console.warn('[damage-alloc] Error loading clients:', error);
          this.loadingAllocationClients = false;
          alert('Failed to load clients for damage allocation');
        }
      );
  }

  /**
   * Update adjusted quantity for a client.
   * Automatically available for distribution is original - adjusted quantities.
   */
  updateClientAllocation(client: DamageAllocationClient, newAdjustedQty: number) {
    client.adjustedQuantity = Math.max(0, Math.min(newAdjustedQty, client.originalQuantity));
    this.allocationTotalAdjusted = this.damageAllocationClients.reduce((sum, c) => sum + c.adjustedQuantity, 0);
  }

  /**
   * Check if user has allocated all received items and allocations are valid.
   */
  get isAllocationValid(): boolean {
    if (!this.damageAllocationClients.length) return false;
    const totalOriginal = this.damageAllocationClients.reduce((sum, c) => sum + c.originalQuantity, 0);
    const totalAdjusted = this.damageAllocationClients.reduce((sum, c) => sum + c.adjustedQuantity, 0);
    const totalReceived = this.allocationReceivedQty || 0;
    
    // Total adjusted must equal received quantity
    return totalAdjusted === totalReceived && totalReceived > 0;
  }

  /**
   * Get quantity available for adjustment (damaged items to distribute).
   */
  get allocationAvailable(): number {
    const totalOriginal = this.damageAllocationClients.reduce((sum, c) => sum + c.originalQuantity, 0);
    return Math.max(0, totalOriginal - this.allocationTotalAdjusted);
  }

  /**
   * Confirm and save damage allocations, then create damaged_items record.
   */
  confirmDamageAllocation() {
    if (!this.isAllocationValid) {
      alert('Allocation invalid: total adjusted must equal received quantity');
      return;
    }
    if (!this.authService.canPerformArrivalsOperation('canConfirmReceivedItems')) return;

    if (this.modalSaving) return;
    this.modalSaving = true;

    const item = this.damageAllocationItem;
    if (!item) {
      this.modalSaving = false;
      return;
    }

    // Build damage allocations array and create damaged_items record
    const allocations = this.damageAllocationClients.map(client => ({
      orderItemId: client.orderItemId,
      productId: item.productId!,
      clientId: client.clientId,
      batchId: this.selectedBatch?.id,
      batchProductId: item.batchProductId || client.batchProductId,
      batchName: item.batchName!,
      originalQuantity: client.originalQuantity,
      adjustedQuantity: client.adjustedQuantity,
      reason: this.allocationReason,
      arrivalItemId: item.id
    }));

    const totalDamaged = this.damageAllocationClients.reduce(
      (sum, c) => sum + (c.originalQuantity - c.adjustedQuantity),
      0
    );

    // Save allocations and damaged item
    this.dbService.saveDamageOrderAllocations(allocations).subscribe(
      allocOk => {
        if (!allocOk) {
          this.modalSaving = false;
          alert('Failed to save damage allocations');
          return;
        }

        // Create single damaged_items record for total damage
        this.dbService.createDamagedItem({
          arrivalItemId: item.id,
          productId: item.productId || null,
          expectedQuantity: item.requestedQuantity || item.orderedQuantity || 0,
          damagedQuantity: totalDamaged,
          notes: `${this.allocationReason} - Damage allocated across ${allocations.length} clients`,
          batchName: item.batchName
        }).subscribe(
          damageOk => {
            this.modalSaving = false;
            if (!damageOk) {
              alert('Failed to record damaged item');
              return;
            }
            this.dbService.confirmArrivalItem(item.id!, item.productId || null, Number(item.receivedQuantity || 0), false).subscribe(confirmOk => {
              if (!confirmOk) {
                alert('Failed to confirm arrival');
                return;
              }
              // Success: close modal and finalize
              this.closeDamageAllocationModal();
              if (this.pendingConfirmItem) {
                this.finalizeConfirmedItem(this.pendingConfirmItem);
                this.pendingConfirmItem = null;
              }
              this.loadItems(true);
              this.loadBatchStats();
            });
          }
        );
      }
    );
  }

  closeDamageAllocationModal() {
    this.showDamageAllocationModal = false;
    this.damageAllocationItem = null;
    this.damageAllocationClients = [];
    this.allocationReceivedQty = 0;
    this.allocationTotalAdjusted = 0;
    this.loadingAllocationClients = false;
    this.allocationReason = 'Damaged in transit';
    this.modalSaving = false;
  }

  cancelDamageAllocation() {
    this.pendingConfirmItem = null;
    this.closeDamageAllocationModal();
  }

  sendToShipping(item: ArrivalItem) {
    if (!item.id || item.sentToShipping) return;
    if (!this.authService.canPerformArrivalsOperation('canSendToShipping')) return;
    this.shippingConfirmMode = 'single';
    this.shippingConfirmItem = item;
    this.showShippingConfirmModal = true;
  }

  closeShippingConfirmModal() {
    if (this.sendingBatch) return;
    if (this.shippingConfirmItem?.id && this.sendingItemId === this.shippingConfirmItem.id) return;
    this.resetShippingConfirmModal();
  }

  private resetShippingConfirmModal() {
    this.showShippingConfirmModal = false;
    this.shippingConfirmItem = null;
    this.shippingConfirmMode = 'single';
  }

  onShippingConfirmButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeShippingConfirmModal();
      return;
    }

    if (button.action !== 'confirm') return;

    if (this.shippingConfirmMode === 'single' && this.shippingConfirmItem?.id) {
      this.confirmSendSingleToShipping(this.shippingConfirmItem);
      return;
    }

    if (this.shippingConfirmMode === 'batch' && this.selectedBatchName) {
      this.confirmSendAllConfirmed();
    }
  }

  private confirmSendSingleToShipping(item: ArrivalItem) {
    if (!item.id || item.sentToShipping) return;
    if (!this.authService.canPerformArrivalsOperation('canSendToShipping')) return;
    this.sendingItemId = item.id;
    this.dbService.sendConfirmedArrivalItemToShipping(item.id).subscribe(ok => {
      if (ok) {
        this.loadItems(true);
        this.loadBatchStats();
        this.sendingItemId = null;
        this.resetShippingConfirmModal();
      } else {
        alert('Failed to send to shipping');
        this.sendingItemId = null;
      }
    });
  }

  // Undo a recent confirm (available until manually undone)
  undoConfirm(item: ArrivalItem) {
    if (!item.id) return;
    const canUndo = item.sentToShipping
      ? this.authService.canPerformArrivalsOperation('canReverseToArrivals')
      : this.authService.canPerformArrivalsOperation('canConfirmReceivedItems');
    if (!canUndo) return;
    if (this.undoingIds.has(item.id)) return;
    this.undoingIds.add(item.id);

    this.dbService.unconfirmArrivalItem(item.id!).subscribe(ok => {
      this.undoingIds.delete(item.id!);
      if (ok) {
        this.loadItems(true);
        this.loadBatchStats();
      } else {
        alert('Failed to undo confirm');
      }
    });
  }

  sendAllConfirmed() {
    if (!this.authService.canPerformArrivalsOperation('canSendToShipping')) return;
    if (this.pendingConfirmedCount === 0) return;
    this.shippingConfirmMode = 'batch';
    this.shippingConfirmItem = null;
    this.showShippingConfirmModal = true;
  }

  private confirmSendAllConfirmed() {
    if (!this.selectedBatchName || this.pendingConfirmedCount === 0) return;
    if (!this.authService.canPerformArrivalsOperation('canSendToShipping')) return;
    this.sendingBatch = true;
    this.dbService.sendConfirmedArrivalsToShipping(this.selectedBatchName).subscribe(ok => {
      this.sendingBatch = false;
      if (ok) {
        this.loadItems(true);
        this.loadBatchStats();
        this.resetShippingConfirmModal();
        alert('All confirmed items sent to shipping');
      } else {
        alert('Failed to send confirmed items');
      }
    });
  }

  private buildConfirmedActions(item: ArrivalItem): ActionOption[] {
    const actions: ActionOption[] = [];

    if (item.id != null && (
      this.authService.canPerformArrivalsOperation('canConfirmReceivedItems')
      || (item.sentToShipping && this.authService.canPerformArrivalsOperation('canReverseToArrivals'))
    )) {
      const reverseSent = !!item.sentToShipping;
      actions.push({
        id: 'undo',
        label: reverseSent ? 'Reverse to arrivals' : 'Undo confirmation',
        icon: reverseSent ? 'arrow-return-left' : 'arrow-counterclockwise',
        color: 'orange',
        disabled: (reverseSent && !this.authService.canPerformArrivalsOperation('canReverseToArrivals'))
          || (!reverseSent && !this.authService.canPerformArrivalsOperation('canConfirmReceivedItems'))
          || this.sendingBatch
          || this.sendingItemId === item.id
          || this.undoingIds.has(item.id),
        loading: this.undoingIds.has(item.id)
      });
    }

    if (this.authService.canPerformArrivalsOperation('canSendToShipping')) {
      actions.push({
        id: 'ship',
        label: 'Send to shipping',
        icon: 'truck',
        color: 'blue',
        disabled: !!item.sentToShipping || this.sendingBatch || this.sendingItemId === item.id,
        loading: this.sendingItemId === item.id
      });
    }

    return actions;
  }
}
