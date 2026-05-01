import { CommonModule } from '@angular/common';
import { Component, ContentChild, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

export interface ModalButtonConfig {
  buttonName: string;
  color?: 'secondary' | 'base_color' | 'danger' | 'warning' | 'success';
  action?: string;
  disabled?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-modal-shell, app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pp-modal-overlay" [class.pp-modal-overlay-static]="!closeOnBackdrop" (click)="handleBackdropClick($event)">
      <div
        class="pp-modal"
        [class.pp-modal-sm]="size === 'sm'"
        [class.pp-modal-lg]="size === 'lg'"
        [class.pp-modal-danger]="tone === 'danger'"
        [class.pp-modal-warning]="tone === 'warning'"
        [class.pp-modal-success]="tone === 'success'"
        (click)="$event.stopPropagation()">
        <div
          class="pp-modal-header"
          [class.pp-modal-header-danger]="tone === 'danger'"
          [class.pp-modal-header-warning]="tone === 'warning'"
          [class.pp-modal-header-success]="tone === 'success'">
          <div class="pp-modal-header-copy">
            <div
              class="pp-modal-header-icon"
              [class.pp-modal-header-icon-danger]="tone === 'danger'"
              [class.pp-modal-header-icon-warning]="tone === 'warning'"
              [class.pp-modal-header-icon-success]="tone === 'success'">
              <span *ngIf="icon" class="material-icons">{{ icon }}</span>
              <i *ngIf="!icon && iconClass" [class]="iconClass"></i>
              <ng-content select="[modal-header-icon]"></ng-content>
            </div>
            <div class="pp-modal-header-text">
              <div class="pp-modal-title">
                <ng-container *ngIf="title; else projectedTitle">{{ title }}</ng-container>
                <ng-template #projectedTitle>
                  <ng-content select="[modal-title]"></ng-content>
                </ng-template>
              </div>
              <div class="pp-modal-sub">
                <ng-container *ngIf="resolvedSubtitle; else projectedSubtitle">{{ resolvedSubtitle }}</ng-container>
                <ng-template #projectedSubtitle>
                  <ng-content select="[modal-subtitle]"></ng-content>
                </ng-template>
              </div>
            </div>
          </div>
          <button *ngIf="showClose" class="pp-modal-close" type="button" (click)="closeRequested.emit()">
            <span class="material-icons">close</span>
          </button>
        </div>

        <div class="pp-modal-body">
          <ng-content select="[modal-body]"></ng-content>
          <ng-content></ng-content>
        </div>

        <div class="pp-modal-footer" *ngIf="hasProjectedFooter || buttons.length > 0">
          <ng-container *ngIf="hasProjectedFooter; else generatedFooter">
            <ng-content select="[modal-footer]"></ng-content>
          </ng-container>
          <ng-template #generatedFooter>
            <button
              *ngFor="let button of buttons"
              type="button"
              class="pp-shell-btn"
              [class.pp-shell-btn-secondary]="resolveButtonColor(button) === 'secondary'"
              [class.pp-shell-btn-base]="resolveButtonColor(button) === 'base_color'"
              [class.pp-shell-btn-danger]="resolveButtonColor(button) === 'danger'"
              [class.pp-shell-btn-warning]="resolveButtonColor(button) === 'warning'"
              [class.pp-shell-btn-success]="resolveButtonColor(button) === 'success'"
              [disabled]="button.disabled || button.loading"
              (click)="buttonClick.emit(button)">
              <span *ngIf="button.loading" class="pp-shell-btn-spinner"></span>
              {{ button.buttonName }}
            </button>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pp-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      backdrop-filter: blur(2px);
    }

    .pp-modal-overlay-static {
      cursor: default;
    }

    .pp-modal {
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      width: 480px;
      max-width: 100%;
      overflow: hidden;
    }

    .pp-modal-sm {
      width: 440px;
    }

    .pp-modal-lg {
      width: 760px;
    }

    .pp-modal-danger {
      border: 1px solid #fecaca;
    }

    .pp-modal-warning {
      border: 1px solid #fde68a;
    }

    .pp-modal-success {
      border: 1px solid #bbf7d0;
    }

    .pp-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #ccc;
      background: linear-gradient(135deg, #f8faff, #fff);
      flex-shrink: 0;
    }

    .pp-modal-header-danger {
      background: linear-gradient(135deg, #fff5f5, #fff);
    }

    .pp-modal-header-warning {
      background: linear-gradient(135deg, #fffaf0, #fff);
    }

    .pp-modal-header-success {
      background: linear-gradient(135deg, #f0fdf4, #fff);
    }

    .pp-modal-header-copy {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .pp-modal-header-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--primary-color, #6366f1);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .pp-modal-header-icon:empty {
      display: none;
    }

    .pp-modal-header-icon .material-icons,
    .pp-modal-header-icon i {
      font-size: inherit;
    }

    .pp-modal-header-icon i {
      font-size: inherit;
      line-height: 1;
    }

    .pp-modal-header-icon-danger {
      background: #ef4444;
      color: #fff;
    }

    .pp-modal-header-icon-warning {
      background: #f59e0b;
      color: #fff;
    }

    .pp-modal-header-icon-success {
      background: #16a34a;
      color: #fff;
    }

    .pp-modal-header-text {
      flex: 1;
      min-width: 0;
    }

    .pp-modal-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .pp-modal-title:empty {
      display: none;
    }

    .pp-modal-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    .pp-modal-sub:empty {
      display: none;
    }

    .pp-modal-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      width: auto;
      height: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
      line-height: 0;
      transition: background 0.12s, color 0.12s;
      flex-shrink: 0;
    }

    .pp-modal-close:hover {
      background: #f1f5f9;
      color: #475569;
    }

    .pp-modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .pp-modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #ccc;
      background: #fafafa;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    .pp-shell-btn {
      border: none;
      border-radius: 10px;
      padding: 11px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-width: 110px;
    }

    .pp-shell-btn:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .pp-shell-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .pp-shell-btn-secondary {
      background: #e2e8f0;
      color: #475569;
    }

    .pp-shell-btn-base {
      background: var(--primary-color, #6366f1);
      color: #fff;
      box-shadow: 0 10px 22px rgba(var(--primary-rgb, 99,102,241), 0.24);
    }

    .pp-shell-btn-danger {
      background: #ef4444;
      color: #fff;
    }

    .pp-shell-btn-warning {
      background: #f59e0b;
      color: #fff;
    }

    .pp-shell-btn-success {
      background: #16a34a;
      color: #fff;
    }

    .pp-shell-btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      display: inline-block;
      animation: pp-shell-spin 0.75s linear infinite;
    }

    @keyframes pp-shell-spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class ModalShellComponent {
  @ContentChild('[modal-footer]', { read: ElementRef }) modalFooterRef?: ElementRef;

  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() tone: 'default' | 'danger' | 'warning' | 'success' = 'default';
  @Input() showClose = true;
  @Input() closeOnBackdrop = true;
  @Input() title = '';
  @Input() subtitle = '';
  @Input('sub-heading') subHeading = '';
  @Input() icon = '';
  @Input() iconClass = '';
  @Input() buttons: ModalButtonConfig[] = [];
  @Output() closeRequested = new EventEmitter<void>();
  @Output() buttonClick = new EventEmitter<ModalButtonConfig>();

  get hasProjectedFooter(): boolean {
    return !!this.modalFooterRef;
  }

  resolveButtonColor(button: ModalButtonConfig): NonNullable<ModalButtonConfig['color']> {
    return button.color || 'secondary';
  }

  handleBackdropClick(event: MouseEvent) {
    if (!this.closeOnBackdrop) return;
    if ((event.target as HTMLElement).classList.contains('pp-modal-overlay')) {
      this.closeRequested.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.closeOnBackdrop) {
      this.closeRequested.emit();
    }
  }

  get resolvedSubtitle(): string {
    return this.subHeading || this.subtitle;
  }
}
