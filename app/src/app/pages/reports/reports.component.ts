import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import {
  Order,
  Expense,
  Delivery,
  BuyingListItem,
  PaymentStatus,
  DeliveryStatus,
  BuyingStatus
} from '../../models';

type SummaryRow = { label: string; count: number; amount: number };
type TopProductRow = { name: string; quantity: number; revenue: number };

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-page">
      <div class="page-header">
        <div>
          <h1>Reports</h1>
          <p class="subtitle">Summaries and exports for sales and operations</p>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" (click)="refresh()" [disabled]="loading">Refresh</button>
          <button class="btn btn-primary" (click)="exportCsv()" [disabled]="loading || !hasData">Export CSV</button>
        </div>
      </div>

      <div class="filters">
        <button class="chip" [class.active]="filterMode === 'all'" (click)="setFilterMode('all')">
          All time
        </button>

        <div class="filter-group">
          <label>Month</label>
          <select [(ngModel)]="selectedMonth" (change)="onMonthChange()">
            <option *ngFor="let m of monthOptions" [ngValue]="m.value">{{ m.label }}</option>
          </select>
          <select [(ngModel)]="selectedYear" (change)="onMonthChange()">
            <option *ngFor="let y of availableYears" [ngValue]="y">{{ y }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Quarter</label>
          <select [(ngModel)]="selectedQuarter" (change)="onQuarterChange()">
            <option *ngFor="let q of quarterOptions" [ngValue]="q">Q{{ q }}</option>
          </select>
          <select [(ngModel)]="selectedYear" (change)="onQuarterChange()">
            <option *ngFor="let y of availableYears" [ngValue]="y">{{ y }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Range</label>
          <input type="date" [(ngModel)]="rangeFrom" (change)="onRangeChange()" />
          <input type="date" [(ngModel)]="rangeTo" (change)="onRangeChange()" />
        </div>
      </div>

      <div class="filter-note">Active filter: {{ activeFilterLabel }}</div>

      <div class="card" *ngIf="loading">Loading reports...</div>

      <ng-container *ngIf="!loading">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">{{ totalOrders }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Revenue (GHS)</div>
            <div class="stat-value">{{ totalRevenue | number:'1.2-2' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Average Order (GHS)</div>
            <div class="stat-value">{{ avgOrderValue | number:'1.2-2' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Paid Orders</div>
            <div class="stat-value">{{ paidOrders }}</div>
          </div>
        </div>

        <div class="report-grid">
          <div class="card report-card">
            <h3>Payment Status</h3>
            <table>
              <thead>
                <tr><th>Status</th><th>Count</th><th>Amount (GHS)</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of paymentStatusSummary">
                  <td>{{ row.label }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card report-card">
            <h3>Expenses by Category</h3>
            <table>
              <thead>
                <tr><th>Category</th><th>Count</th><th>Amount (GHS)</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of expenseCategorySummary">
                  <td>{{ row.label }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card report-card">
            <h3>Delivery Status</h3>
            <table>
              <thead>
                <tr><th>Status</th><th>Count</th><th>Fees (GHS)</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of deliveryStatusSummary">
                  <td>{{ row.label }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.amount | number:'1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card report-card">
            <h3>Buying List Status</h3>
            <table>
              <thead>
                <tr><th>Status</th><th>Items</th><th>Qty Requested</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of buyingStatusSummary">
                  <td>{{ row.label }}</td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.amount | number:'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card report-card full-width">
            <h3>Top Products (by Revenue)</h3>
            <table>
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Revenue (GHS)</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of topProducts">
                  <td>{{ row.name }}</td>
                  <td>{{ row.quantity }}</td>
                  <td>{{ row.revenue | number:'1.2-2' }}</td>
                </tr>
                <tr *ngIf="topProducts.length === 0">
                  <td colspan="3" class="empty-row">No products in this period.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .reports-page {
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .subtitle {
      color: #64748b;
      margin: 4px 0 0;
    }

    .filters {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .filter-note {
      color: #64748b;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 6px 10px;
    }

    .filter-group label {
      font-size: 12px;
      color: #64748b;
      margin-right: 2px;
    }

    .filter-group select,
    .filter-group input[type="date"] {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 8px;
      font-size: 13px;
      background: #fff;
    }

    .chip {
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #334155;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
    }

    .chip.active {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }

    .stat-label {
      color: #64748b;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }

    .report-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .report-card {
      padding: 16px;
    }

    .report-card h3 {
      margin-bottom: 12px;
    }

    .report-card table {
      width: 100%;
      border-collapse: collapse;
    }

    .report-card th,
    .report-card td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }

    .report-card th {
      color: #475569;
      font-weight: 600;
    }

    .empty-row {
      text-align: center;
      color: #94a3b8;
      padding: 14px 0;
    }

    .full-width {
      grid-column: 1 / -1;
    }
  `]
})
export class ReportsComponent implements OnInit {
  loading = true;

  allOrders: Order[] = [];
  allExpenses: Expense[] = [];
  allDeliveries: Delivery[] = [];
  allBuyingList: BuyingListItem[] = [];

  filteredOrders: Order[] = [];
  filteredExpenses: Expense[] = [];
  filteredDeliveries: Delivery[] = [];
  filteredBuyingList: BuyingListItem[] = [];

  paymentStatusSummary: SummaryRow[] = [];
  expenseCategorySummary: SummaryRow[] = [];
  deliveryStatusSummary: SummaryRow[] = [];
  buyingStatusSummary: SummaryRow[] = [];
  topProducts: TopProductRow[] = [];

  filterMode: 'all' | 'month' | 'quarter' | 'range' = 'all';
  rangeFrom = '';
  rangeTo = '';
  selectedMonth = new Date().getMonth();
  selectedQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  selectedYear = new Date().getFullYear();
  availableYears: number[] = [];

  monthOptions = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' }
  ];

  quarterOptions = [1, 2, 3, 4];

  constructor(private dbService: DatabaseService) {}

  ngOnInit(): void {
    this.loadData();
  }

  refresh(): void {
    this.loadData();
  }

  get totalOrders(): number {
    return this.filteredOrders.length;
  }

  get totalRevenue(): number {
    return this.sum(this.filteredOrders.map(o => o.totalAmount || 0));
  }

  get avgOrderValue(): number {
    return this.totalOrders > 0 ? this.totalRevenue / this.totalOrders : 0;
  }

  get paidOrders(): number {
    return this.filteredOrders.filter(o => o.paymentStatus === 'paid').length;
  }

  get hasData(): boolean {
    return this.filteredOrders.length > 0 || this.filteredExpenses.length > 0 || this.filteredDeliveries.length > 0 || this.filteredBuyingList.length > 0;
  }

  get activeFilterLabel(): string {
    switch (this.filterMode) {
      case 'month':
        return `${this.monthOptions[this.selectedMonth]?.label || ''} ${this.selectedYear}`.trim();
      case 'quarter':
        return `Q${this.selectedQuarter} ${this.selectedYear}`;
      case 'range':
        return `${this.rangeFrom || 'Start'} to ${this.rangeTo || 'End'}`;
      default:
        return 'All time';
    }
  }

  setFilterMode(mode: 'all' | 'month' | 'quarter' | 'range'): void {
    this.filterMode = mode;
    this.applyFilter();
  }

  onMonthChange(): void {
    this.filterMode = 'month';
    this.applyFilter();
  }

  onQuarterChange(): void {
    this.filterMode = 'quarter';
    this.applyFilter();
  }

  onRangeChange(): void {
    this.filterMode = 'range';
    this.applyFilter();
  }

  exportCsv(): void {
    const lines: string[] = [];
    lines.push('Reports Export');
    lines.push(`Filter,${this.escapeCsv(this.activeFilterLabel)}`);
    lines.push('');

    lines.push('Sales Summary');
    lines.push('Metric,Value');
    lines.push(`Total Orders,${this.totalOrders}`);
    lines.push(`Total Revenue,${this.totalRevenue.toFixed(2)}`);
    lines.push(`Average Order,${this.avgOrderValue.toFixed(2)}`);
    lines.push(`Paid Orders,${this.paidOrders}`);
    lines.push('');

    this.appendSummary(lines, 'Payment Status', this.paymentStatusSummary);
    this.appendSummary(lines, 'Expenses by Category', this.expenseCategorySummary);
    this.appendSummary(lines, 'Delivery Status', this.deliveryStatusSummary);
    this.appendSummary(lines, 'Buying List Status', this.buyingStatusSummary, 'Qty Requested');

    lines.push('Top Products');
    lines.push('Product,Quantity,Revenue');
    for (const row of this.topProducts) {
      lines.push(`${this.escapeCsv(row.name)},${row.quantity},${row.revenue.toFixed(2)}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${this.filenameDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private appendSummary(lines: string[], title: string, rows: SummaryRow[], amountLabel = 'Amount (GHS)'): void {
    lines.push(title);
    lines.push(`Label,Count,${amountLabel}`);
    for (const row of rows) {
      lines.push(`${this.escapeCsv(row.label)},${row.count},${row.amount.toFixed(2)}`);
    }
    lines.push('');
  }

  private loadData(): void {
    this.loading = true;
    forkJoin({
      orders: this.dbService.getOrders(),
      expenses: this.dbService.getExpenses(),
      deliveries: this.dbService.getDeliveries(),
      buyingList: this.dbService.getBuyingList()
    }).subscribe({
      next: data => {
        this.allOrders = data.orders || [];
        this.allExpenses = data.expenses || [];
        this.allDeliveries = data.deliveries || [];
        this.allBuyingList = data.buyingList || [];
        this.buildYearOptions();
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.allOrders = [];
        this.allExpenses = [];
        this.allDeliveries = [];
        this.allBuyingList = [];
        this.applyFilter();
        this.loading = false;
      }
    });
  }

  private buildYearOptions(): void {
    const years = new Set<number>();
    const add = (d: Date | null) => { if (d) years.add(d.getFullYear()); };
    this.allOrders.forEach(o => add(this.parseDate(o.createdAt || o.updatedAt)));
    this.allExpenses.forEach(e => add(this.parseDate(e.expenseDate || e.createdAt)));
    this.allDeliveries.forEach(d => add(this.parseDate(d.deliveryDate || d.createdAt)));
    this.allBuyingList.forEach(b => add(this.parseDate(b.createdAt)));
    const list = Array.from(years).sort((a, b) => b - a);
    this.availableYears = list.length > 0 ? list : [new Date().getFullYear()];
    if (!this.availableYears.includes(this.selectedYear)) {
      this.selectedYear = this.availableYears[0];
    }
  }

  private applyFilter(): void {
    this.filteredOrders = this.allOrders.filter(o => this.matchesFilter(this.parseDate(o.createdAt || o.updatedAt)));
    this.filteredExpenses = this.allExpenses.filter(e => this.matchesFilter(this.parseDate(e.expenseDate || e.createdAt)));
    this.filteredDeliveries = this.allDeliveries.filter(d => this.matchesFilter(this.parseDate(d.deliveryDate || d.createdAt)));
    this.filteredBuyingList = this.allBuyingList.filter(b => this.matchesFilter(this.parseDate(b.createdAt)));

    this.paymentStatusSummary = this.buildStatusSummary<PaymentStatus>(
      ['paid', 'partial', 'unpaid', 'refunded'],
      status => status,
      this.filteredOrders,
      o => o.paymentStatus
    );

    this.deliveryStatusSummary = this.buildStatusSummary<DeliveryStatus>(
      ['pending', 'in_transit', 'delivered', 'failed'],
      status => status,
      this.filteredDeliveries,
      d => d.status,
      d => d.deliveryFee || 0
    );

    this.buyingStatusSummary = this.buildStatusSummary<BuyingStatus>(
      ['pending', 'ordered', 'arrived'],
      status => status,
      this.filteredBuyingList,
      b => b.status,
      b => b.requestedQuantity || 0
    );

    this.expenseCategorySummary = this.buildExpenseSummary();
    this.topProducts = this.buildTopProducts();
  }

  private buildStatusSummary<T extends string>(
    statuses: T[],
    labelFn: (status: T) => string,
    list: { [key: string]: any }[],
    statusFn: (item: any) => T,
    amountFn: (item: any) => number = (item: any) => item.totalAmount || 0
  ): SummaryRow[] {
    return statuses.map(status => {
      const items = list.filter(i => statusFn(i) === status);
      return {
        label: this.formatLabel(labelFn(status)),
        count: items.length,
        amount: this.sum(items.map(amountFn))
      };
    });
  }


  private buildExpenseSummary(): SummaryRow[] {
    const categories = ['salary', 'rent', 'utilities', 'transport', 'supplies', 'marketing', 'maintenance', 'food', 'other'];
    return categories.map(cat => {
      const items = this.filteredExpenses.filter(e => e.category === cat);
      return {
        label: this.formatLabel(cat),
        count: items.length,
        amount: this.sum(items.map(e => e.amount || 0))
      };
    });
  }

  private buildTopProducts(): TopProductRow[] {
    const map: Record<string, { quantity: number; revenue: number }> = {};
    for (const order of this.filteredOrders) {
      for (const item of order.items || []) {
        const name = item.productName || `Product #${item.productId}`;
        if (!map[name]) {
          map[name] = { quantity: 0, revenue: 0 };
        }
        map[name].quantity += item.quantity || 0;
        map[name].revenue += item.subtotal || 0;
      }
    }
    return Object.entries(map)
      .map(([name, stats]) => ({ name, quantity: stats.quantity, revenue: stats.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private matchesFilter(date: Date | null): boolean {
    if (!date) return false;
    if (this.filterMode === 'all') return true;

    if (this.filterMode === 'month') {
      return date.getFullYear() === this.selectedYear && date.getMonth() === this.selectedMonth;
    }

    if (this.filterMode === 'quarter') {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return date.getFullYear() === this.selectedYear && q === this.selectedQuarter;
    }

    const start = this.rangeFrom ? this.parseDate(this.rangeFrom) : null;
    const end = this.rangeTo ? this.parseDate(this.rangeTo) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private sum(values: number[]): number {
    return values.reduce((acc, n) => acc + (n || 0), 0);
  }

  private formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private filenameDate(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
