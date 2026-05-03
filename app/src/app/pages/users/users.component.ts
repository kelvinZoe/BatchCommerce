import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateFilterComponent } from '../../components/date-filter/date-filter.component';
import { AuthService } from '../../services/auth.service';
import { ShopConfigService } from '../../services/shop-config.service';
import { User, Role } from '../../models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DateFilterComponent],
  template: `
    <div class="u-page">
      <div class="u-status-banner"
           *ngIf="statusMessage"
           [class.u-status-banner-success]="statusTone === 'success'"
           [class.u-status-banner-error]="statusTone === 'error'"
           [class.u-status-banner-info]="statusTone === 'info'">
        <span class="material-icons">{{ statusTone === 'error' ? 'error_outline' : statusTone === 'info' ? 'info' : 'check_circle' }}</span>
        <span>{{ statusMessage }}</span>
        <button class="u-status-close" (click)="clearStatusMessage()"><span class="material-icons">close</span></button>
      </div>

      <!-- PAGE HEADER -->
      <div class="u-page-header">
        <div class="u-header-left">
          <div class="u-header-icon"><span class="material-icons">manage_accounts</span></div>
          <div>
            <h1 class="u-title">Users</h1>
            <p class="u-subtitle">Manage team access for {{ activeShopName }}</p>
          </div>
        </div>
        <button class="u-btn u-btn-primary" (click)="openModal()" *ngIf="authService.can('create', 'users') && authService.canPerformUsersOperation('canAddUser')">
          <span class="material-icons">person_add</span> Add User
        </button>
      </div>

      <div class="u-overview-shell">
        <div class="u-scope-card">
          <div class="u-scope-kicker">Active shop</div>
          <div class="u-scope-name">{{ activeShopName }}</div>
          <p class="u-scope-copy">
            Role and active access below apply only to this shop. Full name, username, email, and phone are shared account details across shops.
          </p>
        </div>

        <div class="u-stat-grid">
          <div class="u-stat-card">
            <span class="material-icons">groups</span>
            <div>
              <div class="u-stat-value">{{ users.length }}</div>
              <div class="u-stat-label">Total members</div>
            </div>
          </div>
          <div class="u-stat-card">
            <span class="material-icons">verified_user</span>
            <div>
              <div class="u-stat-value">{{ activeUsersCount }}</div>
              <div class="u-stat-label">Active in shop</div>
            </div>
          </div>
          <div class="u-stat-card">
            <span class="material-icons">person_off</span>
            <div>
              <div class="u-stat-value">{{ inactiveUsersCount }}</div>
              <div class="u-stat-label">Inactive in shop</div>
            </div>
          </div>
          <div class="u-stat-card">
            <span class="material-icons">admin_panel_settings</span>
            <div>
              <div class="u-stat-value">{{ roles.length }}</div>
              <div class="u-stat-label">Available roles</div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN CARD -->
      <div class="u-card">

        <!-- TOOLBAR -->
        <div class="u-toolbar">
          <div class="u-search-wrap">
            <span class="material-icons u-search-icon">search</span>
            <input class="u-search" type="text" placeholder="Search by name, username, email, or phone…"
                   [(ngModel)]="searchTerm" (input)="filterUsers()" />
          </div>
          <select class="u-role-filter" [(ngModel)]="roleFilter" (change)="filterUsers()">
            <option value="all">All Roles</option>
            <option *ngFor="let role of roles" [value]="role.id">{{ role.name }}</option>
          </select>
          <app-date-filter (dateChange)="dateFrom=$event.from; dateTo=$event.to; filterUsers()"></app-date-filter>
          <div class="u-toolbar-note" *ngIf="selectedUserIds.size === 0">
            <span class="material-icons">lock_person</span>
            Your own shop access is protected from deletion and deactivation here.
          </div>
          <!-- Bulk delete button -->
          <button *ngIf="selectedUserIds.size > 0 && authService.can('delete', 'users') && authService.canPerformUsersOperation('canDeleteUser')"
                  class="u-btn u-btn-danger" (click)="openBulkDeleteModal()"
                  [disabled]="bulkDeleting">
            <span class="material-icons" *ngIf="!bulkDeleting">delete_outline</span>
            <span class="u-spinner" *ngIf="bulkDeleting"></span>
            Remove {{ selectedUserIds.size }} User{{ selectedUserIds.size !== 1 ? 's' : '' }}
          </button>
        </div>

        <!-- SKELETON -->
        <div class="u-table-wrap" *ngIf="loading">
          <table class="u-table">
            <thead><tr>
              <th *ngFor="let h of ['Full Name','Username','Email','Phone','Role','Status','Created','']">{{h}}</th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let i of [1,2,3,4,5,6,7]">
                <td *ngFor="let c of [1,2,3,4,5,6,7,8]"><div class="u-sk u-sk-cell"></div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- TABLE -->
        <div class="u-table-wrap" *ngIf="!loading">
          <table class="u-table">
            <thead>
              <tr>
                <th class="u-col-checkbox">
                  <input type="checkbox" 
                         [checked]="allUsersSelected()" 
                         [indeterminate]="someUsersSelected()"
                         (change)="toggleSelectAllUsers()"
                         class="u-checkbox" />
                </th>
                <th>Full Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of paginatedUsers"
                  [class.u-tr-selected]="isUserSelected(user.id!)">
                <td class="u-col-checkbox">
                  <input type="checkbox" 
                         [checked]="isUserSelected(user.id!)" 
                         (change)="toggleUserSelection(user.id!)"
                         class="u-checkbox"
                         [disabled]="!canSelectUser(user)" />
                </td>
                <td>
                  <div class="u-name-cell">
                    <div class="u-avatar">{{ user.fullName.charAt(0).toUpperCase() }}</div>
                    <div class="u-name-copy">
                      <strong class="u-name">{{ user.fullName }}</strong>
                      <div class="u-name-meta">
                        <span class="u-meta-pill" *ngIf="isSelf(user)">You</span>
                        <span class="u-meta-pill u-meta-pill-muted" *ngIf="user.username === 'admin'">System</span>
                        <span class="u-meta-pill u-meta-pill-warning" *ngIf="user.membershipStatus === 'pending_verification'">Pending Verification</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="u-username">{{ user.username }}</td>
                <td>
                  <span class="u-email" *ngIf="user.email">{{ user.email }}</span>
                  <span *ngIf="!user.email" class="u-empty">—</span>
                </td>
                <td>
                  <span class="u-phone" *ngIf="user.phone">{{ user.phone }}</span>
                  <span *ngIf="!user.phone" class="u-empty">—</span>
                </td>
                <td>
                  <span class="u-role-badge" [class]="'u-role-' + (user.roleName || '').toLowerCase()">
                    {{ user.roleName }}
                  </span>
                </td>
                <td>
                  <span [class]="'u-status-badge ' + getStatusClass(user)">
                    {{ getStatusLabel(user) }}
                  </span>
                </td>
                <td class="u-created">{{ user.createdAt | date:'mediumDate' }}</td>
                <td>
                  <div class="u-actions">
                    <button class="u-icon-btn u-icon-edit" title="Edit"
                            (click)="editUser(user)"
                            *ngIf="authService.can('edit', 'users')"
                            [disabled]="user.username === 'admin' && !authService.isAdmin">
                      <span class="material-icons">edit</span>
                    </button>
                        <button class="u-icon-btn u-icon-verify" title="Resend verification email"
                          (click)="resendVerification(user)"
                          *ngIf="canResendVerification(user)"
                          [disabled]="resendingUserId === user.id">
                          <span *ngIf="resendingUserId !== user.id" class="material-icons">mail</span>
                          <span *ngIf="resendingUserId === user.id" class="u-del-spinner"></span>
                        </button>
                    <button class="u-icon-btn u-icon-del" title="Delete"
                            (click)="deleteUser(user)"
                            *ngIf="authService.can('delete', 'users') && authService.canPerformUsersOperation('canDeleteUser')"
                            [disabled]="!canDeleteUser(user) || deletingUserId === user.id">
                      <span *ngIf="deletingUserId !== user.id" class="material-icons">delete_outline</span>
                      <span *ngIf="deletingUserId === user.id" class="u-del-spinner"></span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredUsers.length === 0">
                <td colspan="9" class="u-empty-row">
                  <span class="material-icons">manage_accounts</span>
                  No users found for {{ activeShopName }}. Click <strong>Add User</strong> to invite someone into this shop.
                </td>
              </tr>
            </tbody>
          </table>

          <!-- PAGINATION -->
          <div class="u-pagination" *ngIf="filteredUsers.length > pageSize">
            <span class="u-page-info">
              {{ (currentPage-1)*pageSize+1 }}–{{ currentPage*pageSize < filteredUsers.length ? currentPage*pageSize : filteredUsers.length }} of {{ filteredUsers.length }}
            </span>
            <div class="u-page-btns">
              <button (click)="currentPage=1" [disabled]="currentPage===1"><span class="material-icons">first_page</span></button>
              <button (click)="currentPage=currentPage-1" [disabled]="currentPage===1"><span class="material-icons">chevron_left</span></button>
              <button (click)="currentPage=currentPage+1" [disabled]="currentPage>=totalPages"><span class="material-icons">chevron_right</span></button>
              <button (click)="currentPage=totalPages" [disabled]="currentPage>=totalPages"><span class="material-icons">last_page</span></button>
            </div>
          </div>
        </div>

      </div><!-- /u-card -->


      <!-- MODAL -->
      <div class="u-modal-overlay" *ngIf="showModal" (click)="onOverlayClick($event)">
        <div class="u-modal" (click)="$event.stopPropagation()">

          <div class="u-modal-header">
            <div class="u-modal-header-icon">
              <span class="material-icons">{{ editingUser ? 'edit' : 'person_add' }}</span>
            </div>
            <div>
              <div class="u-modal-title">{{ editingUser ? 'Edit User' : 'Add User' }}</div>
                <div class="u-modal-sub">{{ editingUser ? 'Update this member\'s profile and shop access' : 'Create a new team member account for this shop' }}</div>
            </div>
            <button class="u-modal-close" (click)="closeModal()"><span class="material-icons">close</span></button>
          </div>

          <div class="u-modal-body">
            <!-- Error Message Banner -->
            <div class="u-error-banner" *ngIf="errorMessage">
              <div class="u-error-icon"><span class="material-icons">error_outline</span></div>
              <div class="u-error-content">
                <div class="u-error-title">Error</div>
                <p class="u-error-text">{{ errorMessage }}</p>
              </div>
              <button class="u-error-close" (click)="errorMessage = ''"><span class="material-icons">close</span></button>
            </div>

            <div class="u-access-note">
              <div class="u-access-note-title">Access scope: {{ activeShopName }}</div>
              <p class="u-access-note-copy">
                Role and account status below affect this shop only. Full name, username, email, and phone are shared account details.
              </p>
              <p class="u-access-note-copy" *ngIf="isEditingSelf">
                Your own role and active access are locked here so you do not remove your current shop access by mistake.
              </p>
            </div>

            <div class="u-form-group">
              <label class="u-label">Full Name <span class="u-req">*</span></label>
              <input class="u-input" type="text" [(ngModel)]="formData.fullName" placeholder="e.g., Kwame Asante" />
            </div>
            <div class="u-form-row">
              <div class="u-form-group">
                <label class="u-label">Email <span class="u-req">*</span></label>
                <input class="u-input" type="email" [(ngModel)]="formData.email" placeholder="e.g., kwame@example.com"
                       [disabled]="!!editingUser" />
                <span class="u-field-hint" *ngIf="!editingUser">This is the user's sign-in address and verification target.</span>
                <span class="u-field-hint" *ngIf="editingUser">Email changes are locked here so auth and verification stay in sync.</span>
              </div>
              <div class="u-form-group">
                <label class="u-label">Username <span class="u-req">*</span></label>
                <input class="u-input" type="text" [(ngModel)]="formData.username" placeholder="e.g., kwame"
                       [disabled]="editingUser?.username === 'admin'" />
              </div>
            </div>
            <div class="u-form-row">
              <div class="u-form-group">
                <label class="u-label">{{ editingUser ? 'New Password (leave blank to keep)' : 'Password *' }}</label>
                <input class="u-input" type="password" [(ngModel)]="formData.password"
                       [placeholder]="editingUser ? '••••••••' : 'Enter password'" />
              </div>
              <div class="u-form-group">
                <label class="u-label">Phone</label>
                <input class="u-input" type="tel" [(ngModel)]="formData.phone" placeholder="0241234567 or +233241234567" />
                <span class="u-field-hint">Optional. Used for contact and delivery coordination.</span>
              </div>
            </div>
            <div class="u-form-row">
              <div class="u-form-group">
                <label class="u-label">Role <span class="u-req">*</span></label>
                <select class="u-input" [(ngModel)]="formData.roleId" [disabled]="isEditingSelf">
                  <option [value]="0">-- Select Role --</option>
                  <option *ngFor="let role of roles" [value]="role.id">{{ role.name }}</option>
                </select>
                <span class="u-field-hint" *ngIf="isEditingSelf">Use another admin account to change your own role in this shop.</span>
              </div>
              <div class="u-form-group">
                <label class="u-label">Invite flow</label>
                <div class="u-input u-static-field">The user will verify this email before the shop access becomes active.</div>
              </div>
            </div>
            <div class="u-form-group u-checkbox-group">
              <label class="u-checkbox-label">
                <input type="checkbox" [(ngModel)]="formData.isActive" [disabled]="isEditingSelf" />
                Account is active
              </label>
              <span class="u-field-hint" *ngIf="isEditingSelf">Your own shop access cannot be deactivated from this page.</span>
            </div>
          </div>

          <div class="u-modal-footer">
            <button class="u-btn u-btn-ghost" (click)="closeModal()" [disabled]="saving">Cancel</button>
            <button class="u-btn u-btn-primary" (click)="saveUser()" [disabled]="saving">
              <span *ngIf="saving" class="u-spinner"></span>
              {{ saving ? 'Saving…' : (editingUser ? 'Update User' : 'Add User') }}
            </button>
          </div>

        </div>
      </div>

      <!-- BULK DELETE MODAL -->
      <div class="u-modal-overlay" *ngIf="showBulkDeleteModal" (click)="closeBulkDeleteModal()">
        <div class="u-modal" (click)="$event.stopPropagation()">

          <div class="u-modal-header">
            <div class="u-modal-header-icon u-modal-header-danger">
              <span class="material-icons">warning</span>
            </div>
            <div>
              <div class="u-modal-title">Remove {{ selectedUserIds.size }} User{{ selectedUserIds.size !== 1 ? 's' : '' }} From This Shop?</div>
              <div class="u-modal-sub">This removes their access to the active shop</div>
            </div>
            <button class="u-modal-close" (click)="closeBulkDeleteModal()"><span class="material-icons">close</span></button>
          </div>

          <div class="u-modal-body">
            <p class="u-bulk-delete-warning">
              You are about to remove {{ selectedUserIds.size }} user{{ selectedUserIds.size !== 1 ? 's' : '' }} from this shop.
            </p>
            <p class="u-bulk-delete-info">
              Their global account stays intact, but they will no longer be able to access the active shop.
            </p>
            <p class="u-bulk-delete-info">
              Your own membership is excluded automatically.
            </p>
          </div>

          <div class="u-modal-footer">
            <button class="u-btn u-btn-ghost" (click)="closeBulkDeleteModal()" [disabled]="bulkDeleting">Cancel</button>
            <button class="u-btn u-btn-danger" (click)="confirmBulkDelete()" [disabled]="bulkDeleting">
              <span *ngIf="bulkDeleting" class="u-spinner"></span>
              <span *ngIf="!bulkDeleting" class="material-icons">delete</span>
              {{ bulkDeleting ? 'Removing…' : 'Remove From Shop' }}
            </button>
          </div>

        </div>
      </div>

    </div><!-- /u-page -->
  `,
  styles: [`
    .u-page { padding:0; max-width:1400px; }
    .u-status-banner {
      margin: 12px 0 18px;
      padding: 12px 14px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid transparent;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    }
    .u-status-banner .material-icons { font-size: 18px; }
    .u-status-banner-success { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
    .u-status-banner-error { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
    .u-status-banner-info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .u-status-close {
      margin-left: auto;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .u-status-close .material-icons { font-size: 16px; }

    /* ── Page header ── */
    .u-page-header  { display:flex; align-items:center; justify-content:space-between; padding:20px 0 16px; gap:12px; flex-wrap:wrap; }
    .u-header-left  { display:flex; align-items:center; gap:14px; }
    .u-header-icon  { width:46px; height:46px; border-radius:12px; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
    .u-title        { margin:0; font-size:22px; font-weight:800; color:#0f172a; }
    .u-subtitle     { margin:2px 0 0; font-size:12px; color:#64748b; }

    .u-overview-shell {
      display: grid;
      grid-template-columns: minmax(240px, 1.3fr) minmax(0, 2fr);
      gap: 14px;
      margin-bottom: 16px;
      align-items: stretch;
    }
    .u-scope-card {
      padding: 18px;
      border-radius: 16px;
      color: #fff;
      background:
        radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 38%),
        linear-gradient(135deg, #0f172a, #1e293b 58%, #334155);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
    }
    .u-scope-kicker {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(226, 232, 240, 0.92);
    }
    .u-scope-name { margin-top: 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
    .u-scope-copy {
      margin: 10px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(226, 232, 240, 0.9);
      max-width: 50ch;
    }
    .u-stat-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .u-stat-card {
      padding: 16px;
      border: 1px solid #dbe3f0;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
    }
    .u-stat-card .material-icons {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e0e7ff;
      color: #4338ca;
      font-size: 19px;
      flex-shrink: 0;
    }
    .u-stat-value { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
    .u-stat-label { margin-top: 4px; font-size: 12px; color: #64748b; }

    /* ── Card ── */
    .u-card { background:#fff; border:1px solid #ccc; border-radius:14px; padding:20px; overflow:hidden; }

    /* ── Buttons ── */
    .u-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:background .15s; }
    .u-btn .material-icons { font-size:17px; }
    .u-btn:disabled { opacity:.45; cursor:default; pointer-events:none; }
    .u-btn-primary  { background:var(--primary-color,#6366f1); color:#fff; }
    .u-btn-primary:hover:not(:disabled) { background:var(--primary-dark,#4f46e5); }
    .u-btn-danger   { background:#ef4444; color:#fff; }
    .u-btn-danger:hover:not(:disabled) { background:#dc2626; }
    .u-btn-ghost    { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
    .u-btn-ghost:hover:not(:disabled) { background:#e2e8f0; }

    /* ── Toolbar ── */
    .u-toolbar      { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .u-search-wrap  { display:flex; align-items:center; gap:8px; border:1px solid #ccc; border-radius:9px; padding:0 12px; background:#f8fafc; flex:1; min-width:180px; max-width:320px; }
    .u-search-icon  { font-size:18px; color:#94a3b8; flex-shrink:0; }
    .u-search       { border:none; background:transparent; font-size:13px; color:#334155; outline:none; width:100%; padding:9px 0; }
    .u-role-filter  { padding:9px 12px; border:1px solid #ccc; border-radius:9px; font-size:13px; color:#334155; background:#f8fafc; outline:none; box-sizing:border-box; }
    .u-role-filter:focus { border-color:var(--primary-color,#6366f1); background:#fff; }
    .u-toolbar-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      border: 1px solid #e2e8f0;
    }
    .u-toolbar-note .material-icons { font-size: 15px; color: #64748b; }

    /* ── Skeleton ── */
    .u-sk { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:u-shimmer 1.4s infinite; border-radius:6px; }
    .u-sk-cell { height:14px; width:80%; }
    @keyframes u-shimmer { to { background-position:-200% 0; } }

    /* ── Table ── */
    .u-table-wrap   { margin:0 -20px -20px; border-top:1px solid #ccc; overflow-x:auto; }
    .u-table        { width:100%; border-collapse:collapse; font-size:13px; }
    .u-table th     { padding:11px 16px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; background:#f8fafc; border-bottom:1px solid #ccc; white-space:nowrap; }
    .u-table td     { padding:12px 16px; border-bottom:1px solid #ccc; color:#334155; vertical-align:middle; text-align:left; }
    .u-table tbody tr:last-child td { border-bottom:none; }
    .u-table tbody tr:hover td { background:#fafafe; }
    .u-tr-selected { background:#f0f4ff; }
    .u-tr-selected:hover { background:#e8edff; }

    /* ── Checkbox column ── */
    .u-checkbox { width:18px; height:18px; cursor:pointer; accent-color:var(--primary-color,#6366f1); }
    .u-col-checkbox { width:50px; text-align:left; padding:8px; }

    /* ── Name cell ── */
    .u-name-cell    { display:flex; align-items:center; gap:10px; }
    .u-avatar       { width:32px; height:32px; border-radius:50%; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex-shrink:0; }
    .u-name-copy    { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .u-name         { font-weight:700; color:#0f172a; }
    .u-name-meta    { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .u-meta-pill {
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #dbeafe;
      color: #1d4ed8;
    }
    .u-meta-pill-muted { background: #ede9fe; color: #6d28d9; }
    .u-meta-pill-warning { background: #ffedd5; color: #c2410c; }

    /* ── Table cells ── */
    .u-username     { font-weight:500; color:#475569; font-family:monospace; font-size:12px; }
    .u-email,
    .u-phone        { font-size:12px; color:#334155; }
    .u-created      { font-size:12px; color:#64748b; }
    .u-empty        { color:#cbd5e1; font-size:13px; }

    /* ── Role badge ── */
    .u-role-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
    .u-role-admin       { background:#ede9fe; color:#6d28d9; }
    .u-role-sales       { background:#dbeafe; color:#1e40af; }
    .u-role-delivery    { background:#d1fae5; color:#065f46; }
    .u-role-accountant  { background:#fef3c7; color:#92400e; }

    /* ── Status badge ── */
    .u-status-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
    .u-status-active  { background:#d1fae5; color:#065f46; }
    .u-status-inactive { background:#fee2e2; color:#991b1b; }
    .u-status-pending { background:#fff7ed; color:#9a3412; }
    .u-status-suspended { background:#fee2e2; color:#991b1b; }

    /* ── Actions ── */
    .u-actions      { display:flex; align-items:center; gap:6px; }
    .u-icon-btn     { display:inline-flex; align-items:center; justify-content:center; padding:6px 8px; border-radius:8px; border:none; cursor:pointer; transition:background 0.13s; line-height:0; }
    .u-icon-btn .material-icons { font-size:16px; }
    .u-icon-btn:disabled { opacity:0.35; cursor:default; }
    .u-icon-edit    { background:#f1f5f9; color:#475569; }
    .u-icon-edit:hover:not(:disabled) { background:#e2e8f0; }
    .u-icon-verify  { background:#eff6ff; color:#2563eb; }
    .u-icon-verify:hover:not(:disabled) { background:#dbeafe; }
    .u-icon-del     { background:#fef2f2; color:#dc2626; }
    .u-icon-del:hover:not(:disabled) { background:#fee2e2; }

    /* ── Empty row ── */
    .u-empty-row    { text-align:center; padding:40px 16px !important; color:#94a3b8; }
    .u-empty-row .material-icons { display:block; font-size:40px; margin-bottom:8px; }

    /* ── Pagination ── */
    .u-pagination   { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #f1f5f9; }
    .u-page-info    { font-size:12px; color:#64748b; margin-right:8px; }
    .u-page-btns    { display:flex; gap:4px; }
    .u-page-btns button { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:7px; border:1px solid #ccc; background:#fff; cursor:pointer; color:#475569; }
    .u-page-btns button:disabled { opacity:.4; cursor:default; }
    .u-page-btns button .material-icons { font-size:18px; }

    /* ── Modal ── */
    .u-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .u-modal        { background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.2); width:100%; max-width:520px; display:flex; flex-direction:column; overflow:hidden; }
    .u-modal-header { display:flex; align-items:center; gap:14px; padding:18px 20px; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .u-modal-header-icon { width:38px; height:38px; border-radius:10px; background:var(--primary-color,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
    .u-modal-header-danger { background:#fef2f2; color:#dc2626; }
    .u-modal-title  { font-size:15px; font-weight:700; color:#0f172a; }
    .u-modal-sub    { font-size:12px; color:#64748b; }
    .u-modal-close  { margin-left:auto; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:none; background:#f1f5f9; border-radius:8px; cursor:pointer; color:#475569; }
    .u-modal-close:hover { background:#e2e8f0; }
    .u-modal-body   { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; }
    .u-bulk-delete-warning { color:#0f172a; font-size:14px; margin:0 0 12px; line-height:1.5; }
    .u-bulk-delete-info { color:#64748b; font-size:13px; margin:12px 0 0; }
    .u-modal-footer { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #e2e8f0; flex-shrink:0; }

    /* ── Form ── */
    .u-form-group   { display:flex; flex-direction:column; gap:5px; }
    .u-form-row     { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .u-label        { font-size:12px; font-weight:600; color:#475569; }
    .u-req          { color:#ef4444; }
    .u-input        { padding:9px 12px; border:1px solid #ccc; border-radius:9px; font-size:13px; color:#334155; background:#f8fafc; outline:none; width:100%; box-sizing:border-box; }
    .u-input:focus  { border-color:var(--primary-color,#6366f1); background:#fff; }
    .u-static-field { display:flex; align-items:center; min-height:39px; color:#475569; }
    .u-field-hint   { font-size:11px; color:#64748b; line-height:1.4; }
    .u-checkbox-group { padding:6px 0; }
    .u-checkbox-label { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:#334155; font-weight:500; }
    .u-checkbox-label input[type="checkbox"] { width:18px; height:18px; cursor:pointer; accent-color:var(--primary-color,#6366f1); }
    .u-access-note {
      padding: 14px 16px;
      border-radius: 12px;
      background: linear-gradient(180deg, #f8fafc, #eff6ff);
      border: 1px solid #dbeafe;
    }
    .u-access-note-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1d4ed8;
      margin-bottom: 6px;
    }
    .u-access-note-copy { margin: 0; font-size: 12px; line-height: 1.6; color: #334155; }
    .u-access-note-copy + .u-access-note-copy { margin-top: 6px; }

    /* ── Spinner ── */
    .u-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:u-spin .7s linear infinite; display:inline-block; }
    .u-del-spinner { width:13px; height:13px; border:2px solid rgba(239,68,68,0.3); border-top-color:#ef4444; border-radius:50%; animation:u-spin .7s linear infinite; display:inline-block; }
    @keyframes u-spin { to { transform:rotate(360deg); } }

    /* ── Error Banner ── */
    .u-error-banner { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:9px; color:#991b1b; margin-bottom:14px; }
    .u-error-icon { font-size:18px; color:#dc2626; flex-shrink:0; margin-top:1px; }
    .u-error-content { flex:1; min-width:0; }
    .u-error-title { font-size:12px; font-weight:700; color:#991b1b; margin:0 0 2px; }
    .u-error-text { font-size:12px; color:#991b1b; margin:0; line-height:1.4; }
    .u-error-close { width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:none; background:transparent; cursor:pointer; color:#dc2626; flex-shrink:0; padding:0; }
    .u-error-close:hover { color:#991b1b; }
    .u-error-close .material-icons { font-size:16px; }

    @media (max-width: 1040px) {
      .u-overview-shell { grid-template-columns: 1fr; }
      .u-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 720px) {
      .u-form-row { grid-template-columns: 1fr; }
      .u-stat-grid { grid-template-columns: 1fr; }
      .u-toolbar-note { width: 100%; justify-content: center; }
      .u-pagination { flex-wrap: wrap; justify-content: center; }
    }
  `]
})
export class UsersComponent implements OnInit {
  loading = true;
  saving  = false;
  users: User[] = [];
  filteredUsers: User[] = [];
  roles: Role[] = [];

