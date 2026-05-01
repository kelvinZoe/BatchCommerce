import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownComponent } from '../dropdown/dropdown.component';

@Component({
  selector: 'app-date-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DropdownComponent],
  template: `
    <app-dropdown #dd icon="calendar_today" [label]="presetLabel" [active]="preset !== 'all'">
      <ul class="df-list">
        <li *ngFor="let opt of options"
            class="df-item"
            [class.df-item-active]="preset === opt.value"
            (click)="selectPreset(opt.value)">
          <span class="material-icons df-check">check</span>
          {{ opt.label }}
        </li>
      </ul>
    </app-dropdown>

    <!-- Inline date input — shown only when Custom is active -->
    <div class="df-inline-input" *ngIf="preset === 'custom'">
      <label>Date</label>
      <input type="date" [ngModel]="from" (ngModelChange)="onManual($event)" />
    </div>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    .df-list { list-style: none; margin: 0; padding: 0; }

    .df-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: #334155;
      cursor: pointer; transition: background 0.12s, color 0.12s;
    }
    .df-item:hover { background: rgba(var(--primary-rgb, 99,102,241), 0.07); color: var(--primary-color, #6366f1); }
    .df-item-active { color: var(--primary-color, #6366f1); font-weight: 700; }

    .df-check { font-size: 16px; color: var(--primary-color, #6366f1); visibility: hidden; flex-shrink: 0; }
    .df-item-active .df-check { visibility: visible; }

    /* Inline date inputs */
    .df-inline-input { display: flex; align-items: center; gap: 6px; }
    .df-inline-input label { font-size: 11px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
    .df-inline-input input[type="date"] {
      padding: 7px 10px; border: 1px solid #ccc; border-radius: 9px;
      font-size: 12px; color: #334155; background: #f8fafc;
      transition: border-color 0.13s; cursor: pointer;
    }
    .df-inline-input input[type="date"]:focus { outline: none; border-color: var(--primary-light, #a5b4fc); box-shadow: 0 0 0 3px rgba(var(--primary-rgb,99,102,241),0.12); }
  `]
})
export class DateFilterComponent {
  @Input() mode: 'range' | 'single' = 'range';
  @Output() dateChange = new EventEmitter<{ from: string; to: string }>();

  @ViewChild('dd') dd?: DropdownComponent;

  preset = 'all';
  from = '';
  to = '';

  readonly options = [
    { value: 'all',     label: 'All Time'    },
    { value: 'today',   label: 'Today'       },
    { value: 'week',    label: 'This Week'   },
    { value: 'month',   label: 'This Month'  },
    { value: 'quarter', label: 'This Quarter'},
    { value: 'year',    label: 'This Year'   },
    { value: 'custom',  label: 'Custom'      },
  ];

  get presetLabel(): string {
    return this.options.find(o => o.value === this.preset)?.label ?? 'All Time';
  }

  selectPreset(value: string) {
    this.preset = value;
    if (value !== 'custom') {
      this.applyPreset();
      this.dd?.close();
    }
  }

  private applyPreset() {
    const today = new Date();
    switch (this.preset) {
      case 'today':
        this.from = this.fmt(today);
        this.to   = this.fmt(today);
        break;
      case 'week': {
        const day  = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        this.from  = this.fmt(new Date(today.getFullYear(), today.getMonth(), diff));
        this.to    = this.fmt(today);
        break;
      }
      case 'month':
        this.from = this.fmt(new Date(today.getFullYear(), today.getMonth(), 1));
        this.to   = this.fmt(today);
        break;
      case 'quarter': {
        const qMonth = Math.floor(today.getMonth() / 3) * 3;
        this.from = this.fmt(new Date(today.getFullYear(), qMonth, 1));
        this.to   = this.fmt(today);
        break;
      }
      case 'year':
        this.from = this.fmt(new Date(today.getFullYear(), 0, 1));
        this.to   = this.fmt(today);
        break;
      default:
        this.from = '';
        this.to   = '';
    }
    this.dateChange.emit({ from: this.from, to: this.to });
  }

  onManual(date: string) {
    this.from   = date;
    this.to     = date; // single date — both ends the same
    this.preset = 'custom';
    this.dateChange.emit({ from: this.from, to: this.to });
  }

  private fmt(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}
