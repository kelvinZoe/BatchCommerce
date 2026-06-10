import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { DropdownComponent } from '../../components/dropdown/dropdown.component';
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
  imports: [CommonModule, FormsModule, DateFilterComponent, DropdownComponent],
  template: `
    <div class="dv-page">

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

        <div class="dv-batch-grid" *ngIf="loading">
          <div class="dv-batch-card dv-skeleton-card" *ngFor="let i of [1,2,3,4,5,6]">
            <div class="dv-sk dv-sk-title"></div>
            <div class="dv-sk dv-sk-line"></div>
            <div class="dv-sk dv-sk-line" style="width:60%"></div>
            <div class="dv-sk dv-sk-chip"></div>
          </div>
        </div>

        <div class="dv-empty" *ngIf="!loading && deliveryBatches.length === 0">
          <span class="material-icons">local_shipping</span>
          <h3>No delivery batches yet</h3>
          <p>Items will appear here after clients are sent to deliveries from the Shipping Ledger.</p>
        </div>

        <div class="dv-batch-grid" *ngIf="!loading && deliveryBatches.length > 0">
          <div
            class="dv-batch-card"
            *ngFor="let batch of deliveryBatches"
            (click)="openBatch(batch)"
            [class.dv-batch-completed]="batch.deliveryStatus === 'completed'"
          >
            <div class="dv-batch-card-header">
              <div class="dv-batch-icon">
                <span class="material-icons">inventory_2</span>
              </div>
              <span class="dv-batch-status-chip" [class]="'dv-dstatus-' + (batch.deliveryStatus || 'pending')">
                {{ getBatchStatusLabel(batch.deliveryStatus) }}
              </span>
            </div>
            <div class="dv-batch-name">{{ batch.name }}</div>
            <div class="dv-batch-meta">
              <span><span class="material-icons dv-meta-icon">people</span>{{ batchDeliveryStats[batch.name]?.clients || 0 }} clients</span>
              <span><span class="material-icons dv-meta-icon">check_circle</span>{{ batchDeliveryStats[batch.name]?.delivered || 0 }} delivered</span>
            </div>
            <div class="dv-batch-progress">
              <div class="dv-batch-progress-fill" [style.width.%]="getDeliveredPct(batch)"></div>
            </div>
          </div>
        </div>

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

        <div class="dv-stats-row">
          <div class="dv-stat-card dv-stat-pending">
            <span class="material-icons">hourglass_empty</span>
            <div class="dv-stat-num">{{ statusCounts.pending }}</div>
            <div class="dv-stat-lbl">Pending</div>
          </div>
          <div class="dv-stat-card dv-stat-packaged">
            <span class="material-icons">inventory_2</span>
            <div class="dv-stat-num">{{ statusCounts.packaged }}</div>
            <div class="dv-stat-lbl">Packaged</div>
          </div>
          <div class="dv-stat-card dv-stat-delivering">
            <span class="material-icons">local_shipping</span>
            <div class="dv-stat-num">{{ statusCounts.delivering }}</div>
            <div class="dv-stat-lbl">Delivering</div>
          </div>
          <div class="dv-stat-card dv-stat-delivered">
            <span class="material-icons">check_circle</span>
            <div class="dv-stat-num">{{ statusCounts.delivered }}</div>
            <div class="dv-stat-lbl">Delivered</div>
          </div>
          <div class="dv-stat-card dv-stat-fees">
            <span class="material-icons">payments</span>
            <div class="dv-stat-num dv-stat-num-fee">GHS {{ totalDeliveryFee | number:'1.2-2' }}</div>
            <div class="dv-stat-lbl">Total Fees</div>
          </div>
        </div>

        <div class="dv-toolbar">
          <div class="dv-search-wrap">
            <span class="material-icons dv-search-icon">search</span>
            <input
              type="text"
              class="dv-search"
              placeholder="Search clients..."
              [(ngModel)]="searchTerm"
              (input)="onSearchInput()"
            />
          </div>
          <app-dropdown [label]="statusFilterLabel" [active]="statusFilter !== 'all'">
            <ul class="dv-dd-list">
              <li *ngFor="let opt of statusOptions"
                  class="dv-dd-item"
                  [class.dv-dd-active]="statusFilter === opt.value"
                  (click)="statusFilter = opt.value; filterDeliveries()">
                <span class="material-icons dv-dd-check">check</span>{{ opt.label }}
              </li>
            </ul>
          </app-dropdown>
          <app-dropdown [label]="typeFilterLabel" [active]="deliveryTypeFilter !== 'all'">
            <ul class="dv-dd-list">
              <li *ngFor="let opt of typeOptions"
                  class="dv-dd-item"
                  [class.dv-dd-active]="deliveryTypeFilter === opt.value"
                  (click)="deliveryTypeFilter = opt.value; filterDeliveries()">
                <span class="material-icons dv-dd-check">check</span>{{ opt.label }}
              </li>
            </ul>
          </app-dropdown>
          <app-date-filter (dateChange)="dateFrom = $event.from; dateTo = $event.to; filterDeliveries()"></app-date-filter>
        </div>

        <div class="dv-table-wrap" *ngIf="loadingDetail">
          <table class="dv-table">
            <thead>
              <tr>
                <th *ngFor="let h of ['Client','Items','Delivery Type','Delivery Fee','Status','Date','']">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let i of [1,2,3,4,5]">
                <td *ngFor="let c of [1,2,3,4,5,6,7]"><div class="dv-sk dv-sk-cell"></div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dv-table-wrap" *ngIf="!loadingDetail">
          <table class="dv-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Items</th>
                <th>Delivery Type</th>
                <th>Delivery Fee</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let d of paginatedDeliveries"
                [class.dv-row-saved]="savedDeliveryIds.has(d.id!)"
              >
                <td>
                  <div class="dv-client-name">{{ d.clientName || 'Unknown' }}</div>
                  <div class="dv-client-phone">{{ d.clientPhone || '—' }}</div>
                </td>
                <td>
                  <button class="dv-items-link" (click)="viewDeliveryItems(d)">
                    {{ getItemCount(d) }} item{{ getItemCount(d) !== 1 ? 's' : '' }}
                  </button>
                </td>
                <td>
                  <select
                    class="dv-type-select"
                    [(ngModel)]="d.deliveryCategory"
                    [disabled]="!authService.can('edit','deliveries') || !editableDeliveryIds.has(d.id!)"
                  >
                    <option [ngValue]="null">— Select —</option>
                    <option value="riders">Riders</option>
                    <option value="station_car_delivery">Station Car</option>
                    <option value="ghana_post">Ghana Post</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    class="dv-fee-input"
                    step="0.01"
                    min="0"
                    [(ngModel)]="d.deliveryFee"
                    [disabled]="!authService.can('edit','deliveries') || !editableDeliveryIds.has(d.id!) || d.deliveryCategory !== 'ghana_post'"
                    [class.dv-fee-locked]="!editableDeliveryIds.has(d.id!) || d.deliveryCategory !== 'ghana_post'"
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <select
                    [(ngModel)]="d.deliveryItemStatus"
                    [disabled]="!authService.can('edit','deliveries') || !editableDeliveryIds.has(d.id!)"
                    [class]="'dv-status-select dv-istatus-' + (d.deliveryItemStatus || 'pending')"
                  >
                    <option value="pending">Pending</option>
                    <option value="packaged">Packaged</option>
                    <option value="delivering">Delivering</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </td>
                <td class="dv-date-cell">
                  <span *ngIf="d.deliveryDate">{{ d.deliveryDate | date:'mediumDate' }}</span>
                  <span *ngIf="!d.deliveryDate" class="dv-dash">—</span>
                </td>
                <td>
                  <div class="dv-action-cell" *ngIf="authService.can('edit','deliveries')">
                    <ng-container *ngIf="editableDeliveryIds.has(d.id!)">
                      <button class="dv-save-btn" (click)="saveDeliveryRow(d)" [disabled]="savingDeliveryIds.has(d.id!)">
                        <span class="dv-btn-spinner" *ngIf="savingDeliveryIds.has(d.id!)"></span>
                        <span class="material-icons" *ngIf="!savingDeliveryIds.has(d.id!)">save</span>
                      </button>
                      <button class="dv-cancel-btn" (click)="cancelEditRow(d)" [disabled]="savingDeliveryIds.has(d.id!)">
                        <span class="material-icons">close</span>
                      </button>
                    </ng-container>
                    <button *ngIf="!editableDeliveryIds.has(d.id!)" class="dv-edit-btn" (click)="editRow(d)">
                      <span class="material-icons">edit</span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredDeliveries.length === 0">
                <td colspan="7" class="dv-empty-row">
                  <span class="material-icons">local_shipping</span>
                  No deliveries match your filters.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="dv-pagination" *ngIf="filteredDeliveries.length > 0">
            <span class="dv-page-info">
              {{ (deliveryPage - 1) * deliveryPageSize + 1 }}–{{ min(deliveryPage * deliveryPageSize, filteredDeliveries.length) }}
              of {{ filteredDeliveries.length }}
            </span>
            <div class="dv-page-btns">
              <button (click)="deliveryPage = 1" [disabled]="deliveryPage === 1">
                <span class="material-icons">first_page</span>
              </button>
              <button (click)="deliveryPage = deliveryPage - 1" [disabled]="deliveryPage === 1">
                <span class="material-icons">chevron_left</span>
              </button>
              <span class="dv-page-num">{{ deliveryPage }} / {{ totalDeliveryPages }}</span>
              <button (click)="deliveryPage = deliveryPage + 1" [disabled]="deliveryPage >= totalDeliveryPages">
                <span class="material-icons">chevron_right</span>
              </button>
              <button (click)="deliveryPage = totalDeliveryPages" [disabled]="deliveryPage >= totalDeliveryPages">
                <span class="material-icons">last_page</span>
              </button>
            </div>
          </div>
        </div>

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

            <div class="dv-modal-section" *ngIf="authService.can('edit','deliveries') && viewingDelivery?.deliveryItemStatus !== 'delivered'">
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

    </div>
  `,
  styles: [`
    .dv-page { max-width: 1400px; }

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

  deliveryPage = 1;
  deliveryPageSize = 20;

  get paginatedDeliveries() {
    const start = (this.deliveryPage - 1) * this.deliveryPageSize;
    return this.filteredDeliveries.slice(start, start + this.deliveryPageSize);
  }

  get totalDeliveryPages() {
    return Math.ceil(this.filteredDeliveries.length / this.deliveryPageSize) || 1;
  }

  min(a: number, b: number) { return Math.min(a, b); }

  get totalDeliveryFee(): number {
    return this.batchDeliveries.reduce((sum, d) => sum + (Number(d.deliveryFee) || 0), 0);
  }

  statusCounts = { pending: 0, packaged: 0, delivering: 0, delivered: 0 };
  batchDeliveryStats: { [name: string]: { clients: number; totalQty: number; delivered: number } } = {};

  savingDeliveryIds     = new Set<number>();
  savedDeliveryIds      = new Set<number>();
  editableDeliveryIds   = new Set<number>();
  private snapshotMap   = new Map<number, { deliveryCategory: any; deliveryFee: any; deliveryItemStatus: any }>();
  batchDeliveries: Delivery[] = [];
  private searchDebounceTimer: any = null;

  showItemsModal = false;
  viewingDelivery: Delivery | null = null;
  viewingDeliveryItemsList: string[] = [];
  products: { id?: number; name: string }[] = [];
  damageProductId: number | null = null;
  damageQuantity = 1;
  damageNote = '';

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService
  ) {}

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
    // Enforce: Station Car / Riders fee stays 0
    if (d.deliveryCategory && d.deliveryCategory !== 'ghana_post') {
      d.deliveryFee = 0;
    }
    const id = d.id;
    this.savingDeliveryIds.add(id);
    this.dbService.updateDeliveryInfo(id, d.deliveryCategory ?? null, Number(d.deliveryFee || 0))
      .subscribe(() => {
        this.dbService.updateDeliveryItemStatus(id, (d.deliveryItemStatus || 'pending') as DeliveryItemStatus)
          .subscribe(() => {
            if (d.deliveryItemStatus === 'delivered') {
              d.status = 'delivered';
              d.deliveryDate = new Date().toISOString().split('T')[0];
            }
            this.savingDeliveryIds.delete(id);
            this.savedDeliveryIds.add(id);
            this.editableDeliveryIds.delete(id);
            this.snapshotMap.delete(id);
            this.calculateBatchStats();
            this.computeStatusCounts();
            setTimeout(() => this.savedDeliveryIds.delete(id), 1400);
          });
      });
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

  quickUpdateStatus(status: string) {
    if (!this.viewingDelivery) return;
    const s = status as DeliveryItemStatus;
    this.dbService.updateDeliveryItemStatus(this.viewingDelivery.id!, s).subscribe(() => {
      this.viewingDelivery!.deliveryItemStatus = s;
      if (s === 'delivered') {
        this.viewingDelivery!.status = 'delivered';
        this.viewingDelivery!.deliveryDate = new Date().toISOString().split('T')[0];
      }
      this.calculateBatchStats();
      this.filterDeliveries();
    });
  }

  reportDamagedFromDelivery() {
    if (!this.damageProductId || !this.viewingDelivery) return alert('Select a product and quantity');
    const qty = Number(this.damageQuantity || 0);
    if (qty <= 0) return alert('Quantity must be > 0');
    this.dbService.createDamagedFromDelivery(
      this.damageProductId, qty, this.damageNote || '', this.viewingDelivery.batchName
    ).subscribe(ok => {
      if (ok) {
        alert('Damaged item recorded');
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
}
