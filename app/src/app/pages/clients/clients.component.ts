import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { Client } from '../../models';
import { ModalButtonConfig, ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { StatCardConfig, StatCardsComponent } from '../../components/stat-cards/stat-cards.component';
import { TableComponent, TableColumn, TableMetadata, ActionOption } from '../../components/table/table.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, TableComponent, ModalShellComponent, StatCardsComponent],
  template: `
    <div class="cl-page">
      <!-- PAGE HEADER -->
      <div class="cl-page-header">
        <div class="cl-header-left">
          <div class="cl-header-icon"><i class="ri-team-line"></i></div>
          <div>
            <h1 class="cl-title">Clients</h1>
            <p class="cl-subtitle">Manage your customer contacts</p>
          </div>
        </div>
        <button 
          class="cl-btn cl-btn-primary" 
          (click)="openAddModal()" 
          *ngIf="authService.can('create', 'clients')">
          <i class="ri-user-add-line"></i> Add Client
        </button>
      </div>

      <!-- MAIN CARD -->
      <div class="cl-card">
        <app-stat-cards [config]="clientStatCards"></app-stat-cards>

        <!-- TABLE -->
        <app-table
          [columns]="columns"
          [data]="clientTableRows"
          [metadata]="metadata"
          [showSearchRow]="true"
          [searchDebounce]="300"
          [searching]="loading"
          [initialLoading]="initialLoading"
          [filters]="[]"
          [tableLabel]="'Client Directory'"
          [summaryLabel]="'Clients'"
          [summaryValue]="metadata.totalCount"
          [baseColor]="baseColor"
          [showToolbarEnd]="selectedClientIds.size > 0 && authService.can('delete', 'clients')"
          (pageChange)="onPageChange($event)"
          (checkboxChange)="onTableCheckboxChange($event)"
          (searchChange)="onSearchChange($event)"
          (sortChange)="onSortChange($event)"
          (actionClick)="onActionClick($event)">
          <button
            table-toolbar-end
            class="cl-btn cl-btn-danger"
            (click)="openBulkDeleteModal()"
            [disabled]="bulkDeleting">
            <i *ngIf="!bulkDeleting" class="ri-delete-bin-line"></i>
            <span *ngIf="bulkDeleting" class="cl-spinner"></span>
            Delete {{ selectedClientIds.size }} Client{{ selectedClientIds.size !== 1 ? 's' : '' }}
          </button>
        </app-table>
      </div><!-- /cl-card -->

      <app-modal-shell
        *ngIf="showAddEditModal"
        size="lg"
        [title]="editingClient ? 'Edit Client' : 'Add Client'"
        [subtitle]="editingClient ? 'Update contact details' : 'Add a new customer contact'"
        [icon]="editingClient ? 'edit_square' : 'person_add'"
        [showClose]="!saving"
        [closeOnBackdrop]="!saving"
        [buttons]="addEditModalButtons"
        (closeRequested)="closeAddEditModal()"
        (buttonClick)="onAddEditModalButton($event)">
        <div modal-body>
          <div class="cl-form-group">
            <label class="cl-label">Full Name <span class="cl-req">*</span></label>
            <input class="cl-input" type="text" [(ngModel)]="formData.name" placeholder="Enter client name" />
          </div>
          <div class="cl-form-row">
            <div class="cl-form-group">
              <label class="cl-label">Phone Number</label>
              <input class="cl-input" type="tel" [(ngModel)]="formData.phone" placeholder="e.g. 0241234567" />
            </div>
            <div class="cl-form-group">
              <label class="cl-label">WhatsApp Number</label>
              <input class="cl-input" type="tel" [(ngModel)]="formData.whatsappNumber" placeholder="e.g. 233241234567" />
            </div>
          </div>
          <div class="cl-form-group">
            <label class="cl-label">Delivery Address</label>
            <textarea class="cl-input cl-textarea" [(ngModel)]="formData.address" placeholder="Enter delivery address…"></textarea>
          </div>
          <div class="cl-form-group">
            <label class="cl-label">Notes</label>
            <textarea class="cl-input cl-textarea" [(ngModel)]="formData.notes" placeholder="Any additional notes…"></textarea>
          </div>
        </div>
      </app-modal-shell>

      <app-modal-shell
        *ngIf="showDeleteModal"
        size="sm"
        tone="danger"
        title="Delete Client"
        subtitle="This action cannot be undone"
        icon="delete"
        [showClose]="!deleting"
        [closeOnBackdrop]="!deleting"
        [buttons]="deleteModalButtons"
        (closeRequested)="closeDeleteModal()"
        (buttonClick)="onDeleteModalButton($event)">
        <div modal-body>
          <p class="cl-modal-copy"><strong>Delete "{{ pendingDeleteClient?.name }}"?</strong></p>
          <p class="cl-modal-copy cl-modal-copy-muted">All contact information and history will be permanently deleted.</p>
        </div>
      </app-modal-shell>

      <app-modal-shell
        *ngIf="showBulkDeleteModal"
        size="sm"
        tone="danger"
        [title]="'Delete ' + selectedClientIds.size + ' Client' + (selectedClientIds.size !== 1 ? 's' : '') + '?'"
        subtitle="This action cannot be undone"
        icon="delete"
        [showClose]="!bulkDeleting"
        [closeOnBackdrop]="!bulkDeleting"
        [buttons]="bulkDeleteModalButtons"
        (closeRequested)="closeBulkDeleteModal()"
        (buttonClick)="onBulkDeleteModalButton($event)">
        <div modal-body>
          <p class="cl-modal-copy"><strong>Delete {{ selectedClientIds.size }} client{{ selectedClientIds.size !== 1 ? 's' : '' }}?</strong></p>
          <p class="cl-modal-copy cl-modal-copy-muted">All contact information and history will be permanently deleted.</p>
          <p class="cl-modal-copy cl-modal-copy-muted">You are about to delete {{ selectedClientIds.size }} record{{ selectedClientIds.size !== 1 ? 's' : '' }}.</p>
        </div>
      </app-modal-shell>
    </div>
  `,
  styles: [`
    .cl-page { padding: 0; max-width: 1400px; }
    .cl-page-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 16px; gap: 12px; flex-wrap: wrap; }
    .cl-header-left { display: flex; align-items: center; gap: 14px; }
    .cl-header-icon { width: 46px; height: 46px; border-radius: 12px; background: var(--primary-color, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .cl-title { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
    .cl-subtitle { margin: 2px 0 0; font-size: 12px; color: #64748b; }

    .cl-card { background: #fff; border: 1px solid #ccc; border-radius: 14px; padding: 20px; overflow: hidden; }

    .cl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
    .cl-btn i { font-size: 17px; }
    .cl-btn:disabled { opacity: 0.45; cursor: default; pointer-events: none; }
    .cl-btn-primary { background: var(--primary-color, #6366f1); color: #fff; }
    .cl-btn-primary:hover:not(:disabled) { background: var(--primary-dark, #4f46e5); }
    .cl-btn-danger { background: #ef4444; color: #fff; }
    .cl-btn-danger:hover:not(:disabled) { background: #dc2626; }
    .cl-form-group { display: flex; flex-direction: column; gap: 5px; }
    .cl-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .cl-label { font-size: 12px; font-weight: 600; color: #475569; }
    .cl-req { color: #ef4444; }
    .cl-input { padding: 9px 12px; border: 1px solid #ccc; border-radius: 9px; font-size: 13px; color: #334155; background: #f8fafc; outline: none; width: 100%; box-sizing: border-box; }
    .cl-input:focus { border-color: var(--primary-color, #6366f1); background: #fff; }
    .cl-textarea { resize: vertical; min-height: 72px; }
    .cl-modal-copy { color: #0f172a; font-size: 14px; margin: 0 0 12px; line-height: 1.5; }
    .cl-modal-copy-muted { color: #64748b; margin-bottom: 0; }

    .cl-spinner { width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff; border-radius: 50%; animation: cl-spin 0.7s linear infinite; display: inline-block; }
    @keyframes cl-spin { to { transform: rotate(360deg); } }
  `]
})
export class ClientsComponent implements OnInit, OnDestroy {
  initialLoading = false;
  loading = false;
  saving = false;
  bulkDeleting = false;
  deleting = false;
  showAddEditModal = false;
  showDeleteModal = false;
  showBulkDeleteModal = false;

