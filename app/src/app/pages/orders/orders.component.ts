import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';
import {
  BatchListSectionComponent,
  BatchSectionBodyDirective,
  BatchSectionFooterDirective
} from '../../components/batch-list-section/batch-list-section.component';
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { ModalButtonConfig, ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { BatchCardTagConfig } from '../../components/batch-card/batch-card.component';
import { BatchDetailHeaderComponent, BatchDetailHeaderTagConfig } from '../../components/batch-detail-header/batch-detail-header.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import { ActionOption, TableComponent, TableColumn, TableMetadata, ToolbarButtonConfig } from '../../components/table/table.component';
import {
  Order, OrderItem, OrderBatch, BatchProduct, Client,
  OrderBatchStatus, OrdersPermissionConfig
} from '../../models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchListSectionComponent, BatchSectionBodyDirective, BatchSectionFooterDirective, SearchableSelectComponent, DateFilterComponent, ModalShellComponent, BatchDetailHeaderComponent, StatCardsComponent, TableComponent],
  template: `
    <div class="ord-page">

      <!-- ══ PAGE HEADER ══ -->
      <div class="ord-header">
        <div class="ord-header-left">
          <div class="ord-header-icon"><span class="material-icons">shopping_cart</span></div>
          <div>
            <h1 class="ord-header-title">Orders</h1>
            <p class="ord-header-sub">Manage batches and customer orders</p>
          </div>
        </div>
        <div class="ord-header-actions">
          <button *ngIf="activeTab === 'batches' && authService.canPerformOrdersOperation('canCreateOrder')"
                  class="ord-btn ord-btn-primary" (click)="openCreateBatchModal()">
            <span class="material-icons">add</span> New Batch
          </button>
          <button *ngIf="activeTab === 'orders' && canCreateOrderInSelectedBatch"
                  class="ord-btn ord-btn-primary" (click)="openCreateOrderModal()">
            <span class="material-icons">add</span> New Order
          </button>
        </div>
      </div>

      <div class="ord-card">

        <!-- ══ BATCH LIST VIEW ══ -->
        <div *ngIf="activeTab === 'batches'">
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
            [emptyTitle]="'No batches yet'"
            [emptyDescription]="'Create your first batch to start taking orders.'"
            [titleResolver]="orderBatchTitleResolver"
            [subtitleResolver]="orderBatchSubtitleResolver"
            [iconResolver]="orderBatchIconResolver"
            [tagResolver]="orderBatchTagResolver"
            [iconMutedResolver]="orderBatchIconMutedResolver"
            (searchTermChange)="onBatchSearchInput($event)"
            (dateSelectionChange)="onBatchMonthYearChange($event)"
            (pageChange)="setBatchPage($event)"
            (cardClick)="viewBatchOrders($event)">
            <div batchSectionFilters class="ord-filter-group">
              <button class="ord-filter-btn" [class.ord-filter-active]="batchStatusFilter === ''"
                      (click)="setBatchStatusFilter('')">All</button>
              <button class="ord-filter-btn" [class.ord-filter-active]="batchStatusFilter === 'open'"
                      (click)="setBatchStatusFilter('open')">Open</button>
              <button class="ord-filter-btn" [class.ord-filter-active]="batchStatusFilter === 'closed'"
                      (click)="setBatchStatusFilter('closed')">Closed</button>
            </div>

            <button batchSectionEmptyAction class="ord-btn ord-btn-primary" *ngIf="authService.canPerformOrdersOperation('canCreateOrder')"
                    (click)="openCreateBatchModal()">
              <span class="material-icons">add</span> Create Batch
            </button>

            <ng-template batchSectionBody let-batch>
              <div class="ord-batch-pills">
                <ng-container *ngIf="batch.status === 'open'">
                  <span class="ord-bpill ord-bpill-orders">
                    <span class="material-icons">receipt_long</span>
                    {{ batchStats.get(batch.id!)?.orderCount ?? '…' }} orders
                  </span>
                </ng-container>
                <ng-container *ngIf="batch.status === 'closed'">
                  <ng-container *ngIf="batchStatTotal(batch.id!) > 0; else noItemsTpl">
                    <span class="ord-bpill ord-bpill-pending" *ngIf="(batchStats.get(batch.id!)?.pending ?? 0) > 0">{{ batchStats.get(batch.id!)!.pending }}/{{ batchStatTotal(batch.id!) }} pending</span>
                    <span class="ord-bpill ord-bpill-ordered">{{ getBatchStatCumulative(batch.id!, 'ordered') }}/{{ batchStatTotal(batch.id!) }} ordered</span>
                    <span class="ord-bpill ord-bpill-shipped">{{ getBatchStatCumulative(batch.id!, 'shipped') }}/{{ batchStatTotal(batch.id!) }} shipped</span>
                    <span class="ord-bpill ord-bpill-arrived" *ngIf="(batchStats.get(batch.id!)?.arrived ?? 0) > 0">{{ batchStats.get(batch.id!)!.arrived }}/{{ batchStatTotal(batch.id!) }} arrived</span>
                  </ng-container>
                  <ng-template #noItemsTpl><span class="ord-bpill ord-bpill-empty">No items</span></ng-template>
                </ng-container>
              </div>
            </ng-template>

            <ng-template batchSectionFooter let-batch>
              <button class="ord-card-action-btn ord-cab-primary ord-open-btn"
                      (click)="$event.stopPropagation(); viewBatchOrders(batch)">
                Open <span class="material-icons">chevron_right</span>
              </button>
            </ng-template>
          </app-batch-list-section>
        </div>

        <!-- ══ ORDERS DETAIL VIEW ══ -->
        <div *ngIf="activeTab === 'orders'">

          <!-- Back header + batch info -->
          <app-batch-detail-header
            [backLabel]="'All Batches'"
            [title]="selectedBatch?.name || ''"
            [subtitle]="selectedBatch?.createdAt ? (selectedBatch!.createdAt | date:'mediumDate') : ''"
            [icon]="selectedBatch?.status === 'open' ? 'folder_open' : 'folder'"
            [tag]="selectedOrderBatchHeaderTag"
            (backClick)="backToBatches()">
            <button
              batchDetailHeaderAction
              *ngIf="selectedBatch?.status === 'open' && authService.canPerformOrdersOperation('canCloseBatch')"
              class="ord-btn ord-btn-warning"
              (click)="openCloseBatchModal()">
              <span class="material-icons">lock</span> Close Batch
            </button>
            <button
              batchDetailHeaderAction
              *ngIf="selectedBatch?.status === 'closed' && authService.canPerformOrdersOperation('canReopenBatch')"
              class="ord-btn ord-btn-ghost"
              (click)="reopenBatch()">
              <span class="material-icons">lock_open</span> Reopen
            </button>
          </app-batch-detail-header>

          <!-- Orders stats strip -->
          <app-stat-cards
            *ngIf="!loadingOrders && orders.length > 0"
            [config]="orderStatCards">
          </app-stat-cards>

          <!-- Orders table -->
          <div *ngIf="!loadingOrders">
            <div *ngIf="orders.length === 0" class="ord-empty">
              <div class="ord-empty-icon"><span class="material-icons">receipt_long</span></div>
              <h3>No orders yet</h3>
              <p *ngIf="selectedBatch?.status === 'open'">Start by creating your first order for this batch.</p>
              <p *ngIf="selectedBatch?.status === 'closed'">This batch has been closed with no recorded orders.</p>
              <button *ngIf="canCreateOrderInSelectedBatch"
                      class="ord-btn ord-btn-primary" (click)="openCreateOrderModal()">
                <span class="material-icons">add</span> New Order
              </button>
            </div>
          </div>

          <app-table
            *ngIf="loadingOrders || orders.length > 0"
            [columns]="orderColumns"
            [data]="orderTableRows"
            [metadata]="orderMetadata"
            [actionOptions]="orderActionOptions"
            [showSearchRow]="true"
            [initialLoading]="loadingOrders && orders.length === 0"
            [searching]="loadingOrders && orders.length > 0"
            [skeletonRows]="5"
            [baseColor]="baseColor"
            [showToolbarStart]="true"
            [toolbarButton]="orderToolbarButton"
            (actionClick)="onOrderTableActionClick($event)"
            (searchChange)="onOrderTableSearchChange($event)"
            (toolbarButtonAction)="openProductSummary()"
            (pageChange)="setOrderPage($event)">
            <app-date-filter table-toolbar-start (dateChange)="onOrderDateChange($event)"></app-date-filter>
          </app-table>
        </div>

      </div><!-- /ord-card -->
    </div><!-- /ord-page -->

    <!-- ══════════════════════════════════════════════════ -->
    <!-- CREATE / EDIT BATCH MODAL                         -->
    <!-- ══════════════════════════════════════════════════ -->
    <div class="ord-modal-overlay" *ngIf="showBatchModal" (click)="showBatchModal = false">
      <div class="ord-modal ord-modal-sm" (click)="$event.stopPropagation()">
        <div class="ord-modal-header">
          <div class="ord-modal-header-icon"><span class="material-icons">folder</span></div>
          <div class="ord-modal-header-text">
            <div class="ord-modal-title">{{ editingBatch ? 'Rename Batch' : 'Create Batch' }}</div>
            <div class="ord-modal-sub">{{ editingBatch ? 'Update the batch name' : 'Create a new batch' }}</div>
          </div>
          <button class="ord-modal-close" (click)="showBatchModal = false">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="ord-modal-body">
          <div class="ord-form-group">
            <label class="ord-label">Batch Name <span class="ord-required">*</span></label>
            <input class="ord-input" type="text" [(ngModel)]="batchForm.name"
                   placeholder="e.g. Week 12 Orders" (keydown.enter)="saveBatch()" />
          </div>
        </div>
        <div class="ord-modal-footer">
          <button class="ord-btn ord-btn-ghost" (click)="showBatchModal = false">Cancel</button>
          <button class="ord-btn ord-btn-primary" (click)="saveBatch()" [disabled]="savingBatch || !batchForm.name.trim()">
            <span *ngIf="savingBatch" class="ord-spinner"></span>
            {{ editingBatch ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- CREATE ORDER MODAL                                -->
    <!-- ══════════════════════════════════════════════════ -->
    <div class="ord-modal-overlay" *ngIf="showOrderModal" (click)="closeOrderModal()">
      <div class="ord-modal ord-modal-lg" (click)="$event.stopPropagation()">
        <div class="ord-modal-header">
          <div class="ord-modal-header-icon" [class.ord-mhi-success]="!!savedOrderReceipt">
            <span class="material-icons">{{ savedOrderReceipt ? 'check_circle' : 'receipt_long' }}</span>
          </div>
          <div class="ord-modal-header-text">
            <div class="ord-modal-title">{{
              savedOrderReceipt ? 'Order Confirmed!' :
              (viewingOrder ? 'Order #' + viewingOrder.id : 'New Order')
            }}</div>
            <div class="ord-modal-sub">{{
              savedOrderReceipt && savedOrderReceipt.addedToExisting
                ? 'Items added to existing Order #' + savedOrderReceipt.orderId
                : savedOrderReceipt
                  ? 'Order #' + savedOrderReceipt.orderId + ' has been placed successfully'
                  : viewingOrder ? 'Order details' : 'Add a new order to ' + selectedBatch?.name
            }}</div>
          </div>
          <button class="ord-modal-close" (click)="closeOrderModal()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="ord-modal-body">

          <!-- ── RECEIPT MODE ── -->
          <ng-container *ngIf="savedOrderReceipt">
            <div class="ord-receipt-wrap">
              <div class="ord-receipt-box">
                <div class="ord-receipt-shop">{{ shopConfig.shopName }}</div>
                <div class="ord-receipt-divider"></div>
                <div *ngIf="savedOrderReceipt.addedToExisting" class="ord-receipt-merged-badge">
                  <span class="material-icons">merge_type</span>
                  Items added to existing order
                </div>
                <div class="ord-receipt-row">
                  <span class="ord-receipt-label">Order ID</span>
                  <span class="ord-receipt-val">#{{ savedOrderReceipt.orderId }}</span>
                </div>
                <div class="ord-receipt-row">
                  <span class="ord-receipt-label">Batch</span>
                  <span class="ord-receipt-val">{{ savedOrderReceipt.batchName }}</span>
                </div>
                <div class="ord-receipt-row">
                  <span class="ord-receipt-label">Customer</span>
                  <span class="ord-receipt-val">{{ savedOrderReceipt.clientName }}</span>
                </div>
                <div class="ord-receipt-divider"></div>
                <div class="ord-receipt-items-head">
                  <span>Item</span><span>Qty</span><span>Price</span><span>Sub</span>
                </div>
                <div class="ord-receipt-item" *ngFor="let item of savedOrderReceipt.items">
                  <span class="ord-receipt-pname">{{ item.productName }}</span>
                  <span>×{{ item.quantity }}</span>
                  <span>GHS {{ item.unitPrice | number:'1.2-2' }}</span>
                  <span>GHS {{ item.subtotal | number:'1.2-2' }}</span>
                </div>
                <div class="ord-receipt-divider"></div>
                <div class="ord-receipt-total">
                  <span>Total</span>
                  <strong>GHS {{ savedOrderReceipt.total | number:'1.2-2' }}</strong>
                </div>
                <div class="ord-receipt-divider"></div>
                <div class="ord-receipt-footer-note">We will contact you once your items arrive.</div>
                <div class="ord-receipt-copy-note">© {{ shopConfig.shopName }} · {{ currentYear }}</div>
              </div>
            </div>
          </ng-container>

          <!-- ── VIEW MODE ── -->
          <ng-container *ngIf="viewingOrder && !savedOrderReceipt">
            <div class="ord-view-detail">
              <div class="ord-view-row">
                <span class="ord-view-label">Client</span>
                <span class="ord-view-value">{{ viewingOrder.clientName }}</span>
              </div>
              <div class="ord-view-row" *ngIf="viewingOrder.clientPhone">
                <span class="ord-view-label">Phone</span>
                <span class="ord-view-value">{{ viewingOrder.clientPhone }}</span>
              </div>
              <div class="ord-view-row">
                <span class="ord-view-label">Total</span>
                <span class="ord-view-value"><strong>GH₵{{ (viewingOrder.totalAmount || 0) | number:'1.2-2' }}</strong></span>
              </div>
              <div class="ord-view-row" *ngIf="viewingOrder.notes">
                <span class="ord-view-label">Notes</span>
                <span class="ord-view-value">{{ viewingOrder.notes }}</span>
              </div>
            </div>
            <div class="ord-section-divider"><span class="ord-section-label">Order Items</span></div>
            <div class="ord-loading-note" *ngIf="orderViewLoading">Loading order history…</div>
            <div class="ord-table-wrap" *ngIf="!orderViewLoading">
              <table class="ord-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Fulfilled</th>
                    <th>Shortfall</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of viewingOrder.items">
                    <td>
                      <div>{{ item.productName }}</div>
                      <div class="ord-adjustment-note" *ngIf="item.adjustmentReason">
                        {{ item.adjustmentReason }}
                      </div>
                      <div class="ord-adjustment-history" *ngIf="item.adjustmentHistory?.length">
                        <div class="ord-adjustment-entry" *ngFor="let adj of item.adjustmentHistory">
                          {{ adj.originalQuantity }} -> {{ adj.adjustedQuantity }}
                          <span *ngIf="adj.damagedQuantity > 0">, {{ adj.damagedQuantity }} damaged</span>
                          <span *ngIf="adj.createdAt"> on {{ adj.createdAt | date:'mediumDate' }}</span>
                          <span *ngIf="adj.undoneAt">, reset {{ adj.undoneAt | date:'mediumDate' }}</span>
                        </div>
                      </div>
                    </td>
                    <td>{{ item.quantity }}</td>
                    <td>{{ item.fulfilledQuantity ?? item.quantity }}</td>
                    <td>{{ item.shortfallQuantity ?? 0 }}</td>
                    <td>GH₵{{ item.unitPrice | number:'1.2-2' }}</td>
                    <td>GH₵{{ item.subtotal | number:'1.2-2' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- ── Add Items Panel ── -->
            <ng-container *ngIf="isAddingItemsToOrder && canAddItemsToViewingOrder">
              <div class="ord-section-divider"><span class="ord-section-label">Add Items</span></div>
              <div *ngFor="let item of addItemsRows; let i = index" class="ord-item-row">
                <div class="ord-form-group ord-item-product">
                  <label class="ord-label">Product</label>
                  <app-searchable-select
                    [items]="batchProducts"
                    labelKey="productName"
                    valueKey="id"
                    placeholder="Select product…"
                    searchPlaceholder="Type to search…"
                    [(ngModel)]="item.batchProductId"
                    (ngModelChange)="onAddItemProductSelect(i, $event)">
                  </app-searchable-select>
                </div>
                <div class="ord-form-group ord-item-qty">
                  <label class="ord-label">Qty</label>
                  <div class="ord-input-prefix">
                    <span>×</span>
                    <input class="ord-input ord-input-prefixed" type="number" min="1"
                           [(ngModel)]="item.quantity" (input)="recalcAddItem(i)" />
                  </div>
                </div>
                <div class="ord-form-group ord-item-price">
                  <label class="ord-label">Unit Price</label>
                  <div class="ord-input-prefix">
                    <span>GH₵</span>
                    <input class="ord-input ord-input-prefixed" type="number" min="0" step="0.01"
                           [(ngModel)]="item.unitPrice" disabled />
                  </div>
                </div>
                <div class="ord-form-group ord-item-subtotal">
                  <label class="ord-label">Subtotal</label>
                  <div class="ord-readonly">GH₵{{ item.subtotal | number:'1.2-2' }}</div>
                </div>
                <button class="ord-item-remove" (click)="removeAddItemRow(i)" title="Remove item"
                        [disabled]="addItemsRows.length === 1">
                  <span class="material-icons">delete</span>
                </button>
              </div>
              <button class="ord-btn ord-btn-ghost ord-btn-sm" (click)="addItemRow()">
                <span class="material-icons">add</span> Add Row
              </button>
              <div class="ord-summary">
                <div class="ord-summary-row ord-summary-total">
                  <span>New Items Total</span>
                  <strong>GH₵{{ addItemsTotal | number:'1.2-2' }}</strong>
                </div>
              </div>
            </ng-container>
          </ng-container>

          <!-- ── CREATE MODE ── -->
          <ng-container *ngIf="!viewingOrder && !savedOrderReceipt">
            <!-- Client select -->
            <div class="ord-form-group">
              <label class="ord-label">Client <span class="ord-required">*</span></label>
              <app-searchable-select
                [items]="clients"
                labelKey="name"
                valueKey="id"
                placeholder="Search and select a client…"
                searchPlaceholder="Type to search…"
                [(ngModel)]="orderForm.clientId">
              </app-searchable-select>
            </div>

            <!-- Add new client inline -->
            <div class="ord-add-client-toggle">
              <button class="ord-btn-link" (click)="showAddClientForm = !showAddClientForm">
                <span class="material-icons">{{ showAddClientForm ? 'remove' : 'add' }}</span>
                {{ showAddClientForm ? 'Cancel new client' : 'Add new client' }}
              </button>
            </div>
            <div *ngIf="showAddClientForm" class="ord-add-client-form">
              <div class="ord-form-row">
                <div class="ord-form-group">
                  <label class="ord-label">Name <span class="ord-required">*</span></label>
                  <input class="ord-input" type="text" [(ngModel)]="newClientForm.name" placeholder="Client name" />
                </div>
                <div class="ord-form-group">
                  <label class="ord-label">Phone</label>
                  <input class="ord-input" type="text" [(ngModel)]="newClientForm.phone" placeholder="0XX XXX XXXX" />
                </div>
              </div>
              <button class="ord-btn ord-btn-ghost ord-btn-sm" (click)="saveNewClient()" [disabled]="savingClient || !newClientForm.name.trim()">
                <span *ngIf="savingClient" class="ord-spinner"></span>
                Save Client
              </button>
            </div>

            <!-- Order items -->
            <div class="ord-section-divider"><span class="ord-section-label">Items</span></div>
            <div *ngFor="let item of orderForm.items; let i = index" class="ord-item-row">
              <div class="ord-form-group ord-item-product">
                <label class="ord-label">Product</label>
                <app-searchable-select
                  [items]="batchProducts"
                  labelKey="productName"
                  valueKey="id"
                  placeholder="Select product…"
                  searchPlaceholder="Type to search…"
                  [(ngModel)]="item.batchProductId"
                  (ngModelChange)="onItemProductSelect(i, $event)">
                </app-searchable-select>
              </div>
              <div class="ord-form-group ord-item-qty">
                <label class="ord-label">Qty</label>
                <div class="ord-input-prefix">
                  <span>×</span>
                  <input class="ord-input ord-input-prefixed" type="number" min="1"
                         [(ngModel)]="item.quantity" (input)="recalcItem(i)" />
                </div>
              </div>
              <div class="ord-form-group ord-item-price">
                <label class="ord-label">Unit Price</label>
                <div class="ord-input-prefix">
                  <span>GH₵</span>
                  <input class="ord-input ord-input-prefixed" type="number" min="0" step="0.01"
                         [(ngModel)]="item.unitPrice" disabled />
                  <ng-container *ngIf="getDiscountInfo(i) as d">
                    <span class="ord-disc-icon material-icons"
                          [class.ord-disc-icon-active]="d.active"
                          [title]="d.active ? 'Discount applied' : ('Discount available at \u2265' + d.minQty + ' units')">local_offer</span>
                  </ng-container>
                </div>
              </div>
              <div class="ord-form-group ord-item-subtotal">
                <label class="ord-label">Subtotal</label>
                <div class="ord-readonly">GH₵{{ item.subtotal | number:'1.2-2' }}</div>
              </div>
              <button class="ord-item-remove" (click)="removeItem(i)" title="Remove item" [disabled]="orderForm.items.length === 1">
                <span class="material-icons">delete</span>
              </button>
            </div>

            <button class="ord-btn ord-btn-ghost ord-btn-sm" (click)="addItem()">
              <span class="material-icons">add</span> Add Item
            </button>

            <!-- Summary -->
            <div class="ord-summary">
              <div class="ord-summary-row">
                <span>Items</span>
                <span>{{ orderForm.items.length }}</span>
              </div>
              <div class="ord-summary-row ord-summary-total">
                <span>Total</span>
                <strong>GH₵{{ orderFormTotal | number:'1.2-2' }}</strong>
              </div>
            </div>

            <!-- Notes -->
            <div class="ord-form-group">
              <label class="ord-label">Notes <span class="ord-optional">(optional)</span></label>
              <textarea class="ord-input ord-textarea" rows="2" [(ngModel)]="orderForm.notes" placeholder="Any additional notes…"></textarea>
            </div>
          </ng-container>

        </div>
        <div class="ord-modal-footer">
          <ng-container *ngIf="isAddingItemsToOrder">
            <button class="ord-btn ord-btn-ghost" (click)="cancelAddItemsToOrder()">Cancel</button>
            <button class="ord-btn ord-btn-primary" (click)="saveAddedItems()"
                    [disabled]="savingAddItems || !addItemsHasProduct">
              <span *ngIf="savingAddItems" class="ord-spinner"></span>
              Save Items
            </button>
          </ng-container>
          <ng-container *ngIf="!isAddingItemsToOrder">
            <button class="ord-btn ord-btn-ghost" (click)="closeOrderModal()">
              {{ savedOrderReceipt ? 'Done' : (viewingOrder ? 'Close' : 'Cancel') }}
            </button>
            <ng-container *ngIf="savedOrderReceipt || viewingOrder">
              <button class="ord-btn ord-btn-ghost" (click)="copyReceipt()">
                <span class="material-icons">{{ copySuccess ? 'check' : 'content_copy' }}</span>
                {{ copySuccess ? 'Copied!' : 'Copy' }}
              </button>
              <button class="ord-btn ord-btn-whatsapp" (click)="sendWhatsappReceipt()">
                <span class="material-icons">chat</span>
                WhatsApp
              </button>
            </ng-container>
            <button *ngIf="viewingOrder && !savedOrderReceipt && canAddItemsToViewingOrder" class="ord-btn ord-btn-secondary"
                    (click)="startAddItemsToOrder()">
              <span class="material-icons">add</span>
              Add Items
            </button>
            <button *ngIf="!viewingOrder && !savedOrderReceipt && canCreateOrderInSelectedBatch" class="ord-btn ord-btn-primary"
                    (click)="saveOrder()" [disabled]="savingOrder || !orderForm.clientId">
              <span *ngIf="savingOrder" class="ord-spinner"></span>
              Create Order
            </button>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- CLOSE BATCH MODAL                                 -->
    <!-- ══════════════════════════════════════════════════ -->
    <app-modal
      *ngIf="showCloseBatchModal"
      size="sm"
      title="Close Batch"
      sub-heading="This will freeze the batch — no new orders can be added"
      icon="lock"
      [buttons]="closeBatchButtons"
      (closeRequested)="showCloseBatchModal = false"
      (buttonClick)="onCloseBatchModalButton($event)">
        <div class="ord-alert ord-alert-warning">
          <span class="material-icons">warning</span>
          <p>Closing <strong>{{ selectedBatch?.name }}</strong> will send all order items to the buying list and lock the batch for editing.</p>
        </div>
        <div class="ord-close-stats">
          <div class="ord-close-stat">
            <span class="material-icons">receipt_long</span>
            <span><strong>{{ closeBatchOrderCount }}</strong> order{{ closeBatchOrderCount !== 1 ? 's' : '' }}</span>
          </div>
          <div class="ord-close-stat">
            <span class="material-icons">payments</span>
            <span><strong>GH₵{{ (orderBatchGrandTotal ?? 0) | number:'1.2-2' }}</strong> total</span>
          </div>
        </div>
    </app-modal>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- PRODUCT SUMMARY MODAL                             -->
    <!-- ══════════════════════════════════════════════════ -->
    <div class="ord-modal-overlay" *ngIf="showProductSummaryModal" (click)="closeProductSummary()">
      <div class="ord-modal ord-modal-sm" (click)="$event.stopPropagation()">
        <div class="ord-modal-header">
          <div class="ord-modal-header-icon"><span class="material-icons">list_alt</span></div>
          <div class="ord-modal-header-text">
            <div class="ord-modal-title">Product Summary</div>
            <div class="ord-modal-sub">See all clients who ordered a product</div>
          </div>
          <button class="ord-modal-close" (click)="closeProductSummary()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="ord-modal-body">
          <div class="ord-form-group">
            <label class="ord-label">Select Product</label>
            <app-searchable-select
              [items]="batchProducts"
              labelKey="productName"
              valueKey="productId"
              placeholder="Search and select a product…"
              searchPlaceholder="Type to search…"
              [ngModel]="summaryProductId"
              (ngModelChange)="onSummaryProductChange($event)">
            </app-searchable-select>
          </div>

          <div *ngIf="loadingSummary" class="ord-summary-loading">
            <span class="ord-spinner"></span> Loading…
          </div>

          <ng-container *ngIf="!loadingSummary && summaryProductId">
            <div *ngIf="summaryRows.length === 0" class="ord-summary-empty">
              No orders found for this product.
            </div>
            <ng-container *ngIf="summaryRows.length > 0">
              <div class="ord-section-divider">
                <span class="ord-section-label">Order list for {{ summaryProductName }}</span>
              </div>
              <div class="ord-psummary-list">
                <div class="ord-psummary-row" *ngFor="let row of summaryRows; let i = index">
                  <span class="ord-psummary-num">{{ i + 1 }}.</span>
                  <div class="ord-psummary-client">
                    <span class="ord-psummary-name">{{ row.clientName }}</span>
                    <span class="ord-psummary-phone" *ngIf="row.clientPhone">{{ row.clientPhone }}</span>
                  </div>
                  <span class="ord-psummary-qty">
                    {{ row.quantity }} unit{{ row.quantity !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>
              <div class="ord-psummary-total">
                <span>Total</span>
                <strong>{{ summaryTotalQty }} unit{{ summaryTotalQty !== 1 ? 's' : '' }}</strong>
              </div>
            </ng-container>
          </ng-container>
        </div>
        <div class="ord-modal-footer" *ngIf="summaryRows.length > 0">
          <button class="ord-btn ord-btn-ghost" (click)="copyProductSummary()">
            <span class="material-icons">{{ summaryCopySuccess ? 'check' : 'content_copy' }}</span>
            {{ summaryCopySuccess ? 'Copied!' : 'Copy' }}
          </button>
          <button class="ord-btn ord-btn-whatsapp" (click)="whatsappProductSummary()">
            <span class="material-icons">chat</span>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Layout ── */
    .ord-page { padding: 0; }
    .ord-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    /* ── Header ── */
    .ord-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .ord-header-left { display: flex; align-items: center; gap: 14px; }
    .ord-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .ord-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .ord-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }
    .ord-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

    /* ── Buttons ── */
    .ord-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.13s, box-shadow 0.13s, opacity 0.13s; }
    .ord-btn .material-icons { font-size: 18px; }
    .ord-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ord-btn-primary { background: var(--primary-color, #6366f1); color: #fff; }
    .ord-btn-primary:hover:not(:disabled) { background: var(--primary-dark, #4f46e5); }
    .ord-btn-ghost { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .ord-btn-ghost:hover:not(:disabled) { background: #e2e8f0; }
    .ord-btn-warning { background: #f59e0b; color: #fff; }
    .ord-btn-warning:hover:not(:disabled) { background: #d97706; }
    .ord-btn-danger { background: #ef4444; color: #fff; }
    .ord-btn-danger:hover:not(:disabled) { background: #dc2626; }
    .ord-btn-sm { padding: 6px 12px; font-size: 12px; }
    .ord-btn-link { background: none; border: none; color: var(--primary-color, #6366f1); font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 0; }
    .ord-btn-link .material-icons { font-size: 16px; }
    .ord-btn-link:hover { text-decoration: underline; }

    /* ── Toolbar ── */

    /* Filter pill group */
    .ord-filter-group { display: inline-flex; gap: 2px; padding: 3px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 9px; }
    .ord-filter-btn { padding: 5px 12px; border: none; border-radius: 7px; font-size: 12px; font-weight: 600; color: #64748b; background: transparent; cursor: pointer; transition: background 0.12s, color 0.12s; }
    .ord-filter-active { background: var(--primary-color, #6366f1); color: #fff; }

    /* ── Status badge ── */
    .ord-status-badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; }
    .ord-sb-open { background: #dcfce7; color: #166534; }
    .ord-sb-closed { background: #f1f5f9; color: #475569; }
    .ord-sb-lg { font-size: 12px; padding: 4px 12px; }

    /* ── Skeleton ── */
    .ord-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 4px 0 16px; }
    .ord-skeleton-batch-card { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid #f1f5f9; border-radius: 14px; }
    .ord-sk { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: ord-shimmer 1.4s infinite; border-radius: 6px; }
    @keyframes ord-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .ord-sk-icon { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
    .ord-sk-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .ord-sk-line { height: 12px; }
    .ord-sk-line-lg { width: 70%; }
    .ord-sk-line-sm { width: 40%; }
    .ord-skeleton-table { margin-top: 8px; }
    .ord-sk-thead { display: flex; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; }
    .ord-sk-th { height: 14px; flex: 1; border-radius: 4px; }
    .ord-sk-row { display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f8fafc; }
    .ord-sk-td { height: 14px; flex: 1; border-radius: 4px; }

    /* ── Batch card grid ── */
    .ord-batch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 4px 0 16px; }
    .ord-card-action-btn { width: 30px; height: 30px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.12s, border-color 0.12s, color 0.12s; }
    .ord-card-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ord-cab-primary { background: var(--primary-color, #6366f1); color: #fff; border-color: var(--primary-color, #6366f1); }
    .ord-open-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 600; padding: 0 10px; width: auto; border-radius: 7px; }
    .ord-open-btn:hover { background: var(--primary-dark, #4f46e5); }
    .ord-batch-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; min-height: 22px; }
    .ord-bpill { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .ord-bpill .material-icons { font-size: 12px; }
    .ord-bpill-orders  { background: rgba(59, 130, 246, 0.12); color: rgba(59, 130, 246, 0.5); }
    .ord-bpill-pending { background: rgba(245, 158, 11, 0.12); color: rgba(245, 158, 11, 0.8); }
    .ord-bpill-ordered { background: rgba(59, 130, 246, 0.12); color: rgba(59, 130, 246, 0.8); }
    .ord-bpill-shipped { background: rgba(168, 85, 247, 0.12); color: rgba(168, 85, 247, 0.8); }
    .ord-bpill-arrived { background: rgba(16, 185, 129, 0.12); color: rgba(16, 185, 129, 0.8); }
    .ord-bpill-empty   { background: #f1f5f9; color: #94a3b8; }

    /* ── Detail header ── */
    .ord-detail-header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ccc; margin-bottom: 16px; flex-wrap: wrap; }
    .ord-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border: 1px solid #ccc; border-radius: 9px; background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: background 0.12s; white-space: nowrap; }
    .ord-back-btn:hover { background: #e2e8f0; }
    .ord-back-btn .material-icons { font-size: 16px; }
    .ord-detail-title-group { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .ord-detail-batch-icon { width: 36px; height: 36px; border-radius: 9px; background: rgba(var(--primary-rgb, 99,102,241), 0.1); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .ord-dbi-closed { background: #f1f5f9; color: #94a3b8; }
    .ord-detail-batch-name { font-size: 15px; font-weight: 700; color: #0f172a; }
    .ord-detail-batch-date { font-size: 11px; color: #94a3b8; }
    .ord-detail-actions { display: flex; gap: 8px; flex-shrink: 0; margin-left: auto; }

    /* ── Orders table ── */
    .ord-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #ccc; }
    .ord-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ord-table th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #ccc; white-space: nowrap; }
    .ord-table td { padding: 11px 12px; border-bottom: 1px solid #ccc; vertical-align: middle; }
    .ord-table tr:last-child td { border-bottom: none; }
    .ord-table tr:hover td { background: #fafbff; }
    .ord-adjustment-note { margin-top: 4px; font-size: 11px; color: #64748b; }
    .ord-adjustment-history { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
    .ord-adjustment-entry { font-size: 11px; color: #94a3b8; }
    .ord-loading-note { margin-bottom: 12px; font-size: 13px; color: #64748b; }
    .ord-id-chip { display: inline-block; padding: 2px 8px; background: rgba(var(--primary-rgb, 99,102,241), 0.08); color: var(--primary-color, #6366f1); border-radius: 6px; font-size: 12px; font-weight: 700; }
    .ord-client-cell { display: flex; align-items: center; gap: 10px; }
    .ord-client-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-color, #6366f1); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ord-client-name { font-size: 13px; font-weight: 600; color: #0f172a; }
    .ord-client-phone { font-size: 11px; color: #94a3b8; }
    .ord-items-link { color: var(--primary-color, #6366f1); font-weight: 600; cursor: pointer; text-decoration: none; }
    .ord-items-link:hover { text-decoration: underline; }
    .ord-date-cell { color: #64748b; white-space: nowrap; font-size: 12px; }
    .ord-row-actions { display: flex; gap: 4px; }
    .ord-row-btn { width: 30px; height: 30px; border: 1px solid #e2e8f0; border-radius: 7px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; transition: background 0.12s, color 0.12s; }
    .ord-row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ord-row-btn:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
    .ord-row-btn-danger:hover:not(:disabled) { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }

    /* ── Pagination ── */
    .ord-pagination { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; margin-top: 4px; border-top: 1px solid #ccc; }
    .ord-stats-strip { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap; padding: 10px 0 8px; }
    .ord-stat-chip { display: flex; flex-direction: column; gap: 4px; padding: 12px 16px; border-radius: 12px; font-size: 12px; background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); min-width: 130px; }
    .ord-stat-chip .ord-stat-top { display: flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .ord-stat-chip .material-icons { font-size: 14px; }
    .ord-stat-chip strong { font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .ord-stat-chip-accent { background: rgba(var(--primary-rgb, 99,102,241), 0.08); border-color: rgba(var(--primary-rgb, 99,102,241), 0.2); color: var(--primary-color, #6366f1); }
    .ord-stat-chip-accent strong { color: var(--primary-color, #6366f1); }
    .ord-stat-chip-muted { background: #f8fafc; color: #64748b; }
    .ord-pg-info { font-size: 12px; color: #64748b; }
    .ord-pg-btns { display: flex; align-items: center; gap: 4px; }
    .ord-pg-btns button { width: 30px; height: 30px; border: 1px solid #e2e8f0; border-radius: 7px; background: #f8fafc; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: background 0.12s; }
    .ord-pg-btns button:disabled { opacity: 0.4; cursor: not-allowed; }
    .ord-pg-btns button:hover:not(:disabled) { background: #e2e8f0; }
    .ord-pg-cur { font-size: 12px; font-weight: 600; color: #0f172a; padding: 0 8px; }

    /* ── Empty state ── */
    .ord-empty { text-align: center; padding: 48px 24px; }
    .ord-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(var(--primary-rgb, 99,102,241), 0.08); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
    .ord-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .ord-empty p { font-size: 13px; color: #64748b; margin: 0 0 16px; }

    /* ── Spinner ── */
    .ord-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: ord-spin 0.6s linear infinite; display: inline-block; }
    @keyframes ord-spin { to { transform: rotate(360deg); } }

    /* ── Modal ── */
    .ord-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .ord-modal { background: #fff; border-radius: 16px; display: flex; flex-direction: column; max-height: 90vh; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
    .ord-modal-sm { width: 440px; }
    .ord-modal-lg { width: 760px; max-width: 100%; }
    .ord-modal-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid #ccc; background: linear-gradient(135deg, #f8faff, #fff); flex-shrink: 0; }
    .ord-modal-header-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .ord-mhi-warning { background: #f59e0b; }
    .ord-modal-header-text { flex: 1; }
    .ord-modal-title { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.2; }
    .ord-modal-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    .ord-modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; border-radius: 6px; line-height: 0; transition: background 0.12s, color 0.12s; }
    .ord-modal-close:hover { background: #f1f5f9; color: #475569; }
    .ord-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .ord-modal-footer { padding: 14px 20px; border-top: 1px solid #ccc; background: #fafafa; display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; }

    /* ── Form elements ── */
    .ord-form-group { margin-bottom: 14px; }
    .ord-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 5px; }
    .ord-required { color: #ef4444; margin-left: 2px; }
    .ord-optional { color: #94a3b8; font-weight: 400; }
    .ord-input { width: 100%; padding: 9px 12px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 9px; font-size: 13px; background: #fff; color: #1e293b; transition: border-color 0.13s, box-shadow 0.13s; box-sizing: border-box; }
    .ord-input:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.15); }
    .ord-textarea { resize: vertical; }
    .ord-readonly { padding: 9px 12px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 9px; background: #f8fafc; font-size: 13px; color: #64748b; }
    .ord-input-prefix { display: flex; align-items: center; border: 1px solid var(--border-color, #e2e8f0); border-radius: 9px; overflow: hidden; background: #fff; transition: border-color 0.13s; }
    .ord-input-prefix:focus-within { border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb, 99,102,241), 0.15); }
    .ord-input-prefix:has(input:disabled) { background: #f8fafc; border-color: #e2e8f0; }
    .ord-input-prefix span:not(.ord-disc-icon) { padding: 0 10px; font-size: 11px; font-weight: 700; color: #94a3b8; background: #f8fafc; border-right: 1px solid var(--border-color, #e2e8f0); white-space: nowrap; align-self: stretch; display: flex; align-items: center; }
    .ord-input-prefixed { border: none !important; box-shadow: none !important; border-radius: 0 !important; flex: 1; }
    .ord-input-prefixed:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .ord-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* ── Add client inline ── */
    .ord-add-client-toggle { margin: -6px 0 12px; }
    .ord-add-client-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px; }

    /* ── Order item row ── */
    .ord-item-row { display: grid; grid-template-columns: 1fr 100px 140px 110px 28px; gap: 8px; align-items: end; margin-bottom: 8px; }
    .ord-item-remove { width: 28px; height: 28px; border: 1px solid #fca5a5; border-radius: 7px; background: #fff; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: background 0.12s; margin-bottom: 14px; }
    .ord-item-remove:hover:not(:disabled) { background: #fef2f2; }
    .ord-item-remove:disabled { opacity: 0.3; cursor: not-allowed; }
    .ord-input-prefix .ord-disc-icon { padding: 0 8px; font-size: 16px; color: #d1d5db; cursor: default; flex-shrink: 0; transition: color 0.15s; }
    .ord-input-prefix .ord-disc-icon-active { color: #16a34a; }

    /* ── Summary ── */
    .ord-section-divider { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; }
    .ord-section-divider::before, .ord-section-divider::after { content: ''; flex: 1; height: 1px; background: #ccc; }
    .ord-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; white-space: nowrap; }
    .ord-summary { background: #f8fafc; border: 1px solid #ccc; border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
    .ord-summary-row { display: flex; justify-content: space-between; font-size: 13px; color: #475569; padding: 3px 0; }
    .ord-summary-total { border-top: 1px solid #ccc; margin-top: 6px; padding-top: 6px; font-size: 14px; color: #0f172a; }

    /* ── View mode ── */
    .ord-view-detail { background: #f8fafc; border: 1px solid #ccc; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
    .ord-view-row { display: flex; gap: 12px; padding: 5px 0; border-bottom: 1px solid #ccc; font-size: 13px; }
    .ord-view-row:last-child { border-bottom: none; }
    .ord-view-label { width: 80px; font-weight: 600; color: #94a3b8; flex-shrink: 0; }
    .ord-view-value { color: #0f172a; }

    /* ── Alert ── */
    .ord-alert { display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
    .ord-alert .material-icons { font-size: 18px; flex-shrink: 0; }
    .ord-alert p { margin: 0; }
    .ord-alert-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .ord-alert-warning .material-icons { color: #f59e0b; }

    /* ── Close batch stats ── */
    .ord-close-stats { display: flex; gap: 12px; flex-wrap: wrap; }
    .ord-close-stat { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #f8fafc; border: 1px solid #ccc; border-radius: 9px; font-size: 13px; color: #475569; }
    .ord-close-stat .material-icons { font-size: 16px; color: var(--primary-color, #6366f1); }

    /* ── Receipt ── */
    .ord-mhi-success { background: #16a34a !important; }
    .ord-receipt-wrap { display: flex; justify-content: center; padding: 4px 0 8px; }
    .ord-receipt-box { width: 100%; max-width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 22px; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #1e293b; }
    .ord-receipt-shop { font-size: 15px; font-weight: 700; text-align: center; letter-spacing: 0.05em; margin-bottom: 12px; color: var(--primary-color, #6366f1); }
    .ord-receipt-divider { border: none; border-top: 1px dashed #cbd5e1; margin: 10px 0; }
    .ord-receipt-row { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0; }
    .ord-receipt-label { color: #64748b; flex-shrink: 0; }
    .ord-receipt-val { font-weight: 600; text-align: right; }
    .ord-receipt-items-head { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
    .ord-receipt-item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; margin: 3px 0; align-items: baseline; }
    .ord-receipt-pname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ord-receipt-total { display: flex; justify-content: space-between; font-size: 14px; padding: 2px 0; }
    .ord-receipt-total strong { font-size: 15px; color: #0f172a; }
    .ord-receipt-footer-note { text-align: center; font-size: 11px; color: #64748b; margin: 4px 0 2px; }
    .ord-receipt-copy-note { text-align: center; font-size: 11px; color: #94a3b8; }
    .ord-receipt-merged-badge { display: flex; align-items: center; gap: 5px; justify-content: center; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600; margin-bottom: 10px; font-family: inherit; }
    .ord-btn-whatsapp { background: #25d366; color: #fff; }
    .ord-btn-whatsapp:hover:not(:disabled) { background: #1ebe5d; }
    .ord-btn-secondary { background: var(--primary-color, #6366f1); color: #fff; }
    .ord-btn-secondary:hover:not(:disabled) { filter: brightness(1.12); }
    .ord-select { appearance: none; cursor: pointer; }
    .ord-summary-loading { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px; padding: 12px 0; }
    .ord-summary-empty { color: #94a3b8; font-size: 13px; text-align: center; padding: 16px 0; }
    .ord-psummary-list { display: flex; flex-direction: column; gap: 2px; margin: 8px 0 4px; }
    .ord-psummary-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9; }
    .ord-psummary-num { color: #94a3b8; font-size: 12px; font-weight: 700; min-width: 20px; }
    .ord-psummary-client { flex: 1; min-width: 0; }
    .ord-psummary-name { font-weight: 600; font-size: 13px; color: #0f172a; display: block; }
    .ord-psummary-phone { font-size: 11px; color: #64748b; display: block; }
    .ord-psummary-qty { background: var(--primary-color, #6366f1); color: #fff; border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .ord-psummary-total { display: flex; justify-content: space-between; align-items: center; padding: 10px 10px 2px; font-size: 13px; color: #475569; border-top: 1px dashed #e2e8f0; margin-top: 4px; }

  `]
})
export class OrdersComponent implements OnInit {
  // ── Tab state ──
  activeTab: 'batches' | 'orders' = 'batches';

