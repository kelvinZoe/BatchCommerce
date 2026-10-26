import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DashboardDataBundle, DashboardDataError, DashboardDataService, DashboardDataSource } from '../../services/dashboard-data.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { AppResource, Order, OrderBatch, Delivery, Expense, DELIVERY_CATEGORIES, DashboardComponentConfig, DASHBOARD_COMPONENTS, EXPENSE_CATEGORIES } from '../../models';

type DashboardPeriod = 'batch' | 'quarter' | 'year';

interface AttentionItem {
  label: string;
  value: string;
  icon: string;
  tone: 'amber' | 'red' | 'blue' | 'purple';
  route: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <section class="dash-hero">
        <div class="dash-hero-copy">
          <span class="dash-kicker">Command room</span>
          <h1>Dashboard</h1>
          <p>{{ dashboardGreeting }}</p>
        </div>
        <div class="dash-hero-actions">
          <div class="dash-date-chip">
            <span class="material-icons">calendar_today</span>
            {{ todayStr | date:'mediumDate' }}
          </div>
          <button class="dash-refresh" type="button" (click)="loadData()" [disabled]="loading">
            <span class="material-icons" [class.spin]="loading">sync</span>
            Refresh
          </button>
        </div>
      </section>

      <section class="dash-context" *ngIf="!loading && hasAnyDashboardSection">
        <label class="context-control" *ngIf="batches.length > 0">
          <span>Working batch</span>
          <select [value]="selectedBatchId || ''" (change)="onBatchChange($event)">
            <option *ngFor="let batch of batches" [value]="batch.id">
              {{ batch.name }} · {{ batch.status }}
            </option>
          </select>
        </label>
        <div class="context-control analytics-control" *ngIf="show('topProducts') || show('deliveryOverview') || show('stockSales')">
          <span>Analytics period</span>
          <div class="period-tabs" role="group" aria-label="Analytics period">
            <button type="button" [class.active]="analyticsPeriod === 'batch'" [attr.aria-pressed]="analyticsPeriod === 'batch'" (click)="onAnalyticsPeriodChange('batch')">Batch</button>
            <button type="button" [class.active]="analyticsPeriod === 'quarter'" [attr.aria-pressed]="analyticsPeriod === 'quarter'" (click)="onAnalyticsPeriodChange('quarter')">Quarter</button>
            <button type="button" [class.active]="analyticsPeriod === 'year'" [attr.aria-pressed]="analyticsPeriod === 'year'" (click)="onAnalyticsPeriodChange('year')">Year</button>
          </div>
        </div>
        <span class="context-generated" *ngIf="lastUpdatedAt">Updated {{ lastUpdatedAt | date:'shortTime' }}</span>
      </section>

      <ng-container *ngIf="loading">
        <div class="stats-grid dash-loading-stats">
          <div class="skeleton-stat-card" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-icon"></div>
            <div class="skeleton-line h-28 w-40 skeleton-spaced"></div>
            <div class="skeleton-line h-12 w-60"></div>
          </div>
        </div>
        <div class="skeleton-card dash-loading-panel full-width">
          <div class="skeleton-line h-20 w-40 skeleton-title-line"></div>
          <div class="dash-loading-grid">
            <div class="skeleton-line dash-loading-block" *ngFor="let i of [1,2,3,4,5]"></div>
          </div>
        </div>
        <div class="dash-loading-columns">
          <div class="skeleton-card" *ngFor="let i of [1,2]">
            <div class="skeleton-line h-20 w-50 skeleton-title-line"></div>
            <div class="skeleton-line dash-loading-chart"></div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading">
        <section class="dash-error" *ngIf="dataErrors.length > 0" role="alert">
          <span class="material-icons">report_problem</span>
          <div>
            <strong>Some dashboard sections are unavailable</strong>
            <p>{{ unavailableSectionLabels }}. Your role may need access to the underlying workspace data.</p>
          </div>
          <button type="button" (click)="loadData()">Try again</button>
        </section>

        <section class="dash-empty-config" *ngIf="!hasAnyDashboardSection">
          <span class="material-icons">dashboard_customize</span>
          <h2>No dashboard sections assigned</h2>
          <p>Ask a shop administrator to enable dashboard sections for your role.</p>
        </section>

        <ng-container *ngIf="show('stats')">
          <div class="section-header skeleton-fade-in">
            <div class="section-title">
              <span class="material-icons">space_dashboard</span>
              <h2>Today at a Glance</h2>
            </div>
            <span class="period-badge">Live workspace totals</span>
          </div>
          <div class="stats-grid summary-grid skeleton-fade-in">
            <div class="stat-card compact-stat">
              <div class="stat-icon blue"><span class="material-icons">inventory_2</span></div>
              <div class="stat-value">{{ totalProducts }}</div>
              <div class="stat-label">Active Products</div>
            </div>
            <div class="stat-card compact-stat">
              <div class="stat-icon purple"><span class="material-icons">groups</span></div>
              <div class="stat-value">{{ totalClients }}</div>
              <div class="stat-label">Clients</div>
            </div>
            <div class="stat-card compact-stat">
              <div class="stat-icon yellow"><span class="material-icons">shopping_cart</span></div>
              <div class="stat-value">{{ ordersToday }}</div>
              <div class="stat-label">Orders Today</div>
            </div>
            <div class="stat-card compact-stat">
              <div class="stat-icon green"><span class="material-icons">local_shipping</span></div>
              <div class="stat-value">{{ pendingDeliveries }}</div>
              <div class="stat-label">Pending Deliveries</div>
            </div>
            <div class="stat-card compact-stat">
              <div class="stat-icon blue"><span class="material-icons">folder_open</span></div>
              <div class="stat-value">{{ openBatches }}</div>
              <div class="stat-label">Open Batches</div>
            </div>
          </div>
        </ng-container>

        <section class="attention-card skeleton-fade-in" *ngIf="show('attention')">
          <div class="attention-heading">
            <div>
              <span class="dash-kicker">Action queue</span>
              <h2>Needs Attention</h2>
            </div>
            <span class="attention-count">{{ attentionItems.length }} open</span>
          </div>
          <div class="attention-grid" *ngIf="attentionItems.length > 0; else allClear">
            <button
              type="button"
              class="attention-item"
              *ngFor="let item of attentionItems"
              [ngClass]="'tone-' + item.tone"
              [disabled]="!item.route"
              (click)="openAttention(item)">
              <span class="attention-icon material-icons">{{ item.icon }}</span>
              <span class="attention-copy">
                <strong>{{ item.value }}</strong>
                <small>{{ item.label }}</small>
              </span>
              <span class="material-icons attention-arrow" *ngIf="item.route">arrow_forward</span>
            </button>
          </div>
          <ng-template #allClear>
            <div class="all-clear"><span class="material-icons">task_alt</span> No operational exceptions need attention.</div>
          </ng-template>
        </section>