  paginatedClients: Client[] = [];

  editingClient: Client | null = null;
  formData: Client = { name: '', phone: '', whatsappNumber: '', address: '', notes: '' };
  pendingDeleteClient: Client | null = null;

  selectedClientIds = new Set<number>();
  clientSummary = { total: 0, contactable: 0, addressed: 0 };

  get addEditModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.saving },
      { buttonName: this.editingClient ? 'Update' : 'Add Client', color: 'base_color', action: 'confirm', disabled: this.saving, loading: this.saving }
    ];
  }

  get deleteModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.deleting },
      { buttonName: 'Delete', color: 'danger', action: 'confirm', disabled: this.deleting, loading: this.deleting }
    ];
  }

  get bulkDeleteModalButtons(): ModalButtonConfig[] {
    return [
      { buttonName: 'Cancel', color: 'secondary', action: 'cancel', disabled: this.bulkDeleting },
      { buttonName: 'Delete All', color: 'danger', action: 'confirm', disabled: this.bulkDeleting, loading: this.bulkDeleting }
    ];
  }

  currentPage = 1;
  pageSize = 20;
  nameSearchTerm = '';
  addressSearchTerm = '';
  baseColor: string = '#6366f1';

  columns: TableColumn[] = [];

  metadata: TableMetadata = { pageNumber: 1, totalCount: 0, pageSize: 20, totalPages: 1 };

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService,
    private themeService: ThemeService
  ) {
    this.baseColor = this.themeService.primaryColor;
  }

  ngOnInit() {
    this.setupColumns();
    this.loadClientsPage(1, true, true);
    this.setupThemeListener();
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.onStorageChange);
  }

  private setupThemeListener() {
    window.addEventListener('storage', this.onStorageChange);
  }

  private onStorageChange = () => {
    this.baseColor = this.themeService.primaryColor;
  }

  get clientStatCards(): StatCardConfig[] {
    return [
      { icon: 'groups', statName: 'Total Clients', statValue: this.clientSummary.total, color: 'base' },
      { icon: 'call', statName: 'Reachable', statValue: this.clientSummary.contactable, color: 'green' },
      { icon: 'home', statName: 'With Address', statValue: this.clientSummary.addressed, color: 'blue' }
    ];
  }

  get clientTableRows() {
    return this.paginatedClients.map(client => ({
      ...client,
      selected: !!client.id && this.selectedClientIds.has(client.id),
      actions: this.getClientActions(client)
    }));
  }

  private setupColumns() {
    const columns: TableColumn[] = [
      { key: 'name', label: 'Name', type: 'string', searchable: true },
      { key: 'phone', label: 'Phone', type: 'string' },
      { key: 'whatsappNumber', label: 'WhatsApp', type: 'string' },
      { key: 'address', label: 'Address', type: 'string', searchable: true },
      { key: 'notes', label: 'Notes', type: 'string' }
    ];

    if (this.authService.can('delete', 'clients')) {
      columns.unshift({ key: 'selected', label: '', type: 'checkbox' });
    }

    if (this.authService.can('edit', 'clients') || this.authService.can('delete', 'clients')) {
      columns.push({ key: 'actions', label: 'Actions', type: 'actions' });
    }

    this.columns = columns;
  }

  loadClientsPage(page: number = this.currentPage, initial = false, refreshStats = false) {
    if (initial) {
      this.initialLoading = true;
    } else {
      this.loading = true;
    }

    this.currentPage = page;

    if (refreshStats) {
      this.loadClientSummary();
    }

    this.dbService.getClientsPage(page, this.pageSize, this.nameSearchTerm, this.addressSearchTerm).subscribe({
      next: result => {
        const totalPages = Math.ceil(result.total / this.pageSize) || 1;

        if (page > totalPages) {
          if (initial) {
            this.initialLoading = false;
          } else {
            this.loading = false;
          }
          this.loadClientsPage(totalPages, initial, false);
          return;
        }

        this.paginatedClients = result.data;
        this.metadata = {
          pageNumber: page,
          totalCount: result.total,
          pageSize: this.pageSize,
          totalPages
        };

        if (initial) {
          this.initialLoading = false;
        } else {
          this.loading = false;
        }
      },
      error: (err: any) => {
        console.error(err);
        if (initial) {
          this.initialLoading = false;
        } else {
          this.loading = false;
        }
        alert('Error loading clients');
      }
    });
  }

  onPageChange(page: number) {
    this.loadClientsPage(page);
  }

  onTableCheckboxChange(event: { item: Client; checked: boolean }) {
    const clientId = event.item.id;
    if (!clientId) return;
    if (event.checked) {
      this.selectedClientIds.add(clientId);
      return;
    }
    this.selectedClientIds.delete(clientId);
  }

  onSearchChange(query: Record<string, string>) {
    this.nameSearchTerm = query['name'] || '';
    this.addressSearchTerm = query['address'] || '';
    this.selectedClientIds.clear();
    this.loadClientsPage(1, false, true);
  }

  onSortChange(event: { sortKey: string | null; sortDir: 'asc' | 'desc' | null }) {
    // Sort functionality can be implemented here if needed
  }

  onActionClick(event: { action: ActionOption; item: Client }) {
    if (event.action.id === 'edit') {
      this.editClient(event.item);
    } else if (event.action.id === 'delete') {
      this.deleteClient(event.item);
    }
  }

  private getClientActions(client: Client): ActionOption[] {
    const actions: ActionOption[] = [];
    if (this.authService.can('edit', 'clients')) {
      actions.push({ id: 'edit', label: 'Edit', icon: 'pencil', color: 'blue' });
    }
    if (this.authService.can('delete', 'clients')) {
      actions.push({ id: 'delete', label: 'Delete', icon: 'trash', color: 'red' });
    }
    return actions;
  }

  private loadClientSummary() {
    this.dbService.getClientsSummary(this.nameSearchTerm, this.addressSearchTerm).subscribe({
      next: summary => {
        this.clientSummary = summary;
      },
      error: (err: any) => {
        console.error('Error loading client summary', err);
      }
    });
  }

  openAddModal() {
    this.editingClient = null;
    this.formData = { name: '', phone: '', whatsappNumber: '', address: '', notes: '' };
    this.showAddEditModal = true;
  }

  editClient(client: Client) {
    this.editingClient = client;
    this.formData = { ...client };
    this.showAddEditModal = true;
  }

  closeAddEditModal() {
    if (this.saving) return;
    this.showAddEditModal = false;
    this.editingClient = null;
  }

  onAddEditModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeAddEditModal();
      return;
    }
    if (button.action === 'confirm' && !this.saving) {
      this.saveClient();
    }
  }

  saveClient() {
    if (!this.formData.name.trim()) {
      alert('Please enter a client name');
      return;
    }

    if (!this.formData.whatsappNumber && this.formData.phone) {
      this.formData.whatsappNumber = this.formData.phone;
    }

    this.saving = true;

    if (this.editingClient) {
      this.dbService.updateClient({ ...this.formData, id: this.editingClient.id }).subscribe({
        next: () => {
          this.saving = false;
          this.loadClientsPage(this.currentPage, false, true);
          this.showAddEditModal = false;
          this.editingClient = null;
        },
        error: (err: any) => {
          this.saving = false;
          console.error(err);
          alert('Error saving client');
        }
      });
    } else {
      this.dbService.createClient(this.formData).subscribe({
        next: () => {
          this.saving = false;
          this.loadClientsPage(1, false, true);
          this.showAddEditModal = false;
          this.editingClient = null;
        },
        error: (err: any) => {
          this.saving = false;
          console.error(err);
          alert('Error saving client');
        }
      });
    }
  }

  deleteClient(client: Client) {
    this.pendingDeleteClient = client;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    if (this.deleting) return;
    this.showDeleteModal = false;
    this.pendingDeleteClient = null;
  }

  onDeleteModalButton(button: ModalButtonConfig) {
    if (button.action === 'cancel') {
      this.closeDeleteModal();
      return;
    }
    if (button.action === 'confirm' && !this.deleting) {
      this.confirmDeleteClient();
    }
  }

  confirmDeleteClient() {
    const client = this.pendingDeleteClient;
    if (!client?.id) return;
    this.deleting = true;
    this.dbService.deleteClient(client.id).subscribe({
      next: () => {
        this.deleting = false;
        this.selectedClientIds.delete(client.id!);
        this.pendingDeleteClient = null;
        this.showDeleteModal = false;
        this.loadClientsPage(this.currentPage, false, true);
      },
      error: (err: any) => {
        this.deleting = false;
        console.error(err);
        alert('Error deleting client');
      }
    });
  }

  openBulkDeleteModal() {
    if (this.selectedClientIds.size === 0) return;
    this.showBulkDeleteModal = true;
  }

  closeBulkDeleteModal() {
    if (this.bulkDeleting) return;
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
    if (this.selectedClientIds.size === 0) return;

    this.bulkDeleting = true;
    const clientIds = Array.from(this.selectedClientIds);
    let deletedCount = 0;
    let failedCount = 0;

    const deleteNext = (index: number) => {
      if (index >= clientIds.length) {
        this.bulkDeleting = false;
        this.showBulkDeleteModal = false;
        this.selectedClientIds.clear();
        alert(`Deleted ${deletedCount} client(s). ${failedCount > 0 ? `${failedCount} failed.` : ''}`);
        this.loadClientsPage(this.currentPage, false, true);
        return;
      }

      const clientId = clientIds[index];
      this.dbService.deleteClient(clientId).subscribe({
        next: () => {
          deletedCount++;
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
}
