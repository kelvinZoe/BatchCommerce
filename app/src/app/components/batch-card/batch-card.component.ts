import { CommonModule } from '@angular/common';
import { Component, ContentChild, ElementRef, EventEmitter, Input, Output } from '@angular/core';

export type BatchCardTagColor = 'gray' | 'green' | 'blue' | 'orange' | 'red' | 'violet';

export interface BatchCardTagConfig {
  tagName: string;
  color?: BatchCardTagColor;
  icon?: string;
}

@Component({
  selector: 'app-batch-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="bc-card"
      [class.bc-card-active]="active"
      [class.bc-card-muted]="muted"
      [class.bc-card-clickable]="clickable"
      (click)="handleClick()">
      <div class="bc-card-top">
        <div class="bc-card-leading">
          <div class="bc-card-header">
            <div class="bc-card-icon" [class.bc-card-icon-muted]="iconMuted">
              <span class="material-icons">{{ icon }}</span>
            </div>
            <div class="bc-card-heading">
              <div class="bc-card-title">{{ title }}</div>
              <div class="bc-card-subtitle" *ngIf="subtitle">{{ subtitle }}</div>
            </div>
          </div>
          <div class="bc-tag-list" *ngIf="!hasProjectedTopRight && displayTags.length">
            <span
              *ngFor="let item of displayTags"
              class="bc-tag"
              [ngClass]="'bc-tag-' + resolveTagColor(item)">
              <span *ngIf="item.icon" class="material-icons">{{ item.icon }}</span>
              {{ item.tagName }}
            </span>
          </div>
        </div>
        <div class="bc-card-top-right" *ngIf="hasProjectedTopRight">
          <ng-content select="[batchCardTopRight]"></ng-content>
        </div>
      </div>

      <div class="bc-card-body">
        <ng-content select="[batchCardBody]"></ng-content>
      </div>

      <div class="bc-card-footer">
        <ng-content select="[batchCardFooter]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .bc-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 14px;
      background: var(--card-background, #fff);
      transition: border-color 0.15s, background 0.15s;
    }

    .bc-card-clickable {
      cursor: pointer;
    }

    .bc-card-clickable:hover {
      border-color: var(--primary-light, #a5b4fc);
    }

    .bc-card-active {
      border-color: var(--primary-color, #6366f1) !important;
    }

    .bc-card-muted {
      opacity: 0.7;
    }

    .bc-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .bc-card-leading {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }

    .bc-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .bc-card-top-right {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .bc-tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .bc-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(var(--primary-rgb, 99,102,241), 0.12);
      color: var(--primary-color, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(var(--primary-rgb, 99,102,241), 0.15);
    }

    .bc-card-icon .material-icons {
      font-size: 20px;
    }

    .bc-card-icon-muted {
      background: #f1f5f9;
      color: #94a3b8;
      border-color: #e2e8f0;
    }

    .bc-card-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bc-card-subtitle {
      font-size: 11px;
      color: var(--text-secondary, #94a3b8);
    }

    .bc-card-heading {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .bc-card-body:empty,
    .bc-card-footer:empty {
      display: none;
    }

    .bc-card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bc-card-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      padding-top: 10px;
      border-top: 1px solid var(--border-color, #f1f5f9);
    }

    .bc-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .bc-tag .material-icons {
      font-size: 13px;
    }

    .bc-tag-gray {
      background: #f3f4f6;
      color: #4b5563;
      border-color: #d1d5db;
    }

    .bc-tag-green {
      background: #dcfce7;
      color: #166534;
      border-color: #bbf7d0;
    }

    .bc-tag-blue {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .bc-tag-orange {
      background: #fef3c7;
      color: #92400e;
      border-color: #fde68a;
    }

    .bc-tag-red {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .bc-tag-violet {
      background: #ede9fe;
      color: #6d28d9;
      border-color: #ddd6fe;
    }
  `]
})
export class BatchCardComponent {
  @ContentChild('[batchCardTopRight]', { read: ElementRef }) projectedTopRight?: ElementRef;

  @Input() title = '';
  @Input() subtitle: string | null = null;
  @Input() icon = 'folder';
  @Input() tag: BatchCardTagConfig | null = null;
  @Input() tags: BatchCardTagConfig[] | null = null;
  @Input() active = false;
  @Input() muted = false;
  @Input() iconMuted = false;
  @Input() clickable = true;

  @Output() cardClick = new EventEmitter<void>();

  get hasProjectedTopRight(): boolean {
    return !!this.projectedTopRight;
  }

  get displayTags(): BatchCardTagConfig[] {
    if (this.tags?.length) {
      return this.tags;
    }
    return this.tag ? [this.tag] : [];
  }

  resolveTagColor(tag: BatchCardTagConfig): BatchCardTagColor {
    return tag.color || 'gray';
  }

  handleClick() {
    if (!this.clickable) return;
    this.cardClick.emit();
  }
}
