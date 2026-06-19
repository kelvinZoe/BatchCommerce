import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { BatchCardComponent } from '../../components/batch-card/batch-card.component';
import { MonthYearPickerComponent } from '../../components/month-year-picker/month-year-picker.component';
import { SearchableSelectComponent } from '../../components/searchable-select/searchable-select.component';
import { ModalButtonConfig, ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { BatchDetailHeaderComponent, BatchDetailHeaderTagConfig } from '../../components/batch-detail-header/batch-detail-header.component';
import { TableComponent, TableColumn, TableMetadata, TableFilterConfig, ActionOption } from '../../components/table/table.component';
import { BatchProduct, OrderBatch, ProductCatalog, ProductPermissionConfig } from '../../models';

interface PriceChangePreviewItem {
  id: number;
  orderId?: number;
  saleId?: number;
  customerName: string;
  quantity: number;
  currentPrice: number;
  newPrice: number;
  oldTotal: number;
  newTotal: number;
  type: 'Preorder' | 'Stock Sale';
}

interface PriceChangePreview {
  affectedRecordCount?: number;
  affectedOrderCount?: number;
  affectedPreorderItemCount?: number;
  affectedStockSaleItemCount?: number;
  affectedOrders: PriceChangePreviewItem[];
  totalCostChange: number;
}

interface PendingPriceUpdate {
  batchProductId: number;
  preorderPrice: number;
  preorderDiscountMinQty: number;
  preorderDiscountPrice: number;
  stockPrice: number;
  stockDiscountMinQty: number;
  stockDiscountPrice: number;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, BatchCardComponent, MonthYearPickerComponent, SearchableSelectComponent, ModalShellComponent, TableComponent, BatchDetailHeaderComponent],
  template: `
    <div class="pp-page">

      <!-- ══ PAGE HEADER ══ -->
      <div class="pp-header">
        <div class="pp-header-left">
          <div class="pp-header-icon"><span class="material-icons">inventory_2</span></div>
          <div>
            <h1 class="pp-header-title">Products &amp; Inventory</h1>
            <p class="pp-header-sub">{{ mainTab === 'batches' ? 'Create batches and manage batch-specific pricing' : 'Manage your product catalog' }}</p>
          </div>
        </div>
        <div class="pp-header-actions">
          <div class="pp-tab-toggle">
            <button class="pp-tab-btn" [class.pp-tab-active]="mainTab === 'batches'" (click)="mainTab = 'batches'">
              <span class="material-icons">folder</span> Batches &amp; Products
            </button>
            <button class="pp-tab-btn" [class.pp-tab-active]="mainTab === 'manage-products'" (click)="mainTab = 'manage-products'">
              <span class="material-icons">store</span> Manage Products
            </button>
          </div>
          <button *ngIf="mainTab === 'batches' && activeTab === 'batches' && authService.canPerformProductOperation('canAddBatch')"
                  class="pp-btn pp-btn-primary" (click)="openBatchModal()">
            <span class="material-icons">add</span> New Batch
          </button>
          <button *ngIf="mainTab === 'batches' && activeTab === 'products' && selectedBatch && authService.canPerformProductOperation('canAddProductToBatch')"
                  class="pp-btn pp-btn-primary" (click)="openBatchProductModal()"
                  [disabled]="savingBatchProduct">
            <span class="material-icons">add</span> Add Product
          </button>
          <button *ngIf="mainTab === 'manage-products' && authService.can('create', 'products')"
                  class="pp-btn pp-btn-primary" (click)="openProductModal()">
            <span class="material-icons">add</span> Add Product
          </button>
        </div>
      </div>

      <div class="pp-card">

        <!-- ══ BATCHES & PRODUCTS VIEW ══ -->
        <ng-container *ngIf="mainTab === 'batches'">
        <ng-container *ngIf="loadingBatches && activeTab === 'batches'">
          <div class="pp-skeleton-grid">
            <div class="pp-skeleton-batch-card" *ngFor="let i of [1,2,3,4,5,6]">
              <div class="pp-sk pp-sk-icon"></div>
              <div class="pp-sk-body">
                <div class="pp-sk pp-sk-line pp-sk-line-lg"></div>
                <div class="pp-sk pp-sk-line pp-sk-line-sm"></div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ══ BATCH LIST VIEW ══ -->
        <div *ngIf="activeTab === 'batches' && !loadingBatches">

          <!-- Toolbar -->
          <div class="pp-toolbar">
            <div class="pp-search-wrap">
              <span class="material-icons pp-search-icon">search</span>
              <input class="pp-search-input" type="text" placeholder="Search batches…"
                     [(ngModel)]="batchSearchTerm" (input)="onBatchSearch()" />
            </div>
            <app-month-year-picker
              [selectedMonth]="batchFilterMonth"
              [selectedYear]="batchFilterYear"
              [currentYear]="currentYear"
              (selectionChange)="onBatchMonthYearChange($event)">
            </app-month-year-picker>
          </div>

          <!-- Empty state -->
          <div *ngIf="filteredBatches.length === 0" class="pp-empty">
            <div class="pp-empty-icon"><span class="material-icons">folder_open</span></div>
            <h3>No batches yet</h3>
            <p>Create your first batch to start adding products with specific pricing.</p>
            <button class="pp-btn pp-btn-primary" *ngIf="authService.canPerformProductOperation('canAddBatch')" (click)="openBatchModal()">
              <span class="material-icons">add</span> Create Batch
            </button>
          </div>

          <!-- Batch card grid -->
          <div *ngIf="filteredBatches.length > 0" class="pp-batch-grid">
            <app-batch-card
              *ngFor="let batch of filteredBatches"
              [title]="batch.name"
              [subtitle]="batch.createdAt ? (batch.createdAt | date:'mediumDate') : ''"
              [icon]="batch.status === 'open' ? 'folder_open' : 'folder'"
              [tag]="batch.status === 'open'
                ? { tagName: 'Open', color: 'green', icon: 'check_circle' }
                : { tagName: 'Closed', color: 'gray', icon: 'task_alt' }"
              [active]="selectedBatch?.id === batch.id"
              [iconMuted]="false"
              (cardClick)="viewBatchProducts(batch)">
              <button batchCardFooter class="pp-card-action-btn pp-cab-primary pp-batch-open-btn" (click)="$event.stopPropagation(); viewBatchProducts(batch)">
                Open <span class="material-icons">chevron_right</span>
              </button>
            </app-batch-card>
          </div>

          <!-- Pagination -->
          <div class="pp-pagination" *ngIf="batchTotal > batchPageSize">
            <span class="pp-pg-info">{{ batchRangeStart }}–{{ batchRangeEnd }} of {{ batchTotal }}</span>
            <div class="pp-pg-btns">
              <button (click)="setBatchPage(1)" [disabled]="batchPage === 1"><span class="material-icons">first_page</span></button>
              <button (click)="setBatchPage(batchPage - 1)" [disabled]="batchPage === 1"><span class="material-icons">chevron_left</span></button>
              <span class="pp-pg-cur">{{ batchPage }} / {{ totalBatchPages }}</span>
              <button (click)="setBatchPage(batchPage + 1)" [disabled]="batchPage >= totalBatchPages"><span class="material-icons">chevron_right</span></button>
              <button (click)="setBatchPage(totalBatchPages)" [disabled]="batchPage >= totalBatchPages"><span class="material-icons">last_page</span></button>
            </div>
          </div>
        </div>

        <!-- ══ BATCH DETAIL VIEW ══ -->
        <div *ngIf="activeTab === 'products'">

          <!-- Back bar + batch info -->
          <app-batch-detail-header
            [backLabel]="'All Batches'"
            [title]="selectedBatch?.name || ''"
            [subtitle]="selectedBatch?.createdAt ? (selectedBatch!.createdAt | date:'mediumDate') : ''"
            [icon]="selectedBatch?.status === 'open' ? 'folder_open' : 'folder'"
            [tag]="selectedProductBatchHeaderTag"
            (backClick)="activeTab = 'batches'">
          </app-batch-detail-header>

          <!-- Product table -->
          <app-table
            [columns]="batchProductsColumns"
            [data]="batchProductsTableRows"
            [metadata]="batchProductsMetadata"
            [showSearchRow]="true"
            [initialLoading]="loadingBatchProducts && batchProductsTableRows.length === 0"
            [searching]="loadingBatchProducts && batchProductsTableRows.length > 0"
            [skeletonRows]="5"
            [tableLabel]="'Batch Products'"
            [summaryLabel]="'Items'"
            [summaryValue]="batchProductsTotal"
            [baseColor]="baseColor"
            (searchChange)="onBatchProductSearchChange($event)"
            (actionClick)="onBatchProductActionClick($event)"
            (pageChange)="setBatchProductsPage($event)">
          </app-table>

        </div>
        </ng-container>

        <!-- ══ MANAGE PRODUCTS (CATALOG) VIEW ══ -->
        <ng-container *ngIf="mainTab === 'manage-products'">

          <!-- Catalog toolbar -->
          <div class="pp-toolbar" *ngIf="!loadingCatalog">
            <!-- Bulk delete button -->
            <button *ngIf="selectedProductIds.size > 0 && authService.can('delete', 'products')"
                    class="pp-btn pp-btn-danger" (click)="openBulkDeleteModal()"
                    [disabled]="bulkDeleting">
              <span class="material-icons" *ngIf="!bulkDeleting">delete_outline</span>
              <span class="pp-spinner" *ngIf="bulkDeleting"></span>
              Delete {{ selectedProductIds.size }} Product{{ selectedProductIds.size !== 1 ? 's' : '' }}
            </button>
          </div>

          <!-- Products table -->
          <app-table
            *ngIf="loadingCatalog || filteredCatalog.length > 0"
            [columns]="catalogColumns"
            [data]="catalogTableRows"
            [metadata]="catalogMetadata"
            [showSearchRow]="true"
            [initialLoading]="loadingCatalog && catalogTableRows.length === 0"
            [searching]="loadingCatalog && catalogTableRows.length > 0"
            [skeletonRows]="5"
            [filters]="catalogFilters"
            [tableLabel]="'Product Catalog'"
            [summaryLabel]="'Products'"
            [summaryValue]="catalogTotal"
            [baseColor]="baseColor"
            (searchChange)="onCatalogSearchChange($event)"
            (filterChange)="onCatalogFilterChange($event)"
            (actionClick)="onCatalogActionClick($event)"
            (pageChange)="setCatalogPage($event)">
          </app-table>

          <!-- Empty products state -->
          <div *ngIf="!loadingCatalog && filteredCatalog.length === 0" class="pp-empty">
            <div class="pp-empty-icon"><span class="material-icons">inventory</span></div>
            <h3>No products yet</h3>
            <p>Create your first product in the catalog to get started.</p>
            <button class="pp-btn pp-btn-primary" *ngIf="authService.can('create', 'products')" (click)="openProductModal()">
              <span class="material-icons">add</span> Add Product
            </button>
          </div>

        </ng-container>

      </div><!-- /pp-card -->

      <!-- ══ CREATE / EDIT BATCH MODAL ══ -->
      <app-modal-shell
        *ngIf="showBatchModal"
        size="sm"
        [title]="editingBatch ? 'Rename Batch' : 'New Batch'"
        [subtitle]="editingBatch ? 'Update the batch name below' : 'Give your batch a descriptive name'"
        [icon]="editingBatch ? 'edit_square' : 'create_new_folder'"
        [showClose]="!savingBatch"
        [closeOnBackdrop]="!savingBatch"
        [buttons]="batchModalButtons"
        (closeRequested)="closeBatchModal()"
        (buttonClick)="onBatchModalButton($event)">
        <div modal-body>
          <div class="pp-form-group">
            <label class="pp-label">Batch Name <span class="pp-required">*</span></label>
            <input class="pp-input" type="text" [(ngModel)]="newBatchName"
                   placeholder="e.g., January 2026 Batch"
                   [disabled]="savingBatch || !canEditCurrentBatchName" />
          </div>
        </div>
      </app-modal-shell>

      <!-- ══ ADD / EDIT BATCH PRODUCT MODAL ══ -->
      <app-modal-shell
        *ngIf="showBatchProductModal"
        size="lg"
        [title]="editingBatchProduct ? 'Edit Product' : 'Add Product to Batch'"
        [subtitle]="selectedBatch?.name || ''"
        [icon]="editingBatchProduct ? 'edit_square' : 'inventory_2'"
        [showClose]="!savingBatchProduct"
        [closeOnBackdrop]="!savingBatchProduct"
        [buttons]="batchProductModalButtons"
        (closeRequested)="closeBatchProductModal()"
        (buttonClick)="onBatchProductModalButton($event)">
        <div modal-body>

            <!-- Product source toggle -->
            <div class="pp-pill-toggle" *ngIf="!editingBatchProduct">
              <button class="pp-pill" [class.pp-pill-active]="useExistingProduct" (click)="switchToExistingProductMode()">
                <span class="material-icons">search</span> Existing Product
              </button>
              <button class="pp-pill" [class.pp-pill-active]="!useExistingProduct" (click)="switchToNewProductMode()">
                <span class="material-icons">add</span> New Product
              </button>
            </div>

            <!-- Editing: show product name as readonly -->
            <div class="pp-form-group" *ngIf="editingBatchProduct">
              <label class="pp-label">Product</label>
              <div class="pp-readonly">{{ editingBatchProduct.productName }}</div>
            </div>

            <!-- Select existing product -->
            <div *ngIf="!editingBatchProduct && useExistingProduct" class="pp-form-group">
              <label class="pp-label">Select Product <span class="pp-required">*</span></label>
              <app-searchable-select
                [items]="productCatalog"
                labelKey="name"
                valueKey="id"
                placeholder="Search and select a product…"
                searchPlaceholder="Type to search…"
                noResultsText="No products found"
                [(ngModel)]="selectedCatalogProductId"
                (ngModelChange)="onExistingProductSelected($event)"
                (searchChange)="onExistingProductSearch($event)">
              </app-searchable-select>
              <!-- Loading indicator -->
              <div class="pp-existing-loading" *ngIf="loadingExistingProduct">
                <span class="pp-spinner pp-spinner-sm"></span> Loading latest pricing…
              </div>
              <div class="pp-existing-loading" *ngIf="loadingProductCatalog">
                <span class="pp-spinner pp-spinner-sm"></span> Loading products…
              </div>
              <!-- Stock badge once a product is selected -->
              <div class="pp-stock-badge" *ngIf="!loadingExistingProduct && selectedCatalogProductId && existingProductStock !== null">
                <span class="material-icons">inventory</span>
                <span *ngIf="existingProductStock > 0">{{ existingProductStock }} item{{ existingProductStock !== 1 ? 's' : '' }} currently in stock</span>
                <span *ngIf="existingProductStock === 0" class="pp-stock-none">No stock currently available</span>
              </div>
            </div>

            <!-- Create new product fields -->
            <div *ngIf="!editingBatchProduct && !useExistingProduct">
              <div class="pp-form-group">
                <label class="pp-label">Product Name <span class="pp-required">*</span></label>
                <input class="pp-input" type="text" [(ngModel)]="productForm.name" placeholder="Enter product name" />
              </div>
              <div class="pp-form-group">
                <label class="pp-label">Description <span class="pp-optional">(optional)</span></label>
                <textarea class="pp-textarea" [(ngModel)]="productForm.description" placeholder="Brief description…" rows="2"></textarea>
              </div>
            </div>

            <!-- Pricing sections -->
            <div class="pp-section-divider">
              <span class="pp-section-label">Preorder Pricing</span>
            </div>
            <div class="pp-form-row">
              <div class="pp-form-group">
                <label class="pp-label">Price (GHS)</label>
                <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="batchProductForm.preorderPrice" (focus)="clearIfZero('preorderPrice')" min="0" [disabled]="!canEditBatchProductPricingFields" /></div>
              </div>
              <div class="pp-form-group">
                <label class="pp-label">Discount from qty</label>
                <input class="pp-input" type="number" [(ngModel)]="batchProductForm.preorderDiscountMinQty" (focus)="clearIfZero('preorderDiscountMinQty')" min="0" placeholder="0 = no discount" [disabled]="!canEditBatchProductPricingFields" />
              </div>
              <div class="pp-form-group">
                <label class="pp-label">Discount Price (GHS)</label>
                <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="batchProductForm.preorderDiscountPrice" (focus)="clearIfZero('preorderDiscountPrice')" min="0" [disabled]="!canEditBatchProductPricingFields" /></div>
              </div>

              <!-- Preorder Discount Explainer -->
              <div class="pp-discount-explainer" *ngIf="batchProductForm.preorderPrice > 0 && batchProductForm.preorderDiscountMinQty > 0 && batchProductForm.preorderDiscountPrice > 0 && batchProductForm.preorderDiscountPrice <= batchProductForm.preorderPrice">
                <span class="material-icons">info_outline</span>
                <span>
                  Unit price drops to <strong>GHS {{ batchProductForm.preorderDiscountPrice }}</strong> when buying <strong>{{ batchProductForm.preorderDiscountMinQty }}</strong>+ items. Total cost: <strong>GHS {{ batchProductForm.preorderDiscountMinQty * batchProductForm.preorderDiscountPrice }}</strong> (saves GHS {{ (batchProductForm.preorderPrice - batchProductForm.preorderDiscountPrice) * batchProductForm.preorderDiscountMinQty }}).
                </span>
              </div>
              <div class="pp-discount-warning" *ngIf="batchProductForm.preorderDiscountPrice > batchProductForm.preorderPrice">
                <span class="material-icons">warning</span>
                <span>
                  <strong>Caution:</strong> The discount price (GHS {{ batchProductForm.preorderDiscountPrice }}) is greater than the regular price (GHS {{ batchProductForm.preorderPrice }}). Did you enter the total amount instead of the discounted <strong>unit price</strong> (e.g. GHS 19 instead of GHS 190)?
                </span>
              </div>
            </div>

            <div class="pp-section-divider">
              <span class="pp-section-label">Available Stock Pricing</span>
            </div>
            <div class="pp-form-row">
              <div class="pp-form-group">
                <label class="pp-label">Stock Price (GHS)</label>
                <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="batchProductForm.stockPrice" (focus)="clearIfZero('stockPrice')" min="0" [disabled]="!canEditBatchProductPricingFields" /></div>
              </div>
              <div class="pp-form-group">
                <label class="pp-label">Discount from qty</label>
                <input class="pp-input" type="number" [(ngModel)]="batchProductForm.stockDiscountMinQty" (focus)="clearIfZero('stockDiscountMinQty')" min="0" placeholder="0 = no discount" [disabled]="!canEditBatchProductPricingFields" />
              </div>
              <div class="pp-form-group">
                <label class="pp-label">Discount Price (GHS)</label>
                <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="batchProductForm.stockDiscountPrice" (focus)="clearIfZero('stockDiscountPrice')" min="0" [disabled]="!canEditBatchProductPricingFields" /></div>
              </div>

              <!-- Stock Discount Explainer -->
              <div class="pp-discount-explainer" *ngIf="batchProductForm.stockPrice > 0 && batchProductForm.stockDiscountMinQty > 0 && batchProductForm.stockDiscountPrice > 0 && batchProductForm.stockDiscountPrice <= batchProductForm.stockPrice">
                <span class="material-icons">info_outline</span>
                <span>
                  Unit price drops to <strong>GHS {{ batchProductForm.stockDiscountPrice }}</strong> when buying <strong>{{ batchProductForm.stockDiscountMinQty }}</strong>+ items. Total cost: <strong>GHS {{ batchProductForm.stockDiscountMinQty * batchProductForm.stockDiscountPrice }}</strong> (saves GHS {{ (batchProductForm.stockPrice - batchProductForm.stockDiscountPrice) * batchProductForm.stockDiscountMinQty }}).
                </span>
              </div>
              <div class="pp-discount-warning" *ngIf="batchProductForm.stockDiscountPrice > batchProductForm.stockPrice">
                <span class="material-icons">warning</span>
                <span>
                  <strong>Caution:</strong> The discount price (GHS {{ batchProductForm.stockDiscountPrice }}) is greater than the regular price (GHS {{ batchProductForm.stockPrice }}). Did you enter the total amount instead of the discounted <strong>unit price</strong> (e.g. GHS 19 instead of GHS 190)?
                </span>
              </div>
            </div>

            <div class="pp-section-divider">
              <span class="pp-section-label">Inventory</span>
            </div>
            <div class="pp-form-row pp-form-row-narrow">
              <div class="pp-form-group">
                <label class="pp-label">In Stock Quantity</label>
                <!-- Existing product: read-only, system-managed -->
                <ng-container *ngIf="useExistingProduct && !editingBatchProduct">
                  <div class="pp-readonly pp-readonly-stock">
                    <span class="material-icons">inventory_2</span>
                    {{ batchProductForm.inStockQty }}
                    <span class="pp-readonly-hint">auto-filled from current stock</span>
                  </div>
                </ng-container>
                <!-- New product or editing: editable -->
                <input *ngIf="!useExistingProduct || editingBatchProduct"
                  class="pp-input" type="number" [(ngModel)]="batchProductForm.inStockQty" (focus)="clearIfZero('inStockQty')" min="0" [disabled]="!canEditBatchProductPricingFields" />
              </div>
            </div>

          </div>
          <div *ngIf="batchProductAddError" class="pp-modal-error">
            <span class="material-icons">error_outline</span>
            {{ batchProductAddError }}
          </div>
      </app-modal-shell>

      <!-- ══ ADD / EDIT PRODUCT CATALOG MODAL ══ -->
      <app-modal-shell
        *ngIf="showProductModal"
        size="sm"
        [title]="editingProduct ? 'Edit Product' : 'Add Product'"
        [subtitle]="editingProduct ? 'Update product information' : 'Add a new product to your catalog'"
        [icon]="editingProduct ? 'edit_square' : 'add_business'"
        [showClose]="!savingProduct"
        [closeOnBackdrop]="!savingProduct"
        [buttons]="productModalButtons"
        (closeRequested)="closeProductModal()"
        (buttonClick)="onProductModalButton($event)">
        <div modal-body>
          <div class="pp-form-group">
            <label class="pp-label">Product Name <span class="pp-required">*</span></label>
            <input class="pp-input" type="text" [(ngModel)]="productFormData.name"
                   placeholder="Enter product name" />
          </div>
          <div class="pp-form-group">
            <label class="pp-label">Description <span class="pp-optional">(optional)</span></label>
            <textarea class="pp-textarea" [(ngModel)]="productFormData.description"
                      placeholder="Brief description of the product…" rows="2"></textarea>
          </div>
          <div class="pp-form-group">
            <label class="pp-label">Current Stock</label>
            <input class="pp-input" type="number" [(ngModel)]="productFormData.stock"
                   min="0" placeholder="0" (focus)="clearProductFieldIfZero('stock', $event)" />
          </div>
          <div class="pp-section-divider">
            <span class="pp-section-label">Available Stock Pricing</span>
          </div>
          <div class="pp-form-row">
            <div class="pp-form-group">
              <label class="pp-label">Stock Price (GHS)</label>
              <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="productFormData.stockPrice" min="0" (focus)="clearProductFieldIfZero('stockPrice', $event)" /></div>
            </div>
            <div class="pp-form-group">
              <label class="pp-label">Discount from qty</label>
              <input class="pp-input" type="number" [(ngModel)]="productFormData.stockDiscountMinQty" min="0" placeholder="0 = no discount" (focus)="clearProductFieldIfZero('stockDiscountMinQty', $event)" />
            </div>
            <div class="pp-form-group">
              <label class="pp-label">Discount Price (GHS)</label>
              <div class="pp-input-prefix"><span>GHS</span><input class="pp-input pp-input-prefixed" type="number" [(ngModel)]="productFormData.stockDiscountPrice" min="0" (focus)="clearProductFieldIfZero('stockDiscountPrice', $event)" /></div>
            </div>

            <!-- Catalog Stock Discount Explainer -->
            <div class="pp-discount-explainer" *ngIf="productFormData.stockPrice > 0 && productFormData.stockDiscountMinQty > 0 && productFormData.stockDiscountPrice > 0 && productFormData.stockDiscountPrice <= productFormData.stockPrice">
              <span class="material-icons">info_outline</span>
              <span>
                Unit price drops to <strong>GHS {{ productFormData.stockDiscountPrice }}</strong> when buying <strong>{{ productFormData.stockDiscountMinQty }}</strong>+ items. Total cost: <strong>GHS {{ productFormData.stockDiscountMinQty * productFormData.stockDiscountPrice }}</strong> (saves GHS {{ (productFormData.stockPrice - productFormData.stockDiscountPrice) * productFormData.stockDiscountMinQty }}).
              </span>
            </div>
             <div class="pp-discount-warning" *ngIf="productFormData.stockDiscountPrice > productFormData.stockPrice">
              <span class="material-icons">warning</span>
              <span>
                <strong>Caution:</strong> The discount price (GHS {{ productFormData.stockDiscountPrice }}) is greater than the regular price (GHS {{ productFormData.stockPrice }}). Did you enter the total amount instead of the discounted <strong>unit price</strong> (e.g. GHS 19 instead of GHS 190)?
              </span>
            </div>
          </div>
        </div>
      </app-modal-shell>

      <!-- BULK DELETE MODAL -->
      <app-modal-shell
        *ngIf="showBulkDeleteModal"
        size="sm"
        tone="danger"
        [title]="'Delete ' + selectedProductIds.size + ' Product' + (selectedProductIds.size !== 1 ? 's' : '') + '?'"
        subtitle="This action cannot be undone"
        icon="delete"
        [showClose]="!bulkDeleting"
        [closeOnBackdrop]="!bulkDeleting"
        [buttons]="bulkDeleteModalButtons"
        (closeRequested)="closeBulkDeleteModal()"
        (buttonClick)="onBulkDeleteModalButton($event)">
        <div modal-body>
          <p class="pp-bulk-delete-warning">
            You are about to permanently delete {{ selectedProductIds.size }} product{{ selectedProductIds.size !== 1 ? 's' : '' }}.
            All related data will be removed as well.
          </p>
          <p class="pp-bulk-delete-info">
            This includes:
          </p>
          <ul class="pp-bulk-delete-list">
            <li>Orders containing these products</li>
            <li>Batch product associations</li>
            <li>Arrival and shipping data</li>
            <li>All related transactions</li>
          </ul>
        </div>
      </app-modal-shell>

      <!-- ══ PRICE CHANGE CONFIRMATION MODAL ══ -->
      <app-modal-shell
        *ngIf="showPriceChangeModal"
        size="lg"
        tone="warning"
        title="Confirm Price Change"
        subtitle="This will recalculate prices for affected preorder and stock-sale items"
        icon="warning"
        [showClose]="!isRecalculatingPrices"
        [closeOnBackdrop]="!isRecalculatingPrices"
        [buttons]="priceChangeModalButtons"
        (closeRequested)="closePriceChangeModal()"
        (buttonClick)="onPriceChangeModalButton($event)">
        <div modal-body>

            <!-- Price change summary -->
            <div class="pp-price-change-summary">
              <div class="pp-price-change-row">
                <span class="pp-price-change-label">Product:</span>
                <span class="pp-price-change-value">{{ editingBatchProduct?.productName }}</span>
              </div>
              <div class="pp-price-change-row">
                <span class="pp-price-change-label">Preorder Price:</span>
                <span class="pp-price-change-value">
                  GHS {{ editingBatchProduct?.preorderPrice | number:'1.2-2' }}
                  <span class="pp-price-arrow">→</span>
                  <span class="pp-price-new">GHS {{ pendingPriceUpdate?.preorderPrice | number:'1.2-2' }}</span>
                </span>
              </div>
              <div class="pp-price-change-row">
                <span class="pp-price-change-label">Stock Price:</span>
                <span class="pp-price-change-value">
                  GHS {{ editingBatchProduct?.stockPrice | number:'1.2-2' }}
                  <span class="pp-price-arrow">→</span>
                  <span class="pp-price-new">GHS {{ pendingPriceUpdate?.stockPrice | number:'1.2-2' }}</span>
                </span>
              </div>
            </div>

            <!-- Affected items section -->
            <div class="pp-section-divider">
              <span class="pp-section-label">Affected Items</span>
            </div>
            <p class="pp-price-change-info" *ngIf="affectedPriceChangeRecordCount">
              <span class="material-icons">shopping_cart</span>
              {{ affectedPriceChangeRecordCount }} item{{ affectedPriceChangeRecordCount !== 1 ? 's' : '' }} will be updated
              <span class="pp-price-change-counts" *ngIf="hasPriceChangeTypeCounts">
                ({{ affectedPreorderItemCount }} preorder, {{ affectedStockSaleItemCount }} stock sale)
              </span>
            </p>

            <!-- Affected items list -->
            <div class="pp-affected-orders" *ngIf="priceChangeItems.length > 0; else noOrdersMsg">
              <div class="pp-affected-order-item" *ngFor="let order of priceChangeItems | slice:0:5">
                <div class="pp-affected-order-details">
                  <div class="pp-affected-order-name">
                    {{ order.customerName }}
                    <span class="pp-affected-order-type">{{ order.type }}</span>
                  </div>
                  <div class="pp-affected-order-qty">{{ $any(order).quantity }} × GHS {{ $any(order).currentPrice | number:'1.2-2' }} → GHS {{ $any(order).newPrice | number:'1.2-2' }}</div>
                </div>
                <div class="pp-affected-order-cost">
                  <span class="pp-affected-order-cost-old">GHS {{ ($any(order).quantity * $any(order).currentPrice) | number:'1.2-2' }}</span>
                  <span class="material-icons pp-affected-order-arrow">arrow_right_alt</span>
                  <span class="pp-affected-order-cost-new">GHS {{ ($any(order).quantity * $any(order).newPrice) | number:'1.2-2' }}</span>
                </div>
              </div>
              <div class="pp-affected-orders-more" *ngIf="priceChangeItems.length > 5">
                ... and {{ priceChangeItems.length - 5 }} more item{{ (priceChangeItems.length - 5) !== 1 ? 's' : '' }}
              </div>
            </div>
            <ng-template #noOrdersMsg>
              <div class="pp-no-orders">No affected preorder or stock-sale items found</div>
            </ng-template>

            <!-- Total impact summary -->
            <div class="pp-price-change-impact" *ngIf="pricePreviewData">
              <div class="pp-impact-row">
                <span class="pp-impact-label">Total Cost Change:</span>
                <span class="pp-impact-value" [class.pp-impact-increase]="priceChangeTotalCostChange > 0" [class.pp-impact-decrease]="priceChangeTotalCostChange < 0">
                  <span *ngIf="priceChangeTotalCostChange > 0" class="material-icons">trending_up</span>
                  <span *ngIf="priceChangeTotalCostChange < 0" class="material-icons">trending_down</span>
                  <span *ngIf="priceChangeTotalCostChange === 0" class="material-icons">trending_flat</span>
                  GHS {{ Math.abs(priceChangeTotalCostChange) | number:'1.2-2' }}
                </span>
              </div>
            </div>

          </div>
          <div *ngIf="priceChangeError" class="pp-modal-error">
            <span class="material-icons">error_outline</span>
            {{ priceChangeError }}
          </div>
      </app-modal-shell>

      <ng-template #batchProductIndexTpl let-item>
        <span class="pp-td-idx">{{ $any(item).displayIndex }}</span>
      </ng-template>

      <ng-template #batchProductCellTpl let-item>
        <div class="pp-product-cell">
          <div class="pp-product-avatar">{{ ($any(item).productName || '?').charAt(0).toUpperCase() }}</div>
          <div>
            <div class="pp-product-name">{{ $any(item).productName }}</div>
            <div class="pp-product-desc" *ngIf="$any(item).description">{{ $any(item).description }}</div>
          </div>
        </div>
      </ng-template>

      <ng-template #batchProductPreorderPriceTpl let-item>
        <div class="pp-price-cell"><span class="pp-currency">GHS</span>{{ $any(item).preorderPrice | number:'1.2-2' }}</div>
      </ng-template>

      <ng-template #batchProductPreorderDiscountTpl let-item>
        <div class="pp-discount-cell" *ngIf="$any(item).preorderDiscountMinQty">
          <span class="pp-disc-qty">{{ $any(item).preorderDiscountMinQty }}+</span>
          <span class="pp-currency">GHS</span>{{ $any(item).preorderDiscountPrice | number:'1.2-2' }}
        </div>
        <span *ngIf="!$any(item).preorderDiscountMinQty" class="pp-no-discount">—</span>
      </ng-template>

      <ng-template #batchProductStockPriceTpl let-item>
        <div class="pp-price-cell"><span class="pp-currency">GHS</span>{{ $any(item).stockPrice | number:'1.2-2' }}</div>
      </ng-template>

      <ng-template #batchProductStockDiscountTpl let-item>
        <div class="pp-discount-cell" *ngIf="$any(item).stockDiscountMinQty">
          <span class="pp-disc-qty">{{ $any(item).stockDiscountMinQty }}+</span>
          <span class="pp-currency">GHS</span>{{ $any(item).stockDiscountPrice | number:'1.2-2' }}
        </div>
        <span *ngIf="!$any(item).stockDiscountMinQty" class="pp-no-discount">—</span>
      </ng-template>

      <ng-template #batchProductQtyTpl let-item>
        <span class="pp-qty-chip">{{ $any(item).inStockQty }}</span>
      </ng-template>

      <ng-template #catalogSelectTpl let-item>
        <input type="checkbox"
               [checked]="isProductSelected($any(item).id!)"
               (change)="toggleProductSelection($any(item).id!)"
               class="pp-checkbox" />
      </ng-template>

      <ng-template #catalogNameTpl let-item>
        <div class="pp-product-cell">
          <div class="pp-product-avatar">{{ ($any(item).name || '?').charAt(0).toUpperCase() }}</div>
          <div>
            <div class="pp-product-name">{{ $any(item).name }}</div>
          </div>
        </div>
      </ng-template>

      <ng-template #catalogStockTpl let-item>
        <span class="pp-qty-chip">{{ $any(item).stock || 0 }}</span>
      </ng-template>

    </div>
  `,
  styles: [`
    /* ── Shell ── */
    .pp-page { padding: 0; max-width: 1400px; }

    /* ── Page header ── */
    .pp-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; gap:12px; }
    .pp-header-left { display:flex; align-items:center; gap:14px; }
    .pp-header-icon { width:46px; height:46px; border-radius:12px; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
    .pp-header-title { margin:0; font-size:22px; font-weight:800; color:var(--text-primary,#0f172a); line-height:1.2; }
    .pp-header-sub { margin:2px 0 0; font-size:12px; color:var(--text-secondary,#64748b); }
    .pp-header-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    
    /* ── Tab toggle ── */
    .pp-tab-toggle { display:inline-flex; gap:2px; background:#f1f5f9; padding:4px; border-radius:8px; border:1px solid #e2e8f0; }
    .pp-tab-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:none; background:transparent; border-radius:6px; font-size:13px; font-weight:600; color:#475569; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
    .pp-tab-btn .material-icons { font-size:17px; }
    .pp-tab-btn:hover { background:rgba(var(--primary-rgb,99,102,241),0.05); color:#1e293b; }
    .pp-tab-active { background:#fff; color:var(--primary-color,#6366f1); box-shadow:0 1px 3px rgba(0,0,0,0.08); }

    /* ── Card ── */
    .pp-card { background:var(--card-background,#fff); border-radius:14px; border:1px solid var(--border-color,#e2e8f0); padding:20px 24px; box-shadow:0 1px 4px rgba(0,0,0,0.05); }

    /* ── Buttons ── */
    .pp-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:background 0.15s,box-shadow 0.15s; }
    .pp-btn .material-icons { font-size:17px; }
    .pp-btn:disabled { opacity:0.45; cursor:default; pointer-events:none; }
    .pp-btn-primary { background:var(--primary-color,#6366f1); color:#fff; }
    .pp-btn-primary:hover:not(:disabled) { background:var(--primary-dark,#4f46e5); box-shadow:0 3px 10px rgba(var(--primary-rgb,99,102,241),0.3); }
    @media (max-width: 980px) {
      .pp-header {
        align-items: stretch;
        flex-direction: column;
        padding: 18px 16px 14px;
      }

      .pp-header-left {
        align-items: flex-start;
        width: 100%;
      }

      .pp-header-title {
        max-width: 16ch;
        font-size: clamp(21px, 6vw, 30px);
      }

      .pp-header-sub {
        max-width: 34ch;
        font-size: 13px;
      }

      .pp-header-actions {
        width: 100%;
        align-items: stretch;
      }

      .pp-tab-toggle {
        width: 100%;
        overflow-x: auto;
        justify-content: flex-start;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }

      .pp-tab-toggle::-webkit-scrollbar {
        display: none;
      }

      .pp-tab-btn {
        flex: 0 0 auto;
      }
    }

    @media (max-width: 560px) {
      .pp-header {
        padding-inline: 12px;
      }

      .pp-header-icon {
        width: 44px;
        height: 44px;
      }

      .pp-header-title {
        max-width: none;
        font-size: 24px;
      }

      .pp-header-sub {
        max-width: 28ch;
        line-height: 1.35;
      }

      .pp-header-actions > .pp-btn {
        width: 100%;
        justify-content: center;
      }

      .pp-card {
        padding: 16px 12px;
      }
    }

    /* ── Toolbar ── */
    .pp-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:18px; flex-wrap:wrap; }
    .pp-search-wrap { display:flex; align-items:center; border:1px solid var(--border-color,#e2e8f0); border-radius:10px; overflow:hidden; background:var(--card-background,#fff); transition:border-color 0.13s; min-width:260px; max-width:400px; }
    .pp-search-wrap:focus-within { border-color:var(--primary-light,#a5b4fc); }
    .pp-search-icon { color:var(--text-secondary,#94a3b8); font-size:18px; padding:0 10px; flex-shrink:0; }
    .pp-search-input { flex:1; border:none; outline:none; padding:9px 10px 9px 0; font-size:13px; background:transparent; color:var(--text-primary,#1e293b); min-width:0; }

    /* ── Batch card grid ── */
    .pp-batch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; margin-bottom:16px; }
    .pp-card-action-btn { display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:5px 8px; border-radius:7px; border:1px solid transparent; font-size:12px; font-weight:600; cursor:pointer; transition:background 0.13s; line-height:0; }
    .pp-card-action-btn .material-icons { font-size:16px; line-height:1; }
    .pp-card-action-btn:disabled { opacity:0.35; cursor:default; pointer-events:none; }
    .pp-cab-primary { background:var(--primary-color,#6366f1); color:#fff; padding:5px 12px; line-height:1; }
    .pp-cab-primary:hover { background:var(--primary-dark,#4f46e5); }
    .pp-batch-open-btn { margin-left:auto; }
    .pp-batch-open-btn .material-icons { font-size:16px; line-height:1; }

    /* Product cell */
    .pp-product-cell { display:flex; align-items:center; gap:10px; }
    .pp-product-avatar { width:32px; height:32px; border-radius:8px; background:var(--primary-color,#6366f1); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .pp-product-name { font-size:13px; font-weight:600; color:var(--text-primary,#0f172a); }
    .pp-product-desc { font-size:11px; color:var(--text-secondary,#94a3b8); margin-top:1px; }

    /* Price/discount cells */
    .pp-price-cell { display:flex; align-items:baseline; gap:4px; justify-content:flex-start; font-weight:600; }
    .pp-currency { font-size:10px; color:var(--text-secondary,#94a3b8); font-weight:600; }
    .pp-discount-cell { display:flex; align-items:baseline; gap:5px; justify-content:flex-start; }
    .pp-disc-qty { background:rgba(var(--primary-rgb,99,102,241),0.12); color:var(--primary-dark,#4f46e5); font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; }
    .pp-no-discount { color:var(--text-secondary,#cbd5e1); }
    .pp-qty-chip { display:inline-block; background:#f1f5f9; color:#475569; font-size:12px; font-weight:700; padding:3px 10px; border-radius:20px; }

    /* ── Empty state ── */
    .pp-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:48px 24px; gap:10px; }
    .pp-empty-icon { width:64px; height:64px; border-radius:16px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; }
    .pp-empty-icon .material-icons { font-size:32px; color:#94a3b8; }
    .pp-empty h3 { margin:0; font-size:17px; font-weight:700; color:var(--text-primary,#0f172a); }
    .pp-empty p { margin:0; font-size:13px; color:var(--text-secondary,#64748b); max-width:340px; }

    /* ── Pagination ── */
    .pp-pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 4px; border-top:1px solid var(--border-color,#e2e8f0); margin-top:8px; }
    .pp-pg-info { font-size:13px; color:var(--text-secondary,#64748b); font-weight:500; }
    .pp-pg-btns { display:flex; align-items:center; gap:4px; }
    .pp-pg-btns button { display:inline-flex; align-items:center; justify-content:center; padding:5px 7px; border-radius:7px; border:1px solid var(--border-color,#e2e8f0); background:var(--card-background,#fff); cursor:pointer; line-height:0; transition:background 0.13s; }
    .pp-pg-btns button .material-icons { font-size:18px; color:var(--text-secondary,#64748b); }
    .pp-pg-btns button:hover:not(:disabled) { background:#f1f5f9; }
    .pp-pg-btns button:disabled { opacity:0.35; cursor:default; }
    .pp-pg-cur { padding:0 10px; font-size:13px; font-weight:600; color:var(--text-secondary,#64748b); }

    /* ── Skeletons ── */
    .pp-skeleton-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; margin-bottom:16px; }
    .pp-skeleton-batch-card { display:flex; align-items:center; gap:12px; padding:16px; border:1px solid #f1f5f9; border-radius:14px; }
    .pp-sk { border-radius:6px; background:linear-gradient(90deg,#f0f0f0 25%,#e6e6e6 50%,#f0f0f0 75%); background-size:400% 100%; animation:pp-shimmer 1.4s linear infinite; }
    .pp-sk-icon { width:40px; height:40px; border-radius:10px; flex-shrink:0; }
    .pp-sk-body { flex:1; display:flex; flex-direction:column; gap:8px; }
    .pp-sk-line { height:12px; }
    .pp-sk-line-lg { width:70%; }
    .pp-sk-line-sm { width:40%; height:10px; }
    @keyframes pp-shimmer { 0%{background-position:-400% 0} 100%{background-position:400% 0} }

    /* ── Spinner ── */
    .pp-spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(0,0,0,0.12); border-top-color:rgba(0,0,0,0.6); border-radius:50%; animation:pp-spin 0.7s linear infinite; }
    .pp-spinner-sm { width:14px; height:14px; border-top-color:#fff; border-color:rgba(255,255,255,0.3); }
    @keyframes pp-spin { to{transform:rotate(360deg)} }

    .pp-modal-error { margin:0 20px 0; padding:10px 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; color:#dc2626; font-size:13px; display:flex; align-items:center; gap:8px; }
    .pp-modal-error .material-icons { font-size:16px; flex-shrink:0; }

    /* ── Form elements ── */
    .pp-form-group { margin-bottom:14px; }
    .pp-label { display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:5px; }
    .pp-required { color:#ef4444; margin-left:2px; }
    .pp-optional { color:#94a3b8; font-weight:400; }
    .pp-input { width:100%; padding:9px 12px; border:1px solid var(--border-color,#e2e8f0); border-radius:9px; font-size:13px; background:#fff; color:#1e293b; transition:border-color 0.13s,box-shadow 0.13s; box-sizing:border-box; }
    .pp-input:focus { outline:none; border-color:#a5b4fc; box-shadow:0 0 0 3px rgba(165,180,252,0.25); }
    .pp-input:disabled { background:#f8fafc; color:#94a3b8; }
    .pp-textarea { width:100%; padding:9px 12px; border:1px solid var(--border-color,#e2e8f0); border-radius:9px; font-size:13px; resize:vertical; background:#fff; color:#1e293b; transition:border-color 0.13s; box-sizing:border-box; }
    .pp-textarea:focus { outline:none; border-color:#a5b4fc; box-shadow:0 0 0 3px rgba(165,180,252,0.25); }
    .pp-readonly { padding:10px 12px; border:1px solid var(--border-color,#e2e8f0); border-radius:9px; background:#f8fafc; font-size:13px; color:#64748b; }
    .pp-readonly-stock { display:flex; align-items:center; gap:8px; font-weight:600; color:#334155; }
    .pp-readonly-stock .material-icons { font-size:16px; color:#6366f1; }
    .pp-readonly-hint { font-size:11px; font-weight:400; color:#94a3b8; margin-left:4px; }
    .pp-stock-badge {
      display:inline-flex; align-items:center; gap:6px;
      margin-top:8px; padding:6px 12px; border-radius:8px;
      background:#eff6ff; border:1px solid #bfdbfe;
      font-size:12px; font-weight:600; color:#1d4ed8;
    }
    .pp-stock-badge .material-icons { font-size:15px; color:#3b82f6; }
    .pp-stock-badge .pp-stock-none { color:#dc2626; }
    .pp-existing-loading { display:inline-flex; align-items:center; gap:6px; margin-top:8px; font-size:12px; color:#94a3b8; }
    .pp-input-prefix { display:flex; align-items:center; border:1px solid var(--border-color,#e2e8f0); border-radius:9px; overflow:hidden; background:#fff; transition:border-color 0.13s; }
    .pp-input-prefix:focus-within { border-color:var(--primary-light,#a5b4fc); box-shadow:0 0 0 3px rgba(var(--primary-rgb,99,102,241),0.15); }
    .pp-input-prefix span { padding:0 10px; font-size:11px; font-weight:700; color:#94a3b8; background:#f8fafc; border-right:1px solid var(--border-color,#e2e8f0); white-space:nowrap; align-self:stretch; display:flex; align-items:center; }
    .pp-input-prefixed { border:none !important; border-radius:0 !important; box-shadow:none !important; flex:1; }
    .pp-form-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; }
    .pp-form-row-narrow { max-width:220px; }

    /* ── Checkboxes and bulk selection ── */
    .pp-checkbox { width:18px; height:18px; cursor:pointer; accent-color:var(--primary-color,#6366f1); }

    /* ── Toolbar buttons ── */
    .pp-btn-danger { background:#ef4444; color:#fff; }
    .pp-btn-danger:hover:not(:disabled) { background:#dc2626; }

    /* ── Bulk delete modal ── */
    .pp-bulk-delete-warning { color:#0f172a; font-size:14px; margin:0 0 12px; line-height:1.5; }
    .pp-bulk-delete-info { color:#64748b; font-size:13px; margin:12px 0 8px; }
    .pp-bulk-delete-list { font-size:13px; color:#64748b; margin:8px 0 0 20px; padding:0; }
    .pp-bulk-delete-list li { margin:4px 0; }

    /* Discount Explainers & Warnings */
    .pp-discount-explainer {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1d4ed8;
      font-size: 11.5px;
      line-height: 1.4;
      margin-top: -6px;
      margin-bottom: 8px;
    }
    .pp-discount-explainer .material-icons {
      font-size: 16px;
      color: #3b82f6;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .pp-discount-warning {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      color: #b45309;
      font-size: 11.5px;
      line-height: 1.4;
      margin-top: -6px;
      margin-bottom: 8px;
    }
    .pp-discount-warning .material-icons {
      font-size: 16px;
      color: #f59e0b;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Section dividers */
    .pp-section-divider { display:flex; align-items:center; gap:10px; margin:18px 0 12px; }
    .pp-section-divider::before,.pp-section-divider::after { content:''; flex:1; height:1px; background:#f1f5f9; }
    .pp-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; white-space:nowrap; }

    /* Pill toggle */
    .pp-pill-toggle { display:inline-flex; gap:4px; padding:4px; border:1px solid var(--border-color,#e2e8f0); border-radius:12px; background:#f8fafc; margin-bottom:16px; }
    .pp-pill { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:9px; border:none; background:transparent; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; transition:background 0.13s,color 0.13s; }
    .pp-pill .material-icons { font-size:15px; }
    .pp-pill-active { background:var(--primary-color,#6366f1); color:#fff !important; box-shadow:0 2px 6px rgba(var(--primary-rgb,99,102,241),0.25); }

    /* ── Price change modal ── */
    .pp-price-change-summary { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom:16px; }
    .pp-price-change-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; font-size:13px; }
    .pp-price-change-row + .pp-price-change-row { border-top:1px solid #e2e8f0; padding-top:10px; }
    .pp-price-change-label { color:#64748b; font-weight:500; }
    .pp-price-change-value { color:#0f172a; font-weight:600; }
    .pp-price-arrow { color:#94a3b8; font-weight:500; margin:0 6px; }
    .pp-price-new { color:#16a34a; font-size:14px; }

    .pp-price-change-info { color:#059669; font-size:13px; margin:12px 0; display:flex; align-items:center; gap:6px; }
    .pp-price-change-info .material-icons { font-size:18px; }
    .pp-price-change-counts { color:#64748b; font-size:12px; }

    .pp-affected-orders { background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; max-height:250px; overflow-y:auto; }
    .pp-affected-order-item { display:flex; justify-content:space-between; align-items:center; padding:11px 14px; border-bottom:1px solid #e2e8f0; font-size:12px; }
    .pp-affected-order-item:last-child { border-bottom:none; }
    .pp-affected-order-details { flex:1; }
    .pp-affected-order-name { font-weight:600; color:#0f172a; margin-bottom:3px; }
    .pp-affected-order-type { display:inline-flex; align-items:center; margin-left:6px; padding:2px 7px; border-radius:999px; background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700; }
    .pp-affected-order-qty { font-size:11px; color:#64748b; }
    .pp-affected-order-cost { display:flex; align-items:center; gap:8px; font-size:12px; white-space:nowrap; }
    .pp-affected-order-cost-old { color:#94a3b8; text-decoration:line-through; }
    .pp-affected-order-cost-new { color:#16a34a; font-weight:600; }
    .pp-affected-order-arrow { font-size:16px; color:#cbd5e1; }
    .pp-affected-orders-more { padding:8px 14px; font-size:11px; color:#94a3b8; font-style:italic; background:#f1f5f9; }

    .pp-no-orders { padding:20px; text-align:center; color:#94a3b8; font-size:13px; background:#f8fafc; border-radius:10px; }

    .pp-price-change-impact { background:#f0fdf4; border:1px solid #dcfce7; border-radius:10px; padding:12px 14px; margin-top:12px; }
    .pp-impact-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; }
    .pp-impact-label { color:#64748b; font-weight:500; }
    .pp-impact-value { display:flex; align-items:center; gap:6px; font-weight:600; color:#0f172a; }
    .pp-impact-value .material-icons { font-size:18px; }
    .pp-impact-increase { color:#dc2626; }
    .pp-impact-decrease { color:#16a34a; }
  `]
})
export class ProductsComponent implements OnInit {
  @ViewChild('batchProductIndexTpl', { static: true }) batchProductIndexTpl!: TemplateRef<any>;
  @ViewChild('batchProductCellTpl', { static: true }) batchProductCellTpl!: TemplateRef<any>;
  @ViewChild('batchProductPreorderPriceTpl', { static: true }) batchProductPreorderPriceTpl!: TemplateRef<any>;
  @ViewChild('batchProductPreorderDiscountTpl', { static: true }) batchProductPreorderDiscountTpl!: TemplateRef<any>;
  @ViewChild('batchProductStockPriceTpl', { static: true }) batchProductStockPriceTpl!: TemplateRef<any>;
  @ViewChild('batchProductStockDiscountTpl', { static: true }) batchProductStockDiscountTpl!: TemplateRef<any>;
  @ViewChild('batchProductQtyTpl', { static: true }) batchProductQtyTpl!: TemplateRef<any>;
  @ViewChild('catalogSelectTpl', { static: true }) catalogSelectTpl!: TemplateRef<any>;
  @ViewChild('catalogNameTpl', { static: true }) catalogNameTpl!: TemplateRef<any>;
  @ViewChild('catalogStockTpl', { static: true }) catalogStockTpl!: TemplateRef<any>;

