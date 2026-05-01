import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { Expense, ExpenseCategory, PaymentMethod } from '../../models';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, DateFilterComponent],
  template: `
    <div class="expenses-page">
      <div class="page-header">
        <h1>Expenses</h1>
        <div class="actions">
          <button class="btn btn-primary" (click)="openModal()" *ngIf="authService.can('create', 'expenses')">
            <span class="material-icons">add</span>
            Add Expense
          </button>
        </div>
      </div>

      <!-- Skeleton loader -->
      <ng-container *ngIf="loading">
        <div class="stats-grid">
          <div class="skeleton-stat-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-icon"></div>
            <div class="skeleton-line h-28 w-40" style="margin-bottom:8px"></div>
            <div class="skeleton-line h-12 w-60"></div>
          </div>
        </div>
        <div class="skeleton-search-bar">
          <div class="skeleton-input"></div>
          <div class="skeleton-select"></div>
          <div class="skeleton-select"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton-table">
            <div class="skeleton-thead">
              <div class="skeleton-th" *ngFor="let i of [1,2,3,4,5,6,7,8]"></div>
            </div>
            <div class="skeleton-row" *ngFor="let i of [1,2,3,4,5,6]">
              <div class="skeleton-td"></div>
              <div class="skeleton-td" style="flex:2"></div>
              <div class="skeleton-td"></div>
              <div class="skeleton-td"></div>
              <div class="skeleton-td"></div>
              <div class="skeleton-td"></div>
              <div class="skeleton-td"></div>
              <div class="skeleton-td" style="flex:0.6"></div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Actual content -->
      <ng-container *ngIf="!loading">
      <div class="stats-grid skeleton-fade-in">
        <div class="stat-card">
          <div class="stat-icon red">
            <span class="material-icons">account_balance_wallet</span>
          </div>
          <div class="stat-value">{{ totalExpenses | number:'1.2-2' }}</div>
          <div class="stat-label">Total Expenses (GHS)</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">
            <span class="material-icons">people</span>
          </div>
          <div class="stat-value">{{ totalSalaries | number:'1.2-2' }}</div>
          <div class="stat-label">Total Salaries (GHS)</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">
            <span class="material-icons">calendar_month</span>
          </div>
          <div class="stat-value">{{ monthlyTotal | number:'1.2-2' }}</div>
          <div class="stat-label">This Month (GHS)</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">
            <span class="material-icons">receipt_long</span>
          </div>
          <div class="stat-value">{{ expenseCount }}</div>
          <div class="stat-label">Total Records</div>
        </div>
      </div>

      <div class="search-bar skeleton-fade-in">
        <input
          type="text"
          placeholder="Search expenses..."
          [(ngModel)]="searchTerm"
          (input)="filterExpenses()"
        />
        <select [(ngModel)]="categoryFilter" (change)="filterExpenses()">
          <option value="all">All Categories</option>
          <option *ngFor="let cat of categories" [value]="cat.value">{{ cat.label }}</option>
        </select>
        <app-date-filter (dateChange)="dateFrom = $event.from; dateTo = $event.to; filterExpenses()"></app-date-filter>
      </div>

      <div class="card skeleton-fade-in">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Recipient</th>
                <th>Amount (GHS)</th>
                <th>Payment</th>
                <th>Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let expense of paginatedExpenses">
                <td>{{ expense.expenseDate | date:'mediumDate' }}</td>
                <td>
                  <span [class]="'category-badge cat-' + expense.category">
                    <span class="material-icons">{{ getCategoryIcon(expense.category) }}</span>
                    {{ getCategoryLabel(expense.category) }}
                  </span>
                </td>
                <td><strong>{{ expense.description }}</strong></td>
                <td>{{ expense.recipient || '-' }}</td>
                <td class="amount-cell">{{ expense.amount | number:'1.2-2' }}</td>
                <td>
                  <span class="payment-badge">{{ getPaymentLabel(expense.paymentMethod) }}</span>
                </td>
                <td>{{ expense.reference || '-' }}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" (click)="editExpense(expense)" *ngIf="authService.can('edit', 'expenses')">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-sm btn-danger" (click)="deleteExpense(expense)" *ngIf="authService.can('delete', 'expenses')">
                      <span class="material-icons">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="empty-state" *ngIf="filteredExpenses.length === 0">
            <span class="material-icons">account_balance_wallet</span>
            <h3>No expenses found</h3>
            <p>Start tracking your expenses and salaries</p>
          </div>

          <div class="pagination-bar" *ngIf="filteredExpenses.length > 0">
            <div class="page-size">
              <label>Rows:</label>
              <select [(ngModel)]="pageSize" (change)="currentPage = 1">
                <option *ngFor="let s of pageSizeOptions" [ngValue]="s">{{ s }}</option>
              </select>
            </div>
            <span>{{ (currentPage-1)*pageSize + 1 }}–{{ currentPage*pageSize < filteredExpenses.length ? currentPage*pageSize : filteredExpenses.length }} of {{ filteredExpenses.length }}</span>
            <div class="page-buttons">
              <button (click)="currentPage = 1" [disabled]="currentPage === 1">&laquo;</button>
              <button (click)="currentPage = currentPage - 1" [disabled]="currentPage === 1">&lsaquo;</button>
              <span>{{ currentPage }} / {{ totalPages }}</span>
              <button (click)="currentPage = currentPage + 1" [disabled]="currentPage >= totalPages">&rsaquo;</button>
              <button (click)="currentPage = totalPages" [disabled]="currentPage >= totalPages">&raquo;</button>
            </div>
          </div>
        </div>
      </div>
      </ng-container>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingExpense ? 'Edit Expense' : 'Add Expense' }}</h3>
            <button class="close-btn" (click)="closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Category *</label>
                <select [(ngModel)]="formData.category" (change)="onCategoryChange()">
                  <option *ngFor="let cat of categories" [value]="cat.value">{{ cat.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Date *</label>
                <input type="date" [(ngModel)]="formData.expenseDate" />
              </div>
            </div>

            <div class="form-group">
              <label>Description *</label>
              <input type="text" [(ngModel)]="formData.description"
                     [placeholder]="formData.category === 'salary' ? 'e.g., January 2026 Salary' : 'What was this expense for?'" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Amount (GHS) *</label>
                <input type="number" [(ngModel)]="formData.amount" placeholder="0.00" min="0" step="0.01" />
              </div>
              <div class="form-group">
                <label>{{ formData.category === 'salary' ? 'Employee Name' : 'Recipient / Vendor' }}</label>
                <input type="text" [(ngModel)]="formData.recipient"
                       [placeholder]="formData.category === 'salary' ? 'e.g., Kwame Asante' : 'Who received the payment?'" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Payment Method</label>
                <select [(ngModel)]="formData.paymentMethod">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div class="form-group">
                <label>Reference / Receipt #</label>
                <input type="text" [(ngModel)]="formData.reference"
                       placeholder="Transaction ID or receipt number" />
              </div>
            </div>

            <div class="form-group">
              <label>Notes</label>
              <textarea [(ngModel)]="formData.notes" placeholder="Additional notes..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveExpense()">
              {{ editingExpense ? 'Update' : 'Add' }} Expense
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .expenses-page {
      max-width: 1400px;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .amount-cell {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--danger-color);
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;

      .material-icons {
        font-size: 14px;
      }
    }

    .cat-salary      { background: #ede9fe; color: #6d28d9; }
    .cat-rent         { background: #fef3c7; color: #92400e; }
    .cat-utilities    { background: #dbeafe; color: #1e40af; }
    .cat-transport    { background: #d1fae5; color: #065f46; }
    .cat-supplies     { background: #fce7f3; color: #9d174d; }
    .cat-marketing    { background: #cffafe; color: #0e7490; }
    .cat-maintenance  { background: #e5e7eb; color: #374151; }
    .cat-food         { background: #fef3c7; color: #b45309; }
    .cat-other        { background: #f1f5f9; color: #475569; }

    .payment-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: #f1f5f9;
      color: #475569;
    }

    .stat-icon.red {
      background: #fee2e2;
      color: #ef4444;
    }

    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 13px;
      color: var(--text-secondary);
    }
    .page-size {
      display: flex;
      align-items: center;
      gap: 8px;
      label { font-weight: 500; }
      select { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-background); font-size: 13px; }
    }
    .page-buttons {
      display: flex;
      align-items: center;
      gap: 4px;
      button {
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: var(--card-background);
        cursor: pointer;
        font-size: 13px;
        &:disabled { opacity: 0.4; cursor: default; }
        &:hover:not(:disabled) { background: var(--border-color); }
      }
    }
  `]
})
export class ExpensesComponent implements OnInit {
  loading = true;
  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];
  searchTerm = '';
  categoryFilter = 'all';
  dateFrom = '';
  dateTo = '';
  showModal = false;
  editingExpense: Expense | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  pageSizeOptions = [10, 20, 50, 100];

  get paginatedExpenses() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredExpenses.slice(start, start + this.pageSize);
  }
  get totalPages() {
    return Math.ceil(this.filteredExpenses.length / this.pageSize) || 1;
  }

  // Stats
  totalExpenses = 0;
  totalSalaries = 0;
  monthlyTotal = 0;
  expenseCount = 0;

  categories = [
    { value: 'salary',      label: 'Salary' },
    { value: 'rent',        label: 'Rent' },
    { value: 'utilities',   label: 'Utilities' },
    { value: 'transport',   label: 'Transport' },
    { value: 'supplies',    label: 'Supplies' },
    { value: 'marketing',   label: 'Marketing' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'food',        label: 'Food & Drinks' },
    { value: 'other',       label: 'Other' },
  ];

  formData: Expense = {
    category: 'other',
    description: '',
    amount: 0,
    recipient: '',
    paymentMethod: 'cash',
    reference: '',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: ''
  };

  constructor(
    private dbService: DatabaseService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.loadExpenses();
  }

  loadExpenses() {
    this.loading = true;
    this.dbService.getExpenses().subscribe(expenses => {
      this.expenses = expenses;
      this.calculateStats();
      this.filterExpenses();
      this.loading = false;
    });
  }

  calculateStats() {
    this.expenseCount = this.expenses.length;
    this.totalExpenses = this.expenses.reduce((sum, e) => sum + e.amount, 0);
    this.totalSalaries = this.expenses
      .filter(e => e.category === 'salary')
      .reduce((sum, e) => sum + e.amount, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    this.monthlyTotal = this.expenses
      .filter(e => e.expenseDate >= monthStart)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  filterExpenses() {
    let filtered = this.expenses;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(term) ||
        (e.recipient || '').toLowerCase().includes(term) ||
        (e.reference || '').toLowerCase().includes(term)
      );
    }

    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === this.categoryFilter);
    }

    if (this.dateFrom) {
      filtered = filtered.filter(e => e.expenseDate >= this.dateFrom);
    }
    if (this.dateTo) {
      filtered = filtered.filter(e => e.expenseDate <= this.dateTo);
    }

    this.filteredExpenses = filtered;
    this.currentPage = 1;
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      salary: 'badge',
      rent: 'home',
      utilities: 'bolt',
      transport: 'directions_car',
      supplies: 'shopping_cart',
      marketing: 'campaign',
      maintenance: 'build',
      food: 'restaurant',
      other: 'more_horiz'
    };
    return icons[category] || 'more_horiz';
  }

  getCategoryLabel(category: string): string {
    const found = this.categories.find(c => c.value === category);
    return found?.label || category;
  }

  getPaymentLabel(method: string): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      mobile_money: 'Mobile Money',
      bank_transfer: 'Bank Transfer'
    };
    return labels[method] || method;
  }

  onCategoryChange() {
    // Auto-set description hint when switching to salary
  }

  openModal(expense?: Expense) {
    this.editingExpense = expense || null;
    if (expense) {
      this.formData = { ...expense };
    } else {
      this.formData = {
        category: 'other',
        description: '',
        amount: 0,
        recipient: '',
        paymentMethod: 'cash',
        reference: '',
        expenseDate: new Date().toISOString().split('T')[0],
        notes: ''
      };
    }
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingExpense = null;
  }

  editExpense(expense: Expense) {
    this.openModal(expense);
  }

  saveExpense() {
    if (!this.formData.description.trim()) {
      alert('Please enter a description');
      return;
    }
    if (!this.formData.amount || this.formData.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!this.formData.expenseDate) {
      alert('Please select a date');
      return;
    }

    if (this.editingExpense) {
      this.formData.id = this.editingExpense.id;
      this.dbService.updateExpense(this.formData).subscribe(() => {
        this.loadExpenses();
        this.closeModal();
      });
    } else {
      // Set the created_by to current user
      this.formData.createdBy = this.authService.currentUser?.id;
      this.dbService.createExpense(this.formData).subscribe(() => {
        this.loadExpenses();
        this.closeModal();
      });
    }
  }

  deleteExpense(expense: Expense) {
    if (confirm(`Are you sure you want to delete this expense: "${expense.description}"?`)) {
      this.dbService.deleteExpense(expense.id!).subscribe(() => {
        this.loadExpenses();
      });
    }
  }
}
