import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { BatchCardTagColor } from '../batch-card/batch-card.component';

export type StatCardColor = 'base' | BatchCardTagColor;

export interface StatCardConfig {
  icon: string;
  statName: string;
  statValue: string | number;
  color?: StatCardColor;
}

@Component({
  selector: 'app-stat-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sc-grid" *ngIf="config?.length">
      <div class="sc-card" *ngFor="let card of config; trackBy: trackByLabel">
        <span class="material-icons sc-icon" [ngClass]="'sc-icon-' + resolveColor(card)">{{ card.icon }}</span>
        <div class="sc-copy">
          <div class="sc-name">{{ card.statName }}</div>
          <div class="sc-value">{{ card.statValue }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sc-grid {
      display: flex;
      align-items: stretch;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 0 8px;
    }

    .sc-card {
      min-width: 150px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid #dbe3ee;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .sc-icon {
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 1px solid transparent;
      flex-shrink: 0;
    }

    .sc-copy {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }

    .sc-name {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      line-height: 1.1;
    }

    .sc-value {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
    }

    .sc-icon-base {
      background: rgba(var(--primary-rgb, 99,102,241), 0.12);
      color: var(--primary-color, #6366f1);
      border-color: rgba(var(--primary-rgb, 99,102,241), 0.15);
    }

    .sc-icon-gray {
      background: #f3f4f6;
      color: #4b5563;
      border-color: #d1d5db;
    }

    .sc-icon-green {
      background: #dcfce7;
      color: #166534;
      border-color: #bbf7d0;
    }

    .sc-icon-blue {
      background: #dbeafe;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .sc-icon-orange {
      background: #fef3c7;
      color: #92400e;
      border-color: #fde68a;
    }

    .sc-icon-red {
      background: #fee2e2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .sc-icon-violet {
      background: #ede9fe;
      color: #6d28d9;
      border-color: #ddd6fe;
    }
  `]
})
export class StatCardsComponent {
  @Input() config: StatCardConfig[] = [];

  resolveColor(card: StatCardConfig): StatCardColor {
    return card.color || 'base';
  }

  trackByLabel(index: number, card: StatCardConfig): string {
    return `${card.statName}-${index}`;
  }
}