  // Main tab switch: batches or manage products
  mainTab: 'batches' | 'manage-products' = 'batches';

  // Batches tab properties
  batchPage = 1;
  batchPageSize = 20;
  batchTotal = 0;
  batchProductsPage = 1;
  batchProductsPageSize = 20;
  batchProductsTotal = 0;
  activeTab: 'batches' | 'products' = 'batches';
  loadingBatches = true;
  loadingBatchProducts = false;
  batches: OrderBatch[] = [];
  selectedBatch: OrderBatch | null = null;

  get selectedProductBatchHeaderTag(): BatchDetailHeaderTagConfig | null {
    if (!this.selectedBatch) return null;
    if (this.selectedBatch.status === 'open') {
      return { label: 'Open', color: 'green', icon: 'check_circle' };
    }
    return { label: 'Closed', color: 'gray', icon: 'task_alt' };
  }

  batchProducts: BatchProduct[] = [];
  filteredBatchProducts: BatchProduct[] = [];

  productCatalog: ProductCatalog[] = [];

  batchSearchTerm = '';
  batchFilterMonth: number | null = null;
  batchFilterYear: number | null = null;
  currentYear = new Date().getFullYear();
  productSearchTerm = '';

  showBatchModal = false;
  newBatchName = '';
  editingBatch: OrderBatch | null = null;
  savingBatch = false;
  deletingBatchIds = new Set<number>();
  pendingSelectBatchId: number | null = null;