  searchTerm = '';
  roleFilter = 'all';
  dateFrom = '';
  dateTo = '';

  deletingUserId: number | null = null;

  // Bulk delete properties
  selectedUserIds = new Set<number>();
  showBulkDeleteModal = false;
  bulkDeleting = false;

  currentPage = 1;
  pageSize = 20;

  get paginatedUsers() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.filteredUsers.length / this.pageSize) || 1;
  }

  showModal = false;
  editingUser: User | null = null;
  errorMessage = ''; // Error display in modal
  statusMessage = '';
  statusTone: 'success' | 'error' | 'info' = 'success';
  private statusTimer: any = null;
  resendingUserId: number | null = null;

  formData: User = {
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    roleId: 0,
    isActive: true
  };

  constructor(public authService: AuthService, public shopConfig: ShopConfigService) {}

  get activeShopName(): string {
    return this.shopConfig.shopName || 'Active Shop';
  }

  get activeUsersCount(): number {
    return this.users.filter(user => user.isActive).length;
  }

  get inactiveUsersCount(): number {
    return this.users.filter(user => !user.isActive).length;
  }

  get isEditingSelf(): boolean {
    return this.isSelf(this.editingUser);
  }

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers() {
    this.authService.getUsers().subscribe(users => {
      this.users = users;
      const validIds = new Set(users.map(user => user.id).filter((id): id is number => typeof id === 'number'));
      Array.from(this.selectedUserIds).forEach(id => {
        if (!validIds.has(id)) {
          this.selectedUserIds.delete(id);
        }
      });
      this.filterUsers();
      this.loading = false;
    });
  }

  loadRoles() {
    this.authService.getRoles().subscribe(roles => {
      this.roles = roles;
    });
  }

  filterUsers() {
    let filtered = this.users;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.fullName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.phone || '').toLowerCase().includes(term)
      );
    }

    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(u => String(u.roleId) === this.roleFilter);
    }

    if (this.dateFrom) {
      filtered = filtered.filter(u => (u.createdAt || '').substring(0, 10) >= this.dateFrom);
    }
    if (this.dateTo) {
      filtered = filtered.filter(u => (u.createdAt || '').substring(0, 10) <= this.dateTo);
    }

    this.filteredUsers = filtered;
    this.currentPage = 1;
  }

  openModal(user?: User) {
    this.clearStatusMessage();
    this.errorMessage = '';
    this.editingUser = user || null;
    if (user) {
      this.formData = { ...user, password: '' };
    } else {
      this.formData = {
        username: '', password: '', fullName: '',
        email: '', phone: '', roleId: 0, isActive: true
      };
    }

    if (this.isEditingSelf && this.authService.currentUser) {
      this.formData.roleId = this.authService.currentUser.roleId;
      this.formData.isActive = true;
    }

    this.showModal = true;
  }

  closeModal() {
    if (this.saving) return;
    this.showModal = false;
    this.editingUser = null;
    this.errorMessage = ''; // Clear error when closing
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('u-modal-overlay')) this.closeModal();
  }

  editUser(user: User) {
    this.openModal(user);
  }

  saveUser() {
    // Clear any previous errors
    this.errorMessage = '';

    // Validation
    if (!this.formData.fullName.trim()) {
      this.errorMessage = 'Please enter a full name';
      return;
    }
    if (!this.formData.username.trim()) {
      this.errorMessage = 'Please enter a username';
      return;
    }
    if (!this.editingUser && !this.formData.email?.trim()) {
      this.errorMessage = 'Please enter an email address';
      return;
    }
    if (!this.editingUser && !this.formData.password?.trim()) {
      this.errorMessage = 'Please enter a password';
      return;
    }
    if (!this.formData.roleId) {
      this.errorMessage = 'Please select a role';
      return;
    }

    const normalizedEmail = this.authService.normalizeEmail(this.formData.email || '');
    if (!this.editingUser && !this.authService.isValidEmail(normalizedEmail)) {
      this.errorMessage = 'Enter a valid email address like user@example.com';
      return;
    }

    const normalizedPhone = this.authService.normalizePhoneNumber(this.formData.phone || '');
    if (normalizedPhone && !this.authService.isValidPhoneNumber(normalizedPhone)) {
      this.errorMessage = 'Enter a valid phone number like 0241234567 or +233241234567';
      return;
    }

    this.formData.email = normalizedEmail;
    this.formData.phone = normalizedPhone;

    this.saving = true;
    if (this.editingUser) {
      this.formData.id = this.editingUser.id;
      if (this.isEditingSelf && this.authService.currentUser) {
        this.formData.roleId = this.authService.currentUser.roleId;
        this.formData.isActive = true;
      }
      if (!this.formData.password?.trim()) {
        delete this.formData.password;
      }
      this.authService.updateUser(this.formData).subscribe({
        next: () => {
          this.saving = false;
          this.loadUsers();
          this.setStatusMessage(`Updated ${this.formData.fullName} for ${this.activeShopName}.`);
          this.closeModal();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.message || 'Unknown error occurred while updating user';
        }
      });
    } else {
      this.authService.createUser(this.formData).subscribe({
        next: (result) => {
          this.saving = false;
          this.loadUsers();
          if (result.membershipStatus === 'pending_verification') {
            const message = result.verificationSent === false
              ? `Added ${this.formData.fullName} to ${this.activeShopName}, but the verification email could not be sent yet.`
              : `Added ${this.formData.fullName} to ${this.activeShopName}. A verification email was sent to ${this.formData.email}.`;
            this.setStatusMessage(message, result.verificationSent === false ? 'info' : 'success');
          } else {
            this.setStatusMessage(`Added ${this.formData.fullName} to ${this.activeShopName}.`);
          }
          this.closeModal();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.message || 'Unknown error occurred while creating user';
        }
      });
    }
  }

  deleteUser(user: User) {
    if (user.username === 'admin') {
      this.setStatusMessage('The system admin account cannot be removed from this page.', 'error');
      return;
    }
    if (!this.canDeleteUser(user)) {
      this.setStatusMessage('You cannot remove your own access from the active shop.', 'error');
      return;
    }
    if (confirm(`Remove "${user.fullName}" from this shop? They will lose access to the active shop.`)) {
      this.deletingUserId = user.id!;
      this.authService.deleteUser(user.id!, user.authId).subscribe({
        next: () => {
          this.deletingUserId = null;
          this.setStatusMessage(`Removed ${user.fullName} from ${this.activeShopName}.`);
          this.loadUsers();
        },
        error: (err) => {
          this.deletingUserId = null;
          this.setStatusMessage(err?.message || 'Failed to remove this user from the active shop.', 'error');
        }
      });
    }
  }

  // Bulk delete operations
  toggleUserSelection(userId: number) {
    const user = this.users.find(item => item.id === userId);
    if (!user || !this.canSelectUser(user)) return;

    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
    } else {
      this.selectedUserIds.add(userId);
    }
  }

  toggleSelectAllUsers() {
    const selectableUsers = this.paginatedUsers.filter(user => this.canSelectUser(user));
    const allSelected = selectableUsers.length > 0 && selectableUsers.every(user => this.selectedUserIds.has(user.id!));

    if (allSelected) {
      selectableUsers.forEach(user => this.selectedUserIds.delete(user.id!));
    } else {
      selectableUsers.forEach(user => this.selectedUserIds.add(user.id!));
    }
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUserIds.has(userId);
  }

  allUsersSelected(): boolean {
    const selectableUsers = this.paginatedUsers.filter(user => this.canSelectUser(user));
    return selectableUsers.length > 0 && selectableUsers.every(user => this.selectedUserIds.has(user.id!));
  }

  someUsersSelected(): boolean {
    const selectableUsers = this.paginatedUsers.filter(user => this.canSelectUser(user));
    const selectedOnPage = selectableUsers.filter(user => this.selectedUserIds.has(user.id!)).length;
    return selectedOnPage > 0 && selectedOnPage < selectableUsers.length;
  }

  openBulkDeleteModal() {
    if (this.selectedUserIds.size === 0) return;
    this.showBulkDeleteModal = true;
  }

  closeBulkDeleteModal() {
    if (this.bulkDeleting) return;
    this.showBulkDeleteModal = false;
  }

  confirmBulkDelete() {
    if (this.selectedUserIds.size === 0) return;
    
    this.bulkDeleting = true;
    const userIds = Array.from(this.selectedUserIds);
    let deletedCount = 0;
    let failedCount = 0;

    // Delete users one by one
    const deleteNext = (index: number) => {
      if (index >= userIds.length) {
        this.bulkDeleting = false;
        this.showBulkDeleteModal = false;
        this.selectedUserIds.clear();
        this.setStatusMessage(
          `Removed ${deletedCount} user(s) from ${this.activeShopName}.${failedCount > 0 ? ` ${failedCount} failed.` : ''}`,
          failedCount > 0 ? 'info' : 'success'
        );
        this.loadUsers();
        return;
      }

      const userId = userIds[index];
      const user = this.users.find(u => u.id === userId);
      if (!user || !this.canDeleteUser(user)) {
        failedCount++;
        deleteNext(index + 1);
        return;
      }

      this.authService.deleteUser(userId, user?.authId).subscribe({
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

  isSelf(user: User | null | undefined): boolean {
    if (!user) return false;
    const currentUser = this.authService.currentUser;
    if (!currentUser) return false;
    return (user.id != null && currentUser.id === user.id)
      || (!!user.authId && currentUser.authId === user.authId);
  }

  canSelectUser(user: User): boolean {
    return !!user.id && user.username !== 'admin' && !this.isSelf(user);
  }

  canDeleteUser(user: User): boolean {
    return !!user.id && user.username !== 'admin' && !this.isSelf(user);
  }

  getStatusLabel(user: User): string {
    if (user.membershipStatus === 'pending_verification') {
      return 'Pending Verification';
    }

    if (user.membershipStatus === 'suspended') {
      return 'Suspended';
    }

    return user.isActive ? 'Active' : 'Inactive';
  }

  getStatusClass(user: User): string {
    if (user.membershipStatus === 'pending_verification') {
      return 'u-status-pending';
    }

    if (user.membershipStatus === 'suspended') {
      return 'u-status-suspended';
    }

    return user.isActive ? 'u-status-active' : 'u-status-inactive';
  }

  canResendVerification(user: User): boolean {
    return !!user.id
      && !!user.email
      && user.membershipStatus === 'pending_verification'
      && this.authService.can('edit', 'users');
  }

  resendVerification(user: User) {
    if (!this.canResendVerification(user)) {
      return;
    }

    this.resendingUserId = user.id!;
    this.authService.resendEmailVerification(user.email || '').subscribe({
      next: (result) => {
        this.resendingUserId = null;
        this.setStatusMessage(result.message, result.success ? 'success' : 'error');
      },
      error: (err) => {
        this.resendingUserId = null;
        this.setStatusMessage(err?.message || 'Could not resend the verification email.', 'error');
      }
    });
  }

  setStatusMessage(message: string, tone: 'success' | 'error' | 'info' = 'success') {
    this.statusMessage = message;
    this.statusTone = tone;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
    this.statusTimer = setTimeout(() => {
      this.statusMessage = '';
      this.statusTimer = null;
    }, 3200);
  }

  clearStatusMessage() {
    this.statusMessage = '';
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }
}