  // ── Batch list ──
  batches: OrderBatch[] = [];
  loadingBatches = true;
  batchPage = 1;
  batchPageSize = 18;
  batchTotal = 0;
  batchSearchTerm = '';
  batchStatusFilter: '' | 'open' | 'closed' = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();
  deletingBatchIds = new Set<number>();

  batchStats = new Map<number, { orderCount: number; pending: number; ordered: number; shipped: number; arrived: number }>();

  // ── Selected batch / orders ──
  selectedBatch: OrderBatch | null = null;
  orders: Order[] = [];
  orderColumns: TableColumn[] = [];
  loadingOrders = false;
  orderPage = 1;
  orderPageSize = 20;
  orderTotal = 0;
  batchOrderCount = 0;
  orderSearchTerm = '';
  orderDateFrom = '';
  orderDateTo = '';
  orderBatchGrandTotal: number | null = null;
  deletingOrderIds = new Set<number>();

  // ── Batch modal ──
  showBatchModal = false;
  editingBatch: OrderBatch | null = null;
  batchForm = { name: '' };
  savingBatch = false;

  // ── Order modal ──
  showOrderModal = false;
  viewingOrder: Order | null = null;
  orderViewLoading = false;
  savingOrder = false;
  savedOrderReceipt: {
    orderId: number;
    clientName: string;
    clientPhone: string;
    batchName: string;
    items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
    total: number;
    addedToExisting?: boolean;
  } | null = null;
  copySuccess = false;
  // ── Add items to existing order ──
  isAddingItemsToOrder = false;
  addItemsRows: { batchProductId: number | null; productId: number | null; productName: string; quantity: number; unitPrice: number; subtotal: number; }[] = [];
  savingAddItems = false;