  showBatchProductModal = false;
  savingBatchProduct = false;
  batchProductAddError = '';
  useExistingProduct = true;
  selectedCatalogProductId: number | null = null;
  loadingExistingProduct = false;
  existingProductStock: number | null = null;
  loadingProductCatalog = false;
  private existingProductSelectionRequestId = 0;
  editingBatchProduct: BatchProduct | null = null;
  deletingBatchProductIds = new Set<number>();

  // Price change confirmation modal
  showPriceChangeModal = false;
  pricePreviewData: PriceChangePreview | null = null;
  isRecalculatingPrices = false;
  priceChangeError = '';

  get batchModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.savingBatch },
      {
        buttonName: this.editingBatch ? 'Update Batch' : 'Create Batch',
        color: 'base_color',
        action: 'confirm',
        disabled: this.savingBatch || !this.canEditCurrentBatchName || !this.newBatchName.trim(),
        loading: this.savingBatch
      }
    ];
  }

  get batchProductModalButtons(): ModalButtonConfig[] {
    const preorderPriceInvalid = this.batchProductForm.preorderDiscountPrice > this.batchProductForm.preorderPrice;
    const stockPriceInvalid = this.batchProductForm.stockDiscountPrice > this.batchProductForm.stockPrice;

    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.savingBatchProduct },
      {
        buttonName: this.editingBatchProduct ? 'Update Product' : 'Add Product',
        color: 'base_color',
        action: 'confirm',
        disabled: this.savingBatchProduct || preorderPriceInvalid || stockPriceInvalid,
        loading: this.savingBatchProduct
      }
    ];
  }

  get productModalButtons(): ModalButtonConfig[] {
    const stockPriceInvalid = this.productFormData.stockDiscountPrice > this.productFormData.stockPrice;

    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.savingProduct },
      {
        buttonName: this.editingProduct ? 'Update Product' : 'Add Product',
        color: 'base_color',
        action: 'confirm',
        disabled: this.savingProduct || !this.productFormData.name.trim() || stockPriceInvalid,
        loading: this.savingProduct
      }
    ];
  }

  get bulkDeleteModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.bulkDeleting },
      {
        buttonName: 'Delete Permanently',
        color: 'danger',
        action: 'confirm',
        disabled: this.bulkDeleting,
        loading: this.bulkDeleting
      }
    ];
  }

  get priceChangeModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.isRecalculatingPrices },
      {
        buttonName: 'Confirm & Update All',
        color: 'base_color',
        action: 'confirm',
        disabled: this.isRecalculatingPrices,
        loading: this.isRecalculatingPrices
      }
    ];
  }
  pendingPriceUpdate: PendingPriceUpdate | null = null;

  get priceChangeItems(): PriceChangePreviewItem[] {
    return this.pricePreviewData?.affectedOrders || [];
  }

  get affectedPriceChangeRecordCount(): number {
    return this.pricePreviewData?.affectedRecordCount ?? this.pricePreviewData?.affectedOrderCount ?? 0;
  }

  get affectedPreorderItemCount(): number {
    return this.pricePreviewData?.affectedPreorderItemCount || 0;
  }

  get affectedStockSaleItemCount(): number {
    return this.pricePreviewData?.affectedStockSaleItemCount || 0;
  }

  get hasPriceChangeTypeCounts(): boolean {
    return this.pricePreviewData?.affectedPreorderItemCount !== undefined
      || this.pricePreviewData?.affectedStockSaleItemCount !== undefined;
  }

  get priceChangeTotalCostChange(): number {
    return this.pricePreviewData?.totalCostChange || 0;
  }

  // Manage Products (Catalog) tab properties
  loadingCatalog = true;
  catalogPage = 1;
  catalogPageSize = 20;
  catalogTotal = 0;
  catalogSearchTerm = '';
  catalogStatusFilter: 'all' | 'active' | 'inactive' = 'all';
  filteredCatalog: ProductCatalog[] = [];
  
  showProductModal = false;
  editingProduct: ProductCatalog | null = null;
  savingProduct = false;
  deletingProductIds = new Set<number>();
  
  // Bulk delete properties
  selectedProductIds = new Set<number>();
  showBulkDeleteModal = false;
  bulkDeleting = false;
  
  productFormData = {
    name: '',
    description: '',
    stock: 0,
    stockPrice: 0,
    stockDiscountMinQty: 0,
    stockDiscountPrice: 0
  };

  productForm = {
    name: '',
    description: ''
  };

  baseColor = '#6366f1';
  batchProductsColumns: TableColumn[] = [];
  catalogColumns: TableColumn[] = [];
  catalogFilters: TableFilterConfig[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' }
      ],
      value: 'all'
    }
  ];

  batchProductForm = {
    preorderPrice: 0,
    preorderDiscountMinQty: 0,
    preorderDiscountPrice: 0,
    stockPrice: 0,
    stockDiscountMinQty: 0,
    stockDiscountPrice: 0,
    inStockQty: 0
  };
  private addBatchProductSystemDefaults = this.createEmptyBatchProductForm();

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService,
    private route: ActivatedRoute
  ) {}

  private createEmptyBatchProductForm(inStockQty = 0) {
    return {
      preorderPrice: 0,
      preorderDiscountMinQty: 0,
      preorderDiscountPrice: 0,
      stockPrice: 0,
      stockDiscountMinQty: 0,
      stockDiscountPrice: 0,
      inStockQty
    };
  }

  private resetExistingProductSelection() {
    this.selectedCatalogProductId = null;
    this.existingProductStock = null;
    this.loadingExistingProduct = false;
    this.existingProductSelectionRequestId += 1;
  }

  switchToExistingProductMode() {
    this.useExistingProduct = true;
    this.resetExistingProductSelection();
    this.batchProductForm = this.createEmptyBatchProductForm();
    if (this.showBatchProductModal) {
      this.loadCatalog();
    }
  }

  switchToNewProductMode() {
    this.useExistingProduct = false;
    this.resetExistingProductSelection();
    this.batchProductForm = this.createEmptyBatchProductForm();
  }

  ngOnInit() {
    this.setupTableConfigs();
    const batchIdParam = this.route.snapshot.queryParamMap.get('batchId');
    if (batchIdParam) {
      const parsed = Number(batchIdParam);
      if (!Number.isNaN(parsed)) {
        this.pendingSelectBatchId = parsed;
      }
    }
    this.loadBatches();
    this.loadCatalogPage();
    this.loadCatalog();
    
    // Reload batches when a batch is deleted elsewhere
    this.dbService.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  private setupTableConfigs() {
    this.batchProductsColumns = [
      { key: 'displayIndex', label: '#', type: 'custom', customTemplate: this.batchProductIndexTpl },
      { key: 'productName', label: 'Product', type: 'custom', customTemplate: this.batchProductCellTpl, searchable: true },
      { key: 'preorderPrice', label: 'Preorder Price', type: 'custom', customTemplate: this.batchProductPreorderPriceTpl },
      { key: 'preorderDiscountMinQty', label: 'Preorder Discount', type: 'custom', customTemplate: this.batchProductPreorderDiscountTpl },
      { key: 'stockPrice', label: 'Stock Price', type: 'custom', customTemplate: this.batchProductStockPriceTpl },
      { key: 'stockDiscountMinQty', label: 'Stock Discount', type: 'custom', customTemplate: this.batchProductStockDiscountTpl },
      { key: 'inStockQty', label: 'In Stock', type: 'custom', customTemplate: this.batchProductQtyTpl },
      { key: 'actions', label: 'Actions', type: 'actions' },
    ];

    this.catalogColumns = [
      { key: 'select', label: '', type: 'custom', customTemplate: this.catalogSelectTpl },
      { key: 'name', label: 'Product Name', type: 'custom', customTemplate: this.catalogNameTpl, searchable: true },
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'stock', label: 'Current Stock', type: 'custom', customTemplate: this.catalogStockTpl },
      { key: 'actions', label: 'Actions', type: 'actions' },
    ];
  }

  get batchProductsTableRows() {
    return this.filteredBatchProducts.map((item, index) => ({
      ...item,
      displayIndex: this.batchProductsRangeStart + index,
      actions: this.getBatchProductActions(item),
    }));
  }

  get batchProductsMetadata(): TableMetadata | null {
    if (this.batchProductsTotal === 0) return null as any;
    return {
      pageNumber: this.batchProductsPage,
      totalCount: this.batchProductsTotal,
      pageSize: this.batchProductsPageSize,
      totalPages: this.totalBatchProductPages,
    };
  }

  get catalogTableRows() {
    return this.filteredCatalog.map((item, index) => ({
      ...item,
      actions: this.getCatalogActions(item),
    }));
  }

  get catalogMetadata(): TableMetadata | null {
    if (this.catalogTotal === 0) return null as any;
    return {
      pageNumber: this.catalogPage,
      totalCount: this.catalogTotal,
      pageSize: this.catalogPageSize,
      totalPages: this.totalCatalogPages,
    };
  }

  private getBatchProductActions(item: BatchProduct): ActionOption[] {
    const batchIsClosed = this.selectedBatch?.status === 'closed';
    const canEditClosed = !batchIsClosed || this.authService.canPerformProductOperation('canEditBatchProductAfterBatchClosed');
    const canDeleteClosed = !batchIsClosed || this.authService.canPerformProductOperation('canDeleteProductAfterBatchClosed');
    const canEdit = this.authService.canPerformProductOperation('canEditBatchProduct') && canEditClosed;
    const canDelete = this.authService.canPerformProductOperation('canDeleteProductFromBatch') && canDeleteClosed;
    const actions: ActionOption[] = [];
    if (canEdit) actions.push({ id: 'edit', label: 'Edit', icon: 'pencil', color: 'blue' });
    if (canDelete) actions.push({ id: 'delete', label: 'Delete', icon: 'trash', color: 'red' });
    return actions;
  }

  private getCatalogActions(item: ProductCatalog): ActionOption[] {
    const actions: ActionOption[] = [];
    if (this.authService.can('edit', 'products')) actions.push({ id: 'edit', label: 'Edit', icon: 'pencil', color: 'blue' });
    if (this.authService.can('delete', 'products')) actions.push({ id: 'delete', label: 'Delete', icon: 'trash', color: 'red' });
    return actions;
  }

  get filteredBatches() {
    return this.batches;
  }

  get totalBatchPages() {
    return Math.max(1, Math.ceil(this.batchTotal / this.batchPageSize));
  }

  get canEditCurrentBatchName(): boolean {
    if (!this.editingBatch) return true;
    if (this.editingBatch.status !== 'closed') return this.authService.canPerformProductOperation('canEditBatchName');
    return this.authService.canPerformProductOperation('canEditBatchName')
      && this.authService.canPerformProductOperation('canEditBatchProductAfterBatchClosed');
  }

  get canEditBatchProductPricingFields(): boolean {
    return this.editingBatchProduct
      ? this.authService.canPerformProductOperation('canEditBatchProductPricing')
      : this.authService.canPerformProductOperation('canEditPricesAndStockOnAdd');
  }

  get totalBatchProductPages() {
    return Math.max(1, Math.ceil(this.batchProductsTotal / this.batchProductsPageSize));
  }

  get batchRangeStart() {
    if (this.batchTotal === 0) return 0;
    return (this.batchPage - 1) * this.batchPageSize + 1;
  }

  get batchRangeEnd() {
    return Math.min(this.batchPage * this.batchPageSize, this.batchTotal);
  }

  get batchProductsRangeStart() {
    if (this.batchProductsTotal === 0) return 0;
    return (this.batchProductsPage - 1) * this.batchProductsPageSize + 1;
  }

  get batchProductsRangeEnd() {
    return Math.min(this.batchProductsPage * this.batchProductsPageSize, this.batchProductsTotal);
  }

  get totalCatalogPages() {
    return Math.max(1, Math.ceil(this.catalogTotal / this.catalogPageSize));
  }

  get catalogRangeStart() {
    if (this.catalogTotal === 0) return 0;
    return (this.catalogPage - 1) * this.catalogPageSize + 1;
  }

  get catalogRangeEnd() {
    return Math.min(this.catalogPage * this.catalogPageSize, this.catalogTotal);
  }

  onBatchMonthYearChange(selection: { month: number | null; year: number | null }) {
    this.batchFilterMonth = selection.month;
    this.batchFilterYear = selection.year;
    this.batchPage = 1;
    this.loadBatches();
  }

  loadBatches() {
    this.loadingBatches = true;
    const term = this.batchSearchTerm.trim();
    const monthYear = this.batchFilterMonth !== null && this.batchFilterYear !== null
      ? { month: this.batchFilterMonth, year: this.batchFilterYear } : undefined;
    this.dbService.getOrderBatchesPage(this.batchPage, this.batchPageSize, term, undefined, monthYear).subscribe(({ data, total }) => {
      this.batches = data;
      this.batchTotal = total;
      this.loadingBatches = false;
      if (this.batchPage > this.totalBatchPages) {
        this.batchPage = this.totalBatchPages;
        this.loadBatches();
        return;
      }
      if (this.pendingSelectBatchId) {
        const pendingId = this.pendingSelectBatchId;
        const pending = data.find(b => b.id === pendingId) || null;
        this.pendingSelectBatchId = null;
        if (pending) {
          this.viewBatchProducts(pending);
          return;
        }
        this.dbService.getOrderBatchById(pendingId).subscribe(batch => {
          if (batch) {
            this.viewBatchProducts(batch);
          }
        });
        return;
      }
      if (!this.selectedBatch && data.length > 0) {
        this.selectBatch(data[0]);
      }
    });
  }

  loadCatalog() {
    this.loadingProductCatalog = true;
    this.dbService.getProductCatalogPage(1, 20, '').subscribe({
      next: ({ data }) => {
        this.productCatalog = data;
        this.loadingProductCatalog = false;
      },
      error: () => {
        this.loadingProductCatalog = false;
      }
    });
  }

  onExistingProductSearch(term: string) {
    if (!this.showBatchProductModal || !this.useExistingProduct || this.editingBatchProduct) return;
    this.loadingProductCatalog = true;
    this.dbService.getProductCatalogPage(1, 20, term).subscribe({
      next: ({ data }) => {
        this.productCatalog = data;
        this.loadingProductCatalog = false;
      },
      error: () => {
        this.loadingProductCatalog = false;
      }
    });
  }

  selectBatch(batch: OrderBatch) {
    this.selectedBatch = batch;
    this.productSearchTerm = '';
    this.batchProductsPage = 1;
    this.loadBatchProducts();
  }

  viewBatchProducts(batch: OrderBatch) {
    this.selectBatch(batch);
    this.activeTab = 'products';
  }

  loadBatchProducts() {
    if (!this.selectedBatch?.id) return;
    this.loadingBatchProducts = true;
    const term = this.productSearchTerm.trim();
    this.dbService.getBatchProductsPage(this.selectedBatch.id, this.batchProductsPage, this.batchProductsPageSize, term)
      .subscribe(({ data, total }) => {
        this.batchProducts = data;
        this.filteredBatchProducts = data;
        this.batchProductsTotal = total;
        this.loadingBatchProducts = false;
        if (this.batchProductsPage > this.totalBatchProductPages) {
          this.batchProductsPage = this.totalBatchProductPages;
          this.loadBatchProducts();
        }
      });
  }

  filterBatchProducts() {
    if (!this.selectedBatch?.id) return;
    this.batchProductsPage = 1;
    this.loadBatchProducts();
  }

  onBatchProductSearchChange(query: Record<string, string>) {
    this.productSearchTerm = (query['productName'] || '').trim();
    this.batchProductsPage = 1;
    this.loadBatchProducts();
  }

  onBatchSearch() {
    this.batchPage = 1;
    this.loadBatches();
  }

  setBatchPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalBatchPages));
    if (next === this.batchPage) return;
    this.batchPage = next;
    this.loadBatches();
  }

  setBatchProductsPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalBatchProductPages));
    if (next === this.batchProductsPage) return;
    this.batchProductsPage = next;
    this.loadBatchProducts();
  }

  onBatchProductActionClick(event: { action: ActionOption; item: BatchProduct }) {
    if (event.action.id === 'edit') {
      this.openBatchProductModal(event.item);
      return;
    }
    if (event.action.id === 'delete') {
      this.deleteBatchProduct(event.item);
    }
  }

  openBatchModal() {
    this.editingBatch = null;
    this.newBatchName = '';
    this.showBatchModal = true;
  }

  editBatch(batch: OrderBatch) {
    if (!this.authService.canPerformProductOperation('canEditBatchName')) return;
    if (batch.status === 'closed' && !this.authService.canPerformProductOperation('canEditBatchProductAfterBatchClosed')) return;
    this.editingBatch = batch;
    this.newBatchName = batch.name;
    this.showBatchModal = true;
  }

  closeBatchModal() {
    this.showBatchModal = false;
    this.savingBatch = false;
    this.editingBatch = null;
  }

  onBatchModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeBatchModal();
      return;
    }
    if (button.action === 'confirm' && !this.savingBatch) {
      this.saveBatch();
    }
  }

  saveBatch() {
    if (!this.newBatchName.trim()) return;
    this.savingBatch = true;
    if (this.editingBatch && !this.canEditCurrentBatchName) {
      this.savingBatch = false;
      return;
    }
    if (this.editingBatch?.id) {
      this.dbService.updateOrderBatch(this.editingBatch.id, this.newBatchName.trim()).subscribe(() => {
        this.savingBatch = false;
        this.closeBatchModal();
        this.loadBatches();
      });
      return;
    }
    this.dbService.createOrderBatch(this.newBatchName.trim()).subscribe(id => {
      this.savingBatch = false;
      this.showBatchModal = false;
      this.pendingSelectBatchId = id || null;
      this.batchPage = 1;
      this.loadBatches();
    });
  }

  deleteBatch(batch: OrderBatch) {
    if (!this.authService.canPerformProductOperation('canDeleteBatch')) return;
    if (batch.status === 'closed' && !this.authService.canPerformProductOperation('canDeleteProductAfterBatchClosed')) return;
    if (!batch.id || this.deletingBatchIds.has(batch.id)) return;
    if (!confirm(`Delete batch "${batch.name}"? This will remove its products and orders.`)) return;
    this.deletingBatchIds.add(batch.id);
    this.dbService.deleteOrderBatch(batch.id).subscribe({
      next: () => {
        if (this.selectedBatch?.id === batch.id) {
          this.selectedBatch = null;
          this.batchProducts = [];
          this.filteredBatchProducts = [];
          this.batchProductsTotal = 0;
          this.batchProductsPage = 1;
        }
        this.loadBatches();
      },
      error: () => {
        this.deletingBatchIds.delete(batch.id!);
      },
      complete: () => {
        this.deletingBatchIds.delete(batch.id!);
      }
    });
  }

  openBatchProductModal(item?: BatchProduct) {
    if (item && this.selectedBatch?.status === 'closed' && !this.authService.canPerformProductOperation('canEditBatchProductAfterBatchClosed')) {
      alert('Cannot edit products in a closed batch.');
      return;
    }

    if (item && !this.authService.canPerformProductOperation('canEditBatchProduct')) {
      alert('You do not have permission to edit batch products.');
      return;
    }

    if (!item && !this.authService.canPerformProductOperation('canAddProductToBatch')) {
      this.batchProductAddError = 'You do not have permission to add products to batches.';
      return;
    }

    this.editingBatchProduct = item || null;
    if (item) {
      this.batchProductForm = {
        preorderPrice: item.preorderPrice || 0,
        preorderDiscountMinQty: item.preorderDiscountMinQty || 0,
        preorderDiscountPrice: item.preorderDiscountPrice || 0,
        stockPrice: item.stockPrice || 0,
        stockDiscountMinQty: item.stockDiscountMinQty || 0,
        stockDiscountPrice: item.stockDiscountPrice || 0,
        inStockQty: item.inStockQty || 0
      };
    } else {
      this.useExistingProduct = true;
      this.resetExistingProductSelection();
      this.productForm = { name: '', description: '' };
      this.batchProductForm = this.createEmptyBatchProductForm();
      this.addBatchProductSystemDefaults = this.createEmptyBatchProductForm();
    }
    if (!item && this.useExistingProduct) {
      this.loadCatalog();
    }
    this.batchProductAddError = '';
    this.showBatchProductModal = true;
  }

  closeBatchProductModal() {
    this.showBatchProductModal = false;
    this.savingBatchProduct = false;
    this.editingBatchProduct = null;
    this.resetExistingProductSelection();
    this.batchProductAddError = '';
  }

  onBatchProductModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeBatchProductModal();
      return;
    }
    if (button.action === 'confirm' && !this.savingBatchProduct) {
      this.saveBatchProduct();
    }
  }

  onExistingProductSelected(id: number | null) {
    const requestId = ++this.existingProductSelectionRequestId;
    this.selectedCatalogProductId = id;
    this.existingProductStock = null;
    this.loadingExistingProduct = false;
    this.batchProductForm = this.createEmptyBatchProductForm();
    this.addBatchProductSystemDefaults = this.createEmptyBatchProductForm();
    if (!id) return;

    // Show current stock from the catalogue (already loaded)
    const catalogEntry = this.productCatalog.find(p => p.id === Number(id));
    if (catalogEntry) {
      this.existingProductStock = catalogEntry.stock ?? 0;
      this.batchProductForm = this.createEmptyBatchProductForm(this.existingProductStock);
      this.addBatchProductSystemDefaults = { ...this.batchProductForm };
    } else {
      this.dbService.getProduct(Number(id)).subscribe(product => {
        if (requestId !== this.existingProductSelectionRequestId || Number(this.selectedCatalogProductId) !== Number(id)) return;
        if (product) {
          this.existingProductStock = product.stock ?? 0;
          this.batchProductForm = this.createEmptyBatchProductForm(this.existingProductStock);
          this.addBatchProductSystemDefaults = { ...this.batchProductForm };
        }
      });
    }

    // Fetch the most recent batch pricing for this product and pre-fill
    this.loadingExistingProduct = true;
    this.dbService.getMostRecentBatchProductForProduct(Number(id)).subscribe(recent => {
      if (requestId !== this.existingProductSelectionRequestId || Number(this.selectedCatalogProductId) !== Number(id)) return;
      this.loadingExistingProduct = false;
      const inStockQty = this.existingProductStock ?? 0;
      if (recent) {
        this.batchProductForm = {
          preorderPrice:           recent.preorderPrice          ?? 0,
          preorderDiscountMinQty:  recent.preorderDiscountMinQty  ?? 0,
          preorderDiscountPrice:   recent.preorderDiscountPrice   ?? 0,
          stockPrice:              recent.stockPrice              ?? 0,
          stockDiscountMinQty:     recent.stockDiscountMinQty     ?? 0,
          stockDiscountPrice:      recent.stockDiscountPrice      ?? 0,
          inStockQty
        };
        this.addBatchProductSystemDefaults = { ...this.batchProductForm };
        return;
      }
      this.batchProductForm = this.createEmptyBatchProductForm(inStockQty);
      this.addBatchProductSystemDefaults = { ...this.batchProductForm };
    });
  }

  saveBatchProduct() {
    if (!this.selectedBatch?.id) return;
    if (this.savingBatchProduct) return;

    const canModifyBatchProduct = this.editingBatchProduct
      ? this.authService.canPerformProductOperation('canEditBatchProduct')
      : this.authService.canPerformProductOperation('canAddProductToBatch');

    if (!canModifyBatchProduct) {
      this.batchProductAddError = this.editingBatchProduct
        ? 'You do not have permission to edit batch products.'
        : 'You do not have permission to add products to batches.';
      return;
    }

    if (this.selectedBatch.status === 'closed' && !this.authService.canPerformProductOperation('canEditBatchProductAfterBatchClosed')) {
      this.batchProductAddError = 'Cannot modify products in a closed batch.';
      this.savingBatchProduct = false;
      return;
    }

    const batchId = this.selectedBatch.id;
    const selectedId = this.selectedCatalogProductId ? Number(this.selectedCatalogProductId) : 0;
    const sourceForm = !this.editingBatchProduct && !this.authService.canPerformProductOperation('canEditPricesAndStockOnAdd')
      ? this.addBatchProductSystemDefaults
      : this.batchProductForm;

    const payload: BatchProduct = {
      batchId,
      productId: selectedId,
      preorderPrice: Number(sourceForm.preorderPrice || 0),
      preorderDiscountMinQty: Number(sourceForm.preorderDiscountMinQty || 0),
      preorderDiscountPrice: Number(sourceForm.preorderDiscountPrice || 0),
      stockPrice: Number(sourceForm.stockPrice || 0),
      stockDiscountMinQty: Number(sourceForm.stockDiscountMinQty || 0),
      stockDiscountPrice: Number(sourceForm.stockDiscountPrice || 0),
      inStockQty: Number(sourceForm.inStockQty || 0)
    };

    this.batchProductAddError = '';
    this.savingBatchProduct = true;

    if (this.editingBatchProduct?.id) {
      // Check if price or discount settings have changed
      const priceChanged = 
        payload.preorderPrice !== this.editingBatchProduct.preorderPrice ||
        payload.preorderDiscountMinQty !== this.editingBatchProduct.preorderDiscountMinQty ||
        payload.preorderDiscountPrice !== this.editingBatchProduct.preorderDiscountPrice ||
        payload.stockPrice !== this.editingBatchProduct.stockPrice ||
        payload.stockDiscountMinQty !== this.editingBatchProduct.stockDiscountMinQty ||
        payload.stockDiscountPrice !== this.editingBatchProduct.stockDiscountPrice;

      if (priceChanged) {
        // Show preview modal for price change confirmation
        this.savingBatchProduct = false;
        this.previewAndConfirmPriceChange(
          payload.preorderPrice,
          payload.preorderDiscountMinQty,
          payload.preorderDiscountPrice,
          payload.stockPrice,
          payload.stockDiscountMinQty,
          payload.stockDiscountPrice
        );
        return;
      }

      // No price change, proceed with normal update
      this.dbService.updateBatchProduct(this.editingBatchProduct.id, payload).subscribe(ok => {
        this.savingBatchProduct = false;
        if (ok) {
          this.closeBatchProductModal();
          this.loadBatchProducts();
        }
      });
      return;
    }

    if (this.useExistingProduct) {
      if (!selectedId) {
        this.savingBatchProduct = false;
        return;
      }
      payload.productId = selectedId;
      this.dbService.addBatchProduct(payload).subscribe({
        next: () => {
          this.savingBatchProduct = false;
          this.closeBatchProductModal();
          this.loadBatchProducts();
        },
        error: (err) => {
          this.savingBatchProduct = false;
          if (err?.code === '23505' || err?.status === 409) {
            this.batchProductAddError = 'This product is already in this batch.';
          } else {
            this.batchProductAddError = 'Failed to add product. Please try again.';
          }
        }
      });
      return;
    }

    if (!this.productForm.name.trim()) {
      this.savingBatchProduct = false;
      return;
    }

    const newProduct: ProductCatalog = {
      name: this.productForm.name.trim(),
      description: this.productForm.description
    };

    this.dbService.createProductCatalog(newProduct).subscribe({
      next: (productId) => {
        if (!productId) {
          this.savingBatchProduct = false;
          return;
        }
        payload.productId = productId;
        this.dbService.addBatchProduct(payload).subscribe({
          next: () => {
            this.savingBatchProduct = false;
            this.closeBatchProductModal();
            this.loadCatalog();
            this.loadBatchProducts();
          },
          error: (err) => {
            this.savingBatchProduct = false;
            if (err?.code === '23505' || err?.status === 409) {
              this.batchProductAddError = 'This product is already in this batch.';
            } else {
              this.batchProductAddError = 'Failed to add product. Please try again.';
            }
          }
        });
      },
      error: () => {
        this.savingBatchProduct = false;
      }
    });
  }

  deleteBatchProduct(item: BatchProduct) {
    if (!item.id || this.deletingBatchProductIds.has(item.id)) return;
    
    // Permission check
    if (!this.authService.canPerformProductOperation('canDeleteProductFromBatch')) {
      alert('You do not have permission to delete batch products.');
      return;
    }

    if (this.selectedBatch?.status === 'closed' && !this.authService.canPerformProductOperation('canDeleteProductAfterBatchClosed')) {
      alert('Cannot delete products from a closed batch.');
      return;
    }

    if (!confirm(`Remove "${item.productName}" from this batch?`)) return;
    this.deletingBatchProductIds.add(item.id);
    this.dbService.deleteBatchProduct(item.id).subscribe({
      next: () => {
        this.loadBatchProducts();
      },
      error: () => {
        this.deletingBatchProductIds.delete(item.id!);
      },
      complete: () => {
        this.deletingBatchProductIds.delete(item.id!);
      }
    });
  }

  // ══ PRODUCT CATALOG MANAGEMENT ══

  loadCatalogPage() {
    this.loadingCatalog = true;
    const term = this.catalogSearchTerm.trim();
    this.dbService.getProductCatalogPage(this.catalogPage, this.catalogPageSize, term, this.catalogStatusFilter).subscribe(({ data, total }) => {
      this.filteredCatalog = data;
      this.catalogTotal = total;
      this.loadingCatalog = false;
      if (this.catalogPage > this.totalCatalogPages) {
        this.catalogPage = this.totalCatalogPages;
        this.loadCatalogPage();
      }
    });
  }

  onCatalogSearch() {
    this.catalogPage = 1;
    this.loadCatalogPage();
  }

  onCatalogSearchChange(query: Record<string, string>) {
    this.catalogSearchTerm = (query['name'] || '').trim();
    this.catalogPage = 1;
    this.loadCatalogPage();
  }

  onCatalogFilterChange(filters: Record<string, any>) {
    this.catalogStatusFilter = (filters['status'] || 'all') as 'all' | 'active' | 'inactive';
    this.catalogPage = 1;
    this.loadCatalogPage();
  }

  setCatalogPage(page: number) {
    const next = Math.max(1, Math.min(page, this.totalCatalogPages));
    if (next === this.catalogPage) return;
    this.catalogPage = next;
    this.loadCatalogPage();
  }

  onCatalogActionClick(event: { action: ActionOption; item: ProductCatalog }) {
    if (event.action.id === 'edit') {
      this.openProductModal(event.item);
      return;
    }
    if (event.action.id === 'delete') {
      this.deleteProduct(event.item);
    }
  }

  openProductModal(product?: ProductCatalog) {
    this.editingProduct = product || null;
    if (product) {
      this.productFormData = {
        name: product.name,
        description: product.description || '',
        stock: product.stock || 0,
        stockPrice: product.stockPrice || 0,
        stockDiscountMinQty: product.stockDiscountMinQty || 0,
        stockDiscountPrice: product.stockDiscountPrice || 0
      };
    } else {
      this.productFormData = {
        name: '',
        description: '',
        stock: 0,
        stockPrice: 0,
        stockDiscountMinQty: 0,
        stockDiscountPrice: 0
      };
    }
    this.showProductModal = true;
  }

  closeProductModal() {
    this.showProductModal = false;
    this.editingProduct = null;
    this.productFormData = {
      name: '',
      description: '',
      stock: 0,
      stockPrice: 0,
      stockDiscountMinQty: 0,
      stockDiscountPrice: 0
    };
    this.savingProduct = false;
  }

  onProductModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeProductModal();
      return;
    }
    if (button.action === 'confirm' && !this.savingProduct) {
      this.saveProduct();
    }
  }

  clearProductFieldIfZero(field: keyof typeof this.productFormData, event: FocusEvent) {
    if (Number((this.productFormData as any)[field]) === 0) {
      (this.productFormData as any)[field] = null;
      const input = event.target as HTMLInputElement;
      input.value = '';
    }
  }

  saveProduct() {
    if (!this.productFormData.name.trim()) return;
    this.savingProduct = true;

    const payload: ProductCatalog = {
      name: this.productFormData.name.trim(),
      description: this.productFormData.description || '',
      stock: this.productFormData.stock || 0,
      stockPrice: Number(this.productFormData.stockPrice || 0),
      stockDiscountMinQty: Number(this.productFormData.stockDiscountMinQty || 0),
      stockDiscountPrice: Number(this.productFormData.stockDiscountPrice || 0)
    };

    if (this.editingProduct?.id) {
      this.dbService.updateProductCatalog(this.editingProduct.id, payload).subscribe({
        next: () => {
          this.savingProduct = false;
          this.closeProductModal();
          this.loadCatalogPage();
        },
        error: () => {
          this.savingProduct = false;
        }
      });
      return;
    }

    this.dbService.createProductCatalog(payload).subscribe({
      next: () => {
        this.savingProduct = false;
        this.closeProductModal();
        this.catalogPage = 1;
        this.loadCatalogPage();
      },
      error: () => {
        this.savingProduct = false;
      }
    });
  }

  deleteProduct(product: ProductCatalog) {
    if (!product.id || this.deletingProductIds.has(product.id)) return;
    if (!confirm(`Delete product "${product.name}"?`)) return;
    this.deletingProductIds.add(product.id);
    this.dbService.deleteProductCatalog(product.id).subscribe({
      next: () => {
        this.loadCatalogPage();
      },
      error: () => {
        this.deletingProductIds.delete(product.id!);
      },
      complete: () => {
        this.deletingProductIds.delete(product.id!);
      }
    });
  }

  // Bulk delete operations
  toggleProductSelection(productId: number) {
    if (this.selectedProductIds.has(productId)) {
      this.selectedProductIds.delete(productId);
    } else {
      this.selectedProductIds.add(productId);
    }
  }

  toggleSelectAllProducts() {
    if (this.selectedProductIds.size === this.filteredCatalog.length) {
      this.selectedProductIds.clear();
    } else {
      this.filteredCatalog.forEach(product => {
        if (product.id) this.selectedProductIds.add(product.id);
      });
    }
  }

  isProductSelected(productId: number): boolean {
    return this.selectedProductIds.has(productId);
  }

  allProductsSelected(): boolean {
    return this.selectedProductIds.size > 0 && this.selectedProductIds.size === this.filteredCatalog.length;
  }

  someProductsSelected(): boolean {
    return this.selectedProductIds.size > 0 && this.selectedProductIds.size < this.filteredCatalog.length;
  }

  openBulkDeleteModal() {
    if (this.selectedProductIds.size === 0) return;
    this.showBulkDeleteModal = true;
  }

  closeBulkDeleteModal() {
    this.showBulkDeleteModal = false;
  }

  onBulkDeleteModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeBulkDeleteModal();
      return;
    }
    if (button.action === 'confirm' && !this.bulkDeleting) {
      this.confirmBulkDelete();
    }
  }

  confirmBulkDelete() {
    if (this.selectedProductIds.size === 0) return;
    
    this.bulkDeleting = true;
    const productIds = Array.from(this.selectedProductIds);
    let deletedCount = 0;
    let failedCount = 0;

    // Delete products one by one
    const deleteNext = (index: number) => {
      if (index >= productIds.length) {
        this.bulkDeleting = false;
        this.showBulkDeleteModal = false;
        this.selectedProductIds.clear();
        alert(`Deleted ${deletedCount} product(s). ${failedCount > 0 ? `${failedCount} failed.` : ''}`);
        this.loadCatalogPage();
        return;
      }

      const productId = productIds[index];
      this.dbService.deleteProductCatalog(productId).subscribe({
        next: (success) => {
          if (success) deletedCount++;
          else failedCount++;
          deleteNext(index + 1);
        },
        error: () => {
          failedCount++;
          deleteNext(index + 1);
        }
      });
    };

    deleteNext(0);
  }

  // ──────── PRICE CHANGE CONFIRMATION ────────

  closePriceChangeModal() {
    this.showPriceChangeModal = false;
    this.pricePreviewData = null;
    this.priceChangeError = '';
    this.pendingPriceUpdate = null;
  }

  onPriceChangeModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closePriceChangeModal();
      return;
    }
    if (button.action === 'confirm' && !this.isRecalculatingPrices) {
      this.confirmPriceUpdate();
    }
  }

  previewAndConfirmPriceChange(
    newPreorderPrice: number,
    newPreorderDiscountMinQty: number,
    newPreorderDiscountPrice: number,
    newStockPrice: number,
    newStockDiscountMinQty: number,
    newStockDiscountPrice: number
  ) {
    if (!this.editingBatchProduct?.id) return;

    const batchProductId = this.editingBatchProduct.id;
    this.priceChangeError = '';
    this.savingBatchProduct = true;  // Show loading on the first modal button

    this.dbService.previewPriceChange(
      batchProductId,
      newPreorderPrice,
      newPreorderDiscountMinQty,
      newPreorderDiscountPrice,
      newStockPrice,
      newStockDiscountMinQty,
      newStockDiscountPrice
    ).subscribe({
      next: (preview) => {
        this.savingBatchProduct = false;  // Hide loading after preview loads
        this.isRecalculatingPrices = false;
        this.pricePreviewData = preview;
        this.pendingPriceUpdate = {
          batchProductId,
          preorderPrice: newPreorderPrice,
          preorderDiscountMinQty: newPreorderDiscountMinQty,
          preorderDiscountPrice: newPreorderDiscountPrice,
          stockPrice: newStockPrice,
          stockDiscountMinQty: newStockDiscountMinQty,
          stockDiscountPrice: newStockDiscountPrice
        };
        this.showPriceChangeModal = true;
      },
      error: (err) => {
        this.savingBatchProduct = false;  // Hide loading on error
        this.isRecalculatingPrices = false;
        this.priceChangeError = 'Failed to load price change preview. Please try again.';
        console.error('Preview error:', err);
      }
    });
  }

  confirmPriceUpdate() {
    if (!this.pendingPriceUpdate) return;

    if (!this.authService.canPerformProductOperation('canEditBatchProductPricing')) {
      this.priceChangeError = 'You do not have permission to modify product prices in batches.';
      return;
    }

    this.priceChangeError = '';
    this.isRecalculatingPrices = true;

    const {
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    } = this.pendingPriceUpdate;

    this.dbService.updateBatchProductPriceWithRecalc(
      batchProductId,
      preorderPrice,
      preorderDiscountMinQty,
      preorderDiscountPrice,
      stockPrice,
      stockDiscountMinQty,
      stockDiscountPrice
    ).subscribe({
      next: (result) => {
        this.isRecalculatingPrices = false;
        this.closePriceChangeModal();
        this.closeBatchProductModal();
        // Reload batch products to reflect changes
        this.loadBatchProducts();
        // Optional: show success message
      },
      error: (err) => {
        this.isRecalculatingPrices = false;
        this.priceChangeError = 'Failed to update prices. Please try again.';
        console.error('Update error:', err);
      }
    });
  }

  // Math object reference for template
  Math = Math;

  // Clear zero values when input is focused
  clearIfZero(field: string) {
    const fieldKey = field as keyof typeof this.batchProductForm;
    if (this.batchProductForm[fieldKey] === 0) {
      this.batchProductForm[fieldKey] = '' as any;
    }
  }
}
