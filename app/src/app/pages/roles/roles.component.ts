import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {
  ALL_RESOURCES,
  AppResource,
  ArrivalsPermissionConfig,
  ARRIVALS_OPERATIONS,
  BuyingListPermissionConfig,
  BUYING_LIST_OPERATIONS,
  DashboardComponentConfig,
  DEFAULT_ARRIVALS_CONFIG,
  DEFAULT_BUYING_LIST_CONFIG,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_MANAGE_BATCHES_CONFIG,
  DEFAULT_ORDERS_CONFIG,
  DEFAULT_PRODUCT_CONFIG,
  DEFAULT_ROLES_CONFIG,
  DEFAULT_SHIPPING_CONFIG,
  DEFAULT_SHIPPING_LEDGER_CONFIG,
  DEFAULT_STOCK_SALES_CONFIG,
  DEFAULT_USERS_CONFIG,
  ManageBatchesPermissionConfig,
  MANAGE_BATCHES_OPERATIONS,
  OrdersPermissionConfig,
  ORDERS_OPERATIONS,
  PermissionAction,
  ProductPermissionConfig,
  PRODUCT_OPERATIONS,
  Role,
  RolesPermissionConfig,
  ROLES_OPERATIONS,
  SHIPPING_LEDGER_OPERATIONS,
  SHIPPING_OPERATIONS,
  ShippingLedgerPermissionConfig,
  ShippingPermissionConfig,
  StockSalesPermissionConfig,
  STOCK_SALES_OPERATIONS,
  UsersPermissionConfig
} from '../../models';

type CrudAction = Exclude<PermissionAction, 'view'>;
type ConfigKey =
  | 'productConfig'
  | 'ordersConfig'
  | 'buyingListConfig'
  | 'arrivalsConfig'
  | 'shippingConfig'
  | 'shippingLedgerConfig'
  | 'stockSalesConfig'
  | 'manageBatchesConfig'
  | 'rolesConfig';

interface CrudActionCard {
  key: CrudAction;
  label: string;
  description: string;
  icon: string;
}

interface ProductActionCard {
  key: keyof ProductPermissionConfig;
  label: string;
  description: string;
  icon: string;
}

interface OrdersActionCard {
  key: keyof OrdersPermissionConfig;
  label: string;
  description: string;
  icon: string;
}

interface ConfigActionCard {
  key: string;
  label: string;
  description: string;
  icon: string;
}

interface PermissionActionGroup {
  label: string;
  type: 'crud' | 'config';
  resource: AppResource;
  actions: Array<CrudActionCard | ConfigActionCard>;
  configKey?: ConfigKey;
}

type ManagedPermissionPage =
  | 'clients'
  | 'products'
  | 'orders'
  | 'buying_list'
  | 'arrivals'
  | 'shipping'
  | 'shipping_ledger'
  | 'stock_sales'
  | 'batches'
  | 'roles';

interface ManagedPageTab {
  key: ManagedPermissionPage;
  resource: AppResource;
  label: string;
  description: string;
  icon: string;
  accentClass: string;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roles-page">
      <section class="roles-hero">
        <div class="roles-hero-copy">
          <div class="hero-kicker">Roles &amp; Permissions</div>
          <h1>Make team access easy to understand.</h1>
          <p class="page-subtitle">Pick a role, choose a page, and turn actions on or off in plain language.</p>
        </div>

        <div class="roles-hero-actions">
          <div class="hero-hint">
            <span class="material-icons">tips_and_updates</span>
            <span>Changes only affect the selected role.</span>
          </div>

          <button
            class="btn btn-primary"
            *ngIf="authService.canPerformRolesOperation('canAddRole')"
            (click)="openModal()"
            [disabled]="savingRole">
            <span class="material-icons spinner" *ngIf="savingRole">sync</span>
            <span class="material-icons" *ngIf="!savingRole">add_moderator</span>
            {{ savingRole ? 'Creating...' : 'Create Role' }}
          </button>
        </div>
      </section>

      <ng-container *ngIf="loading">
        <div class="roles-shell">
          <div class="card skeleton-panel-card">
            <div class="panel-heading">
              <span class="step-badge">Step 1</span>
              <div class="skeleton-line title"></div>
              <div class="skeleton-line md"></div>
            </div>

            <div class="role-list role-list-loading">
              <div class="skeleton-card role-skeleton" *ngFor="let i of [1,2,3,4]">
                <div class="skeleton-head">
                  <div class="skeleton-icon"></div>
                  <div class="skeleton-copy">
                    <div class="skeleton-line lg"></div>
                    <div class="skeleton-line md"></div>
                  </div>
                </div>
                <div class="skeleton-line full"></div>
              </div>
            </div>
          </div>

          <div class="roles-stage">
            <div class="card workbench-skeleton">
              <div class="skeleton-line title"></div>
              <div class="skeleton-panels">
                <div class="skeleton-panel" *ngFor="let i of [1,2,3]"></div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading">
        <div class="roles-shell">
          <aside class="card roles-sidebar">
            <div class="panel-heading">
              <span class="step-badge">Step 1</span>
              <h2>Choose a role</h2>
              <p>Select the job or team title you want to set up.</p>
            </div>

            <div class="role-list">
              <div
                *ngFor="let role of roles"
                class="role-card"
                [class.active]="selectedRole?.id === role.id"
                (click)="selectRole(role)">
                <div class="role-card-main">
                  <div class="role-header">
                    <div class="role-icon" [style.background]="getRoleColor(role.name)">
                      <span class="material-icons">{{ getRoleIcon(role.name) }}</span>
                    </div>
                    <div class="role-title">
                      <h3>{{ role.name }}</h3>
                      <div class="role-badges">
                        <span class="badge-system" *ngIf="role.isSystem">System</span>
                        <span class="badge-custom" *ngIf="!role.isSystem">Custom</span>
                      </div>
                    </div>
                  </div>

                  <p class="role-desc">{{ role.description || 'No description yet.' }}</p>

                  <div class="role-footer">
                    <div class="role-stats">
                      <span class="material-icons">person</span>
                      {{ userCounts[role.id!] || 0 }} user{{ (userCounts[role.id!] || 0) === 1 ? '' : 's' }}
                    </div>
                    <div class="role-stats">
                      <span class="material-icons">security</span>
                      {{ getPermissionCount(role) }} active permission{{ getPermissionCount(role) === 1 ? '' : 's' }}
                    </div>
                  </div>
                </div>

                <div class="role-actions">
                  <button
                    class="btn btn-sm btn-secondary"
                    title="Edit role"
                    *ngIf="authService.canPerformRolesOperation('canEditRole')"
                    (click)="editRole(role); $event.stopPropagation()">
                    <span class="material-icons">edit</span>
                  </button>
                  <button
                    class="btn btn-sm btn-secondary"
                    title="Duplicate role"
                    *ngIf="authService.canPerformRolesOperation('canAddRole')"
                    (click)="duplicateRoleAction(role); $event.stopPropagation()">
                    <span class="material-icons">content_copy</span>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    title="Delete role"
                    *ngIf="!role.isSystem && authService.canPerformRolesOperation('canDeleteRole')"
                    (click)="deleteRole(role); $event.stopPropagation()"
                    [disabled]="deletingRoleId === role.id">
                    <span *ngIf="deletingRoleId !== role.id" class="material-icons">delete</span>
                    <span *ngIf="deletingRoleId === role.id" class="material-icons spinner">sync</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <section class="roles-stage" *ngIf="selectedRole; else emptyState">
            <div class="card setup-overview">
              <div class="setup-overview-main">
                <div class="matrix-title">
                  <div class="role-icon sm" [style.background]="getRoleColor(selectedRole.name)">
                    <span class="material-icons">verified_user</span>
                  </div>
                  <div>
                    <div class="overview-kicker">Current setup</div>
                    <h2>{{ selectedRole.name }}</h2>
                    <small>{{ userCounts[selectedRole.id!] || 0 }} user{{ (userCounts[selectedRole.id!] || 0) === 1 ? '' : 's' }} assigned to this role</small>
                  </div>
                </div>