        <ng-container *ngIf="show('finance')">
        <div class="section-header skeleton-fade-in">
          <div class="section-title">
            <span class="material-icons">monitoring</span>
            <h2>Selected Batch Health</h2>
          </div>
          <span class="period-badge">{{ currentBatchName }} vs {{ previousBatchName }}</span>
        </div>
        <div class="stats-grid batch-health-grid skeleton-fade-in">
          <div class="stat-card">
            <div class="stat-icon yellow"><span class="material-icons">shopping_cart</span></div>
            <div class="stat-value">{{ ordersThisBatch }}</div>
            <div class="stat-label">Batch Orders</div>
            <div class="stat-sub" [class.positive]="ordersChange >= 0" [class.negative]="ordersChange < 0">
              {{ ordersChange >= 0 ? '\u25b2' : '\u25bc' }} {{ ordersChange >= 0 ? ordersChange : ordersChange * -1 }}% vs last batch
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><span class="material-icons">payments</span></div>
            <div class="stat-value">GHS {{ batchOrderValue | number:'1.0-0' }}</div>
            <div class="stat-label">Batch Order Value</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue"><span class="material-icons">paid</span></div>
            <div class="stat-value">GHS {{ revenueThisMonth | number:'1.0-0' }}</div>
            <div class="stat-label">Paid Order Value</div>
            <div class="stat-sub" [class.positive]="revenueChange >= 0" [class.negative]="revenueChange < 0">
              {{ revenueChange >= 0 ? '\u25b2' : '\u25bc' }} {{ revenueChange >= 0 ? revenueChange : revenueChange * -1 }}% vs last batch
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple"><span class="material-icons">pending_actions</span></div>
            <div class="stat-value">GHS {{ batchOpenPaymentValue | number:'1.0-0' }}</div>
            <div class="stat-label">Open Order Value</div>
            <div class="stat-sub">Full value of {{ unpaidOrPartialOrdersThisBatch }} unpaid / partial orders</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green"><span class="material-icons">task_alt</span></div>
            <div class="stat-value">{{ batchPaidOrderRate }}%</div>
            <div class="stat-label">Paid Order Rate</div>
            <div class="stat-sub">{{ paidOrdersThisMonth }} of {{ ordersThisBatch }} orders paid</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue"><span class="material-icons">local_shipping</span></div>
            <div class="stat-value">GHS {{ shippingThisMonth | number:'1.0-0' }}</div>
            <div class="stat-label">Shipping Charges</div>
            <div class="stat-sub" [class.positive]="shippingChange >= 0" [class.negative]="shippingChange < 0">
              {{ shippingChange >= 0 ? '\u25b2' : '\u25bc' }} {{ shippingChange >= 0 ? shippingChange : shippingChange * -1 }}% vs last batch
            </div>
          </div>
        </div>
        </ng-container>

        <div class="card full-width trend-card skeleton-fade-in" *ngIf="show('revenueTrend')">
          <div class="card-header"><h2>Paid Order Value by Order Date (Last 6 Months)</h2></div>
          <div class="bar-chart">
            <div class="bar-item" *ngFor="let m of monthlyRevenueTrend">
              <div class="bar-wrapper">
                <div class="bar" [style.height.%]="m.heightPercent"></div>
              </div>
              <span class="bar-amount">{{ m.amount | number:'1.0-0' }}</span>
              <span class="bar-label">{{ m.label }}</span>
            </div>
          </div>
        </div>

        <div class="dashboard-grid skeleton-fade-in" *ngIf="show('topProducts') || show('deliveryOverview')">
          <div class="card" *ngIf="show('topProducts')">
            <div class="card-header">
              <h2>Top 10 Products</h2>
              <span class="period-badge">{{ analyticsPeriodLabel }}</span>
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

          <div class="card" *ngIf="show('deliveryOverview')">
            <div class="card-header">
              <h2>Delivery Overview</h2>
              <span class="period-badge">{{ analyticsPeriodLabel }}</span>
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

