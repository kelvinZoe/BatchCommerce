import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ManageBatchesPermissionConfig } from '../../models';

interface BatchInfo {
  id?: number;
  name: string;
  createdAt?: string;
  status?: 'open' | 'closed';
  closedAt?: string | null;
  itemCount?: number;
  orderCount?: number;
}

@Component({
  selector: 'app-batches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="batch-page">
      <!-- PAGE HEADER -->
      <div class="batch-header">
        <div class="batch-header-left">
          <div class="batch-header-icon"><span class="material-icons">inventory_2</span></div>
          <div>
            <h1 class="batch-header-title">Batch Management</h1>
            <p class="batch-header-sub">View and manage product batches</p>
          </div>
        </div>
      </div>

      <div class="batch-card">
        <!-- Loading state -->
        <div *ngIf="loading" class="batch-skeleton-grid">
          <div class="batch-skeleton-card" *ngFor="let i of [1,2,3,4,5,6]">
            <div class="batch-sk batch-sk-line batch-sk-line-lg"></div>
            <div class="batch-sk batch-sk-line batch-sk-line-sm"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="!loading && batches.length === 0" class="batch-empty">
          <div class="batch-empty-icon"><span class="material-icons">inbox</span></div>
          <h3>No batches found</h3>
          <p>Create batches through the orders or arrivals pages.</p>
        </div>

        <!-- Batches list -->
        <div *ngIf="!loading && batches.length > 0" class="batch-list">
          <div class="batch-item" *ngFor="let batch of batches">
            <div class="batch-item-header">
              <div class="batch-item-top">
                <div class="batch-item-name">{{ batch.name }}</div>
                <span class="batch-status-badge" 
                      [class.batch-status-closed]="batch.status === 'closed'"
                      [class.batch-status-open]="batch.status === 'open'">
                  {{ batch.status || 'open' }}
                </span>
              </div>
              <div class="batch-item-meta">
                <span class="batch-meta-label">{{ batch.itemCount || 0 }} items</span>
                <span class="batch-meta-label">{{ batch.orderCount || 0 }} orders</span>
              </div>
            </div>
            <div class="batch-item-actions">
              <button class="batch-btn batch-btn-secondary"
                      *ngIf="authService.canPerformManageBatchesOperation('canRenameBatch')"
                      (click)="openRenameModal(batch)"
                      [disabled]="renamingBatch === batch.name"
                      title="Rename batch">
                <span class="material-icons" *ngIf="renamingBatch !== batch.name">drive_file_rename_outline</span>
                <span class="batch-spinner batch-spinner-dark" *ngIf="renamingBatch === batch.name"></span>
                Rename
              </button>
              <button class="batch-btn batch-btn-danger"
                      *ngIf="authService.canPerformManageBatchesOperation('canDeleteBatch')"
                      (click)="deleteBatch(batch)"
                      [disabled]="deletingBatch === batch.name"
                      title="Delete batch and all related data (products are preserved)">
                <span class="material-icons" *ngIf="deletingBatch !== batch.name">delete</span>
                <span class="batch-spinner" *ngIf="deletingBatch === batch.name"></span>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- RENAME MODAL -->
      <div class="batch-modal-overlay" *ngIf="showRenameModal" (click)="closeRenameModal()">
        <div class="batch-modal batch-modal-sm" (click)="$event.stopPropagation()">
          <div class="batch-modal-header">
            <div class="batch-modal-header-icon batch-modal-header-icon-info"><span class="material-icons">drive_file_rename_outline</span></div>
            <div class="batch-modal-header-text">
              <div class="batch-modal-title">Rename Batch</div>
              <div class="batch-modal-sub">Update the batch name everywhere it is displayed</div>
            </div>
            <button class="batch-modal-close" (click)="closeRenameModal()">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="batch-modal-body">
            <label class="batch-form-label">Batch name</label>
            <input
              class="batch-input"
              type="text"
              [(ngModel)]="renameBatchName"
              placeholder="Enter batch name"
              (keydown.enter)="confirmRenameBatch()" />
          </div>
          <div class="batch-modal-footer">
            <button class="batch-btn batch-btn-ghost" (click)="closeRenameModal()" [disabled]="!!renamingBatch">Cancel</button>
            <button class="batch-btn batch-btn-secondary"
                    (click)="confirmRenameBatch()"
                    [disabled]="!!renamingBatch || !renameBatchName.trim()">
              <span class="material-icons" *ngIf="!renamingBatch">save</span>
              <span class="batch-spinner batch-spinner-dark" *ngIf="!!renamingBatch"></span>
              Save Name
            </button>
          </div>
        </div>
      </div>

      <!-- DELETE CONFIRMATION MODAL -->
      <div class="batch-modal-overlay" *ngIf="showDeleteModal" (click)="showDeleteModal = false">
        <div class="batch-modal batch-modal-sm" (click)="$event.stopPropagation()">
          <div class="batch-modal-header">
            <div class="batch-modal-header-icon"><span class="material-icons">warning</span></div>
            <div class="batch-modal-header-text">
              <div class="batch-modal-title">Delete Batch</div>
              <div class="batch-modal-sub">This action cannot be undone</div>
            </div>
            <button class="batch-modal-close" (click)="showDeleteModal = false">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="batch-modal-body">
            <p class="batch-delete-warning">
              <strong>Are you sure you want to delete "{{ batchToDelete }}"?</strong>
            </p>
            <p class="batch-delete-info">
              All related data will be permanently deleted:
            </p>
            <ul class="batch-delete-list">
              <li>Orders and order items</li>
              <li>Buying list items</li>
              <li>Arrivals and arrival items</li>
              <li>Damages and allocations</li>
              <li>Shipping fees and deliveries</li>
            </ul>
            <p class="batch-delete-note">
              <strong>Note:</strong> Products will be preserved and can be used in future batches.
            </p>
          </div>
          <div class="batch-modal-footer">
            <button class="batch-btn batch-btn-ghost" (click)="showDeleteModal = false">Cancel</button>
            <button class="batch-btn batch-btn-danger" 
                    (click)="confirmDeleteBatch()" 
                    [disabled]="deletingBatch === batchToDelete">
              <span class="material-icons" *ngIf="deletingBatch !== batchToDelete">delete</span>
              <span class="batch-spinner" *ngIf="deletingBatch === batchToDelete"></span>
              Delete Batch
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* PAGE */
    .batch-page { padding: 0; }
    .batch-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; }

    /* HEADER */
    .batch-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
    .batch-header-left { display: flex; align-items: center; gap: 14px; }
    .batch-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .batch-header-title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .batch-header-sub { font-size: 13px; color: #64748b; margin: 2px 0 0; }

    /* BATCH LIST */
    .batch-list { display: flex; flex-direction: column; gap: 12px; }
    .batch-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; transition: all 0.13s; }
    .batch-item:hover { background: #fff; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 2px 8px rgba(99,102,241,0.1); }
    .batch-item-header { flex: 1; min-width: 0; }
    .batch-item-top { display: flex; align-items: center; gap: 10px; }
    .batch-item-name { font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .batch-status-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
    .batch-status-open { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .batch-status-closed { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .batch-item-meta { display: flex; gap: 12px; margin-top: 6px; }
    .batch-meta-label { font-size: 12px; color: #64748b; background: #fff; padding: 3px 8px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .batch-item-actions { display: flex; gap: 8px; flex-shrink: 0; margin-left: 16px; }

    /* BUTTONS */
    .batch-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.13s; }
    .batch-btn .material-icons { font-size: 16px; }
    .batch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .batch-btn-secondary { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .batch-btn-secondary:hover:not(:disabled) { background: #c7d2fe; }
    .batch-btn-danger { background: #ef4444; color: #fff; }
    .batch-btn-danger:hover:not(:disabled) { background: #dc2626; }

    /* EMPTY STATE */
    .batch-empty { text-align: center; padding: 48px 24px; }
    .batch-empty-icon { width: 60px; height: 60px; border-radius: 16px; background: rgba(99,102,241,0.08); color: var(--primary-color, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; }
    .batch-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .batch-empty p { font-size: 13px; color: #64748b; margin: 0; }

    /* SKELETON */
    .batch-skeleton-grid { display: flex; flex-direction: column; gap: 12px; }
    .batch-skeleton-card { padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
    .batch-sk { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: batch-shimmer 1.4s infinite; border-radius: 6px; }
    @keyframes batch-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .batch-sk-line { height: 12px; }
    .batch-sk-line-lg { width: 70%; }
    .batch-sk-line-sm { width: 40%; margin-top: 8px; }

    /* SPINNER */
    .batch-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: batch-spin 0.6s linear infinite; display: inline-block; flex-shrink: 0; }
    .batch-spinner-dark { border-color: rgba(55,48,163,0.25); border-top-color: #3730a3; }
    @keyframes batch-spin { to { transform: rotate(360deg); } }

    /* MODAL */
    .batch-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .batch-modal { background: #fff; border-radius: 14px; box-shadow: 0 20px 25px rgba(0,0,0,0.15); overflow: hidden; animation: batch-modal-slide-in 0.2s ease-out; }
    .batch-modal-sm { max-width: 450px; width: 90%; }
    @keyframes batch-modal-slide-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

    .batch-modal-header { display: flex; align-items: flex-start; gap: 14px; padding: 20px; border-bottom: 1px solid #e2e8f0; }
    .batch-modal-header-icon { width: 40px; height: 40px; border-radius: 10px; background: #fef3c7; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .batch-modal-header-icon-info { background: #e0e7ff; color: #4338ca; }
    .batch-modal-header-text { flex: 1; }
    .batch-modal-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .batch-modal-sub { font-size: 13px; color: #64748b; margin: 3px 0 0; }
    .batch-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.13s; padding: 0; }
    .batch-modal-close:hover { background: #f1f5f9; color: #0f172a; }

    .batch-modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
    .batch-form-label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
    .batch-input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; color: #0f172a; box-sizing: border-box; }
    .batch-input:focus { outline: none; border-color: var(--primary-color, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
    .batch-delete-warning { font-size: 14px; color: #0f172a; margin: 0 0 12px; line-height: 1.5; }
    .batch-delete-info { font-size: 13px; color: #64748b; margin: 12px 0 8px; }
    .batch-delete-list { font-size: 13px; color: #64748b; margin: 8px 0 16px 20px; padding: 0; }
    .batch-delete-list li { margin: 4px 0; }
    .batch-delete-note { font-size: 12px; color: #94a3b8; margin: 12px 0 0; padding: 12px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px; }

    .batch-modal-footer { display: flex; gap: 10px; padding: 16px 20px; border-top: 1px solid #e2e8f0; justify-content: flex-end; }
    .batch-btn-ghost { background: transparent; border: 1px solid #e2e8f0; color: #64748b; }
    .batch-btn-ghost:hover:not(:disabled) { background: #f1f5f9; border-color: #cbd5e1; color: #0f172a; }
  `]
})
export class BatchesComponent implements OnInit {
  batches: BatchInfo[] = [];
  loading = true;
  deletingBatch: string | null = null;
  renamingBatch: string | null = null;
  showDeleteModal = false;
  batchToDelete: string | null = null;
  batchIdToDelete: number | null = null;
  showRenameModal = false;
  batchToRename: BatchInfo | null = null;
  renameBatchName = '';

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBatches();
    
    // Reload batches when a batch is deleted elsewhere
    this.dbService.batchDeleted$.subscribe(() => {
      this.loadBatches();
    });
  }

  private loadBatches(): void {
    this.loading = true;
    this.dbService.getAllBatchesForManagement(1, 1000).subscribe(({ data }) => {
      // Map batches and fetch their counts
      const batchesWithoutCounts = (data || []);
      const countRequests = batchesWithoutCounts.map(batch =>
        forkJoin({
          itemCount: batch.id ? this.dbService.getBatchItemCountById(batch.id) : this.dbService.getBatchItemCount(batch.name),
          orderCount: batch.id ? this.dbService.getBatchOrderCountById(batch.id) : this.dbService.getBatchOrderCount(batch.name)
        }).pipe(
          map(counts => ({
            id: batch.id,
            name: batch.name,
            createdAt: batch.createdAt,
            status: batch.status as 'open' | 'closed',
            closedAt: batch.closedAt,
            itemCount: counts.itemCount,
            orderCount: counts.orderCount
          }))
        )
      );

      if (countRequests.length === 0) {
        this.batches = [];
        this.loading = false;
      } else {
        forkJoin(countRequests).subscribe(
          batches => {
            this.batches = batches;
            this.loading = false;
          },
          () => {
            this.loading = false;
          }
        );
      }
    }, () => {
      this.loading = false;
    });
  }

  deleteBatch(batch: BatchInfo): void {
    if (!this.authService.canPerformManageBatchesOperation('canDeleteBatch')) {
      alert('You do not have permission to delete batches');
      return;
    }
    this.batchToDelete = batch.name;
    this.batchIdToDelete = batch.id ?? null;
    this.showDeleteModal = true;
  }

  openRenameModal(batch: BatchInfo): void {
    if (!this.authService.canPerformManageBatchesOperation('canRenameBatch')) {
      alert('You do not have permission to rename batches');
      return;
    }
    if (!batch.id) {
      alert('This batch cannot be renamed because it is missing an id.');
      return;
    }
    this.batchToRename = batch;
    this.renameBatchName = batch.name;
    this.showRenameModal = true;
  }

  closeRenameModal(): void {
    if (this.renamingBatch) return;
    this.showRenameModal = false;
    this.batchToRename = null;
    this.renameBatchName = '';
  }

  confirmRenameBatch(): void {
    if (!this.batchToRename?.id) return;
    if (!this.authService.canPerformManageBatchesOperation('canRenameBatch')) return;
    const nextName = this.renameBatchName.trim();
    if (!nextName || nextName === this.batchToRename.name) {
      this.closeRenameModal();
      return;
    }

    const previousName = this.batchToRename.name;
    this.renamingBatch = previousName;
    this.dbService.updateOrderBatch(this.batchToRename.id, nextName).subscribe(success => {
      this.renamingBatch = null;
      if (!success) {
        alert(`Failed to rename batch "${previousName}". Please try again.`);
        return;
      }
      this.showRenameModal = false;
      this.batchToRename = null;
      this.renameBatchName = '';
      this.loadBatches();
    });
  }

  confirmDeleteBatch(): void {
    if (!this.batchToDelete) return;
    if (!this.authService.canPerformManageBatchesOperation('canDeleteBatch')) return;
    const batchName = this.batchToDelete;
    const batchId = this.batchIdToDelete;

    this.deletingBatch = batchName;
    const deleteRequest = batchId
      ? this.dbService.deleteBatchCascadeById(batchId, batchName)
      : this.dbService.deleteBatchCascade(batchName);

    deleteRequest.subscribe(
      success => {
        this.deletingBatch = null;
        if (success) {
          alert(`Batch "${batchName}" has been deleted successfully.`);
          this.showDeleteModal = false;
          this.batchToDelete = null;
          this.batchIdToDelete = null;
          // Reload batches from database to verify deletion
          this.loadBatches();
        } else {
          alert(`Failed to delete batch "${batchName}". Please try again.`);
        }
      },
      error => {
        this.deletingBatch = null;
        console.error('Error deleting batch:', error);
        alert(`Error deleting batch: ${error?.message || 'Unknown error'}`);
      }
    );
  }
}
