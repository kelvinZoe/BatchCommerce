import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { DropdownComponent } from '../dropdown/dropdown.component';

@Component({
  selector: 'app-month-year-picker',
  standalone: true,
  imports: [CommonModule, DropdownComponent],
  template: `
    <app-dropdown
      #picker
      [icon]="icon"
      [label]="displayLabel"
      [active]="selectedMonth !== null"
      (opened)="panelYear = selectedYear ?? currentYear">
      <div class="myp-year-row">
        <button type="button" (click)="panelYear = panelYear - 1">
          <span class="material-icons">chevron_left</span>
        </button>
        <span class="myp-year-label">{{ panelYear }}</span>
        <button type="button" (click)="panelYear = panelYear + 1" [disabled]="panelYear >= currentYear">
          <span class="material-icons">chevron_right</span>
        </button>
      </div>

      <div class="myp-months">
        <button
          type="button"
          *ngFor="let month of monthNames; let i = index"
          class="myp-month"
          [class.myp-month-active]="selectedMonth === i && selectedYear === panelYear"
          (click)="selectMonth(i)">
          {{ month.substring(0, 3) }}
        </button>
      </div>

      <div class="myp-footer" *ngIf="selectedMonth !== null">
        <button type="button" class="myp-clear" (click)="clearSelection()">
          <span class="material-icons">close</span> Clear filter
        </button>
      </div>
    </app-dropdown>
  `,
  styles: [`
    .myp-year-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .myp-year-row button {
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      padding: 2px;
      border-radius: 6px;
      display: flex;
    }

    .myp-year-row button:hover:not(:disabled) {
      background: #f1f5f9;
    }

    .myp-year-row button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .myp-year-label {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .myp-months {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }

    .myp-month {
      padding: 7px 4px;
      border: none;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      background: transparent;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }

    .myp-month:hover {
      background: rgba(var(--primary-rgb, 99,102,241), 0.08);
      color: var(--primary-color, #6366f1);
    }

    .myp-month-active {
      background: var(--primary-color, #6366f1) !important;
      color: #fff !important;
    }

    .myp-footer {
      margin-top: 10px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }

    .myp-clear {
      background: none;
      border: none;
      color: #64748b;
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .myp-clear:hover {
      color: #ef4444;
    }
  `]
})
export class MonthYearPickerComponent {
  @Input() selectedMonth: number | null = null;
  @Input() selectedYear: number | null = null;
  @Input() currentYear = new Date().getFullYear();
  @Input() placeholder = 'All time';
  @Input() icon = 'calendar_month';

  @Output() selectionChange = new EventEmitter<{ month: number | null; year: number | null }>();

  @ViewChild('picker') picker?: DropdownComponent;

  panelYear = new Date().getFullYear();
  readonly monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  get displayLabel(): string {
    if (this.selectedMonth === null || this.selectedYear === null) {
      return this.placeholder;
    }
    return `${this.monthNames[this.selectedMonth].substring(0, 3)} ${this.selectedYear}`;
  }

  selectMonth(month: number) {
    this.selectionChange.emit({ month, year: this.panelYear });
    this.picker?.close();
  }

  clearSelection() {
    this.selectionChange.emit({ month: null, year: null });
    this.picker?.close();
  }
}