        <div class="dashboard-grid skeleton-fade-in" *ngIf="show('batchPipeline') || show('recentOrders')">
          <div class="card ops-card pipeline-card" *ngIf="show('batchPipeline')">
            <div class="card-header ops-card-header">
              <div>
                <span class="dash-kicker">Batch flow</span>
                <h2>Batch Pipeline</h2>
              </div>
              <span class="ops-total">{{ batchPipeline.open + batchPipeline.buying + batchPipeline.delivering }} active</span>
            </div>
            <div class="pipeline">
              <div class="pipeline-stage open">
                <div class="stage-marker"><span class="material-icons">inventory_2</span></div>
                <div class="stage-copy">
                  <div class="stage-label">Open</div>
                  <div class="stage-count">{{ batchPipeline.open }}</div>
                </div>
              </div>
              <div class="pipeline-stage buying">
                <div class="stage-marker"><span class="material-icons">shopping_bag</span></div>
                <div class="stage-copy">
                  <div class="stage-label">Buying</div>
                  <div class="stage-count">{{ batchPipeline.buying }}</div>
                </div>
              </div>
              <div class="pipeline-stage delivering">
                <div class="stage-marker"><span class="material-icons">local_shipping</span></div>
                <div class="stage-copy">
                  <div class="stage-label">Delivering</div>
                  <div class="stage-count">{{ batchPipeline.delivering }}</div>
                </div>
              </div>
              <div class="pipeline-stage completed">
                <div class="stage-marker"><span class="material-icons">task_alt</span></div>
                <div class="stage-copy">
                  <div class="stage-label">Completed</div>
                  <div class="stage-count">{{ batchPipeline.completed }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card ops-card orders-card" *ngIf="show('recentOrders')">
            <div class="card-header ops-card-header">
              <div>
                <span class="dash-kicker">Latest activity</span>
                <h2>Recent Orders</h2>
              </div>
              <span class="ops-total">{{ recentOrders.length }} shown</span>
            </div>
            <div class="recent-orders">
              <div class="recent-order" *ngFor="let o of recentOrders; let i = index">
                <span class="ro-rank">{{ i + 1 }}</span>
                <div class="ro-info">
                  <strong>{{ o.clientName }}</strong>
                  <small>#{{ o.id }} &middot; {{ o.items.length || 0 }} item{{ (o.items.length || 0) === 1 ? '' : 's' }}</small>
                </div>
                <span class="ro-status-pill" [ngClass]="'status-' + o.paymentStatus">{{ o.paymentStatus }}</span>
                <div class="ro-amount">GHS {{ o.totalAmount | number:'1.2-2' }}</div>
              </div>
              <div class="empty-list" *ngIf="recentOrders.length === 0">
                <p>No orders yet</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card full-width trend-card skeleton-fade-in" *ngIf="show('expenses')">
          <div class="card-header"><h2>Monthly Expense Trends (Last 6 Months)</h2></div>
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

        <div class="dashboard-grid skeleton-fade-in" *ngIf="show('expenses') || show('stockSales')">
          <div class="card" *ngIf="show('expenses')">
            <div class="card-header"><h2>This Month's Expenses by Category</h2></div>
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
                    <span class="legend-label">{{ getExpenseCategoryLabel(e.category) }}</span>
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

          <div class="card" *ngIf="show('stockSales')">
            <div class="card-header"><h2>Stock Sales · {{ stockSalesPeriodLabel }}</h2></div>
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

        <div class="dashboard-grid skeleton-fade-in" *ngIf="show('damagedItems') || show('inventory')">
          <div class="card" *ngIf="show('damagedItems')">
            <div class="card-header"><h2>Damaged Items Summary</h2></div>
            <div class="damaged-items-grid">
              <div class="damage-stat">
                <div class="damage-icon"><span class="material-icons">warning</span></div>
                <div class="damage-info">
                  <span class="damage-label">Total Damaged Units</span>
                  <span class="damage-value">{{ totalDamagedItems }}</span>
                </div>
              </div>
              <div class="damage-stat">
                <div class="damage-icon danger"><span class="material-icons">trending_up</span></div>
                <div class="damage-info">
                  <span class="damage-label">Units This Month</span>
                  <span class="damage-value">{{ damagedThisMonth }}</span>
                </div>
              </div>
              <div class="damage-stat">
                <div class="damage-icon warning"><span class="material-icons">check_circle</span></div>
                <div class="damage-info">
                  <span class="damage-label">Allocated Units</span>
                  <span class="damage-value">{{ damageAllocated }}</span>
                </div>
              </div>
            </div>
            <div class="top-damaged-products">
              <div class="damaged-product" *ngFor="let p of topDamagedProducts | slice:0:5">
                <span class="damage-count">{{ p.count }}</span>
                <div class="product-info">
                  <strong>{{ p.name }}</strong>
                  <small>{{ p.batches }} batches</small>
                </div>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="show('inventory')">
            <div class="card-header"><h2>Inventory Status</h2></div>
            <div class="inventory-grid">
              <div class="inventory-stat">
                <div class="inv-icon arriving"><span class="material-icons">local_shipping</span></div>
                <div class="inv-info">
                  <span class="inv-label">Expected Units</span>
                  <span class="inv-value">{{ arrivalsExpected }}</span>
                </div>
              </div>
              <div class="inventory-stat">
                <div class="inv-icon received"><span class="material-icons">done_all</span></div>
                <div class="inv-info">
                  <span class="inv-label">Units Received This Month</span>
                  <span class="inv-value">{{ arrivalsReceivedMonth }}</span>
                </div>
              </div>
              <div class="inventory-stat">
                <div class="inv-icon pending"><span class="material-icons">pending_actions</span></div>
                <div class="inv-info">
                  <span class="inv-label">Pending Units</span>
                  <span class="inv-value">{{ arrivalsPending }}</span>
                </div>
              </div>
            </div>
            <div class="recent-arrivals">
              <div class="arrival-item" *ngFor="let a of recentArrivals | slice:0:5">
                <div class="arrival-info">
                  <strong>{{ a.productName }}</strong>
                  <small>{{ a.quantity }} units · {{ a.supplier }}</small>
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
    .dashboard {
      --dash-ink: #172033;
      --dash-muted: #64748b;
      --dash-line: #dbe3ef;
      --dash-paper: rgba(255, 255, 255, 0.82);
      --dash-soft: #f8fafc;
      max-width: 1420px;
      margin: 0 auto;
      color: var(--dash-ink);
    }

    .dash-hero {
      position: relative;
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: center;
      margin-bottom: 18px;
      padding: 24px 26px;
      border: 1px solid rgba(23, 32, 51, 0.12);
      border-radius: 28px;
      overflow: hidden;
      background:
        radial-gradient(circle at 8% 0%, rgba(var(--primary-rgb, 99,102,241), 0.16), transparent 34%),
        radial-gradient(circle at 100% 18%, rgba(15, 118, 110, 0.12), transparent 34%),
        linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,253,247,0.72));
    }

    .dash-hero::after {
      content: '';
      position: absolute;
      right: -64px;
      bottom: -108px;
      width: 260px;
      height: 260px;
      border: 1px solid rgba(23, 32, 51, 0.12);
      border-radius: 50%;
      background: rgba(199, 121, 19, 0.07);
      pointer-events: none;
    }

    .dash-hero-copy,
    .dash-hero-actions {
      position: relative;
      z-index: 1;
    }

    .dash-kicker {
      display: inline-flex;
      color: #0f766e;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .dash-hero h1 {
      margin: 5px 0 6px;
      font-size: clamp(30px, 4vw, 46px);
      line-height: 0.98;
      letter-spacing: -0.055em;
      color: #0f172a;
    }

    .dash-hero p {
      max-width: 620px;
      margin: 0;
      color: var(--dash-muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .dash-hero-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .dash-context {
      display: flex;
      align-items: flex-end;
      gap: 14px;
      margin-bottom: 18px;
      padding: 13px 16px;
      border: 1px solid rgba(148, 163, 184, 0.26);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.76);
      backdrop-filter: blur(10px);
    }

    .context-control {
      display: grid;
      gap: 6px;
    }

    .context-control > span,
    .context-generated {
      color: #64748b;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .context-control select {
      min-width: 220px;
      min-height: 38px;
      padding: 0 34px 0 12px;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 11px;
      background: #fff;
      color: #1e293b;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
    }

    .analytics-control {
      margin-left: auto;
    }

    .context-generated {
      align-self: center;
      margin-left: 4px;
      white-space: nowrap;
    }

    .dash-error {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 16px;
      background: #fff7f7;
      color: #991b1b;
    }

    .dash-error > .material-icons {
      font-size: 22px;
    }

    .dash-error strong {
      display: block;
      font-size: 13px;
    }

    .dash-error p {
      margin: 3px 0 0;
      color: #b91c1c;
      font-size: 11px;
      line-height: 1.45;
    }

    .dash-error button {
      padding: 8px 11px;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fff;
      color: #991b1b;
      cursor: pointer;
      font-size: 11px;
      font-weight: 900;
    }

    .dash-empty-config {
      display: grid;
      justify-items: center;
      padding: 54px 24px;
      border: 1px dashed rgba(100, 116, 139, 0.35);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.66);
      text-align: center;
    }

    .dash-empty-config .material-icons {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: #e0e7ff;
      color: #4338ca;
      font-size: 26px;
    }

    .dash-empty-config h2 {
      margin: 14px 0 5px;
      font-size: 18px;
    }

    .dash-empty-config p {
      margin: 0;
      color: #64748b;
      font-size: 12px;
    }

    .summary-grid {
      grid-template-columns: repeat(5, minmax(150px, 1fr));
    }

    .compact-stat {
      min-height: 116px;
    }

    .attention-card {
      margin: 18px 0;
      padding: 19px;
      border: 1px solid rgba(180, 83, 9, 0.2);
      border-radius: 22px;
      background:
        radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.12), transparent 30%),
        rgba(255, 252, 245, 0.9);
    }

    .attention-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .attention-heading h2 {
      margin: 3px 0 0;
      font-size: 18px;
      letter-spacing: -0.025em;
    }

    .attention-count {
      padding: 6px 10px;
      border-radius: 999px;
      background: #ffedd5;
      color: #9a3412;
      font-size: 11px;
      font-weight: 900;
    }

    .attention-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px;
    }

    .attention-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 72px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 15px;
      background: rgba(255, 255, 255, 0.86);
      color: #334155;
      text-align: left;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .attention-item:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    .attention-item:disabled {
      cursor: default;
    }

    .attention-icon {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #fef3c7;
      color: #b45309;
      font-size: 20px;
    }

    .tone-red .attention-icon { background: #fee2e2; color: #b91c1c; }
    .tone-blue .attention-icon { background: #dbeafe; color: #1d4ed8; }
    .tone-purple .attention-icon { background: #ede9fe; color: #6d28d9; }

    .attention-copy {
      display: grid;
      gap: 2px;
    }

    .attention-copy strong {
      color: #0f172a;
      font-size: 16px;
      letter-spacing: -0.02em;
    }

    .attention-copy small {
      color: #64748b;
      font-size: 10px;
      font-weight: 750;
      line-height: 1.35;
    }

    .attention-arrow {
      color: #94a3b8;
      font-size: 17px;
    }

    .all-clear {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-radius: 14px;
      background: #ecfdf5;
      color: #047857;
      font-size: 12px;
      font-weight: 850;
    }

    .dash-date-chip,
    .dash-refresh {
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 13px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 850;
      white-space: nowrap;
    }

    .dash-date-chip {
      border: 1px solid rgba(148, 163, 184, 0.3);
      background: rgba(255, 255, 255, 0.72);
      color: #334155;
    }

    .dash-refresh {
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: var(--dash-ink);
      color: #fff;
      cursor: pointer;
    }

    .dash-refresh:disabled {
      opacity: 0.65;
      cursor: default;
    }

    .dash-refresh:focus-visible,
    .period-tabs button:focus-visible,
    .context-control select:focus-visible,
    .attention-item:focus-visible,
    .dash-error button:focus-visible {
      outline: 3px solid rgba(var(--primary-rgb, 99,102,241), 0.28);
      outline-offset: 2px;
    }

    .dash-date-chip .material-icons,
    .dash-refresh .material-icons {
      font-size: 17px;
    }

    .spin {
      animation: dash-spin 0.8s linear infinite;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      margin-bottom: 16px;
    }

    .batch-health-grid {
      margin-bottom: 18px;
    }

    .stat-card {
      position: relative;
      min-height: 126px;
      display: grid;
      align-content: space-between;
      padding: 18px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 22px;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.84)),
        radial-gradient(circle at 100% 0%, rgba(var(--primary-rgb, 99,102,241), 0.08), transparent 35%);
    }

    .stat-card::after {
      content: '';
      position: absolute;
      right: -30px;
      bottom: -42px;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: rgba(15, 118, 110, 0.05);
      pointer-events: none;
    }

    .stat-icon {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.74);
    }

    .stat-icon .material-icons {
      font-size: 21px;
      color: currentColor;
    }

    .stat-icon.blue {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .stat-icon.green {
      background: #dcfce7;
      color: #047857;
    }

    .stat-icon.yellow {
      background: #fef3c7;
      color: #b45309;
    }

    .stat-icon.purple {
      background: #ede9fe;
      color: #6d28d9;
    }

    .stat-value {
      margin-top: 14px;
      color: #0f172a;
      font-size: 28px;
      font-weight: 950;
      letter-spacing: -0.045em;
      line-height: 1;
    }

    .stat-value .material-icons {
      font-size: inherit;
    }

    .stat-label {
      margin-top: 5px;
      color: var(--dash-muted);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .stat-sub {
      position: relative;
      z-index: 1;
      margin-top: 8px;
      color: var(--dash-muted);
      font-size: 11px;
      font-weight: 800;
      line-height: 1.35;
    }

    .stat-sub.positive {
      color: #059669;
    }

    .stat-sub.negative {
      color: #dc2626;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin: 22px 0 12px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title h2,
    .card-header h2 {
      color: #0f172a;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .section-title .material-icons {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: rgba(var(--primary-rgb, 99,102,241), 0.1);
      color: var(--primary-color, #6366f1);
      font-size: 19px;
    }

    .period-badge {
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.28);
      color: var(--dash-muted);
      font-size: 11px;
      font-weight: 850;
    }

    .card {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 22px;
      background: var(--dash-paper);
      backdrop-filter: blur(10px);
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .trend-card {
      margin-top: 16px;
    }

    .full-width {
      grid-column: span 2;
    }

    .card {
      padding: 18px;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 15px;
    }

    .ops-card {
      min-height: 250px;
    }

    .ops-card-header {
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.22);
    }

    .ops-card-header h2 {
      margin-top: 3px;
    }

    .ops-total {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 999px;
      color: #475569;
      background: #f8fafc;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }

    .period-tabs {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 999px;
      background: #f8fafc;
    }

    .period-tabs button {
      padding: 6px 11px;
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--dash-muted);
      cursor: pointer;
      font-size: 11px;
      font-weight: 850;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .period-tabs button.active {
      background: var(--primary-color, #6366f1);
      color: white;
    }

    .period-tabs button:hover:not(.active) {
      background: #fff;
      color: #334155;
    }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      height: 210px;
      padding: 14px 8px 0;
      border-radius: 18px;
      background:
        repeating-linear-gradient(0deg, rgba(148,163,184,0.13) 0 1px, transparent 1px 42px),
        linear-gradient(180deg, rgba(248,250,252,0.85), rgba(255,255,255,0));
    }

    .bar-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      min-width: 0;
    }

    .bar-wrapper {
      flex: 1;
      width: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .bar {
      width: 58%;
      max-width: 54px;
      min-height: 4px;
      border-radius: 999px 999px 8px 8px;
      background: linear-gradient(180deg, var(--primary-color, #6366f1), #0f766e);
      transition: height 0.5s ease;
    }

    .bar-expense {
      background: linear-gradient(180deg, #ef4444, #f59e0b);
    }

    .bar-amount {
      margin-top: 8px;
      color: #0f172a;
      font-size: 11px;
      font-weight: 850;
    }

    .bar-label {
      margin-top: 2px;
      color: var(--dash-muted);
      font-size: 10.5px;
      font-weight: 750;
    }

    .top-products-list,
    .stock-sales-list,
    .recent-orders {
      max-height: 360px;
      overflow-y: auto;
      padding-right: 2px;
      scrollbar-width: thin;
      scrollbar-color: rgba(100,116,139,0.28) transparent;
    }

    .top-product,
    .stock-item,
    .recent-order,
    .arrival-item,
    .damaged-product,
    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    .top-product:last-child,
    .stock-item:last-child,
    .recent-order:last-child,
    .arrival-item:last-child,
    .legend-item:last-child {
      border-bottom: none;
    }

    .rank,
    .damage-count {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 900;
      background: #f1f5f9;
      color: #64748b;
    }

    .rank-1 { background: #fef3c7; color: #92400e; }
    .rank-2 { background: #e5e7eb; color: #374151; }
    .rank-3 { background: #ffedd5; color: #9a3412; }
    .damage-count { background: #fee2e2; color: #991b1b; }

    .product-info,
    .stock-info,
    .ro-info,
    .arrival-info,
    .legend-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .product-info strong,
    .stock-info strong,
    .ro-info strong,
    .arrival-info strong,
    .legend-label {
      color: #0f172a;
      font-size: 13px;
      font-weight: 850;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .product-info small,
    .stock-info small,
    .ro-info small,
    .arrival-info small,
    .legend-detail {
      margin-top: 2px;
      color: var(--dash-muted);
      font-size: 11px;
      line-height: 1.35;
    }

    .product-bar-wrap {
      width: 82px;
      height: 7px;
      border-radius: 999px;
      overflow: hidden;
      background: #e2e8f0;
    }

    .product-bar {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--primary-color, #6366f1), #0f766e);
      transition: width 0.5s ease;
    }

    .delivery-chart {
      display: flex;
      align-items: center;
      gap: 22px;
      padding: 8px 0 2px;
    }

    .pie-chart {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
    }

    .pie-center {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 64%;
      height: 64%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fffdf8;
      text-align: center;
    }

    .pie-center strong {
      color: #0f172a;
      font-size: 20px;
      font-weight: 950;
      line-height: 1;
    }

    .pie-center small {
      margin-top: 3px;
      color: var(--dash-muted);
      font-size: 10px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .pie-legend {
      flex: 1;
      min-width: 0;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-pct,
    .stock-amount,
    .ro-amount,
    .arrival-date {
      color: #0f172a;
      font-size: 12px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .stock-amount,
    .ro-amount {
      font-size: 13px;
    }

    .orders-card .recent-orders {
      max-height: 310px;
    }

    .orders-card .recent-order {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr) auto auto;
      gap: 10px;
      min-height: 56px;
      padding: 10px 0;
    }

    .ro-rank {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: #f1f5f9;
      color: #475569;
      font-size: 12px;
      font-weight: 950;
    }

    .ro-status-pill {
      justify-self: end;
      align-self: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      min-height: 26px;
      padding: 0 9px;
      border: 1px solid transparent;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 950;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .status-paid {
      border-color: #bbf7d0;
      background: #dcfce7;
      color: #166534;
    }

    .status-partial {
      border-color: #fde68a;
      background: #fef3c7;
      color: #92400e;
    }

    .status-unpaid {
      border-color: #fecaca;
      background: #fee2e2;
      color: #991b1b;
    }

    .status-refunded {
      border-color: #ddd6fe;
      background: #ede9fe;
      color: #5b21b6;
    }

    .damaged-items-grid,
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .damage-stat,
    .inventory-stat {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 16px;
      background: #f8fafc;
    }

    .damage-icon,
    .inv-icon {
      width: 36px;
      height: 36px;
      border-radius: 13px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .damage-icon { background: #fef3c7; color: #ea580c; }
    .damage-icon.danger { background: #fee2e2; color: #991b1b; }
    .damage-icon.warning { background: #dbeafe; color: #1e3a8a; }
    .inv-icon.arriving { background: #dbeafe; color: #1e40af; }
    .inv-icon.received { background: #d1fae5; color: #065f46; }
    .inv-icon.pending { background: #fef3c7; color: #92400e; }

    .damage-icon .material-icons,
    .inv-icon .material-icons {
      font-size: 19px;
    }

    .damage-info,
    .inv-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .damage-label,
    .inv-label {
      color: var(--dash-muted);
      font-size: 10.5px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.25;
    }

    .damage-value,
    .inv-value {
      margin-top: 3px;
      color: #0f172a;
      font-size: 18px;
      font-weight: 950;
      line-height: 1;
    }

    .top-damaged-products,
    .recent-arrivals {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(148, 163, 184, 0.22);
    }

    .pipeline {
      display: grid;
      gap: 10px;
      padding: 2px 0 0;
    }

    .pipeline-stage {
      position: relative;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      min-width: 0;
      padding: 11px 12px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 17px;
      background: #ffffff;
    }

    .pipeline-stage:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 32px;
      bottom: -11px;
      width: 2px;
      height: 10px;
      background: #cbd5e1;
    }

    .stage-marker {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      border: 1px solid currentColor;
      background: rgba(255, 255, 255, 0.5);
    }

    .stage-marker .material-icons {
      font-size: 20px;
    }

    .stage-copy {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .stage-count {
      color: #0f172a;
      font-size: 24px;
      font-weight: 950;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .stage-label {
      color: currentColor;
      font-size: 11px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .pipeline-stage.open {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .pipeline-stage.buying {
      background: #fffbeb;
      color: #b45309;
    }

    .pipeline-stage.delivering {
      background: #f5f3ff;
      color: #6d28d9;
    }

    .pipeline-stage.completed {
      background: #ecfdf5;
      color: #047857;
    }

    .empty-list {
      padding: 28px 18px;
      color: var(--dash-muted);
      text-align: center;
    }

    .empty-list .material-icons {
      margin-bottom: 8px;
      font-size: 30px;
      opacity: 0.5;
    }

    .empty-list p {
      margin: 0;
      font-size: 12px;
      font-weight: 750;
    }

    .dash-loading-stats {
      margin-top: 0;
    }

    .skeleton-stat-card,
    .skeleton-card {
      border-radius: 22px;
      border-color: rgba(148, 163, 184, 0.24);
      background: rgba(255,255,255,0.78);
    }

    .skeleton-spaced {
      margin-bottom: 8px;
    }

    .skeleton-title-line {
      margin-bottom: 16px;
    }

    .dash-loading-panel {
      margin-top: 16px;
    }

    .dash-loading-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
    }

    .dash-loading-block {
      height: 80px;
      border-radius: 16px;
    }

    .dash-loading-columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .dash-loading-chart {
      height: 200px;
      border-radius: 16px;
    }

    @keyframes dash-spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1220px) {
      .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .full-width {
        grid-column: span 1;
      }
    }

    @media (max-width: 900px) {
      .dash-hero {
        align-items: flex-start;
        flex-direction: column;
      }

      .dash-hero-actions {
        justify-content: flex-start;
      }

      .dash-context {
        align-items: stretch;
        flex-direction: column;
      }

      .analytics-control {
        margin-left: 0;
      }

      .context-generated {
        align-self: flex-start;
        margin-left: 0;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .delivery-chart {
        align-items: flex-start;
        flex-direction: column;
      }

      .pie-chart {
        align-self: center;
      }

      .dash-loading-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dash-loading-columns {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .dash-hero {
        padding: 20px;
        border-radius: 24px;
      }

      .dash-hero h1 {
        font-size: 34px;
      }

      .dash-hero-actions,
      .dash-date-chip,
      .dash-refresh {
        width: 100%;
      }

      .context-control select,
      .analytics-control,
      .analytics-control .period-tabs {
        width: 100%;
      }

      .dash-error {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .dash-error button {
        grid-column: 1 / -1;
      }

      .stats-grid,
      .damaged-items-grid,
      .inventory-grid,
      .pipeline,
      .dash-loading-grid {
        grid-template-columns: 1fr;
      }

      .summary-grid,
      .dash-loading-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .summary-grid .compact-stat {
        min-height: 106px;
        padding: 13px;
        border-radius: 17px;
      }

      .summary-grid .compact-stat:last-child:nth-child(odd) {
        grid-column: 1 / -1;
      }

      .summary-grid .stat-icon {
        width: 34px;
        height: 34px;
        border-radius: 11px;
      }

      .summary-grid .stat-icon .material-icons { font-size: 18px; }
      .summary-grid .stat-value { margin-top: 10px; font-size: 23px; }
      .summary-grid .stat-label { margin-top: 4px; font-size: 9px; line-height: 1.3; }

      .dash-context {
        gap: 10px;
        margin-bottom: 14px;
        padding: 11px 12px;
        border-radius: 15px;
      }

      .section-header { gap: 8px; margin-top: 17px; }
      .section-title { gap: 8px; min-width: 0; }
      .section-title h2 { font-size: 15px; }
      .period-badge { padding: 6px 9px; font-size: 9px; white-space: nowrap; }

      .card {
        padding: 16px;
        border-radius: 20px;
      }

      .card-header {
        flex-direction: column;
      }

      .period-tabs {
        width: 100%;
      }

      .period-tabs button {
        flex: 1;
      }

      .bar-chart {
        gap: 8px;
        height: 180px;
      }

      .product-bar-wrap {
        display: none;
      }

      .orders-card .recent-order {
        grid-template-columns: 32px minmax(0, 1fr);
      }

      .ro-status-pill,
      .ro-amount {
        grid-column: 2;
        justify-self: start;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  loading = true;
  dataErrors: DashboardDataError[] = [];
  lastUpdatedAt: Date | null = null;
  selectedBatchId: number | null = null;
  analyticsPeriod: DashboardPeriod = 'batch';

  orders: Order[] = [];
  expenses: Expense[] = [];
  deliveries: Delivery[] = [];
  batches: OrderBatch[] = [];
  private dashboardBundle: DashboardDataBundle | null = null;

  totalProducts = 0;
  totalClients = 0;
  ordersToday = 0;
  pendingDeliveries = 0;
  openBatches = 0;
  attentionItems: AttentionItem[] = [];

  revenueThisMonth = 0;
  revenueLastMonth = 0;
  shippingThisMonth = 0;
  shippingLastMonth = 0;
  paidOrdersThisMonth = 0;
  ordersThisBatch = 0;
  ordersLastBatch = 0;
  batchOrderValue = 0;
  batchOpenPaymentValue = 0;
  unpaidOrPartialOrdersThisBatch = 0;
  currentBatchName = 'No batch';
  previousBatchName = 'Previous batch';
  private currentBatchId: number | null = null;

  topProducts: { name: string; quantity: number; revenue: number }[] = [];

  deliveryBreakdown: { category: string; label: string; count: number; fees: number; color: string }[] = [];

  batchPipeline = { open: 0, buying: 0, delivering: 0, completed: 0 };
  monthlyRevenueTrend: { label: string; amount: number; heightPercent: number }[] = [];
  monthlyExpenseTrend: { label: string; amount: number; heightPercent: number }[] = [];
  recentOrders: Order[] = [];

  // New properties for dashboard enhancements
  expenseBreakdown: { category: string; amount: number; color: string }[] = [];
  expenseColors: Record<string, string> = {
    salary: '#0f766e',
    rent: '#2563eb',
    utilities: '#7c3aed',
    communication: '#0284c7',
    software: '#4f46e5',
    transport: '#d97706',
    supplies: '#0891b2',
    marketing: '#db2777',
    maintenance: '#dc2626',
    food: '#65a30d',
    taxes: '#ea580c',
    insurance: '#16a34a',
    professional_services: '#9333ea',
    bank_fees: '#e11d48',
    other: '#64748b',
    general: '#64748b'
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
  private thisQuarterStart = '';
  private thisYearStart = '';
  todayStr = '';

  constructor(
    private dashboardData: DashboardDataService,
    private authService: AuthService,
    private shopConfig: ShopConfigService,
    private router: Router
  ) {}

  get dashboardGreeting(): string {
    const name = this.authService.currentUser?.fullName?.split(' ')[0] || 'there';
    const shopName = this.shopConfig.shopName || 'your shop';
    return `Welcome back, ${name}. Here is the live operating picture for ${shopName}.`;
  }

  can(component: keyof DashboardComponentConfig): boolean {
    return this.authService.canSeeDashboardComponent(component);
  }

  show(component: keyof DashboardComponentConfig): boolean {
    return this.can(component) && !this.isSectionUnavailable(component);
  }

  get hasAnyDashboardSection(): boolean {
    return DASHBOARD_COMPONENTS.some(component => this.can(component.key));
  }

  get analyticsPeriodLabel(): string {
    if (this.analyticsPeriod === 'batch') return this.currentBatchName;
    return this.analyticsPeriod === 'quarter' ? 'This Quarter' : 'This Year';
  }

  get stockSalesPeriodLabel(): string {
    return this.analyticsPeriod === 'batch' ? 'This Month' : this.analyticsPeriodLabel;
  }

  get unavailableSectionLabels(): string {
    return DASHBOARD_COMPONENTS
      .filter(component => this.can(component.key) && this.isSectionUnavailable(component.key))
      .map(component => component.label)
      .join(', ');
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
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    this.thisQuarterStart = fmt(new Date(now.getFullYear(), qMonth, 1));
    this.thisYearStart = fmt(new Date(now.getFullYear(), 0, 1));
  }

  loadData() {
    this.loading = true;
    this.dataErrors = [];

    this.dashboardData.loadDashboardData(this.selectedBatchId).subscribe(
      dashboardData => {
        this.dashboardBundle = dashboardData;
        this.orders = dashboardData.orders;
        this.expenses = dashboardData.expenses;
        this.deliveries = dashboardData.deliveries;
        this.batches = dashboardData.batches;
        this.selectedBatchId = dashboardData.selectedBatchId;
        this.dataErrors = dashboardData.errors;

        this.computeSummary(dashboardData.products, dashboardData.customerCount);
        this.computeFinance(dashboardData.shippingBatches);
        this.computeTopProducts();
        this.computeDeliveryBreakdown();
        this.computeBatchPipeline();
        this.computeMonthlyTrend();
        this.computeExpenseTrend();
        this.computeExpenseBreakdown();
        this.computeTopStockSales(dashboardData.stockSales, dashboardData.stockItems);
        this.computeArrivals(this.batches, dashboardData.arrivalItems, dashboardData.products);
        this.computeDamagedItems(dashboardData.damagedItems, dashboardData.damageAllocations, dashboardData.products);
        this.computeAttention(dashboardData);
        this.recentOrders = this.orders.slice(0, 5);
        this.lastUpdatedAt = new Date();
        this.loading = false;
      },
      error => {
        console.error('Error loading dashboard data:', error);
        this.dataErrors = [{ source: 'batches', message: 'The dashboard could not be loaded.' }];
        this.loading = false;
      }
    );
  }

  private computeSummary(products: any[], customerCount: number) {
    const today = this.todayStr;
    this.totalProducts = products.length;
    this.totalClients = customerCount;
    this.ordersToday = this.orders.filter(order => (order.createdAt || '').substring(0, 10) === today).length;
    this.pendingDeliveries = this.deliveries.filter(delivery =>
      delivery.status === 'pending' || delivery.status === 'in_transit'
    ).length;
    this.openBatches = this.batches.filter(batch => batch.status === 'open').length;
  }

  private computeFinance(shippingBatches: any[]) {
    const selectedIndex = this.batches.findIndex(batch => Number(batch.id) === Number(this.selectedBatchId));
    const latestBatch = selectedIndex >= 0 ? this.batches[selectedIndex] : this.batches[0];
    const prevBatch = selectedIndex >= 0 ? this.batches[selectedIndex + 1] : this.batches[1];
    this.currentBatchId = latestBatch?.id ? Number(latestBatch.id) : null;
    this.currentBatchName = latestBatch?.name || 'No batch';
    this.previousBatchName = prevBatch?.name || 'Previous batch';

    const ordersForBatch = (batch?: OrderBatch) => {
      if (!batch || !batch.id) return [] as Order[];
      return this.orders.filter(o => o.batchId === batch.id);
    };

    const latestOrders = ordersForBatch(latestBatch).filter(order => order.paymentStatus !== 'refunded');
    const prevOrders = ordersForBatch(prevBatch).filter(order => order.paymentStatus !== 'refunded');
    this.ordersThisBatch = latestOrders.length;
    this.ordersLastBatch = prevOrders.length;
    this.batchOrderValue = latestOrders
      .filter(o => o.paymentStatus !== 'refunded')
      .reduce((s, o) => s + o.totalAmount, 0);
    this.unpaidOrPartialOrdersThisBatch = latestOrders
      .filter(o => o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial')
      .length;
    this.batchOpenPaymentValue = latestOrders
      .filter(o => o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial')
      .reduce((s, o) => s + o.totalAmount, 0);

    this.revenueThisMonth = latestOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.totalAmount, 0);
    this.revenueLastMonth = prevOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.totalAmount, 0);

    this.shippingThisMonth = this.shippingTotalForBatch(shippingBatches, latestBatch);
    this.shippingLastMonth = this.shippingTotalForBatch(shippingBatches, prevBatch);

    this.paidOrdersThisMonth = latestOrders.filter((o: Order) => o.paymentStatus === 'paid').length;
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  get revenueChange() { return this.pctChange(this.revenueThisMonth, this.revenueLastMonth); }
  get shippingChange() { return this.pctChange(this.shippingThisMonth, this.shippingLastMonth); }
  get ordersChange() { return this.pctChange(this.ordersThisBatch, this.ordersLastBatch); }
  get batchPaidOrderRate() {
    return this.ordersThisBatch > 0 ? Math.round((this.paidOrdersThisMonth / this.ordersThisBatch) * 100) : 0;
  }

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
    for (const e of this.expenses.filter(expense => expense.expenseDate >= this.thisMonthStart)) {
      const cat = (e.category || 'other').toLowerCase();
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

  getExpenseCategoryLabel(category: string): string {
    return EXPENSE_CATEGORIES.find(item => item.value === category)?.label
      || category.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
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
    const periodOrders = (this.analyticsPeriod === 'batch'
      ? this.orders.filter(o => !!this.currentBatchId && o.batchId === this.currentBatchId)
      : this.orders.filter(o =>
        (o.createdAt || '').substring(0, 10) >= this.getPeriodStart(this.analyticsPeriod)
      )).filter(order => order.paymentStatus !== 'refunded');
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

  onAnalyticsPeriodChange(period: DashboardPeriod) {
    this.analyticsPeriod = period;
    this.computeTopProducts();
    this.computeDeliveryBreakdown();
    if (this.dashboardBundle) {
      this.computeTopStockSales(this.dashboardBundle.stockSales, this.dashboardBundle.stockItems);
    }
  }

  computeDeliveryBreakdown() {
    const periodDeliveries = this.analyticsPeriod === 'batch'
      ? this.deliveries.filter(d => Number(d.batchId) === Number(this.currentBatchId))
      : this.deliveries.filter(d =>
        (d.createdAt || '').substring(0, 10) >= this.getPeriodStart(this.analyticsPeriod)
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
      } else if (b.status === 'open') {
        this.batchPipeline.open++;
      } else if (b.deliveryStatus === 'pending' || b.deliveryStatus === 'in_progress') {
        this.batchPipeline.delivering++;
      } else {
        this.batchPipeline.buying++;
      }
    }
  }

  private computeTopStockSales(stockSales: any[], stockItems: any[]) {
    const periodStart = this.analyticsPeriod === 'batch'
      ? this.thisMonthStart
      : this.getPeriodStart(this.analyticsPeriod);
    const salesMap: Record<number, { quantity: number; totalAmount: number; description: string }> = {};
    for (const item of stockItems) {
      const saleId = item.stock_sale_id;
      const sale = stockSales.find(s => s.id === saleId && (s.created_at || '') >= periodStart);
      if (sale) {
        if (!salesMap[saleId]) {
          salesMap[saleId] = {
            quantity: 0,
            totalAmount: Number(sale.total_amount || 0),
            description: sale.customer_name || `Stock sale #${sale.id}`
          };
        }
        salesMap[saleId].quantity += item.quantity || 0;
      }
    }
    this.topStockSales = Object.values(salesMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }

  private computeDamagedItems(damagedItems: any[], damageAllocations: any[], products: any[]) {
    this.totalDamagedItems = damagedItems.reduce((sum, item) => sum + Number(item.damaged_qty || 0), 0);
    this.damagedThisMonth = damagedItems.filter(d =>
      (d.created_at || '').substring(0, 10) >= this.thisMonthStart
    ).reduce((sum, item) => sum + Number(item.damaged_qty || 0), 0);
    this.damageAllocated = damageAllocations
      .filter(allocation => allocation.is_active !== false)
      .reduce((sum, allocation) => sum + Number(allocation.damaged_quantity || 0), 0);

    const productMap: Record<number, { name: string; count: number; batches: Set<number> }> = {};
    for (const d of damagedItems) {
      const pid = d.product_id;
      const batchId = d.batch_id;
      const product = products.find(p => p.id === pid);
      const name = product ? product.name : `Product #${pid}`;
      if (!productMap[pid]) {
        productMap[pid] = { name, count: 0, batches: new Set() };
      }
      productMap[pid].count += Number(d.damaged_qty || 0);
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

    this.arrivalsExpected = arrivalItems.reduce((sum, item) => sum + Number(item.requested_qty || 0), 0);
    this.arrivalsReceivedMonth = arrivalItems.filter(item => {
      const itemStatus = item.status || 'pending';
      const itemDate = (item.updated_at || item.created_at || '').substring(0, 10);
      return receivedStatuses.has(itemStatus) && itemDate >= this.thisMonthStart;
    }).reduce((sum, item) => sum + Math.max(
      Number(item.confirmed_qty || 0),
      Number(item.received_qty || 0)
    ), 0);
    this.arrivalsPending = arrivalItems
      .filter(item => pendingStatuses.has(item.status || 'pending'))
      .reduce((sum, item) => sum + Math.max(
        Number(item.requested_qty || 0) - Math.max(
          Number(item.confirmed_qty || 0),
          Number(item.received_qty || 0)
        ),
        0
      ), 0);

    this.recentArrivals = [...arrivalItems]
      .sort((left, right) => (right.updated_at || right.created_at || '').localeCompare(left.updated_at || left.created_at || ''))
      .slice(0, 5)
      .map(item => ({
        productName: productNameById.get(Number(item.product_id)) || `Product #${item.product_id || 'Unknown'}`,
        quantity: Number(item.confirmed_qty || item.received_qty || item.requested_qty || 0),
        supplier: batchNameById.get(Number(item.batch_id)) || 'Unknown batch',
        arrivalDate: (item.updated_at || item.created_at || '').substring(0, 10)
      }));
  }

  private computeAttention(data: DashboardDataBundle) {
    const pendingBuying = data.buyingList.length;
    const pendingArrivalUnits = data.arrivalItems.reduce((sum, item) => sum + Math.max(
      Number(item.requested_qty || 0) - Math.max(
        Number(item.confirmed_qty || 0),
        Number(item.received_qty || 0)
      ),
      0
    ), 0);
    const damagedUnits = data.damagedItems.reduce((sum, item) => sum + Number(item.damaged_qty || 0), 0);
    const allocatedUnits = data.damageAllocations.reduce((sum, item) => sum + Number(item.damaged_quantity || 0), 0);
    const pendingDeliveryCount = data.deliveries.filter(delivery =>
      delivery.status === 'pending' || delivery.status === 'in_transit'
    ).length;
    const shippingBalance = data.shippingPayments.reduce((sum, payment) => sum + Math.max(
      Number(payment.total_fee || 0) - Number(payment.paid_amount || 0),
      0
    ), 0);

    const candidates: Array<AttentionItem & { resource: AppResource; numericValue: number }> = [
      {
        label: 'buying lines still pending', value: pendingBuying.toLocaleString(), numericValue: pendingBuying,
        icon: 'shopping_bag', tone: 'amber', resource: 'buying_list', route: '/buying-list'
      },
      {
        label: 'arrival units outstanding', value: pendingArrivalUnits.toLocaleString(), numericValue: pendingArrivalUnits,
        icon: 'inventory', tone: 'blue', resource: 'arrivals', route: '/arrivals'
      },
      {
        label: 'damaged units unallocated', value: Math.max(damagedUnits - allocatedUnits, 0).toLocaleString(),
        numericValue: Math.max(damagedUnits - allocatedUnits, 0), icon: 'report_problem', tone: 'red',
        resource: 'damaged_items', route: '/damaged-items'
      },
      {
        label: 'deliveries still pending', value: pendingDeliveryCount.toLocaleString(), numericValue: pendingDeliveryCount,
        icon: 'local_shipping', tone: 'purple', resource: 'deliveries', route: '/deliveries'
      },
      {
        label: 'shipping balance outstanding', value: `GHS ${shippingBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        numericValue: shippingBalance, icon: 'payments', tone: 'amber', resource: 'shipping', route: '/shipping-ledger'
      }
    ];

    this.attentionItems = candidates
      .filter(item => item.numericValue > 0)
      .map(item => ({
        label: item.label,
        value: item.value,
        icon: item.icon,
        tone: item.tone,
        route: this.authService.canView(item.resource) ? item.route : null
      }));
  }

  onBatchChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value || 0);
    this.selectedBatchId = value > 0 ? value : null;
    this.analyticsPeriod = 'batch';
    this.loadData();
  }

  openAttention(item: AttentionItem) {
    if (item.route) this.router.navigateByUrl(item.route);
  }

  private shippingTotalForBatch(shippingBatches: any[], batch?: OrderBatch): number {
    if (!batch?.id) return 0;
    const exact = shippingBatches.find(row => Number(row.batch_id) === Number(batch.id));
    const legacy = shippingBatches.find(row => !row.batch_id && row.batch_name === batch.name);
    return Number((exact || legacy)?.total_fee || 0);
  }

  private isSectionUnavailable(component: keyof DashboardComponentConfig): boolean {
    const failed = new Set<DashboardDataSource>(this.dataErrors.map(error => error.source));
    const dependencies: Record<keyof DashboardComponentConfig, DashboardDataSource[]> = {
      stats: ['products', 'customers', 'orders', 'deliveries', 'batches'],
      attention: ['buyingList', 'arrivalItems', 'damagedItems', 'damageAllocations', 'deliveries', 'shippingPayments'],
      finance: ['orders', 'batches', 'shippingBatches'],
      revenueTrend: ['orders'],
      topProducts: ['orders', 'batches'],
      deliveryOverview: ['deliveries', 'batches'],
      batchPipeline: ['batches'],
      recentOrders: ['orders'],
      expenses: ['expenses'],
      stockSales: ['stockSales', 'stockItems'],
      damagedItems: ['damagedItems', 'damageAllocations', 'products'],
      inventory: ['arrivalItems', 'products', 'batches']
    };
    return dependencies[component].some(source => failed.has(source));
  }

  private getPeriodStart(period: DashboardPeriod): string {
    switch (period) {
      case 'batch': return this.thisMonthStart;
      case 'quarter': return this.thisQuarterStart;
      case 'year': return this.thisYearStart;
    }
  }
}
