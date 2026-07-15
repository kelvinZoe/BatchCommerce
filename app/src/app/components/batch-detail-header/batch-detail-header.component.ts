import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BatchCardTagColor } from '../batch-card/batch-card.component';

export interface BatchDetailHeaderTagConfig {
  label: string;
  color?: BatchCardTagColor;
  icon?: string;
}

@Component({
  selector: 'app-batch-detail-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bdh-header">
      <button class="bdh-back-btn" type="button" (click)="backClick.emit()">
        <span class="material-icons">arrow_back</span>
        {{ backLabel }}
      </button>

      <div class="bdh-title-group">
        <div class="bdh-batch-icon">
          <span class="material-icons">{{ icon }}</span>
        </div>
        <div class="bdh-copy">
          <div class="bdh-title-row">
            <div class="bdh-title">{{ title }}</div>
            <span *ngIf="tag" class="bdh-tag" [ngClass]="'bdh-tag-' + resolveTagColor(tag)">
              <span *ngIf="tag.icon" class="material-icons">{{ tag.icon }}</span>
              {{ tag.label }}
            </span>
          </div>
          <div class="bdh-subtitle" *ngIf="subtitle">{{ subtitle }}</div>
        </div>
      </div>

      <div class="bdh-actions">
        <ng-content select="[batchDetailHeaderAction]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .bdh-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color, #d7dde6);
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .bdh-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      border: 1px solid #d7dde6;
      background: #fff;
      color: #475569;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.15s;
    }

    .bdh-back-btn:hover {
      border-color: var(--primary-light, #c4b5fd);
      transform: translateY(-1px);
    }

    .bdh-back-btn .material-icons {
      font-size: 18px;
    }

    .bdh-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .bdh-batch-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(var(--primary-rgb, 99,102,241), 0.12);
      color: var(--primary-color, #6366f1);
      border: 1px solid rgba(var(--primary-rgb, 99,102,241), 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .bdh-batch-icon .material-icons {
      font-size: 20px;
    }

    .bdh-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .bdh-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bdh-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bdh-subtitle {
      font-size: 12px;
      color: #64748b;
    }

    .bdh-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .bdh-tag .material-icons {
      font-size: 14px;
    }

    .bdh-tag-gray {
      background: #f3f4f6;
      color: #4b5563;
      border-color: #d1d5db;
    }

    .bdh-tag-green {
      background: #dcfce7;
      color: #166534;
      border-color: #bbf7d0;
    }

    .bdh-tag-blue {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .bdh-tag-orange {
      background: #fef3c7;
      color: #92400e;
      border-color: #fde68a;
    }

    .bdh-tag-red {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .bdh-tag-violet {
      background: #ede9fe;
      color: #6d28d9;
      border-color: #ddd6fe;
    }

    .bdh-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bdh-actions:empty {
      display: none;
    }

    @media (max-width: 720px) {
      .bdh-header {
        align-items: stretch;
      }

      .bdh-back-btn,
      .bdh-actions {
        width: 100%;
      }

      .bdh-actions {
        justify-content: flex-end;
        margin-left: 0;
      }
    }
  `]
})
export class BatchDetailHeaderComponent {
  @Input() backLabel = 'Back';
  @Input() title = '';
  @Input() subtitle: string | null = null;
  @Input() icon = 'folder';
  @Input() tag: BatchDetailHeaderTagConfig | null = null;

  @Output() backClick = new EventEmitter<void>();

  resolveTagColor(tag: BatchDetailHeaderTagConfig): BatchCardTagColor {
    return tag.color || 'gray';
  }
}
