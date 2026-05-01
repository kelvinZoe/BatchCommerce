import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DatabaseService } from '../../services/database.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Order, OrderBatch, Delivery, Expense, DELIVERY_CATEGORIES, DashboardComponentConfig } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Welcome to Shakhis Ventures Commerce</p>
      </div>

      <ng-container *ngIf="loading">
        <div class="stats-grid">
          <div class="skeleton-stat-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-icon"></div>
            <div class="skeleton-line h-28 w-40" style="margin-bottom:8px"></div>
            <div class="skeleton-line h-12 w-60"></div>
          </div>
        </div>
        <div class="skeleton-card full-width" style="margin-top:20px">
          <div class="skeleton-line h-20 w-40" style="margin-bottom:16px"></div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px">
            <div class="skeleton-line" style="height:80px" *ngFor="let i of [1,2,3,4,5]"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
          <div class="skeleton-card" *ngFor="let i of [1,2]">
            <div class="skeleton-line h-20 w-50" style="margin-bottom:16px"></div>
            <div class="skeleton-line" style="height:200px"></div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading">
        <div class="stats-grid skeleton-fade-in" *ngIf="can('stats')">
          <div class="stat-card">
            <div class="stat-icon blue"><span class="material-icons">inventory_2</span></div>
            <div class="stat-value">{{ totalProducts }}</div>
            <div class="stat-label">Total Products</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><span class="material-icons">people</span></div>
            <div class="stat-value">{{ totalClients }}</div>
            <div class="stat-label">Total Clients</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon yellow"><span class="material-icons">shopping_cart</span></div>
            <div class="stat-value">{{ todayOrders }}</div>
            <div class="stat-label">Orders Today</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple"><span class="material-icons">local_shipping</span></div>
            <div class="stat-value">{{ pendingDeliveries }}</div>
            <div class="stat-label">Pending Deliveries</div>
          </div>
        </div>

        <ng-container *ngIf="can('finance')">
        <div class="section-header skeleton-fade-in">
          <div class="section-title">
            <span class="material-icons">account_balance</span>
            <h2>Finance Overview</h2>
          </div>
          <span class="period-badge">This Batch vs Last Batch</span>
        </div>
        <div class="finance-grid skeleton-fade-in">
          <div class="finance-card">
            <div class="finance-icon green-bg"><span class="material-icons">trending_up</span></div>
            <div class="finance-details">
              <span class="finance-label">Revenue</span>
              <span class="finance-value">GHS {{ revenueThisMonth | number:'1.2-2' }}</span>
              <span class="finance-change" [class.positive]="revenueChange >= 0" [class.negative]="revenueChange < 0">
                {{ revenueChange >= 0 ? '\u25b2' : '\u25bc' }} {{ revenueChange >= 0 ? revenueChange : revenueChange * -1 }}% vs last batch
              </span>
            </div>
          </div>
          <div class="finance-card">
            <div class="finance-icon red-bg"><span class="material-icons">money_off</span></div>
            <div class="finance-details">
              <span class="finance-label">Expenses</span>
              <span class="finance-value">GHS {{ expensesThisMonth | number:'1.2-2' }}</span>
              <span class="finance-change" [class.positive]="expenseChange <= 0" [class.negative]="expenseChange > 0">
                {{ expenseChange >= 0 ? '\u25b2' : '\u25bc' }} {{ expenseChange >= 0 ? expenseChange : expenseChange * -1 }}% vs last month
              </span>
            </div>
          </div>
          <div class="finance-card">
            <div class="finance-icon blue-bg"><span class="material-icons">local_shipping</span></div>
            <div class="finance-details">
              <span class="finance-label">Shipping Fees</span>
              <span class="finance-value">GHS {{ shippingThisMonth | number:'1.2-2' }}</span>
              <span class="finance-change" [class.positive]="shippingChange >= 0" [class.negative]="shippingChange < 0">
                {{ shippingChange >= 0 ? '\u25b2' : '\u25bc' }} {{ shippingChange >= 0 ? shippingChange : shippingChange * -1 }}% vs last batch
              </span>
            </div>
          </div>
          <!-- Net Profit removed per request -->
          <div class="finance-card">
            <div class="finance-icon purple-bg"><span class="material-icons">receipt_long</span></div>
            <div class="finance-details">
              <span class="finance-label">Paid Orders</span>
              <span class="finance-value">{{ paidOrdersThisMonth }}</span>
              <span class="finance-sub">This month</span>
            </div>
          </div>
        </div>
        </ng-container>

        <div class="card full-width skeleton-fade-in" style="margin-top:20px" *ngIf="can('revenueTrend')">
          <div class="card-header"><h2>Revenue Trend (Last 6 Months)</h2></div>          <div class="bar-chart">
            <div class="bar-item" *ngFor="let m of monthlyRevenueTrend">
              <div class="bar-wrapper">
                <div class="bar" [style.height.%]="m.heightPercent"></div>
              </div>
              <span class="bar-amount">{{ m.amount | number:'1.0-0' }}</span>
              <span class="bar-label">{{ m.label }}</span>
            </div>
          </div>
        </div>

        <div class="dashboard-grid skeleton-fade-in" *ngIf="can('topProducts') || can('deliveryOverview')">
          <div class="card" *ngIf="can('topProducts')">
            <div class="card-header">
              <h2>Top 10 Products</h2>
              <div class="period-tabs">
                <button [class.active]="topProductsPeriod === 'month'" (click)="onTopProductsPeriodChange('month')">Month</button>
                <button [class.active]="topProductsPeriod === 'quarter'" (click)="onTopProductsPeriodChange('quarter')">Quarter</button>
                <button [class.active]="topProductsPeriod === 'year'" (click)="onTopProductsPeriodChange('year')">Year</button>
              </div>
            </div>
            <div class="top-products-list">
              <div class="top-product" *ngFor="let p of topProducts; let i = index">
                <span class="rank" [class.rank-1]="i===0" [class.rank-2]="i===1" [class.rank-3]="i===2">#{{ i + 1 }}</span>
                <div class="product-info">
                  <strong>{{ p.name }}</strong>
                  <small>{{ p.quantity }} units &middot; GHS {{ p.revenue | number:'1.0-0' }}</small>
                </div>
                <div class="product-bar-wrap">
                  <div class="product-bar" [style.width.%]="topProducts.length > 0 && topProducts[0].quantity ? (p.quantity / topProducts[0].quantity * 100) : 0"></div>
                </div>
              </div>
              <div class="empty-list" *ngIf="topProducts.length === 0">
                <span class="material-icons">inventory_2</span>
                <p>No sales data for this period</p>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="can('deliveryOverview')">
            <div class="card-header">
              <h2>Delivery Overview</h2>
              <div class="period-tabs">
                <button [class.active]="deliveryPeriod === 'month'" (click)="onDeliveryPeriodChange('month')">Month</button>
                <button [class.active]="deliveryPeriod === 'quarter'" (click)="onDeliveryPeriodChange('quarter')">Quarter</button>
                <button [class.active]="deliveryPeriod === 'year'" (click)="onDeliveryPeriodChange('year')">Year</button>
              </div>
            </div>
            <div class="delivery-chart">
              <div class="pie-chart" [style.background]="pieGradient">
                <div class="pie-center">
                  <strong>{{ deliveryTotal }}</strong>
                  <small>Total</small>
                </div>
              </div>
              <div class="pie-legend">
                <div class="legend-item" *ngFor="let d of deliveryBreakdown">
                  <span class="legend-dot" [style.background]="d.color"></span>
                  <div class="legend-info">
                    <span class="legend-label">{{ d.label }}</span>
                    <span class="legend-detail">{{ d.count }} deliveries &middot; GHS {{ d.fees | number:'1.0-0' }}</span>
                  </div>
                  <span class="legend-pct">{{ getDeliveryPercent(d.count) }}%</span>
                </div>
                <div class="empty-list" *ngIf="deliveryBreakdown.length === 0">
                  <p>No delivery data for this period</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-grid skeleton-fade-in" *ngIf="can('batchPipeline') || can('recentOrders')">
          <div class="card" *ngIf="can('batchPipeline')">
            <div class="card-header"><h2>Batch Pipeline</h2></div>
            <div class="pipeline">
              <div class="pipeline-stage open">
                <div class="stage-count">{{ batchPipeline.open }}</div>
                <div class="stage-label">Open</div>
              </div>
              <span class="material-icons arrow">arrow_forward</span>
              <div class="pipeline-stage buying">
                <div class="stage-count">{{ batchPipeline.buying }}</div>
                <div class="stage-label">Buying</div>
              </div>
              <span class="material-icons arrow">arrow_forward</span>
              <div class="pipeline-stage delivering">
                <div class="stage-count">{{ batchPipeline.delivering }}</div>
                <div class="stage-label">Delivering</div>
              </div>
              <span class="material-icons arrow">arrow_forward</span>
              <div class="pipeline-stage completed">
                <div class="stage-count">{{ batchPipeline.completed }}</div>
                <div class="stage-label">Completed</div>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="can('recentOrders')">
            <div class="card-header"><h2>Recent Orders</h2></div>
            <div class="recent-orders">
              <div class="recent-order" *ngFor="let o of recentOrders">
                <div class="ro-info">
                  <strong>{{ o.clientName }}</strong>
                  <small>#{{ o.id }} &middot; {{ o.items.length || 0 }} items</small>
                </div>
                <span class="ro-amount">GHS {{ o.totalAmount | number:'1.2-2' }}</span>
              </div>
              <div class="empty-list" *ngIf="recentOrders.length === 0">
                <p>No orders yet</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card full-width skeleton-fade-in" style="margin-top:20px" *ngIf="can('expenses')">
          <div class="card-header"><h2>Expense Trends (Last 6 Months)</h2></div>
          <div class="bar-chart">
            <div class="bar-item" *ngFor="let m of monthlyExpenseTrend">
              <div class="bar-wrapper">
                <div class="bar bar-expense" [style.height.%]="m.heightPercent"></div>
              </div>
              <span class="bar-amount">{{ m.amount | number:'1.0-0' }}</span>
              <span class="bar-label">{{ m.label }}</span>
            </div>
          </div>
        </div>

        <div class="dashboard-grid skeleton-fade-in" *ngIf="can('expenses') || can('stockSales')">
          <div class="card" *ngIf="can('expenses')">
            <div class="card-header"><h2>Expense Breakdown by Category</h2></div>
            <div class="delivery-chart">
              <div class="pie-chart" [style.background]="expensePieGradient">
                <div class="pie-center">
                  <strong>{{ expenseTotal | number:'1.0-0' }}</strong>
                  <small>GHS</small>
                </div>
              </div>
              <div class="pie-legend">
                <div class="legend-item" *ngFor="let e of expenseBreakdown">
                  <span class="legend-dot" [style.background]="e.color"></span>
                  <div class="legend-info">
                    <span class="legend-label">{{ e.category }}</span>
                    <span class="legend-detail">GHS {{ e.amount | number:'1.0-0' }}</span>
                  </div>
                  <span class="legend-pct">{{ getExpensePercent(e.amount) }}%</span>
                </div>
                <div class="empty-list" *ngIf="expenseBreakdown.length === 0">
                  <p>No expenses for this period</p>
                </div>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="can('stockSales')">
            <div class="card-header"><h2>Stock Sales Performance</h2></div>
            <div class="stock-sales-list">
              <div class="stock-item" *ngFor="let s of topStockSales">
                <div class="stock-info">
                  <strong>{{ s.description }}</strong>
                  <small>{{ s.quantity }} units</small>
                </div>
                <span class="stock-amount">GHS {{ s.totalAmount | number:'1.2-2' }}</span>
              </div>
              <div class="empty-list" *ngIf="topStockSales.length === 0">
                <span class="material-icons">inventory_2</span>
                <p>No stock sales yet</p>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-grid skeleton-fade-in" *ngIf="can('damagedItems') || can('inventory')">
          <div class="card" *ngIf="can('damagedItems')">
            <div class="card-header"><h2>Damaged Items Summary</h2></div>
            <div class="damaged-items-grid">
              <div class="damage-stat">
                <div class="damage-icon"><span class="material-icons">warning</span></div>
                <div class="damage-info">
                  <span class="damage-label">Total Damaged</span>
                  <span class="damage-value">{{ totalDamagedItems }}</span>
                </div>
              </div>
              <div class="damage-stat">
                <div class="damage-icon danger"><span class="material-icons">trending_up</span></div>
                <div class="damage-info">
                  <span class="damage-label">This Month</span>
                  <span class="damage-value">{{ damagedThisMonth }}</span>
                </div>
              </div>
              <div class="damage-stat">
                <div class="damage-icon warning"><span class="material-icons">check_circle</span></div>
                <div class="damage-info">
                  <span class="damage-label">Allocated</span>
                  <span class="damage-value">{{ damageAllocated }}</span>
                </div>
              </div>
            </div>
            <div class="top-damaged-products" style="margin-top:16px;border-top:1px solid var(--border-color);padding-top:12px;">
              <div class="damaged-product" *ngFor="let p of topDamagedProducts | slice:0:5">
                <span class="damage-count">{{ p.count }}</span>
                <div class="product-info">
                  <strong>{{ p.name }}</strong>
                  <small>{{ p.batches }} batches</small>
                </div>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="can('inventory')">
            <div class="card-header"><h2>Inventory Status</h2></div>
            <div class="inventory-grid">
              <div class="inventory-stat">
                <div class="inv-icon arriving"><span class="material-icons">local_shipping</span></div>
                <div class="inv-info">
                  <span class="inv-label">Expected Arrivals</span>
                  <span class="inv-value">{{ arrivalsExpected }}</span>
                </div>
              </div>
              <div class="inventory-stat">
                <div class="inv-icon received"><span class="material-icons">done_all</span></div>
                <div class="inv-info">
                  <span class="inv-label">Received This Month</span>
                  <span class="inv-value">{{ arrivalsReceivedMonth }}</span>
                </div>
              </div>
              <div class="inventory-stat">
                <div class="inv-icon pending"><span class="material-icons">pending_actions</span></div>
                <div class="inv-info">
                  <span class="inv-label">Pending Items</span>
                  <span class="inv-value">{{ arrivalsPending }}</span>
                </div>
              </div>
            </div>
            <div class="recent-arrivals" style="margin-top:16px;border-top:1px solid var(--border-color);padding-top:12px;">
              <div class="arrival-item" *ngFor="let a of recentArrivals | slice:0:5">
                <div class="arrival-info">
                  <strong>{{ a.productName }}</strong>
                  <small>{{ a.quantity }} units from {{ a.supplier }}</small>
                </div>
                <span class="arrival-date">{{ a.arrivalDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1400px; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    .page-header .subtitle { color: var(--text-secondary); font-size: 14px; }

    .section-header { display: flex; align-items: center; justify-content: space-between; margin: 28px 0 16px; }
    .section-title { display: flex; align-items: center; gap: 10px; }
    .section-title h2 { font-size: 18px; font-weight: 600; margin: 0; }
    .section-title .material-icons { color: var(--primary-color); font-size: 24px; }
    .period-badge { padding: 4px 14px; border-radius: 20px; background: #f1f5f9; color: #64748b; font-size: 12px; font-weight: 500; }

    .finance-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 4px; }
    .finance-card { display: flex; align-items: center; gap: 14px; padding: 20px; background: var(--card-background); border-radius: var(--radius-md); border: 1px solid var(--border-color); }
    .finance-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .finance-icon .material-icons { font-size: 22px; color: white; }
    .green-bg { background: #10b981; }
    .red-bg { background: #ef4444; }
    .blue-bg { background: #3b82f6; }
    .purple-bg { background: #8b5cf6; }
    .finance-details { display: flex; flex-direction: column; min-width: 0; }
    .finance-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
    .finance-value { font-size: 18px; font-weight: 700; white-space: nowrap; }
    .finance-change { font-size: 11px; font-weight: 500; }
    .finance-change.positive { color: #10b981; }
    .finance-change.negative { color: #ef4444; }
    .finance-sub { font-size: 11px; color: var(--text-secondary); }
    .text-danger { color: #ef4444 !important; }

    .dashboard-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px; }
    .full-width { grid-column: span 2; }

    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .card-header h2 { font-size: 16px; font-weight: 600; margin: 0; }

    .period-tabs { display: flex; gap: 4px; background: var(--background-color); border-radius: 8px; padding: 3px; }
    .period-tabs button { padding: 4px 12px; border-radius: 6px; border: none; background: transparent; font-size: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease; }
    .period-tabs button.active { background: var(--primary-color); color: white; }
    .period-tabs button:hover:not(.active) { background: var(--border-color); }

    .bar-chart { display: flex; align-items: flex-end; gap: 16px; padding: 16px 8px 0; height: 200px; }
    .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .bar-wrapper { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
    .bar { width: 60%; max-width: 60px; background: linear-gradient(180deg, var(--primary-color), #93c5fd); border-radius: 6px 6px 0 0; min-height: 4px; transition: height 0.5s ease; }
    .bar-amount { font-size: 11px; font-weight: 600; color: var(--text-primary); margin-top: 8px; }
    .bar-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

    .top-products-list { max-height: 420px; overflow-y: auto; }
    .top-product { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
    .top-product:last-child { border-bottom: none; }
    .rank { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; background: #f1f5f9; color: #64748b; }
    .rank-1 { background: #fef3c7; color: #92400e; }
    .rank-2 { background: #e5e7eb; color: #374151; }
    .rank-3 { background: #fed7aa; color: #9a3412; }
    .product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .product-info strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-info small { font-size: 11px; color: var(--text-secondary); }
    .product-bar-wrap { width: 80px; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; }
    .product-bar { height: 100%; background: var(--primary-color); border-radius: 3px; transition: width 0.5s ease; }
    .bar-expense { background: linear-gradient(180deg, #ef4444, #fca5a5); }

    .delivery-chart, .payment-chart { display: flex; align-items: center; gap: 24px; padding: 10px 0; }
    .pie-chart { width: 160px; height: 160px; border-radius: 50%; position: relative; flex-shrink: 0; }
    .pie-sm { width: 130px; height: 130px; }
    .pie-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 65%; height: 65%; background: var(--card-background); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .pie-center strong { font-size: 20px; font-weight: 700; }
    .pie-center small { font-size: 10px; color: var(--text-secondary); }
    .pie-legend { flex: 1; }
    .legend-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
    .legend-item:last-child { border-bottom: none; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-info { flex: 1; display: flex; flex-direction: column; }
    .legend-label { font-size: 13px; font-weight: 500; }
    .legend-detail { font-size: 11px; color: var(--text-secondary); }
    .legend-pct { font-size: 14px; font-weight: 700; color: var(--text-primary); }

    .stock-sales-list { max-height: 350px; overflow-y: auto; }
    .stock-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
    .stock-item:last-child { border-bottom: none; }
    .stock-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .stock-info strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stock-info small { font-size: 11px; color: var(--text-secondary); }
    .stock-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

    .damaged-items-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .damage-stat { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--background-color); border-radius: var(--radius-md); }
    .damage-icon { width: 40px; height: 40px; border-radius: 50%; background: #fef3c7; color: #ea580c; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .damage-icon.danger { background: #fee2e2; color: #991b1b; }
    .damage-icon.warning { background: #dbeafe; color: #1e3a8a; }
    .damage-info { display: flex; flex-direction: column; }
    .damage-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
    .damage-value { font-size: 18px; font-weight: 700; }

    .top-damaged-products { }
    .damaged-product { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .damage-count { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: #fee2e2; color: #991b1b; flex-shrink: 0; }
    .product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .product-info strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .product-info small { font-size: 11px; color: var(--text-secondary); }

    .inventory-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .inventory-stat { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--background-color); border-radius: var(--radius-md); }
    .inv-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .inv-icon.arriving { background: #dbeafe; color: #1e40af; }
    .inv-icon.received { background: #d1fae5; color: #065f46; }
    .inv-icon.pending { background: #fef3c7; color: #92400e; }
    .inv-info { display: flex; flex-direction: column; }
    .inv-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
    .inv-value { font-size: 18px; font-weight: 700; }

    .recent-arrivals { }
    .arrival-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
    .arrival-item:last-child { border-bottom: none; }
    .arrival-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .arrival-info strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .arrival-info small { font-size: 11px; color: var(--text-secondary); }
    .arrival-date { font-size: 11px; color: var(--text-secondary); white-space: nowrap; margin-left: 8px; }

    .pipeline { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 20px 10px; }
    .pipeline-stage { text-align: center; padding: 16px 20px; border-radius: var(--radius-md); flex: 1; }
    .stage-count { font-size: 28px; font-weight: 700; }
    .stage-label { font-size: 12px; font-weight: 500; margin-top: 2px; }
    .pipeline-stage.open { background: #dbeafe; color: #1e40af; }
    .pipeline-stage.buying { background: #fef3c7; color: #92400e; }
    .pipeline-stage.delivering { background: #e0e7ff; color: #3730a3; }
    .pipeline-stage.completed { background: #d1fae5; color: #065f46; }
    .arrow { color: var(--text-secondary); font-size: 20px; }

    .recent-orders { max-height: 330px; overflow-y: auto; }
    .recent-order { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-color); }
    .recent-order:last-child { border-bottom: none; }
    .ro-info { flex: 1; display: flex; flex-direction: column; }
    .ro-info strong { font-size: 13px; }
    .ro-info small { font-size: 11px; color: var(--text-secondary); }
    .ro-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .ro-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-unpaid { background: #fee2e2; color: #991b1b; }
    .status-refunded { background: #e0e7ff; color: #3730a3; }

    .empty-list { text-align: center; padding: 30px 20px; color: var(--text-secondary); }
    .empty-list .material-icons { font-size: 32px; margin-bottom: 8px; opacity: 0.5; }
    .empty-list p { font-size: 13px; margin: 0; }

    @media (max-width: 1200px) { .finance-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 900px) {
      .finance-grid { grid-template-columns: repeat(2, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
      .delivery-chart, .payment-chart { flex-direction: column; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  loading = true;

  orders: Order[] = [];
  expenses: Expense[] = [];
  deliveries: Delivery[] = [];
  batches: OrderBatch[] = [];

  totalProducts = 0;
  totalClients = 0;
  todayOrders = 0;
  pendingDeliveries = 0;

  revenueThisMonth = 0;
  revenueLastMonth = 0;
  expensesThisMonth = 0;
  expensesLastMonth = 0;
  shippingThisMonth = 0;
  shippingLastMonth = 0;
  netThisMonth = 0;
  paidOrdersThisMonth = 0;

  topProductsPeriod: 'month' | 'quarter' | 'year' = 'month';
  topProducts: { name: string; quantity: number; revenue: number }[] = [];

  deliveryPeriod: 'month' | 'quarter' | 'year' = 'month';
  deliveryBreakdown: { category: string; label: string; count: number; fees: number; color: string }[] = [];

  batchPipeline = { open: 0, buying: 0, delivering: 0, completed: 0 };
  monthlyRevenueTrend: { label: string; amount: number; heightPercent: number }[] = [];
  monthlyExpenseTrend: { label: string; amount: number; heightPercent: number }[] = [];
  recentOrders: Order[] = [];

  // New properties for dashboard enhancements
  expenseBreakdown: { category: string; amount: number; color: string }[] = [];
  expenseColors: Record<string, string> = {
    'Inventory': '#3b82f6',
    'Shipping': '#10b981',
    'Staff': '#f59e0b',
    'Utilities': '#8b5cf6',
    'Damaged': '#ef4444',
    'Other': '#6366f1'
  };
  topStockSales: { quantity: number; totalAmount: number; description: string }[] = [];
  totalDamagedItems = 0;
  damagedThisMonth = 0;
  damageAllocated = 0;
  topDamagedProducts: { name: string; count: number; batches: number }[] = [];
  arrivalsExpected = 0;
  arrivalsReceivedMonth = 0;
  arrivalsPending = 0;
  recentArrivals: { productName: string; quantity: number; supplier: string; arrivalDate: string }[] = [];

  private thisMonthStart = '';
  private lastMonthStart = '';
  private lastMonthEnd = '';
  private thisQuarterStart = '';
  private thisYearStart = '';
  private todayStr = '';

  constructor(
    private dbService: DatabaseService,
    private authService: AuthService,
    private supabaseService: SupabaseService
  ) {}

  private get sb() {
    return this.supabaseService.client;
  }

  private get activeShopId(): string | null {
    return this.authService.currentUser?.shopId || null;
  }

  private scopeShopQuery(query: any) {
    const shopId = this.activeShopId;
    return shopId ? query.eq('shop_id', shopId) : query;
  }

  can(component: keyof DashboardComponentConfig): boolean {
    return this.authService.canSeeDashboardComponent(component);
  }

  ngOnInit() {
    this.initDates();
    this.loadData();
  }

  private initDates() {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    this.todayStr = fmt(now);
    this.thisMonthStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    this.lastMonthStart = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    this.lastMonthEnd = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    this.thisQuarterStart = fmt(new Date(now.getFullYear(), qMonth, 1));
    this.thisYearStart = fmt(new Date(now.getFullYear(), 0, 1));
  }

  loadData() {
    this.loading = true;
    forkJoin({
      stats: this.dbService.getDashboardStats(),
      orders: this.dbService.getOrders(),
      expenses: this.dbService.getExpenses(),
      deliveries: this.dbService.getDeliveries(),
      batches: this.dbService.getOrderBatches(),
      damagedItems: this.scopeShopQuery(this.sb.from('damaged_items').select('*')),
      stockSales: this.scopeShopQuery(this.sb.from('stock_sales').select('*')),
      stockItems: this.scopeShopQuery(this.sb.from('stock_sale_items').select('*')),
      arrivalItems: this.scopeShopQuery(this.sb.from('arrival_items').select('*')),
      products: this.scopeShopQuery(this.sb.from('products').select('*'))
    }).subscribe(
      data => {
        const dashboardData = data as any;
        this.totalProducts = dashboardData.stats.totalProducts;
        this.totalClients = dashboardData.stats.totalClients;
        this.orders = dashboardData.orders;
        this.expenses = dashboardData.expenses;
        this.deliveries = dashboardData.deliveries;
        this.batches = dashboardData.batches;

        this.computeKeyStats();
        this.computeFinance();
        this.computeTopProducts();
        this.computeDeliveryBreakdown();
        this.computeBatchPipeline();
        this.computeMonthlyTrend();
        this.computeExpenseTrend();
        this.computeExpenseBreakdown();
        this.computeTopStockSales(dashboardData.stockSales.data || [], dashboardData.stockItems.data || []);
        this.computeArrivals(this.batches, dashboardData.arrivalItems.data || [], dashboardData.products.data || []);
        this.recentOrders = this.orders.slice(0, 5);

        const shopBatchNames = this.batches
          .map(batch => batch.name)
          .filter((name): name is string => !!name);

        const finalize = (damageAllocations: any[]) => {
          this.computeDamagedItems(dashboardData.damagedItems.data || [], damageAllocations, dashboardData.products.data || []);
          this.loading = false;
        };

        if (shopBatchNames.length === 0) {
          finalize([]);
          return;
        }

        this.scopeShopQuery(
          this.sb.from('damage_order_allocations').select('*').in('batch_name', shopBatchNames)
        ).subscribe(
          ({ data: damageAllocations }: { data: any[] }) => finalize(damageAllocations || []),
          (error: unknown) => {
            console.error('Error loading damage allocations:', error);
            finalize([]);
          }
        );
      },
      error => {
        console.error('Error loading dashboard data:', error);
        this.loading = false;
      }
    );
  }

  private computeKeyStats() {
    this.todayOrders = this.orders.filter(o =>
      (o.createdAt || '').substring(0, 10) === this.todayStr
    ).length;
    this.pendingDeliveries = this.deliveries.filter(d =>
      d.status === 'pending' || d.status === 'in_transit'
    ).length;
  }

  private computeFinance() {
    const batchesSorted = [...this.batches].sort((a, b) => {
      const aKey = (a.closedAt || a.createdAt || '') as string;
      const bKey = (b.closedAt || b.createdAt || '') as string;
      return bKey.localeCompare(aKey);
    });
    const latestBatch = batchesSorted[0];
    const prevBatch = batchesSorted[1];

    const ordersForBatch = (batch?: OrderBatch) => {
      if (!batch || !batch.id) return [] as Order[];
      return this.orders.filter(o => o.batchId === batch.id);
    };

    const latestOrders = ordersForBatch(latestBatch);
    const prevOrders = ordersForBatch(prevBatch);

    this.revenueThisMonth = latestOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.totalAmount, 0);
    this.revenueLastMonth = prevOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.totalAmount, 0);

    this.shippingThisMonth = 0;
    this.shippingLastMonth = 0;
    if (latestBatch && latestBatch.name) {
      this.dbService.getBatchTotal(latestBatch.name).subscribe(total => {
        this.shippingThisMonth = Number(total || 0);
      }, _err => { this.shippingThisMonth = 0; });
    }
    if (prevBatch && prevBatch.name) {
      this.dbService.getBatchTotal(prevBatch.name).subscribe(total => {
        this.shippingLastMonth = Number(total || 0);
      }, _err => { this.shippingLastMonth = 0; });
    }

    this.expensesThisMonth = this.expenses
      .filter(e => e.expenseDate >= this.thisMonthStart)
      .reduce((s, e) => s + e.amount, 0);
    this.expensesLastMonth = this.expenses
      .filter(e => e.expenseDate >= this.lastMonthStart && e.expenseDate <= this.lastMonthEnd)
      .reduce((s, e) => s + e.amount, 0);

    this.netThisMonth = this.revenueThisMonth - this.expensesThisMonth;
    this.paidOrdersThisMonth = latestOrders.filter((o: Order) => o.paymentStatus === 'paid').length;
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  get revenueChange() { return this.pctChange(this.revenueThisMonth, this.revenueLastMonth); }
  get expenseChange() { return this.pctChange(this.expensesThisMonth, this.expensesLastMonth); }
  get shippingChange() { return this.pctChange(this.shippingThisMonth, this.shippingLastMonth); }

  private computeMonthlyTrend() {
    const now = new Date();
    const months: { label: string; amount: number; heightPercent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const rev = this.orders
        .filter(o => o.paymentStatus === 'paid')
        .filter(o => {
          const d = (o.createdAt || '').substring(0, 10);
          return d >= startStr && d <= endStr;
        })
        .reduce((s, o) => s + o.totalAmount, 0);
      months.push({ label: start.toLocaleString('default', { month: 'short' }), amount: rev, heightPercent: 0 });
    }
    const max = Math.max(...months.map(m => m.amount), 1);
    months.forEach(m => m.heightPercent = Math.max((m.amount / max) * 100, 3));
    this.monthlyRevenueTrend = months;
  }

  private computeExpenseBreakdown() {
    const catMap: Record<string, number> = {};
    for (const e of this.expenses) {
      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + e.amount;
    }
    this.expenseBreakdown = Object.entries(catMap).map(([cat, amount]) => ({
      category: cat,
      amount: amount,
      color: this.expenseColors[cat] || '#94a3b8'
    })).sort((a, b) => b.amount - a.amount);
  }

  get expenseTotal(): number {
    return this.expenseBreakdown.reduce((s, e) => s + e.amount, 0);
  }

  get expensePieGradient(): string {
    const total = this.expenseTotal;
    if (total === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    const parts: string[] = [];
    let deg = 0;
    for (const seg of this.expenseBreakdown) {
      const slice = (seg.amount / total) * 360;
      parts.push(seg.color + ' ' + deg + 'deg ' + (deg + slice) + 'deg');
      deg += slice;
    }
    return 'conic-gradient(' + parts.join(', ') + ')';
  }

  getExpensePercent(amount: number): number {
    return this.expenseTotal > 0 ? Math.round((amount / this.expenseTotal) * 100) : 0;
  }

  private computeExpenseTrend() {
    const now = new Date();
    const months: { label: string; amount: number; heightPercent: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const exp = this.expenses
        .filter(e => e.expenseDate >= startStr && e.expenseDate <= endStr)
        .reduce((s, e) => s + e.amount, 0);
      months.push({ label: start.toLocaleString('default', { month: 'short' }), amount: exp, heightPercent: 0 });
    }
    const max = Math.max(...months.map(m => m.amount), 1);
    months.forEach(m => m.heightPercent = Math.max((m.amount / max) * 100, 3));
    this.monthlyExpenseTrend = months;
  }

  computeTopProducts() {
    const startDate = this.getPeriodStart(this.topProductsPeriod);
    const periodOrders = this.orders.filter(o =>
      (o.createdAt || '').substring(0, 10) >= startDate
    );
    const productMap: Record<number, { name: string; quantity: number; revenue: number }> = {};
    for (const order of periodOrders) {
      for (const item of (order.items || [])) {
        const pid = item.productId;
        if (!productMap[pid]) {
          productMap[pid] = { name: item.productName || 'Product #' + pid, quantity: 0, revenue: 0 };
        }
        productMap[pid].quantity += item.quantity;
        productMap[pid].revenue += item.subtotal;
      }
    }
    this.topProducts = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }

  onTopProductsPeriodChange(period: 'month' | 'quarter' | 'year') {
    this.topProductsPeriod = period;
    this.computeTopProducts();
  }

  computeDeliveryBreakdown() {
    const startDate = this.getPeriodStart(this.deliveryPeriod);
    const periodDeliveries = this.deliveries.filter(d =>
      (d.createdAt || '').substring(0, 10) >= startDate
    );
    const colors: Record<string, string> = {
      station_car_delivery: '#3b82f6', riders: '#10b981', ghana_post: '#f59e0b', unknown: '#6366f1'
    };
    const catMap: Record<string, { count: number; fees: number }> = {};
    for (const d of periodDeliveries) {
      const cat = d.deliveryCategory || 'unknown';
      if (!catMap[cat]) catMap[cat] = { count: 0, fees: 0 };
      catMap[cat].count++;
      catMap[cat].fees += d.deliveryFee || 0;
    }
    this.deliveryBreakdown = Object.entries(catMap).map(([cat, data]) => {
      const found = DELIVERY_CATEGORIES.find(c => c.value === cat);
      return {
        category: cat,
        label: found ? found.label : (cat === 'unknown' ? 'Unset' : cat),
        count: data.count, fees: data.fees,
        color: colors[cat] || '#94a3b8'
      };
    }).sort((a, b) => b.count - a.count);
  }

  onDeliveryPeriodChange(period: 'month' | 'quarter' | 'year') {
    this.deliveryPeriod = period;
    this.computeDeliveryBreakdown();
  }

  get pieGradient(): string {
    const total = this.deliveryTotal;
    if (total === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    const parts: string[] = [];
    let deg = 0;
    for (const seg of this.deliveryBreakdown) {
      const slice = (seg.count / total) * 360;
      parts.push(seg.color + ' ' + deg + 'deg ' + (deg + slice) + 'deg');
      deg += slice;
    }
    return 'conic-gradient(' + parts.join(', ') + ')';
  }

  get deliveryTotal(): number {
    return this.deliveryBreakdown.reduce((s, d) => s + d.count, 0);
  }

  getDeliveryPercent(count: number): number {
    return this.deliveryTotal > 0 ? Math.round((count / this.deliveryTotal) * 100) : 0;
  }

  private computeBatchPipeline() {
    this.batchPipeline = { open: 0, buying: 0, delivering: 0, completed: 0 };
    for (const b of this.batches) {
      if (b.deliveryStatus === 'completed') {
        this.batchPipeline.completed++;
      } else if (b.deliveryStatus === 'pending' || b.deliveryStatus === 'in_progress') {
        this.batchPipeline.delivering++;
      } else if (b.buyingStatus && b.buyingStatus !== 'pending') {
        this.batchPipeline.buying++;
      } else {
        this.batchPipeline.open++;
      }
    }
  }

  private computeTopStockSales(stockSales: any[], stockItems: any[]) {
    const salesMap: Record<number, { quantity: number; totalAmount: number; description: string }> = {};
    for (const item of stockItems) {
      const saleId = item.stock_sale_id;
      const sale = stockSales.find(s => s.id === saleId);
      if (sale) {
        if (!salesMap[saleId]) {
          salesMap[saleId] = { quantity: 0, totalAmount: sale.total_amount || 0, description: sale.notes || 'Stock Sale' };
        }
        salesMap[saleId].quantity += item.quantity || 0;
      }
    }
    this.topStockSales = Object.values(salesMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }

  private computeDamagedItems(damagedItems: any[], damageAllocations: any[], products: any[]) {
    this.totalDamagedItems = damagedItems.length;
    this.damagedThisMonth = damagedItems.filter(d =>
      (d.created_at || '').substring(0, 10) >= this.thisMonthStart
    ).length;
    this.damageAllocated = damageAllocations.length;

    const productMap: Record<number, { name: string; count: number; batches: Set<number> }> = {};
    for (const d of damagedItems) {
      const pid = d.product_id;
      const batchId = d.batch_id;
      const product = products.find(p => p.id === pid);
      const name = product ? product.name : `Product #${pid}`;
      if (!productMap[pid]) {
        productMap[pid] = { name, count: 0, batches: new Set() };
      }
      productMap[pid].count++;
      if (batchId) productMap[pid].batches.add(batchId);
    }
    this.topDamagedProducts = Object.entries(productMap)
      .map(([pid, data]) => ({ name: data.name, count: data.count, batches: data.batches.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private computeArrivals(batches: OrderBatch[], arrivalItems: any[], products: any[]) {
    const pendingStatuses = new Set(['pending']);
    const receivedStatuses = new Set(['confirmed', 'sent_to_shipping']);
    const productNameById = new Map<number, string>((products || []).map((product: any) => [product.id, product.name]));
    const batchNameById = new Map<number, string>((batches || [])
      .filter(batch => !!batch.id)
      .map(batch => [Number(batch.id), batch.name || 'Unknown Batch']));

    this.arrivalsExpected = arrivalItems.filter(item => Number(item.requested_qty || 0) > 0).length;
    this.arrivalsReceivedMonth = arrivalItems.filter(item => {
      const itemStatus = item.status || 'pending';
      const itemDate = (item.updated_at || item.created_at || '').substring(0, 10);
      return receivedStatuses.has(itemStatus) && itemDate >= this.thisMonthStart;
    }).length;
    this.arrivalsPending = arrivalItems.filter(item => pendingStatuses.has(item.status || 'pending')).length;

    this.recentArrivals = [...arrivalItems]
      .sort((left, right) => (right.updated_at || right.created_at || '').localeCompare(left.updated_at || left.created_at || ''))
      .slice(0, 5)
      .map(item => ({
        productName: productNameById.get(Number(item.product_id)) || `Product #${item.product_id || 'Unknown'}`,
        quantity: Number(item.confirmed_qty || item.received_qty || item.requested_qty || 0),
        supplier: batchNameById.get(Number(item.batch_id)) || 'Unknown Batch',
        arrivalDate: (item.updated_at || item.created_at || '').substring(0, 10)
      }));
  }

  private getPeriodStart(period: 'month' | 'quarter' | 'year'): string {
    switch (period) {
      case 'month': return this.thisMonthStart;
      case 'quarter': return this.thisQuarterStart;
      case 'year': return this.thisYearStart;
    }
  }
}