  // ── Product summary ──
  showProductSummaryModal = false;
  summaryProductId: number | null = null;
  summaryRows: { clientName: string; clientPhone: string; quantity: number }[] = [];
  loadingSummary = false;
  summaryCopySuccess = false;

  // Clients & products for dropdowns
  clients: Client[] = [];
  batchProducts: BatchProduct[] = [];
  readonly baseColor = 'var(--primary-color, #6366f1)';

  // New client inline form
  showAddClientForm = false;
  newClientForm = { name: '', phone: '' };
  savingClient = false;

  // Create order form
  orderForm: {
    clientId: number | null;
    notes: string;
    items: { batchProductId: number | null; productId: number | null; productName: string; quantity: number; unitPrice: number; subtotal: number; }[];
  } = {
    clientId: null,
    notes: '',
    items: [this.blankItem()]
  };

  // ── Close batch modal ──
  showCloseBatchModal = false;
  closingBatch = false;
  closeBatchButtons: ModalButtonConfig[] = [
    { buttonName: 'Cancel', color: 'secondary', action: 'cancel' },
    { buttonName: 'Close Batch', color: 'base_color', action: 'confirm' }
  ];

  // ── Search debounce ──
  private batchSearchTimer: any;
  private orderSearchTimer: any;

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService,
    public shopConfig: ShopConfigService
  ) {}

  ngOnInit() {
    this.initializeOrderTable();
    this.loadBatches();
    this.loadClients();
  }

  // ────────────────────────────────────────────────────
  // COMPUTED
  // ────────────────────────────────────────────────────
  get batchRangeStart() { return (this.batchPage - 1) * this.batchPageSize + 1; }
  get batchRangeEnd() { return Math.min(this.batchPage * this.batchPageSize, this.batchTotal); }
  get totalBatchPages() { return Math.max(1, Math.ceil(this.batchTotal / this.batchPageSize)); }

  get orderRangeStart() { return (this.orderPage - 1) * this.orderPageSize + 1; }
  get orderRangeEnd() { return Math.min(this.orderPage * this.orderPageSize, this.orderTotal); }
  get totalOrderPages() { return Math.max(1, Math.ceil(this.orderTotal / this.orderPageSize)); }
  get orderPageAmountTotal() { return this.orders.reduce((s, o) => s + (o.totalAmount || 0), 0); }
  get closeBatchOrderCount() { return Math.max(this.batchOrderCount, this.orderTotal, this.orders.length); }
  get orderMetadata(): TableMetadata | null {
    if (this.orderTotal === 0) return null;
    return {
      pageNumber: this.orderPage,
      totalCount: this.orderTotal,
      pageSize: this.orderPageSize,
      totalPages: this.totalOrderPages
    };
  }
  get orderTableRows() {
    return this.orders.map(order => ({
      clientName: order.clientName || 'Unknown Client',
      orderIdLabel: `#${order.id}`,
      itemsLabel: `${order.items.length || 0} item${(order.items.length || 0) !== 1 ? 's' : ''}`,
      totalLabel: `GH₵${(order.totalAmount || 0).toFixed(2)}`,
      createdAt: order.createdAt,
      order
    }));
  }
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

  get orderFormTotal() {
    return this.orderForm.items.reduce((s, i) => s + (i.subtotal || 0), 0);
  }

  get addItemsTotal() {
    return this.addItemsRows.reduce((s, i) => s + (i.subtotal || 0), 0);
  }

  get addItemsHasProduct() {
    return this.addItemsRows.some(i => !!i.productId);
  }

  get canCreateOrderInSelectedBatch(): boolean {
    return this.selectedBatch?.status === 'open'
      && this.authService.canPerformOrdersOperation('canCreateOrder');
  }

  get canAddItemsToViewingOrder(): boolean {
    if (!this.viewingOrder || !this.selectedBatch) return false;
    if (!this.authService.canPerformOrdersOperation('canAddItemsToOrder')) return false;
    return this.selectedBatch.status === 'open'
      || this.authService.canPerformOrdersOperation('canEditOrderAfterBatchClosed');
  }

  readonly orderBatchTitleResolver = (batch: OrderBatch) => batch.name;
  readonly orderBatchSubtitleResolver = (batch: OrderBatch) =>
    batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  readonly orderBatchIconResolver = (batch: OrderBatch) => batch.status === 'open' ? 'folder_open' : 'folder';
  readonly orderBatchTagResolver = (batch: OrderBatch): BatchCardTagConfig | null =>
    batch.status === 'closed'
      ? { tagName: 'Closed', color: 'gray', icon: 'task_alt' }
      : null;
  readonly orderBatchIconMutedResolver = () => false;

  get selectedOrderBatchHeaderTag(): BatchDetailHeaderTagConfig | null {
    if (!this.selectedBatch) return null;
    if (this.selectedBatch.status === 'open') {
      return { label: 'Open', color: 'green', icon: 'check_circle' };
    }
    return { label: 'Closed', color: 'gray', icon: 'task_alt' };
  }

  get orderStatCards(): StatCardConfig[] {
    return [
      {
        icon: 'receipt_long',
        statName: 'Total Orders',
        statValue: this.orderTotal,
        color: 'base'
      },
      {
        icon: 'payments',
        statName: 'Batch Revenue',
        statValue: `GH¢${(this.orderBatchGrandTotal ?? 0).toFixed(2)}`,
        color: 'green'
      },
      {
        icon: 'view_list',
        statName: 'This Page',
        statValue: `GH¢${this.orderPageAmountTotal.toFixed(2)}`,
        color: 'blue'
      }
    ];
  }

  readonly orderToolbarButton: ToolbarButtonConfig = {
    icon: 'list_alt',
    buttonName: 'Product Summary'
  };
  get orderActionOptions(): ActionOption[] {
    const actions: ActionOption[] = [
      { id: 'view', label: 'View order', icon: 'eye', color: 'black' }
    ];

    if (this.authService.canPerformOrdersOperation('canDeleteOrder')) {
      actions.push({
        id: 'delete',
        label: 'Delete order',
        icon: 'trash',
        color: 'red'
      });
    }

    return actions;
  }

  initializeOrderTable() {
    this.orderColumns = [
      { key: 'clientName', label: 'Client', type: 'string', searchable: true },
      { key: 'orderIdLabel', label: '#', type: 'string' },
      { key: 'itemsLabel', label: 'Items', type: 'string' },
      { key: 'totalLabel', label: 'Total', type: 'string' },
      { key: 'createdAt', label: 'Date', type: 'date' },
      { key: 'actions', label: '', type: 'actions' }
    ];
  }

  // ────────────────────────────────────────────────────
  // BATCH LOADING
  // ────────────────────────────────────────────────────
  loadBatches() {
    this.loadingBatches = true;
    const status = this.batchStatusFilter as any || undefined;
    const monthYear = this.batchFilterMonth !== null
      ? { month: this.batchFilterMonth, year: this.batchFilterYear! }
      : undefined;
    this.dbService.getOrderBatchesPage(
      this.batchPage, this.batchPageSize, this.batchSearchTerm, status, monthYear
    ).subscribe(res => {
      this.batches = res.data;
      this.batchTotal = res.total;
      this.loadingBatches = false;
      const ids = res.data.map((b: any) => b.id).filter(Boolean);
      if (ids.length) {
        this.dbService.getBatchesPreviewStats(ids).subscribe(stats => { this.batchStats = stats; });
      }
    });
  }

  onBatchSearch() {
    clearTimeout(this.batchSearchTimer);
    this.batchSearchTimer = setTimeout(() => {
      this.batchPage = 1;
      this.loadBatches();
    }, 500);
  }

  onBatchSearchInput(term: string) {
    this.batchSearchTerm = term;
    this.onBatchSearch();
  }

  setBatchStatusFilter(val: '' | 'open' | 'closed') {
    this.batchStatusFilter = val;
    this.batchPage = 1;
    this.loadBatches();
  }

  setBatchPage(p: number) {
    this.batchPage = p;
    this.loadBatches();
  }

  onBatchMonthYearChange(selection: { month: number | null; year: number | null }) {
    this.batchFilterMonth = selection.month;
    this.batchFilterYear = selection.year;
    this.batchPage = 1;
    this.loadBatches();
  }

  // ────────────────────────────────────────────────────
  // BATCH CRUD
  // ────────────────────────────────────────────────────
  openCreateBatchModal() {
    if (!this.authService.canPerformOrdersOperation('canCreateOrder')) return;
    this.editingBatch = null;
    this.batchForm = { name: '' };
    this.showBatchModal = true;
  }

  openEditBatchModal(batch: OrderBatch) {
    this.editingBatch = batch;
    this.batchForm = { name: batch.name };
    this.showBatchModal = true;
  }

  saveBatch() {
    if (!this.batchForm.name.trim() || this.savingBatch) return;
    if (!this.editingBatch && !this.authService.canPerformOrdersOperation('canCreateOrder')) return;
    this.savingBatch = true;
    if (this.editingBatch) {
      this.dbService.updateOrderBatch(this.editingBatch.id!, this.batchForm.name.trim()).subscribe(() => {
        this.savingBatch = false;
        this.showBatchModal = false;
        this.loadBatches();
      });
    } else {
      this.dbService.createOrderBatch(this.batchForm.name.trim()).subscribe(() => {
        this.savingBatch = false;
        this.showBatchModal = false;
        this.batchPage = 1;
        this.loadBatches();
      });
    }
  }

  deleteBatch(batch: OrderBatch) {
    if (!confirm(`Delete batch "${batch.name}"? This cannot be undone.`)) return;
    this.deletingBatchIds.add(batch.id!);
    this.dbService.deleteOrderBatch(batch.id!).subscribe(() => {
      this.deletingBatchIds.delete(batch.id!);
      this.loadBatches();
    });
  }

  // ────────────────────────────────────────────────────
  // ORDERS LOADING
  // ────────────────────────────────────────────────────
  viewBatchOrders(batch: OrderBatch) {
    this.selectedBatch = batch;
    this.activeTab = 'orders';
    this.orderPage = 1;
    this.orderSearchTerm = '';
    this.orderDateFrom = '';
    this.orderDateTo = '';
    this.batchOrderCount = 0;
    this.loadOrders();
    this.loadBatchProducts(batch.id!);
  }

  backToBatches() {
    this.activeTab = 'batches';
    this.selectedBatch = null;
    this.orders = [];
    this.orderTotal = 0;
    this.batchOrderCount = 0;
    this.loadBatches();
  }

  loadOrders() {
    if (!this.selectedBatch) return;
    this.loadingOrders = true;
    this.dbService.getOrdersByBatchPage(
      this.selectedBatch.id!,
      this.orderPage,
      this.orderPageSize,
      this.orderSearchTerm,
      this.orderDateFrom,
      this.orderDateTo
    ).subscribe(res => {
      this.orders = res.data;
      this.orderTotal = res.total > 0 || res.data.length === 0 ? res.total : res.data.length;
      this.loadingOrders = false;
    });
    this.dbService.getOrdersCountByBatch(this.selectedBatch.id!).subscribe(count => {
      this.batchOrderCount = count;
    });
    this.dbService.getBatchGrandTotal(this.selectedBatch.id!).subscribe(total => {
      this.orderBatchGrandTotal = total;
    });
  }

  onOrderTableSearchChange(query: Record<string, string>) {
    this.orderSearchTerm = (query['clientName'] || '').trim();
    this.onOrderSearch();
  }

  onOrderTableActionClick(event: { action: ActionOption; item: any }) {
    if (event.action.id === 'view') {
      this.viewOrder(event.item.order as Order);
      return;
    }

    if (event.action.id === 'delete') {
      this.deleteOrder(event.item.order as Order);
    }
  }

  onOrderSearch() {
    clearTimeout(this.orderSearchTimer);
    this.orderSearchTimer = setTimeout(() => {
      this.orderPage = 1;
      this.loadOrders();
    }, 500);
  }

  onOrderDateChange(range: { from: string; to: string }) {
    this.orderDateFrom = range.from;
    this.orderDateTo = range.to;
    this.orderPage = 1;
    this.loadOrders();
  }

  setOrderPage(p: number) {
    this.orderPage = p;
    this.loadOrders();
  }

  deleteOrder(order: Order) {
    if (!this.authService.canPerformOrdersOperation('canDeleteOrder')) return;
    if (this.selectedBatch?.status === 'closed'
      && !this.authService.canPerformOrdersOperation('canEditOrderAfterBatchClosed')) {
      alert('You do not have permission to delete orders after a batch is closed.');
      return;
    }
    if (!confirm(`Delete order #${order.id}? This cannot be undone.`)) return;
    this.deletingOrderIds.add(order.id!);
    this.dbService.deleteOrder(order.id!).subscribe(success => {
      this.deletingOrderIds.delete(order.id!);
      if (success) {
        // Remove immediately so the UI doesn't wait for the reload
        this.orders = this.orders.filter(o => o.id !== order.id);
        this.orderTotal = Math.max(0, this.orderTotal - 1);
        this.loadOrders();
      } else {
        alert('Failed to delete order. It may have already been deleted or you lack permission.');
      }
    });
  }

  // ────────────────────────────────────────────────────
  // CLIENTS & BATCH PRODUCTS
  // ────────────────────────────────────────────────────
  loadClients() {
    this.dbService.getClients().subscribe(clients => {
      this.clients = clients;
    });
  }

  loadBatchProducts(batchId: number) {
    this.dbService.getBatchProducts(batchId).subscribe(products => {
      this.batchProducts = products;
    });
  }

  // ────────────────────────────────────────────────────
  // ORDER MODAL
  // ────────────────────────────────────────────────────
  openCreateOrderModal() {
    if (!this.canCreateOrderInSelectedBatch) return;
    this.viewingOrder = null;
    this.orderViewLoading = false;
    this.orderForm = {
      clientId: null,
      notes: '',
      items: [this.blankItem()]
    };
    this.showAddClientForm = false;
    this.newClientForm = { name: '', phone: '' };
    this.showOrderModal = true;
  }

  viewOrder(order: Order) {
    this.viewingOrder = order;
    this.orderViewLoading = true;
    this.copySuccess = false;
    this.isAddingItemsToOrder = false;
    this.addItemsRows = [];
    this.showOrderModal = true;
    this.dbService.getOrderItems(order.id!).subscribe({
      next: items => {
        if (!this.viewingOrder || this.viewingOrder.id !== order.id) return;
        this.viewingOrder = {
          ...this.viewingOrder,
          items
        };
        this.orderViewLoading = false;
      },
      error: () => {
        this.orderViewLoading = false;
      }
    });
  }

  closeOrderModal() {
    this.showOrderModal = false;
    this.viewingOrder = null;
    this.orderViewLoading = false;
    this.savedOrderReceipt = null;
    this.copySuccess = false;
    this.isAddingItemsToOrder = false;
    this.addItemsRows = [];
  }

  onItemProductSelect(i: number, batchProductId: any) {
    const bp = this.batchProducts.find(p => p.id === batchProductId);
    if (bp) {
      this.orderForm.items[i].productId = bp.productId;
      this.orderForm.items[i].productName = bp.productName || '';
      this.recalcItem(i); // recalcItem will set the correct price tier
    }
  }

  recalcItem(i: number) {
    const item = this.orderForm.items[i];
    const bp = this.batchProducts.find(p => p.id === item.batchProductId);
    if (bp) {
      const discountActive = bp.preorderDiscountMinQty > 0 && item.quantity >= bp.preorderDiscountMinQty;
      item.unitPrice = discountActive ? (bp.preorderDiscountPrice || bp.preorderPrice) : (bp.preorderPrice || 0);
    }
    item.subtotal = +(item.quantity * item.unitPrice).toFixed(2);
  }

  getDiscountInfo(i: number): { hasDiscount: boolean; active: boolean; minQty: number; price: number } | null {
    const item = this.orderForm.items[i];
    const bp = this.batchProducts.find(p => p.id === item.batchProductId);
    if (!bp || !bp.preorderDiscountMinQty) return null;
    return {
      hasDiscount: true,
      active: item.quantity >= bp.preorderDiscountMinQty,
      minQty: bp.preorderDiscountMinQty,
      price: bp.preorderDiscountPrice
    };
  }

  addItem() {
    this.orderForm.items.push(this.blankItem());
  }

  removeItem(i: number) {
    if (this.orderForm.items.length > 1) {
      this.orderForm.items.splice(i, 1);
    }
  }

  blankItem() {
    return { batchProductId: null, productId: null, productName: '', quantity: 1, unitPrice: 0, subtotal: 0 };
  }

  // ────────────────────────────────────────────────────
  // ADD ITEMS TO EXISTING ORDER
  // ────────────────────────────────────────────────────
  startAddItemsToOrder() {
    if (!this.canAddItemsToViewingOrder) return;
    this.addItemsRows = [this.blankItem()];
    this.isAddingItemsToOrder = true;
  }

  cancelAddItemsToOrder() {
    this.isAddingItemsToOrder = false;
    this.addItemsRows = [];
  }

  addItemRow() {
    this.addItemsRows.push(this.blankItem());
  }

  removeAddItemRow(i: number) {
    if (this.addItemsRows.length > 1) {
      this.addItemsRows.splice(i, 1);
    }
  }

  onAddItemProductSelect(i: number, batchProductId: any) {
    const bp = this.batchProducts.find(p => p.id === batchProductId);
    if (bp) {
      this.addItemsRows[i].productId = bp.productId;
      this.addItemsRows[i].productName = bp.productName || '';
      this.recalcAddItem(i);
    }
  }

  recalcAddItem(i: number) {
    const item = this.addItemsRows[i];
    const bp = this.batchProducts.find(p => p.id === item.batchProductId);
    if (bp) {
      const discountActive = bp.preorderDiscountMinQty > 0 && item.quantity >= bp.preorderDiscountMinQty;
      item.unitPrice = discountActive ? (bp.preorderDiscountPrice || bp.preorderPrice) : (bp.preorderPrice || 0);
    }
    item.subtotal = +(item.quantity * item.unitPrice).toFixed(2);
  }

  saveAddedItems() {
    if (!this.viewingOrder?.id || this.savingAddItems) return;
    if (!this.canAddItemsToViewingOrder) return;
    const validItems = this.addItemsRows.filter(i => i.productId);
    if (!validItems.length) return;
    this.savingAddItems = true;
    const orderId = this.viewingOrder.id!;
    const saves = validItems.map(item =>
      this.dbService.addOrderItem({
        orderId,
        productId: item.productId!,
        batchProductId: item.batchProductId || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal
      }).toPromise()
    );
    Promise.all(saves).then(() => {
      const newItems: any[] = validItems.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal
      }));
      const addedTotal = validItems.reduce((s, i) => s + i.subtotal, 0);
      this.viewingOrder = {
        ...this.viewingOrder!,
        items: [...(this.viewingOrder!.items || []), ...newItems],
        totalAmount: (this.viewingOrder!.totalAmount || 0) + addedTotal
      };
      this.savingAddItems = false;
      this.isAddingItemsToOrder = false;
      this.addItemsRows = [];
      this.loadOrders();
    });
  }

  saveOrder() {
    if (!this.orderForm.clientId || this.savingOrder) return;
    if (!this.canCreateOrderInSelectedBatch) return;
    this.savingOrder = true;

    const newItems = this.orderForm.items.filter(i => i.productId);
    const savedClient = this.clients.find(c => c.id === this.orderForm.clientId);

    // Check if this client already has an order in the selected batch
    this.dbService.findOrderByClientBatch(
      this.orderForm.clientId!,
      this.selectedBatch!.id!
    ).subscribe(existingOrder => {
      if (existingOrder) {
        // ── MERGE into existing order ──────────────────────────────
        const mergePromises = newItems.map(item => {
          const existingItem = existingOrder.items.find(ei => ei.productId === item.productId);
          if (existingItem?.id) {
            // Same product → increment quantity
            const newQty = existingItem.quantity + item.quantity;
            const newSubtotal = +(newQty * item.unitPrice).toFixed(2);
            return this.dbService.updateOrderItem(existingItem.id, newQty, newSubtotal).toPromise();
          } else {
            // New product → add item
            return this.dbService.addOrderItem({
              orderId: existingOrder.id!,
              productId: item.productId!,
              batchProductId: item.batchProductId || undefined,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal
            }).toPromise();
          }
        });
        Promise.all(mergePromises).then(() => {
          this.savingOrder = false;
          // Build merged items for the receipt display
          const mergedItems = existingOrder.items.map(ei => ({ ...ei }));
          for (const item of newItems) {
            const idx = mergedItems.findIndex(ei => ei.productId === item.productId);
            if (idx >= 0) {
              const newQty = mergedItems[idx].quantity + item.quantity;
              mergedItems[idx] = { ...mergedItems[idx], quantity: newQty, subtotal: +(newQty * item.unitPrice).toFixed(2) };
            } else {
              mergedItems.push({ productId: item.productId!, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal, productName: item.productName });
            }
          }
          this.savedOrderReceipt = {
            orderId: existingOrder.id!,
            clientName: savedClient?.name || existingOrder.clientName || 'Customer',
            clientPhone: savedClient?.phone || (savedClient as any)?.whatsappNumber || existingOrder.clientPhone || '',
            batchName: this.selectedBatch?.name || '',
            items: mergedItems.map(i => ({ productName: (i as any).productName || '', quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal })),
            total: mergedItems.reduce((s, i) => s + (i.subtotal || 0), 0),
            addedToExisting: true
          };
          this.loadOrders();
        });
      } else {
        // ── CREATE new order ───────────────────────────────────────
        const savedItems = newItems.map(i => ({
          productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal
        }));
        const order: Order = {
          clientId: this.orderForm.clientId!,
          batchId: this.selectedBatch?.id,
          notes: this.orderForm.notes,
          totalAmount: this.orderFormTotal,
          paymentStatus: 'paid',
          items: newItems.map(i => ({
            productId: i.productId!,
            batchProductId: i.batchProductId || undefined,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal
          }))
        };
        this.dbService.createOrder(order).subscribe(orderId => {
          if (!orderId) { this.savingOrder = false; return; }
          const itemSaves = order.items.map(item =>
            this.dbService.addOrderItem({ ...item, orderId }).toPromise()
          );
          Promise.all(itemSaves).then(() => {
            this.savingOrder = false;
            this.savedOrderReceipt = {
              orderId,
              clientName: savedClient?.name || 'Customer',
              clientPhone: savedClient?.phone || (savedClient as any)?.whatsappNumber || '',
              batchName: this.selectedBatch?.name || '',
              items: savedItems,
              total: order.totalAmount || 0,
              addedToExisting: false
            };
            this.loadOrders();
          });
        });
      }
    });
  }

  // ────────────────────────────────────────────────────
  // RECEIPT HELPERS
  // ────────────────────────────────────────────────────

  buildReceiptText(): string {
    const sn = this.shopConfig.shopName;
    const year = this.currentYear;

    if (this.savedOrderReceipt) {
      const r = this.savedOrderReceipt;
      const lines = r.items.map(i =>
        `  • ${i.productName} x${i.quantity} @ GHS ${i.unitPrice.toFixed(2)} = GHS ${i.subtotal.toFixed(2)}`
      ).join('\n');
      return [
        `Hello, thank you for ordering from ${sn}, your order has been confirmed.`,
        ``,
        `Order ID: #${r.orderId}`,
        `Batch: ${r.batchName}`,
        ``,
        `Items:`,
        lines,
        ``,
        `Total: GHS ${r.total.toFixed(2)}`,
        ``,
        `We will contact you once your items arrive.`,
        `© ${sn} - ${year}`
      ].join('\n');
    }

    if (this.viewingOrder) {
      const o = this.viewingOrder;
      const lines = (o.items || []).map(i =>
        `  • ${i.productName} x${i.quantity} @ GHS ${i.unitPrice.toFixed(2)} = GHS ${i.subtotal.toFixed(2)}`
      ).join('\n');
      return [
        `Hello, thank you for ordering from ${sn}, your order has been confirmed.`,
        ``,
        `Order ID: #${o.id}`,
        `Batch: ${this.selectedBatch?.name || ''}`,
        ``,
        `Items:`,
        lines,
        ``,
        `Total: GHS ${(o.totalAmount || 0).toFixed(2)}`,
        ``,
        `We will contact you once your items arrive.`,
        `© ${sn} - ${year}`
      ].join('\n');
    }

    return '';
  }

  copyReceipt() {
    navigator.clipboard.writeText(this.buildReceiptText()).then(() => {
      this.copySuccess = true;
      setTimeout(() => this.copySuccess = false, 2200);
    });
  }

  sendWhatsappReceipt() {
    const phone = this.savedOrderReceipt
      ? (this.savedOrderReceipt.clientPhone || '').replace(/\s+/g, '').replace(/^\+/, '')
      : (this.viewingOrder?.clientPhone || '').replace(/\s+/g, '').replace(/^\+/, '');
    const text = encodeURIComponent(this.buildReceiptText());
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  // ────────────────────────────────────────────────────
  // PRODUCT SUMMARY
  // ────────────────────────────────────────────────────
  get summaryProductName() {
    if (!this.summaryProductId) return '';
    return this.batchProducts.find(p => p.productId === this.summaryProductId)?.productName || '';
  }

  get summaryTotalQty() {
    return this.summaryRows.reduce((s, r) => s + r.quantity, 0);
  }

  openProductSummary() {
    this.summaryProductId = null;
    this.summaryRows = [];
    this.loadingSummary = false;
    this.summaryCopySuccess = false;
    this.showProductSummaryModal = true;
  }

  closeProductSummary() {
    this.showProductSummaryModal = false;
    this.summaryProductId = null;
    this.summaryRows = [];
    this.summaryCopySuccess = false;
  }

  onSummaryProductChange(productId: any) {
    this.summaryProductId = productId ? +productId : null;
    this.summaryRows = [];
    if (!this.summaryProductId || !this.selectedBatch?.id) return;
    this.loadingSummary = true;
    this.dbService.getClientsByProduct(this.selectedBatch.id, this.summaryProductId).subscribe(rows => {
      this.summaryRows = rows;
      this.loadingSummary = false;
    });
  }

  buildSummaryText(): string {
    const name = this.summaryProductName;
    const lines = this.summaryRows.map((r, i) =>
      `${i + 1}. ${r.clientName}${r.clientPhone ? ' (' + r.clientPhone + ')' : ''} — ${r.quantity} unit${r.quantity !== 1 ? 's' : ''}`
    ).join('\n');
    return [
      `Order list for ${name}`,
      ``,
      lines,
      ``,
      `Total: ${this.summaryTotalQty} unit${this.summaryTotalQty !== 1 ? 's' : ''}`
    ].join('\n');
  }

  copyProductSummary() {
    navigator.clipboard.writeText(this.buildSummaryText()).then(() => {
      this.summaryCopySuccess = true;
      setTimeout(() => this.summaryCopySuccess = false, 2200);
    });
  }

  whatsappProductSummary() {
    const text = encodeURIComponent(this.buildSummaryText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }
  // ────────────────────────────────────────────────────
  saveNewClient() {
    if (!this.newClientForm.name.trim() || this.savingClient) return;
    this.savingClient = true;
    const client: Client = {
      name: this.newClientForm.name.trim(),
      phone: this.newClientForm.phone.trim(),
      whatsappNumber: this.newClientForm.phone.trim()
    };
    this.dbService.createClient(client).subscribe(id => {
      this.savingClient = false;
      if (id) {
        const newClient = { ...client, id };
        this.clients = [...this.clients, newClient];
        this.orderForm.clientId = id;
        this.showAddClientForm = false;
        this.newClientForm = { name: '', phone: '' };
      }
    });
  }

  // ────────────────────────────────────────────────────
  // CLOSE / REOPEN BATCH
  // ────────────────────────────────────────────────────
  openCloseBatchModal() {
    if (!this.authService.canPerformOrdersOperation('canCloseBatch')) return;
    this.closingBatch = false;
    this.syncCloseBatchButtons();
    if (this.selectedBatch?.id) {
      this.dbService.getOrdersCountByBatch(this.selectedBatch.id).subscribe(count => {
        this.batchOrderCount = count;
      });
    }
    this.showCloseBatchModal = true;
  }

  onCloseBatchModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.showCloseBatchModal = false;
      return;
    }

    if (button.action === 'confirm' && !this.closingBatch) {
      this.closeBatch();
    }
  }

  closeBatch() {
    if (!this.selectedBatch || this.closingBatch) return;
    if (!this.authService.canPerformOrdersOperation('canCloseBatch')) return;
    this.closingBatch = true;
    this.syncCloseBatchButtons();
    this.dbService.sendBatchToBuyingList(this.selectedBatch.id!, this.selectedBatch.name).subscribe(() => {
      this.dbService.closeOrderBatch(this.selectedBatch!.id!).subscribe(() => {
        this.closingBatch = false;
        this.syncCloseBatchButtons();
        this.showCloseBatchModal = false;
        this.selectedBatch = { ...this.selectedBatch!, status: 'closed' };
      });
    });
  }

  reopenBatch() {
    if (!this.selectedBatch || !confirm(`Reopen batch "${this.selectedBatch.name}"?`)) return;
    if (!this.authService.canPerformOrdersOperation('canReopenBatch')) return;
    this.dbService.reopenOrderBatch(this.selectedBatch.id!).subscribe(() => {
      this.selectedBatch = { ...this.selectedBatch!, status: 'open' };
    });
  }

  private syncCloseBatchButtons() {
    this.closeBatchButtons = [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.closingBatch },
      { buttonName: 'Close Batch', color: 'base_color', action: 'confirm', disabled: this.closingBatch, loading: this.closingBatch }
    ];
  }
}