                <div class="overview-status">
                  <div class="status-pill" [class.dirty]="matrixDirty">
                    <span class="material-icons">{{ matrixDirty ? 'edit' : 'task_alt' }}</span>
                    {{ matrixDirty ? 'Unsaved changes' : 'Saved' }}
                  </div>
                  <div class="status-pill">
                    <span class="material-icons">web</span>
                    {{ getManagedPageMeta(focusedPage).label }} page
                  </div>
                </div>
              </div>

              <button
                class="btn btn-primary"
                *ngIf="selectedRole.name !== 'Admin'"
                (click)="savePermissions()"
                [disabled]="!matrixDirty || savingPermissions">
                <span class="material-icons spinner" *ngIf="savingPermissions">sync</span>
                <span class="material-icons" *ngIf="!savingPermissions">save</span>
                {{ savingPermissions ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>

            <div class="admin-notice" *ngIf="selectedRole.name === 'Admin'">
              <span class="material-icons">verified_user</span>
              <div>
                <strong>Admin always has full access</strong>
                <p>This role bypasses page-level restrictions, so there is nothing to configure here.</p>
              </div>
            </div>

            <ng-container *ngIf="selectedRole.name !== 'Admin'">
              <div class="builder-grid">
                <section class="card builder-panel page-picker-panel">
                  <div class="panel-heading compact-heading">
                    <span class="step-badge">Step 2</span>
                    <div>
                      <h3>Choose a page</h3>
                      <p>Jump between page-level access groups.</p>
                    </div>
                  </div>

                  <div class="page-choice-list">
                    <button
                      type="button"
                      *ngFor="let page of managedPages"
                      class="page-choice"
                      [class.active]="focusedPage === page.key"
                      [ngClass]="page.accentClass"
                      (click)="setFocusedPage(page.key)">
                      <div class="page-choice-top">
                        <span class="material-icons">{{ page.icon }}</span>
                        <span class="page-choice-state" [class.off]="!hasPermission(page.resource, 'view')">
                          {{ hasPermission(page.resource, 'view') ? 'Open' : 'Blocked' }}
                        </span>
                      </div>
                      <div class="page-choice-copy">
                        <strong>{{ page.label }}</strong>
                        <small>{{ page.description }}</small>
                      </div>
                      <div class="page-choice-meta">
                        <span>{{ getEnabledActionCount(page.key) }}/{{ getTotalActionCount(page.key) }}</span>
                      </div>
                    </button>
                  </div>
                </section>

                <section class="card builder-panel action-builder">
                  <div class="action-builder-head">
                    <div class="panel-heading compact-heading">
                      <span class="step-badge">Step 3</span>
                      <div>
                        <h3>{{ getManagedPageMeta(focusedPage).label }} actions</h3>
                        <p>Turn on only the tasks this role should be allowed to do.</p>
                      </div>
                    </div>

                    <div class="action-count-pill">
                      <strong>{{ getEnabledActionCount(focusedPage) }}</strong>
                      <span>/ {{ getTotalActionCount(focusedPage) }} allowed</span>
                    </div>
                  </div>

                  <div class="page-access-card">
                    <div class="page-access-copy">
                      <div class="page-card-title">
                        <div class="page-card-icon" [ngClass]="getManagedPageMeta(focusedPage).accentClass">
                          <span class="material-icons">{{ getManagedPageMeta(focusedPage).icon }}</span>
                        </div>
                        <div>
                          <h3>{{ getManagedPageMeta(focusedPage).label }} page</h3>
                          <p>{{ getManagedPageDescription(focusedPage) }}</p>
                        </div>
                      </div>
                    </div>

                    <div class="page-access-toggle">
                      <span>{{ hasPermission(getFocusedResource(), 'view') ? 'Can open this page' : 'Cannot open this page' }}</span>
                      <label class="toggle">
                        <input
                          type="checkbox"
                          [checked]="hasPermission(getFocusedResource(), 'view')"
                          (change)="togglePageAccess(getFocusedResource())" />
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div class="page-toolbar">
                    <button class="btn btn-sm btn-secondary" (click)="enableAllPageActions(focusedPage)">
                      <span class="material-icons">done_all</span>
                      Allow all
                    </button>
                    <button class="btn btn-sm btn-secondary" (click)="clearPageActions(focusedPage)">
                      <span class="material-icons">block</span>
                      Clear
                    </button>
                  </div>

                  <div class="action-group" *ngFor="let group of getActionGroups(focusedPage)">
                    <div class="action-group-label">{{ group.label }}</div>
                    <div class="action-list" [class.muted]="!hasPermission(group.resource, 'view')">
                      <button
                        type="button"
                        class="action-row"
                        *ngFor="let action of group.actions"
                        [class.active]="isActionEnabled(group, action.key)"
                        [disabled]="!hasPermission(group.resource, 'view')"
                        (click)="toggleAction(group, action.key)">
                        <div class="action-row-main">
                          <span class="action-row-icon material-icons">{{ action.icon }}</span>
                          <span class="action-row-copy">
                            <strong>{{ action.label }}</strong>
                            <small>{{ action.description }}</small>
                          </span>
                        </div>
                        <span class="action-row-state" [class.allowed]="isActionEnabled(group, action.key)">
                          {{ isActionEnabled(group, action.key) ? 'Allowed' : 'Blocked' }}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div class="page-summary">
                    <div class="page-summary-head">
                      <strong>What this role can do on {{ getManagedPageMeta(focusedPage).label }}</strong>
                      <span>{{ getEnabledActionCount(focusedPage) }} action{{ getEnabledActionCount(focusedPage) === 1 ? '' : 's' }} allowed</span>
                    </div>
                    <div class="page-summary-chips" *ngIf="getEnabledActionLabels(focusedPage).length; else noActions">
                      <span class="summary-chip" *ngFor="let label of getEnabledActionLabels(focusedPage)">{{ label }}</span>
                    </div>
                    <ng-template #noActions>
                      <p class="page-summary-empty">No actions are allowed on this page yet.</p>
                    </ng-template>
                  </div>

                  <div class="page-note page-note-neutral" *ngIf="focusedPage === 'clients'">
                    <span class="material-icons">groups</span>
                    <span>Use this for people who manage customer records but should not touch products or orders.</span>
                  </div>

                  <div class="page-note page-note-neutral" *ngIf="focusedPage === 'products'">
                    <span class="material-icons">inventory</span>
                    <span>Catalog actions are for standalone products. Batch actions are for products after they have been added to a batch.</span>
                  </div>

                  <div class="page-note" *ngIf="focusedPage === 'orders'">
                    <span class="material-icons">edit_note</span>
                    <span><strong>Edit Order</strong> covers changing items inside an existing order.</span>
                  </div>
                </section>
              </div>

              <div class="unsaved-banner" *ngIf="matrixDirty">
                <span class="material-icons">warning</span>
                <span>You have unsaved changes for {{ selectedRole.name }}.</span>
                <button class="btn btn-sm btn-primary" (click)="savePermissions()" [disabled]="savingPermissions">Save Now</button>
              </div>
            </ng-container>
          </section>

          <ng-template #emptyState>
            <section class="roles-stage">
              <div class="card empty-state">
                <span class="material-icons">touch_app</span>
                <h3>Select a role to begin</h3>
                <p>Once you choose a role on the left, page permissions will appear here.</p>
              </div>
            </section>
          </ng-template>
        </div>
      </ng-container>

      <div class="rl-modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="rl-modal" (click)="$event.stopPropagation()">
          <div class="rl-modal-header">
            <div class="rl-modal-title">
              <div class="rl-modal-title-icon">
                <span class="material-icons">{{ editingRole ? 'manage_accounts' : 'admin_panel_settings' }}</span>
              </div>
              <h3>{{ editingRole ? 'Edit Role' : 'Create Role' }}</h3>
            </div>
            <button class="rl-close-btn" (click)="closeModal()">&times;</button>
          </div>
          <div class="rl-modal-body">
            <div class="rl-form-group">
              <label>Role Name *</label>
              <input
                type="text"
                [(ngModel)]="formData.name"
                placeholder="e.g. Supervisor"
                [disabled]="!!editingRole?.isSystem" />
              <small class="form-hint" *ngIf="editingRole?.isSystem">System role names cannot be changed.</small>
            </div>
            <div class="rl-form-group">
              <label>Description</label>
              <textarea
                [(ngModel)]="formData.description"
                rows="3"
                placeholder="What is this role responsible for?"></textarea>
            </div>
          </div>
          <div class="rl-modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn btn-primary" (click)="saveRole()" [disabled]="savingRole">
              <span class="material-icons spinner" *ngIf="savingRole">sync</span>
              {{ savingRole ? 'Saving...' : (editingRole ? 'Update' : 'Create') + ' Role' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .roles-page {
      --rbac-ink: #10201b;
      --rbac-muted: #66756f;
      --rbac-line: #dce6df;
      --rbac-panel: rgba(255, 255, 250, 0.94);
      --rbac-green: #19624a;
      --rbac-gold: #d89124;
      --rbac-red: #b9472e;
      max-width: 1440px;
      display: grid;
      gap: 20px;
    }

    .roles-hero {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 24px 26px;
      border-radius: 24px;
      border: 1px solid rgba(var(--primary-rgb, 37, 99, 235), 0.14);
      background:
        radial-gradient(circle at top right, rgba(var(--primary-rgb, 37, 99, 235), 0.16), transparent 32%),
        linear-gradient(135deg, #ffffff 0%, #f8fbff 48%, #f6f9fc 100%);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.07);
      align-items: center;
    }

    .roles-hero-copy h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 38px);
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .hero-kicker {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(var(--primary-rgb, 37, 99, 235), 0.08);
      color: var(--primary-color, #2563eb);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 12px;
    }

    .page-subtitle {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.6;
      max-width: 640px;
    }

    .roles-hero-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    .hero-hint {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.28);
      color: #475569;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
    }

    .hero-hint .material-icons {
      font-size: 16px;
      color: var(--primary-color, #2563eb);
    }

    .roles-shell {
      display: grid;
      grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
      align-items: start;
      gap: 16px;
    }

    .roles-sidebar,
    .builder-panel,
    .setup-overview,
    .skeleton-panel-card {
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
    }

    .roles-sidebar {
      padding: 20px;
      position: sticky;
      top: 16px;
    }

    .roles-stage {
      display: grid;
      gap: 16px;
    }

    .panel-heading {
      margin-bottom: 16px;
    }

    .panel-heading h2,
    .panel-heading h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }

    .panel-heading p {
      margin: 6px 0 0;
      color: #64748b;
      font-size: 13px;
      line-height: 1.55;
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      margin-bottom: 10px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .role-list {
      display: grid;
      gap: 12px;
    }

    .role-list-loading {
      gap: 10px;
    }

    .role-card {
      cursor: pointer;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 16px;
      position: relative;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      display: grid;
      gap: 14px;
    }

    .role-card:hover {
      border-color: var(--primary-color, #2563eb);
      transform: translateY(-1px);
      box-shadow: 0 14px 24px rgba(15, 23, 42, 0.08);
    }

    .role-card.active {
      border-color: var(--primary-color, #2563eb);
      background:
        radial-gradient(circle at top right, rgba(var(--primary-rgb, 37, 99, 235), 0.16), transparent 36%),
        linear-gradient(180deg, #f8fbff, #eef6ff);
      box-shadow: 0 18px 30px rgba(var(--primary-rgb, 37, 99, 235), 0.12);
    }

    .role-card-main {
      min-width: 0;
    }

    .role-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .role-title h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }

    .role-badges {
      display: flex;
      gap: 6px;
      margin-top: 2px;
    }

    .badge-system,
    .badge-custom {
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-system {
      background: #ede9fe;
      color: #6d28d9;
    }

    .badge-custom {
      background: #dbeafe;
      color: #1e40af;
    }

    .role-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .role-icon.sm {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .role-icon.sm .material-icons {
      font-size: 18px;
    }

    .role-desc {
      margin: 8px 0 12px;
      font-size: 13px;
      line-height: 1.45;
      color: #64748b;
      min-height: 0;
    }

    .role-footer {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .role-stats {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #64748b;
    }

    .role-stats .material-icons {
      font-size: 14px;
    }

    .role-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .setup-overview {
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .setup-overview-main,
    .matrix-title {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .setup-overview-main {
      justify-content: space-between;
      flex: 1;
      min-width: 0;
      flex-wrap: wrap;
    }

    .matrix-title h2 {
      margin: 0 0 3px;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.1;
    }

    .matrix-title small {
      color: #64748b;
      font-size: 12px;
    }

    .overview-kicker {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
      margin-bottom: 6px;
    }

    .overview-status {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
    }

    .status-pill .material-icons {
      font-size: 16px;
    }

    .status-pill.dirty {
      background: #fff7ed;
      border-color: #fdba74;
      color: #c2410c;
    }

    .admin-notice,
    .scope-notice,
    .unsaved-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 18px;
    }

    .admin-notice {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }

    .admin-notice .material-icons {
      font-size: 24px;
    }

    .admin-notice strong {
      display: block;
      margin-bottom: 4px;
      font-size: 15px;
    }

    .admin-notice p {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
    }

    .scope-notice {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 13px;
      line-height: 1.5;
    }

    .scope-notice .material-icons,
    .unsaved-banner .material-icons {
      font-size: 18px;
      flex-shrink: 0;
    }

    .builder-grid {
      display: grid;
      grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
      gap: 12px;
    }

    .builder-panel {
      padding: 18px;
    }

    .page-choice-list {
      display: grid;
      gap: 10px;
    }

    .page-choice {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      background: #fff;
      padding: 16px;
      text-align: left;
      cursor: pointer;
      display: grid;
      gap: 10px;
      transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }

    .page-choice:hover {
      transform: translateY(-1px);
      border-color: #cbd5e1;
      box-shadow: 0 12px 20px rgba(15, 23, 42, 0.05);
    }

    .page-choice-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .page-choice .material-icons {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      flex-shrink: 0;
    }

    .page-choice.clients .material-icons {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
    }

    .page-choice.products .material-icons {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
    }

    .page-choice.orders .material-icons {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }

    .page-choice.active {
      background: #f8fbff;
      border-color: #93c5fd;
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08), 0 16px 28px rgba(59, 130, 246, 0.1);
    }

    .page-choice strong {
      display: block;
      font-size: 15px;
      color: #0f172a;
    }

    .page-choice small {
      display: block;
      font-size: 12px;
      line-height: 1.55;
      color: #64748b;
    }

    .page-choice-state,
    .page-choice-meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
    }

    .page-choice-state.off {
      color: #9a3412;
    }

    .action-builder {
      display: grid;
      gap: 16px;
    }

    .page-access-card {
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background:
        radial-gradient(circle at top right, rgba(148, 163, 184, 0.08), transparent 28%),
        linear-gradient(180deg, #ffffff, #f8fafc);
      padding: 18px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .page-card-title {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .page-card-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    .page-card-title p {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
      max-width: 520px;
    }

    .page-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }

    .page-card-icon.clients { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
    .page-card-icon.products { background: linear-gradient(135deg, #7c3aed, #6d28d9); }
    .page-card-icon.orders { background: linear-gradient(135deg, #f59e0b, #d97706); }

    .page-access-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid #e2e8f0;
    }

    .page-toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .action-group {
      display: grid;
      gap: 10px;
    }

    .action-group + .action-group {
      margin-top: -4px;
    }

    .action-group-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
    }

    .action-list {
      display: grid;
      gap: 10px;
    }

    .action-list.muted {
      opacity: 0.5;
      pointer-events: none;
    }

    .action-row {
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      background: #fff;
      padding: 14px 16px;
      text-align: left;
      width: 100%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
    }

    .action-row:hover:not(:disabled) {
      border-color: #93c5fd;
      background: #f8fbff;
      transform: translateY(-1px);
    }

    .action-row.active {
      border-color: #2563eb;
      background: #eff6ff;
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.06);
    }

    .action-row:disabled {
      cursor: default;
    }

    .action-row-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .action-row-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      font-size: 18px;
      color: #64748b;
      flex-shrink: 0;
    }

    .action-row.active .action-row-icon {
      background: rgba(var(--primary-rgb, 37, 99, 235), 0.12);
      color: #2563eb;
    }

    .action-row-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .action-row-copy strong {
      display: block;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .action-row-copy small {
      display: block;
      font-size: 12px;
      line-height: 1.45;
      color: #64748b;
      margin-top: 3px;
    }

    .action-row-state {
      padding: 7px 10px;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      flex-shrink: 0;
    }

    .action-row-state.allowed {
      background: #dcfce7;
      border-color: #86efac;
      color: #166534;
    }

    .page-summary {
      border: 1px dashed #cbd5e1;
      border-radius: 18px;
      padding: 16px;
      background: #fcfdff;
    }

    .page-summary-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .page-summary-head strong {
      color: #0f172a;
      font-size: 14px;
    }

    .page-summary-head span {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }

    .page-summary-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .summary-chip {
      display: inline-flex;
      align-items: center;
      padding: 7px 10px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
    }

    .page-summary-empty {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }

    .page-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 12px;
      line-height: 1.45;
    }

    .page-note-neutral {
      background: #f8fafc;
      border-color: #e2e8f0;
      color: #334155;
    }

    .page-note .material-icons {
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .unsaved-banner {
      align-items: center;
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 0;
    }

    .unsaved-banner .btn {
      margin-left: auto;
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      border-radius: 24px;
      border: 1px dashed #cbd5e1;
    }

    .empty-state .material-icons {
      font-size: 44px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .empty-state h3 {
      margin: 0 0 8px;
      font-size: 18px;
      color: #0f172a;
    }

    .empty-state p {
      margin: 0;
      color: #64748b;
      font-size: 13px;
    }

    .rl-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.48);
      backdrop-filter: blur(3px);
    }

    .rl-modal {
      width: min(520px, 100%);
      background: #fff;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22);
      overflow: hidden;
    }

    .rl-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #f8fbff, #ffffff);
    }

    .rl-modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .rl-modal-title-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primary-color, #6366f1), var(--primary-dark, #4f46e5));
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 8px 20px rgba(var(--primary-rgb, 99,102,241), 0.24);
    }

    .rl-modal-title-icon .material-icons {
      font-size: 18px;
    }

    .rl-modal-header h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }

    .rl-close-btn {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 10px;
      background: #f1f5f9;
      color: #475569;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .rl-close-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    .rl-modal-body {
      padding: 20px;
    }

    .rl-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafcff;
    }

    .rl-form-group + .rl-form-group {
      margin-top: 16px;
    }

    .rl-form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }

    .rl-form-group input,
    .rl-form-group textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 11px 13px;
      font-size: 13px;
      color: #0f172a;
      background: #fff;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .rl-form-group input:focus,
    .rl-form-group textarea:focus {
      outline: none;
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }

    .rl-form-group textarea {
      resize: vertical;
      min-height: 96px;
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 42px;
      height: 24px;
      cursor: pointer;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: #cbd5e1;
      border-radius: 999px;
      transition: background 0.25s ease;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      bottom: 3px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.25s ease;
    }

    .toggle input:checked + .toggle-slider {
      background: #2563eb;
    }

    .toggle input:checked + .toggle-slider::before {
      transform: translateX(18px);
    }

    .toggle input:disabled + .toggle-slider {
      opacity: 0.35;
    }

    .skeleton-card,
    .workbench-skeleton {
      padding: 20px;
    }

    .role-skeleton {
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      background: #fff;
    }

    .skeleton-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .skeleton-icon,
    .skeleton-line,
    .skeleton-panel {
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%);
      background-size: 400% 100%;
      animation: shimmer 1.25s ease-in-out infinite;
      border-radius: 10px;
    }

    .skeleton-icon {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }

    .skeleton-copy {
      flex: 1;
    }

    .skeleton-line {
      height: 12px;
      margin-bottom: 8px;
    }

    .skeleton-line.lg { width: 55%; }
    .skeleton-line.md { width: 35%; }
    .skeleton-line.full { width: 100%; margin-bottom: 0; }
    .skeleton-line.title { width: 220px; height: 18px; margin-bottom: 16px; }

    .skeleton-panels {
      display: grid;
      gap: 12px;
    }

    .skeleton-panel {
      height: 150px;
      border-radius: 16px;
    }

    .form-hint {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: #64748b;
    }

    @keyframes shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      animation: spin 1s linear infinite;
    }

    /* Compact RBAC workbench refresh */
    .roles-page {
      gap: 16px;
      color: var(--rbac-ink);
    }

    .roles-hero {
      padding: 20px 22px;
      border-radius: 24px;
      border-color: rgba(102, 117, 111, 0.2);
      background:
        radial-gradient(circle at 10% 0%, rgba(216, 145, 36, 0.18), transparent 28%),
        radial-gradient(circle at 88% 18%, rgba(25, 98, 74, 0.14), transparent 30%),
        linear-gradient(135deg, #fffefa 0%, #f4efe4 100%);
      box-shadow: 0 18px 40px rgba(35, 45, 39, 0.08);
    }

    .roles-hero-copy h1,
    .panel-heading h2,
    .panel-heading h3,
    .matrix-title h2,
    .page-card-title h3,
    .action-row-copy strong,
    .page-summary-head strong {
      color: var(--rbac-ink);
    }

    .hero-kicker,
    .step-badge {
      background: rgba(25, 98, 74, 0.1);
      color: var(--rbac-green);
    }

    .page-subtitle,
    .panel-heading p,
    .matrix-title small,
    .overview-kicker,
    .page-choice small,
    .page-choice-meta,
    .action-row-copy small,
    .page-summary-head span,
    .page-summary-empty {
      color: var(--rbac-muted);
    }

    .hero-hint,
    .status-pill,
    .page-access-toggle {
      border-color: rgba(102, 117, 111, 0.22);
      color: #38534a;
      background: rgba(255, 255, 250, 0.88);
    }

    .hero-hint .material-icons {
      color: var(--rbac-green);
    }

    .roles-shell {
      grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
      gap: 14px;
    }

    .roles-sidebar,
    .builder-panel,
    .setup-overview,
    .skeleton-panel-card {
      border-color: var(--rbac-line);
      background: var(--rbac-panel);
      box-shadow: 0 12px 32px rgba(35, 45, 39, 0.06);
    }

    .roles-sidebar {
      padding: 14px;
      max-height: calc(100vh - 32px);
      overflow: auto;
      scrollbar-width: thin;
    }

    .role-list {
      gap: 8px;
    }

    .role-card {
      padding: 12px;
      border-radius: 16px;
      border-color: var(--rbac-line);
      gap: 9px;
      background: linear-gradient(180deg, rgba(255, 255, 250, 0.98), rgba(247, 244, 235, 0.96));
    }

    .role-card.active {
      border-color: var(--rbac-green);
      background:
        radial-gradient(circle at top right, rgba(25, 98, 74, 0.16), transparent 36%),
        linear-gradient(180deg, #f8fff9, #edf6ef);
      box-shadow: 0 18px 30px rgba(25, 98, 74, 0.12);
    }

    .role-card:hover {
      border-color: rgba(25, 98, 74, 0.4);
      box-shadow: 0 14px 24px rgba(35, 45, 39, 0.08);
    }

    .role-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
    }

    .role-title h3 {
      font-size: 14px;
      font-weight: 800;
    }

    .role-desc {
      margin: 6px 0 8px;
      font-size: 12px;
    }

    .role-footer {
      gap: 10px;
      margin-bottom: 8px;
    }

    .setup-overview {
      padding: 15px 16px;
      border-radius: 20px;
    }

    .matrix-title h2 {
      font-size: 22px;
      font-weight: 800;
    }

    .builder-grid {
      grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
      align-items: start;
      gap: 12px;
    }

    .builder-panel {
      padding: 14px;
      border-radius: 20px;
    }

    .page-picker-panel {
      align-self: start;
      position: sticky;
      top: 16px;
      max-height: calc(100vh - 32px);
      overflow: auto;
      scrollbar-width: thin;
    }

    .action-builder {
      align-self: start;
      gap: 12px;
    }

    .compact-heading {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }

    .compact-heading .step-badge {
      margin: 0;
      flex-shrink: 0;
    }

    .panel-heading h3 {
      font-size: 15px;
      font-weight: 850;
    }

    .panel-heading p {
      margin-top: 3px;
      font-size: 11px;
    }

    .page-choice-list {
      gap: 7px;
    }

    .page-choice {
      min-height: 0;
      padding: 10px;
      border-radius: 14px;
      gap: 7px;
      border-color: var(--rbac-line);
      background: #fffefa;
      box-shadow: none;
    }

    .page-choice:hover {
      border-color: rgba(25, 98, 74, 0.35);
      box-shadow: 0 10px 18px rgba(35, 45, 39, 0.06);
    }

    .page-choice.active {
      background: #f1f8ef;
      border-color: var(--rbac-green);
      box-shadow: inset 0 0 0 1px rgba(25, 98, 74, 0.08), 0 12px 22px rgba(25, 98, 74, 0.11);
    }

    .page-choice .material-icons {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      font-size: 16px;
      background: linear-gradient(135deg, #53665d, #263a32);
    }

    .page-choice.clients .material-icons,
    .page-card-icon.clients { background: linear-gradient(135deg, #2362a8, #153d68); }
    .page-choice.products .material-icons,
    .page-card-icon.products { background: linear-gradient(135deg, #8a5a1f, #d89124); }
    .page-choice.orders .material-icons,
    .page-card-icon.orders { background: linear-gradient(135deg, #b9472e, #81301f); }
    .page-choice.buying-list .material-icons,
    .page-card-icon.buying-list { background: linear-gradient(135deg, #74512b, #a97439); }
    .page-choice.arrivals .material-icons,
    .page-card-icon.arrivals { background: linear-gradient(135deg, #19624a, #0d3e30); }
    .page-choice.shipping .material-icons,
    .page-card-icon.shipping { background: linear-gradient(135deg, #255f6f, #123842); }
    .page-choice.shipping-ledger .material-icons,
    .page-card-icon.shipping-ledger { background: linear-gradient(135deg, #374151, #111827); }
    .page-choice.stock-sales .material-icons,
    .page-card-icon.stock-sales { background: linear-gradient(135deg, #a0441d, #6f2e13); }
    .page-choice.batches .material-icons,
    .page-card-icon.batches { background: linear-gradient(135deg, #55523b, #2f2c1e); }
    .page-choice.roles .material-icons,
    .page-card-icon.roles { background: linear-gradient(135deg, #4b5d75, #263447); }

    .page-choice-copy {
      min-width: 0;
    }

    .page-choice strong {
      font-size: 13px;
      line-height: 1.15;
    }

    .page-choice small {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: 10.5px;
      line-height: 1.35;
    }

    .page-choice-state {
      padding: 4px 7px;
      border-radius: 999px;
      background: #edf6ef;
      color: var(--rbac-green);
      font-size: 9px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .page-choice-state.off {
      background: #fff1e8;
      color: var(--rbac-red);
    }

    .page-choice-meta {
      font-size: 10px;
      font-weight: 800;
    }

    .action-builder-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .action-count-pill {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      padding: 8px 10px;
      border-radius: 14px;
      background: #10201b;
      color: #fffefa;
      flex-shrink: 0;
      box-shadow: 0 10px 20px rgba(16, 32, 27, 0.16);
    }

    .action-count-pill strong {
      font-size: 18px;
      line-height: 1;
    }

    .action-count-pill span {
      font-size: 11px;
      opacity: 0.76;
    }

    .page-access-card {
      padding: 12px;
      border-radius: 16px;
      align-items: center;
      border-color: var(--rbac-line);
      background:
        linear-gradient(135deg, rgba(255, 254, 250, 0.98), rgba(243, 240, 231, 0.95));
    }

    .page-card-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
    }

    .page-card-title h3 {
      font-size: 15px;
      font-weight: 850;
    }

    .page-card-title p {
      max-width: 520px;
      font-size: 11px;
    }

    .page-toolbar {
      margin: -2px 0 0;
      gap: 6px;
    }

    .page-toolbar .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 11px;
    }

    .page-toolbar .material-icons {
      font-size: 14px;
    }

    .action-group {
      gap: 7px;
    }

    .action-group-label {
      font-size: 9.5px;
      color: #7a8078;
    }

    .action-list {
      gap: 7px;
    }

    .action-row {
      padding: 10px 12px;
      border-radius: 14px;
      border-color: var(--rbac-line);
      background: #fffefa;
    }

    .action-row:hover:not(:disabled) {
      border-color: rgba(25, 98, 74, 0.35);
      background: #f8fbf4;
    }

    .action-row.active {
      border-color: var(--rbac-green);
      background: #edf6ef;
      box-shadow: inset 0 0 0 1px rgba(25, 98, 74, 0.08);
    }

    .action-row-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      font-size: 16px;
      background: #f0eee5;
      color: #6a7168;
    }

    .action-row.active .action-row-icon {
      background: rgba(25, 98, 74, 0.12);
      color: var(--rbac-green);
    }

    .action-row-copy strong {
      font-size: 12.5px;
      line-height: 1.2;
    }

    .action-row-copy small {
      margin-top: 2px;
      font-size: 10.5px;
    }

    .action-row-state {
      padding: 5px 8px;
      font-size: 9px;
      background: #f3f0e7;
      border-color: #e2d9c8;
    }

    .action-row-state.allowed {
      background: #dff2e5;
      border-color: #9bd7b0;
      color: var(--rbac-green);
    }

    .page-summary {
      padding: 12px;
      border-radius: 14px;
      background: #fffefa;
      border-color: #d9d2c3;
    }

    .page-summary-head {
      margin-bottom: 8px;
    }

    .summary-chip {
      padding: 6px 8px;
      background: #edf6ef;
      color: var(--rbac-green);
      font-size: 11px;
    }

    .page-note {
      margin-top: 0;
      border-radius: 12px;
    }

    @media (max-width: 900px) {
      .roles-hero,
      .setup-overview,
      .page-access-card,
      .action-row {
        flex-direction: column;
        align-items: stretch;
      }

      .roles-shell,
      .builder-grid {
        grid-template-columns: 1fr;
      }

      .roles-sidebar {
        position: static;
      }

      .roles-hero-actions {
        align-items: stretch;
      }

      .page-access-toggle,
      .page-summary-head {
        justify-content: space-between;
      }
    }
  `]
})
export class RolesComponent implements OnInit {
  loading = true;
  roles: Role[] = [];
  selectedRole: Role | null = null;
  resources = ALL_RESOURCES;
  userCounts: Record<number, number> = {};

  showModal = false;
  editingRole: Role | null = null;
  savingRole = false;
  deletingRoleId: number | null = null;
  formData = { name: '', description: '' };
  pendingSelectRoleId: number | null = null;

  permissionMatrix: Record<string, Record<string, boolean>> = {};
  matrixDirty = false;
  savingPermissions = false;
  focusedPage: ManagedPermissionPage = 'clients';

  dashboardConfig: DashboardComponentConfig = { ...DEFAULT_DASHBOARD_CONFIG };
  productConfig: ProductPermissionConfig = { ...DEFAULT_PRODUCT_CONFIG };
  ordersConfig: OrdersPermissionConfig = { ...DEFAULT_ORDERS_CONFIG };
  buyingListConfig: BuyingListPermissionConfig = { ...DEFAULT_BUYING_LIST_CONFIG };
  arrivalsConfig: ArrivalsPermissionConfig = { ...DEFAULT_ARRIVALS_CONFIG };
  shippingConfig: ShippingPermissionConfig = { ...DEFAULT_SHIPPING_CONFIG };
  shippingLedgerConfig: ShippingLedgerPermissionConfig = { ...DEFAULT_SHIPPING_LEDGER_CONFIG };
  stockSalesConfig: StockSalesPermissionConfig = { ...DEFAULT_STOCK_SALES_CONFIG };
  manageBatchesConfig: ManageBatchesPermissionConfig = { ...DEFAULT_MANAGE_BATCHES_CONFIG };
  rolesConfig: RolesPermissionConfig = { ...DEFAULT_ROLES_CONFIG };
  usersConfig: UsersPermissionConfig = { ...DEFAULT_USERS_CONFIG };

  readonly clientActions: CrudActionCard[] = [
    { key: 'create', label: 'Add New Client', description: 'Create new client records.', icon: 'person_add' },
    { key: 'edit', label: 'Edit Client', description: 'Update client details and contact info.', icon: 'edit' },
    { key: 'delete', label: 'Delete Client', description: 'Delete single clients or bulk selections.', icon: 'delete' }
  ];

  readonly productCatalogActions: CrudActionCard[] = [
    { key: 'create', label: 'Add New Product', description: 'Create new products in the catalog.', icon: 'add_box' },
    { key: 'edit', label: 'Edit Product', description: 'Edit existing catalog products.', icon: 'edit_square' },
    { key: 'delete', label: 'Delete Product', description: 'Delete catalog products.', icon: 'delete_forever' }
  ];

  readonly productBatchActions: ProductActionCard[] = [...PRODUCT_OPERATIONS];
  readonly ordersActions: OrdersActionCard[] = [...ORDERS_OPERATIONS];
  readonly buyingListActions: ConfigActionCard[] = [...BUYING_LIST_OPERATIONS];
  readonly arrivalsActions: ConfigActionCard[] = [...ARRIVALS_OPERATIONS];
  readonly shippingActions: ConfigActionCard[] = [...SHIPPING_OPERATIONS];
  readonly shippingLedgerActions: ConfigActionCard[] = [...SHIPPING_LEDGER_OPERATIONS];
  readonly stockSalesActions: ConfigActionCard[] = [...STOCK_SALES_OPERATIONS];
  readonly manageBatchesActions: ConfigActionCard[] = [...MANAGE_BATCHES_OPERATIONS];
  readonly rolesActions: ConfigActionCard[] = [...ROLES_OPERATIONS];

  readonly managedPages: ManagedPageTab[] = [
    { key: 'clients', resource: 'clients', label: 'Clients', description: 'Manage client actions', icon: 'people', accentClass: 'clients' },
    { key: 'products', resource: 'products', label: 'Products', description: 'Manage product and batch actions', icon: 'inventory_2', accentClass: 'products' },
    { key: 'orders', resource: 'orders', label: 'Orders', description: 'Manage order and batch controls', icon: 'shopping_cart', accentClass: 'orders' },
    { key: 'buying_list', resource: 'buying_list', label: 'Buying List', description: 'Manage purchasing workflow actions', icon: 'shopping_bag', accentClass: 'buying-list' },
    { key: 'arrivals', resource: 'arrivals', label: 'Arrivals', description: 'Manage receiving and shipping handoff actions', icon: 'inventory', accentClass: 'arrivals' },
    { key: 'shipping', resource: 'shipping', label: 'Shipping', description: 'Manage shipping item values', icon: 'paid', accentClass: 'shipping' },
    { key: 'shipping_ledger', resource: 'shipping', label: 'Shipping Ledger', description: 'Manage shipping payments and delivery handoff', icon: 'local_shipping', accentClass: 'shipping-ledger' },
    { key: 'stock_sales', resource: 'stock_sales', label: 'Stock Sales', description: 'Manage stock sale actions', icon: 'storefront', accentClass: 'stock-sales' },
    { key: 'batches', resource: 'batches', label: 'Manage Batches', description: 'Manage destructive batch admin actions', icon: 'inventory_2', accentClass: 'batches' },
    { key: 'roles', resource: 'roles', label: 'Roles', description: 'Manage role setup actions', icon: 'admin_panel_settings', accentClass: 'roles' }
  ];

  constructor(public authService: AuthService) {}

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.authService.getRoles().subscribe(roles => {
      this.roles = roles;
      if (this.pendingSelectRoleId) {
        const createdRole = roles.find(role => role.id === this.pendingSelectRoleId);
        this.pendingSelectRoleId = null;
        if (createdRole) {
          this.selectRole(createdRole);
        }
      } else if (this.selectedRole) {
        const updated = roles.find(role => role.id === this.selectedRole?.id);
        if (updated) {
          this.selectRole(updated);
        }
      }
      this.loading = false;
    });

    this.authService.getUserCountByRole().subscribe(counts => {
      this.userCounts = counts;
    });
  }

  selectRole(role: Role) {
    this.selectedRole = role;
    this.matrixDirty = false;
    this.focusedPage = 'clients';
    this.buildMatrix(role);
  }

  setFocusedPage(page: ManagedPermissionPage) {
    this.focusedPage = page;
  }

  getManagedPageMeta(page: ManagedPermissionPage): ManagedPageTab {
    return this.managedPages.find(item => item.key === page) || this.managedPages[0];
  }

  getFocusedResource(): AppResource {
    return this.getManagedPageMeta(this.focusedPage).resource;
  }

  getEnabledActionCount(page: ManagedPermissionPage): number {
    return this.getActionGroups(page).reduce(
      (count, group) => count + group.actions.filter(action => this.isActionEnabled(group, action.key)).length,
      0
    );
  }

  getTotalActionCount(page: ManagedPermissionPage): number {
    return this.getActionGroups(page).reduce((count, group) => count + group.actions.length, 0);
  }

  getEnabledActionLabels(page: ManagedPermissionPage): string[] {
    return this.getActionGroups(page).flatMap(group =>
      group.actions
        .filter(action => this.isActionEnabled(group, action.key))
        .map(action => action.label)
    );
  }

  getManagedPageDescription(page: ManagedPermissionPage): string {
    const meta = this.getManagedPageMeta(page);
    return meta.description;
  }

  getActionGroups(page: ManagedPermissionPage): PermissionActionGroup[] {
    switch (page) {
      case 'clients':
        return [{ label: 'Client management', type: 'crud', resource: 'clients', actions: this.clientActions }];
      case 'products':
        return [
          { label: 'Product catalog', type: 'crud', resource: 'products', actions: this.productCatalogActions },
          { label: 'Batch work inside products', type: 'config', resource: 'products', configKey: 'productConfig', actions: this.productBatchActions }
        ];
      case 'orders':
        return [{ label: 'Order handling', type: 'config', resource: 'orders', configKey: 'ordersConfig', actions: this.ordersActions }];
      case 'buying_list':
        return [{ label: 'Buying list workflow', type: 'config', resource: 'buying_list', configKey: 'buyingListConfig', actions: this.buyingListActions }];
      case 'arrivals':
        return [{ label: 'Arrivals workflow', type: 'config', resource: 'arrivals', configKey: 'arrivalsConfig', actions: this.arrivalsActions }];
      case 'shipping':
        return [{ label: 'Shipping setup', type: 'config', resource: 'shipping', configKey: 'shippingConfig', actions: this.shippingActions }];
      case 'shipping_ledger':
        return [{ label: 'Shipping ledger workflow', type: 'config', resource: 'shipping', configKey: 'shippingLedgerConfig', actions: this.shippingLedgerActions }];
      case 'stock_sales':
        return [{ label: 'Stock sales workflow', type: 'config', resource: 'stock_sales', configKey: 'stockSalesConfig', actions: this.stockSalesActions }];
      case 'batches':
        return [{ label: 'Batch management', type: 'config', resource: 'batches', configKey: 'manageBatchesConfig', actions: this.manageBatchesActions }];
      case 'roles':
        return [{ label: 'Role management', type: 'config', resource: 'roles', configKey: 'rolesConfig', actions: this.rolesActions }];
      default:
        return [];
    }
  }

  buildMatrix(role: Role) {
    this.permissionMatrix = {};
    for (const resource of this.resources) {
      this.permissionMatrix[resource.key] = {
        view: false,
        create: false,
        edit: false,
        delete: false
      };
    }

    for (const permission of role.permissions || []) {
      if (!this.permissionMatrix[permission.resource]) continue;
      this.permissionMatrix[permission.resource]['view'] = !!permission.canView;
      this.permissionMatrix[permission.resource]['create'] = !!permission.canCreate;
      this.permissionMatrix[permission.resource]['edit'] = !!permission.canEdit;
      this.permissionMatrix[permission.resource]['delete'] = !!permission.canDelete;
    }

    const dashboardPermission = role.permissions?.find(permission => permission.resource === 'dashboard');
    this.dashboardConfig = dashboardPermission?.dashboardConfig
      ? { ...DEFAULT_DASHBOARD_CONFIG, ...dashboardPermission.dashboardConfig }
      : { ...DEFAULT_DASHBOARD_CONFIG };

    const productPermission = role.permissions?.find(permission => permission.resource === 'products');
    this.productConfig = productPermission?.productConfig
      ? { ...DEFAULT_PRODUCT_CONFIG, ...productPermission.productConfig }
      : { ...DEFAULT_PRODUCT_CONFIG };

    const ordersPermission = role.permissions?.find(permission => permission.resource === 'orders');
    this.ordersConfig = ordersPermission?.ordersConfig
      ? { ...DEFAULT_ORDERS_CONFIG, ...ordersPermission.ordersConfig }
      : { ...DEFAULT_ORDERS_CONFIG };

    const buyingListPermission = role.permissions?.find(permission => permission.resource === 'buying_list');
    this.buyingListConfig = buyingListPermission?.buyingListConfig
      ? { ...DEFAULT_BUYING_LIST_CONFIG, ...buyingListPermission.buyingListConfig }
      : { ...DEFAULT_BUYING_LIST_CONFIG };

    const arrivalsPermission = role.permissions?.find(permission => permission.resource === 'arrivals');
    this.arrivalsConfig = arrivalsPermission?.arrivalsConfig
      ? { ...DEFAULT_ARRIVALS_CONFIG, ...arrivalsPermission.arrivalsConfig }
      : { ...DEFAULT_ARRIVALS_CONFIG };

    const shippingPermission = role.permissions?.find(permission => permission.resource === 'shipping');
    this.shippingConfig = shippingPermission?.shippingConfig
      ? { ...DEFAULT_SHIPPING_CONFIG, ...shippingPermission.shippingConfig }
      : { ...DEFAULT_SHIPPING_CONFIG };

    this.shippingLedgerConfig = shippingPermission?.shippingLedgerConfig
      ? { ...DEFAULT_SHIPPING_LEDGER_CONFIG, ...shippingPermission.shippingLedgerConfig }
      : { ...DEFAULT_SHIPPING_LEDGER_CONFIG };

    const stockSalesPermission = role.permissions?.find(permission => permission.resource === 'stock_sales');
    this.stockSalesConfig = stockSalesPermission?.stockSalesConfig
      ? { ...DEFAULT_STOCK_SALES_CONFIG, ...stockSalesPermission.stockSalesConfig }
      : { ...DEFAULT_STOCK_SALES_CONFIG };

    const manageBatchesPermission = role.permissions?.find(permission => permission.resource === 'batches');
    this.manageBatchesConfig = manageBatchesPermission?.manageBatchesConfig
      ? { ...DEFAULT_MANAGE_BATCHES_CONFIG, ...manageBatchesPermission.manageBatchesConfig }
      : { ...DEFAULT_MANAGE_BATCHES_CONFIG };

    const rolesPermission = role.permissions?.find(permission => permission.resource === 'roles');
    this.rolesConfig = rolesPermission?.rolesConfig
      ? { ...DEFAULT_ROLES_CONFIG, ...rolesPermission.rolesConfig }
      : { ...DEFAULT_ROLES_CONFIG };

    const usersPermission = role.permissions?.find(permission => permission.resource === 'users');
    this.usersConfig = usersPermission?.usersConfig
      ? { ...DEFAULT_USERS_CONFIG, ...usersPermission.usersConfig }
      : { ...DEFAULT_USERS_CONFIG };
  }

  hasPermission(resource: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
    return this.permissionMatrix[resource]?.[action] ?? false;
  }

  isActionEnabled(group: PermissionActionGroup, actionKey: string): boolean {
    if (group.type === 'crud') {
      return this.hasPermission(group.resource, actionKey as CrudAction);
    }

    const config = group.configKey ? this.getConfig(group.configKey) : null;
    return !!config?.[actionKey];
  }

  toggleAction(group: PermissionActionGroup, actionKey: string) {
    if (group.type === 'crud') {
      this.toggleCrudPermission(group.resource, actionKey as CrudAction);
      return;
    }

    this.toggleConfigPermission(group.resource, group.configKey!, actionKey);
  }

  enableAllPageActions(page: ManagedPermissionPage) {
    for (const group of this.getActionGroups(page)) {
      this.ensureMatrixRow(group.resource);
      this.permissionMatrix[group.resource]['view'] = true;

      for (const action of group.actions) {
        if (group.type === 'crud') {
          this.permissionMatrix[group.resource][action.key] = true;
        } else if (group.configKey) {
          this.getConfig(group.configKey)[action.key] = true;
        }
      }
    }

    this.matrixDirty = true;
  }

  clearPageActions(page: ManagedPermissionPage) {
    for (const group of this.getActionGroups(page)) {
      this.clearGroupActions(group);
    }

    this.matrixDirty = true;
  }

  togglePageAccess(resource: AppResource) {
    this.ensureMatrixRow(resource);
    const enabled = !this.permissionMatrix[resource]['view'];
    this.permissionMatrix[resource]['view'] = enabled;

    if (!enabled) {
      this.permissionMatrix[resource]['create'] = false;
      this.permissionMatrix[resource]['edit'] = false;
      this.permissionMatrix[resource]['delete'] = false;
      this.clearResourceConfigActions(resource);
    }

    this.matrixDirty = true;
  }

  toggleCrudPermission(resource: AppResource, action: CrudAction) {
    this.ensureMatrixRow(resource);
    const current = this.permissionMatrix[resource][action];
    this.permissionMatrix[resource][action] = !current;
    if (!current) {
      this.permissionMatrix[resource]['view'] = true;
    }
    this.matrixDirty = true;
  }

  toggleConfigPermission(resource: AppResource, configKey: ConfigKey, actionKey: string) {
    this.ensureMatrixRow(resource);
    const config = this.getConfig(configKey);
    config[actionKey] = !config[actionKey];
    if (config[actionKey]) {
      this.permissionMatrix[resource]['view'] = true;
    }
    this.matrixDirty = true;
  }

  getPermissionCount(role: Role): number {
    let count = 0;

    for (const permission of role.permissions || []) {
      if (permission.canView) count += 1;
      if (permission.canCreate) count += 1;
      if (permission.canEdit) count += 1;
      if (permission.canDelete) count += 1;

      count += this.countEnabledFlags(permission.dashboardConfig);
      count += this.countEnabledFlags(permission.productConfig);
      count += this.countEnabledFlags(permission.ordersConfig);
      count += this.countEnabledFlags(permission.buyingListConfig);
      count += this.countEnabledFlags(permission.arrivalsConfig);
      count += this.countEnabledFlags(permission.shippingConfig);
      count += this.countEnabledFlags(permission.shippingLedgerConfig);
      count += this.countEnabledFlags(permission.stockSalesConfig);
      count += this.countEnabledFlags(permission.manageBatchesConfig);
      count += this.countEnabledFlags(permission.rolesConfig);
      count += this.countEnabledFlags(permission.usersConfig);
    }

    return count;
  }

  savePermissions() {
    if (!this.selectedRole) return;

    this.savingPermissions = true;
    const permissions: { resource: string; action: string }[] = [];

    for (const resource of Object.keys(this.permissionMatrix)) {
      for (const action of Object.keys(this.permissionMatrix[resource])) {
        if (this.permissionMatrix[resource][action]) {
          permissions.push({ resource, action });
        }
      }
    }

    this.authService.updateRolePermissions(
      this.selectedRole.id!,
      permissions,
      this.dashboardConfig,
      this.productConfig,
      this.ordersConfig,
      this.buyingListConfig,
      this.arrivalsConfig,
      this.shippingConfig,
      this.shippingLedgerConfig,
      this.stockSalesConfig,
      this.manageBatchesConfig,
      this.rolesConfig,
      this.usersConfig
    ).subscribe(() => {
      this.matrixDirty = false;
      this.savingPermissions = false;
      this.authService.refreshCurrentUserPermissions().subscribe();
      this.loadRoles();
    });
  }

  getRoleIcon(name: string): string {
    const icons: Record<string, string> = {
      Admin: 'admin_panel_settings',
      Sales: 'point_of_sale',
      Delivery: 'local_shipping',
      Accountant: 'account_balance',
      Supervisor: 'supervisor_account',
      Manager: 'business_center'
    };
    return icons[name] || 'badge';
  }

  getRoleColor(name: string): string {
    const colors: Record<string, string> = {
      Admin: '#7c3aed',
      Sales: '#2563eb',
      Delivery: '#059669',
      Accountant: '#d97706'
    };
    return colors[name] || '#6366f1';
  }

  openModal(role?: Role) {
    this.editingRole = role || null;
    this.formData = role
      ? { name: role.name, description: role.description || '' }
      : { name: '', description: '' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingRole = null;
    this.savingRole = false;
  }

  editRole(role: Role) {
    this.openModal(role);
  }

  saveRole() {
    if (!this.formData.name.trim()) {
      alert('Please enter a role name');
      return;
    }

    this.savingRole = true;

    if (this.editingRole) {
      this.authService.updateRole({
        ...this.editingRole,
        name: this.editingRole.isSystem ? this.editingRole.name : this.formData.name,
        description: this.formData.description
      }).subscribe(() => {
        this.savingRole = false;
        this.loadRoles();
        this.closeModal();
      });
      return;
    }

    this.authService.createRole(this.formData.name, this.formData.description).subscribe(roleId => {
      this.savingRole = false;
      this.pendingSelectRoleId = roleId || null;
      this.loadRoles();
      this.closeModal();
    });
  }

  duplicateRoleAction(role: Role) {
    const newName = prompt('Enter name for the duplicated role:', `${role.name} (Copy)`);
    if (!newName || !newName.trim()) return;

    this.authService.duplicateRole(role.id!, newName.trim()).subscribe(() => {
      this.loadRoles();
    });
  }

  deleteRole(role: Role) {
    if (role.isSystem) {
      alert('System roles cannot be deleted');
      return;
    }

    const userCount = this.userCounts[role.id!] || 0;
    const message = userCount > 0
      ? `"${role.name}" has ${userCount} user(s) assigned. Deleting this role will leave those users without a role.\n\nAre you sure?`
      : `Are you sure you want to delete the "${role.name}" role?`;

    if (!confirm(message)) return;

    this.deletingRoleId = role.id!;
    this.authService.deleteRole(role.id!).subscribe({
      next: () => {
        this.deletingRoleId = null;
        if (this.selectedRole?.id === role.id) {
          this.selectedRole = null;
        }
        this.loadRoles();
      },
      error: () => {
        this.deletingRoleId = null;
      }
    });
  }

  private ensureMatrixRow(resource: AppResource) {
    if (!this.permissionMatrix[resource]) {
      this.permissionMatrix[resource] = {
        view: false,
        create: false,
        edit: false,
        delete: false
      };
    }
  }

  private getConfig(configKey: ConfigKey): Record<string, boolean> {
    return this[configKey] as unknown as Record<string, boolean>;
  }

  private clearGroupActions(group: PermissionActionGroup) {
    if (group.type === 'crud') {
      this.ensureMatrixRow(group.resource);
      for (const action of group.actions) {
        this.permissionMatrix[group.resource][action.key] = false;
      }
      return;
    }

    if (!group.configKey) return;
    const config = this.getConfig(group.configKey);
    for (const action of group.actions) {
      config[action.key] = false;
    }
  }

  private clearResourceConfigActions(resource: AppResource) {
    const groups = this.managedPages
      .flatMap(page => this.getActionGroups(page.key))
      .filter(group => group.resource === resource);

    for (const group of groups) {
      this.clearGroupActions(group);
    }
  }

  private countEnabledFlags(config: Record<string, any> | undefined): number {
    if (!config) return 0;
    return Object.values(config).filter(value => value === true).length;
  }
}
