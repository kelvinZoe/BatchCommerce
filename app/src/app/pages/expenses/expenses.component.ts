import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { ModalShellComponent } from '../../components/modal-shell/modal-shell.component';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../../models';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, DateFilterComponent, ModalShellComponent],
  template: `
    <div class="expenses-page">
      <div class="page-header">
        <div>
          <span class="page-kicker">Operating costs</span>
          <h1>Expenses</h1>
          <p class="page-subtitle">Track salaries, utilities, rent, fees, and the everyday costs of running the shop.</p>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" type="button" (click)="loadExpenses()" [disabled]="loading">
            <span class="material-icons" [class.spin]="loading">refresh</span>
            Refresh
          </button>
          <button class="btn btn-primary" (click)="openModal()" *ngIf="authService.can('create', 'expenses')">
            <span class="material-icons">add</span>
            Add Expense
          </button>
        </div>
      </div>

      <div class="feedback feedback-error" *ngIf="errorMessage" role="alert">
        <span class="material-icons">error_outline</span>
        <span>{{ errorMessage }}</span>
        <button type="button" (click)="errorMessage = ''" aria-label="Dismiss error">&times;</button>
      </div>
      <div class="feedback feedback-success" *ngIf="successMessage" role="status">
        <span class="material-icons">check_circle</span>
        <span>{{ successMessage }}</span>
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
          <div class="stat-value">GHS {{ monthlyTotal | number:'1.2-2' }}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">
            <span class="material-icons">badge</span>
          </div>
          <div class="stat-value">GHS {{ monthlySalaries | number:'1.2-2' }}</div>
          <div class="stat-label">Salaries & Wages</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">
            <span class="material-icons">bolt</span>
          </div>
          <div class="stat-value">GHS {{ monthlyUtilities | number:'1.2-2' }}</div>
          <div class="stat-label">Utilities</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">
            <span class="material-icons">receipt_long</span>
          </div>
          <div class="stat-value">GHS {{ monthlyOtherCosts | number:'1.2-2' }}</div>
          <div class="stat-label">Other Operating Costs</div>
        </div>
      </div>

      <section class="category-overview skeleton-fade-in">
        <div class="category-overview-head">
          <div>
            <span class="page-kicker">This month</span>
            <h2>Where the money went</h2>
          </div>
          <span class="record-count">{{ monthlyExpenseCount }} record{{ monthlyExpenseCount === 1 ? '' : 's' }}</span>
        </div>
        <div class="category-grid" *ngIf="monthlyCategorySummary.length; else noMonthlyExpenses">
          <button type="button" class="category-tile" *ngFor="let category of monthlyCategorySummary" (click)="filterByCategory(category.value)">
            <span class="category-tile-icon material-icons">{{ category.icon }}</span>
            <span class="category-tile-copy">
              <strong>{{ category.label }}</strong>
              <small>{{ category.percent }}% of this month</small>
            </span>
            <b>GHS {{ category.amount | number:'1.2-2' }}</b>
          </button>
        </div>
        <ng-template #noMonthlyExpenses>
          <div class="category-empty">No expenses recorded this month yet.</div>
        </ng-template>
      </section>

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
                <td data-label="Date">{{ expense.expenseDate | date:'mediumDate' }}</td>
                <td data-label="Category">
                  <span [class]="'category-badge cat-' + expense.category">
                    <span class="material-icons">{{ getCategoryIcon(expense.category) }}</span>
                    {{ getCategoryLabel(expense.category) }}
                  </span>
                </td>
                <td data-label="Description"><strong>{{ expense.description }}</strong></td>
                <td data-label="Recipient">{{ expense.recipient || '-' }}</td>
                <td data-label="Amount" class="amount-cell">GHS {{ expense.amount | number:'1.2-2' }}</td>
                <td data-label="Payment">
                  <span class="payment-badge">{{ getPaymentLabel(expense.paymentMethod) }}</span>
                </td>
                <td data-label="Reference">{{ expense.reference || '-' }}</td>
                <td data-label="Actions">
                  <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" type="button" title="Edit expense" [attr.aria-label]="'Edit ' + expense.description" (click)="editExpense(expense)" *ngIf="authService.can('edit', 'expenses')">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-sm btn-danger" type="button" title="Delete expense" [attr.aria-label]="'Delete ' + expense.description" (click)="deleteExpense(expense)" [disabled]="deletingExpenseId === expense.id" *ngIf="authService.can('delete', 'expenses')">
                      <span class="material-icons" [class.spin]="deletingExpenseId === expense.id">{{ deletingExpenseId === expense.id ? 'sync' : 'delete' }}</span>
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
      <app-modal-shell
        *ngIf="showModal"
        size="lg"
        [title]="editingExpense ? 'Edit Expense' : 'Add Expense'"
        [subtitle]="editingExpense ? 'Update the expense record' : 'Track a new business expense or salary'"
        [icon]="editingExpense ? 'edit_note' : 'receipt_long'"
        (closeRequested)="closeModal()">
        <div modal-body>
          <div class="modal-error" *ngIf="formErrorMessage" role="alert">
            <span class="material-icons">error_outline</span>
            {{ formErrorMessage }}
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Category *</label>
              <select [(ngModel)]="formData.category">
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
                   maxlength="160"
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
        <div modal-footer>
          <button class="btn btn-secondary" type="button" (click)="closeModal()" [disabled]="saving">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="saveExpense()" [disabled]="saving">
            <span class="material-icons spin" *ngIf="saving">sync</span>
            {{ saving ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Add Expense') }}
          </button>
        </div>
      </app-modal-shell>
    </div>
  `,
  styles: [`
    .expenses-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      align-items: flex-end;
      margin-bottom: 18px;
    }

    .page-kicker {
      display: block;
      color: #0f766e;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .page-header h1 {
      margin: 4px 0 3px;
    }

    .page-subtitle {
      margin: 0;
      color: #64748b;
      font-size: 13px;
    }

    .feedback {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 14px;
      padding: 11px 13px;
      border: 1px solid;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 650;
    }

    .feedback .material-icons { font-size: 18px; }
    .feedback button { margin-left: auto; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 20px; }
    .feedback-error { background: #fff7f7; border-color: #fecaca; color: #991b1b; }
    .feedback-success { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }

    .stats-grid {
      grid-template-columns: repeat(4, minmax(190px, 1fr));
    }

    .category-overview {
      margin: 18px 0;
      padding: 18px;
      border: 1px solid rgba(15, 118, 110, .16);
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(240, 253, 250, .92), rgba(255, 255, 255, .98));
    }

    .category-overview-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 13px;
    }

    .category-overview-head h2 {
      margin: 3px 0 0;
      color: #0f172a;
      font-size: 18px;
      letter-spacing: -.025em;
    }

    .record-count {
      padding: 6px 10px;
      border-radius: 999px;
      background: #ccfbf1;
      color: #115e59;
      font-size: 11px;
      font-weight: 850;
    }

    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(225px, 1fr));
      gap: 9px;
    }

    .category-tile {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 66px;
      padding: 11px;
      border: 1px solid rgba(148, 163, 184, .22);
      border-radius: 14px;
      background: rgba(255, 255, 255, .88);
      color: #334155;
      cursor: pointer;
      text-align: left;
      transition: transform .15s ease, box-shadow .15s ease;
    }

    .category-tile:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, .07);
    }

    .category-tile:focus-visible {
      outline: 3px solid rgba(15, 118, 110, .22);
      outline-offset: 2px;
    }

    .category-tile-icon {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: #ccfbf1;
      color: #0f766e;
      font-size: 19px;
    }

    .category-tile-copy { display: grid; gap: 2px; min-width: 0; }
    .category-tile-copy strong { overflow: hidden; color: #1e293b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .category-tile-copy small { color: #64748b; font-size: 10px; }
    .category-tile b { color: #0f172a; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .category-empty { padding: 22px; border: 1px dashed #99f6e4; border-radius: 14px; color: #64748b; font-size: 12px; text-align: center; }

    .modal-error {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 14px;
      padding: 10px 12px;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fff7f7;
      color: #991b1b;
      font-size: 12px;
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
    .cat-communication{ background: #cffafe; color: #155e75; }
    .cat-software     { background: #e0e7ff; color: #3730a3; }
    .cat-transport    { background: #d1fae5; color: #065f46; }
    .cat-supplies     { background: #fce7f3; color: #9d174d; }
    .cat-marketing    { background: #cffafe; color: #0e7490; }
    .cat-maintenance  { background: #e5e7eb; color: #374151; }
    .cat-food         { background: #fef3c7; color: #b45309; }
    .cat-taxes        { background: #ffedd5; color: #9a3412; }
    .cat-insurance    { background: #dcfce7; color: #166534; }
    .cat-professional_services { background: #f3e8ff; color: #7e22ce; }
    .cat-bank_fees    { background: #ffe4e6; color: #be123c; }
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

    .spin { animation: expense-spin .8s linear infinite; }

    @keyframes expense-spin { to { transform: rotate(360deg); } }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      .expenses-page { width: 100%; min-width: 0; }

      .page-header {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
        margin-bottom: 14px;
      }

      .page-header h1 { font-size: 25px; line-height: 1.05; }
      .page-subtitle { max-width: 34ch; font-size: 12px; line-height: 1.55; }

      .page-header .actions {
        display: grid;
        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
        width: 100%;
        gap: 8px;
      }

      .page-header .actions .btn {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        padding-inline: 10px;
        white-space: nowrap;
      }

      .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }

      .stat-card {
        min-width: 0;
        padding: 14px;
        border-radius: 16px;
      }

      .stat-card .stat-icon {
        width: 36px;
        height: 36px;
        margin-bottom: 10px;
        border-radius: 10px;
      }

      .stat-card .stat-icon .material-icons { font-size: 19px; }
      .stat-card .stat-value { margin-bottom: 3px; font-size: clamp(18px, 5vw, 22px); line-height: 1.15; }
      .stat-card .stat-label { font-size: 11px; line-height: 1.35; }

      .category-overview { margin: 14px 0; padding: 14px; border-radius: 17px; }
      .category-overview-head { align-items: center; gap: 10px; }
      .category-overview-head h2 { font-size: 16px; }
      .category-grid { grid-template-columns: 1fr; }
      .category-tile { grid-template-columns: auto minmax(0, 1fr); }
      .category-tile b { grid-column: 2; }

      .search-bar {
        display: grid;
        grid-template-columns: 1fr;
        gap: 9px;
        margin-bottom: 14px;
      }

      .search-bar input,
      .search-bar select,
      .search-bar app-date-filter {
        width: 100%;
        min-width: 0;
        max-width: none;
        box-sizing: border-box;
      }

      .card { padding: 0; border: 0; background: transparent; }
      .table-container { overflow: visible; }
      table, tbody, tr, td { display: block; width: 100%; box-sizing: border-box; }
      table { border-collapse: separate; }
      thead { display: none; }
      tbody { display: grid; gap: 10px; }

      tbody tr {
        padding: 9px 11px;
        border: 1px solid var(--border-color);
        border-radius: 16px;
        background: var(--surface-color);
      }

      tbody td {
        display: grid;
        grid-template-columns: minmax(76px, .72fr) minmax(0, 1.28fr);
        align-items: center;
        gap: 10px;
        padding: 7px 0;
        border: 0;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      tbody td::before {
        content: attr(data-label);
        color: #64748b;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .05em;
        text-transform: uppercase;
      }

      tbody td[data-label="Description"] strong { color: #0f172a; font-size: 13px; }
      tbody td[data-label="Actions"] { padding-top: 10px; border-top: 1px solid #eef2f7; }
      .action-buttons { justify-content: flex-start; }

      .pagination-bar {
        align-items: center;
        gap: 10px;
        margin-top: 10px;
        padding: 11px;
        border: 1px solid var(--border-color);
        border-radius: 14px;
        background: var(--surface-color);
        flex-wrap: wrap;
      }

      .page-buttons { margin-left: auto; }
      .form-row { grid-template-columns: 1fr; }
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
  saving = false;
  deletingExpenseId: number | null = null;
  errorMessage = '';
  successMessage = '';
  formErrorMessage = '';

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
  monthlyTotal = 0;
  monthlySalaries = 0;
  monthlyUtilities = 0;
  monthlyOtherCosts = 0;
  monthlyExpenseCount = 0;
  monthlyCategorySummary: Array<{
    value: ExpenseCategory;
    label: string;
    icon: string;
    amount: number;
    percent: number;
  }> = [];

  readonly categories = EXPENSE_CATEGORIES;

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
    this.errorMessage = '';
    this.dbService.getExpenses().subscribe({
      next: expenses => {
        this.expenses = expenses;
        this.calculateStats();
        this.filterExpenses();
        this.loading = false;
      },
      error: error => {
        this.expenses = [];
        this.calculateStats();
        this.filterExpenses();
        this.errorMessage = this.describeError(error, 'Expenses could not be loaded. Check your role access and try again.');
        this.loading = false;
      }
    });
  }

  calculateStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthlyExpenses = this.expenses.filter(e => e.expenseDate >= monthStart);
    this.monthlyExpenseCount = monthlyExpenses.length;
    this.monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    this.monthlySalaries = monthlyExpenses
      .filter(e => e.category === 'salary')
      .reduce((sum, e) => sum + e.amount, 0);
    this.monthlyUtilities = monthlyExpenses
      .filter(e => e.category === 'utilities')
      .reduce((sum, e) => sum + e.amount, 0);
    this.monthlyOtherCosts = Math.max(this.monthlyTotal - this.monthlySalaries - this.monthlyUtilities, 0);

    this.monthlyCategorySummary = this.categories
      .map(category => {
        const amount = monthlyExpenses
          .filter(expense => expense.category === category.value)
          .reduce((sum, expense) => sum + expense.amount, 0);
        return {
          ...category,
          amount,
          percent: this.monthlyTotal > 0 ? Math.round((amount / this.monthlyTotal) * 100) : 0
        };
      })
      .filter(category => category.amount > 0)
      .sort((a, b) => b.amount - a.amount);
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

  filterByCategory(category: ExpenseCategory) {
    this.categoryFilter = category;
    this.filterExpenses();
  }

  getCategoryIcon(category: string): string {
    return this.categories.find(item => item.value === category)?.icon || 'more_horiz';
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

  openModal(expense?: Expense) {
    this.editingExpense = expense || null;
    this.formErrorMessage = '';
    this.successMessage = '';
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
    if (this.saving) return;
    this.showModal = false;
    this.editingExpense = null;
    this.formErrorMessage = '';
  }

  editExpense(expense: Expense) {
    this.openModal(expense);
  }

  saveExpense() {
    if (!this.formData.description.trim()) {
      this.formErrorMessage = 'Enter a short description of the expense.';
      return;
    }
    if (!this.formData.amount || this.formData.amount <= 0) {
      this.formErrorMessage = 'Enter an amount greater than zero.';
      return;
    }
    if (!this.formData.expenseDate) {
      this.formErrorMessage = 'Select the date the expense was paid or incurred.';
      return;
    }

    this.saving = true;
    this.formErrorMessage = '';
    const wasEditing = Boolean(this.editingExpense);

    if (this.editingExpense) {
      this.formData.id = this.editingExpense.id;
      this.dbService.updateExpense(this.formData).subscribe({
        next: () => this.finishSave(wasEditing),
        error: error => {
          this.saving = false;
          this.formErrorMessage = this.describeError(error, 'The expense could not be updated.');
        }
      });
    } else {
      // Set the created_by to current user
      this.formData.createdBy = this.authService.currentUser?.id;
      this.dbService.createExpense(this.formData).subscribe({
        next: () => this.finishSave(wasEditing),
        error: error => {
          this.saving = false;
          this.formErrorMessage = this.describeError(error, 'The expense could not be added.');
        }
      });
    }
  }

  deleteExpense(expense: Expense) {
    if (confirm(`Are you sure you want to delete this expense: "${expense.description}"?`)) {
      this.deletingExpenseId = expense.id!;
      this.errorMessage = '';
      this.dbService.deleteExpense(expense.id!).subscribe({
        next: () => {
          this.deletingExpenseId = null;
          this.successMessage = 'Expense deleted.';
          this.loadExpenses();
        },
        error: error => {
          this.deletingExpenseId = null;
          this.errorMessage = this.describeError(error, 'The expense could not be deleted.');
        }
      });
    }
  }

  private finishSave(wasEditing: boolean) {
    this.saving = false;
    this.showModal = false;
    this.editingExpense = null;
    this.successMessage = wasEditing ? 'Expense updated.' : 'Expense added.';
    this.loadExpenses();
  }

  private describeError(error: any, fallback: string): string {
    return error?.message || error?.error_description || fallback;
  }
}
