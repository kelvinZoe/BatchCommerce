import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="ss-root" [class.ss-disabled]="disabled" [class.ss-open]="isOpen">
      <button
        type="button"
        class="ss-trigger"
        #triggerBtn
        (click)="toggle()"
        [disabled]="disabled">
        <span class="material-icons ss-trigger-icon">{{ isOpen ? 'search' : 'expand_circle_down' }}</span>
        <span class="ss-trigger-label" [class.ss-placeholder]="!selectedLabel">
          {{ selectedLabel || placeholder }}
        </span>
        <span class="material-icons ss-chevron" [class.ss-chevron-open]="isOpen">expand_more</span>
      </button>

      <div class="ss-dropdown" *ngIf="isOpen"
           [style.position]="'fixed'"
           [style.top.px]="dropTop"
           [style.left.px]="dropLeft"
           [style.width.px]="dropWidth">
        <div class="ss-search-row">
          <span class="material-icons ss-search-ico">search</span>
          <input
            #searchInput
            class="ss-search"
            type="text"
            [(ngModel)]="searchTerm"
            [placeholder]="searchPlaceholder"
            (ngModelChange)="onSearchInput()"
            (keydown)="onKeydown($event)"
          />
        </div>
        <div class="ss-options">
          <button
            type="button"
            class="ss-option"
            *ngFor="let item of filteredItems"
            [class.ss-option-active]="isSelected(item)"
            (click)="selectItem(item)">
            <span class="ss-option-check material-icons" *ngIf="isSelected(item)">check</span>
            <span class="ss-option-check ss-option-check-empty" *ngIf="!isSelected(item)"></span>
            {{ item[labelKey] }}
          </button>
          <div class="ss-no-results" *ngIf="filteredItems.length === 0">
            <span class="material-icons">search_off</span>
            {{ noResultsText }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ss-root {
      position: relative;
      width: 100%;
      font-size: 13px;
    }

    /* Trigger button */
    .ss-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 9px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      color: #1e293b;
      transition: border-color 0.13s, box-shadow 0.13s;
      text-align: left;
    }
    .ss-root.ss-open .ss-trigger {
      border-color: var(--primary-light,#a5b4fc);
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb,99,102,241), 0.15);
    }
    .ss-trigger:hover:not(:disabled) {
      border-color: var(--primary-light,#a5b4fc);
    }
    .ss-trigger:disabled {
      cursor: not-allowed;
      background: #f8fafc;
      color: #94a3b8;
    }
    .ss-trigger-icon { font-size: 17px; color: #94a3b8; flex-shrink: 0; }
    .ss-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ss-placeholder { color: #94a3b8; }
    .ss-chevron { font-size: 18px; color: #94a3b8; flex-shrink: 0; transition: transform 0.18s; }
    .ss-chevron-open { transform: rotate(180deg); }

    /* Dropdown */
    .ss-dropdown {
      position: fixed;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      z-index: 99999;
      overflow: hidden;
    }

    /* Search row */
    .ss-search-row {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      background: #f8fafc;
    }
    .ss-search-ico { font-size: 17px; color: #94a3b8; margin-right: 6px; flex-shrink: 0; }
    .ss-search {
      flex: 1;
      border: none;
      outline: none;
      font-size: 13px;
      background: transparent;
      color: #1e293b;
    }
    .ss-search::placeholder { color: #94a3b8; }

    /* Options */
    .ss-options {
      max-height: 220px;
      overflow-y: auto;
      padding: 6px 0;
    }
    .ss-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: left;
      border: none;
      background: transparent;
      padding: 9px 14px;
      cursor: pointer;
      font-size: 13px;
      color: #1e293b;
      transition: background 0.1s;
    }
    .ss-option:hover { background: #f1f5f9; }
    .ss-option-active {
      background: rgba(var(--primary-rgb,99,102,241),0.08) !important;
      color: var(--primary-dark,#4f46e5);
      font-weight: 600;
    }
    .ss-option-check { font-size: 15px; color: var(--primary-color,#6366f1); flex-shrink: 0; }
    .ss-option-check-empty { width: 15px; flex-shrink: 0; }

    /* No results */
    .ss-no-results {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 14px;
      font-size: 12px;
      color: #94a3b8;
    }
    .ss-no-results .material-icons { font-size: 17px; }

    /* Disabled */
    .ss-disabled { opacity: 0.55; pointer-events: none; }
  `]
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() items: Array<Record<string, any>> = [];
  @Input() labelKey = 'name';
  @Input() valueKey = 'id';
  @Input() placeholder = '-- Select --';
  @Input() searchPlaceholder = 'Search...';
  @Input() noResultsText = 'No results';
  @Input() disabled = false;
  @Output() searchChange = new EventEmitter<string>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerBtn') triggerBtn?: ElementRef<HTMLButtonElement>;

  isOpen = false;
  searchTerm = '';
  dropTop = 0;
  dropLeft = 0;
  dropWidth = 200;
  private value: any = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>, private cdr: ChangeDetectorRef) {}

  get selectedLabel(): string {
    const selected = this.items.find(item => String(item[this.valueKey]) === String(this.value));
    return selected ? String(selected[this.labelKey] ?? '') : '';
  }

  get filteredItems() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.items;
    return this.items.filter(item => String(item[this.labelKey] ?? '').toLowerCase().includes(term));
  }

  writeValue(value: any): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle() {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
      this.emitSearchChange();
      const rect = this.triggerBtn?.nativeElement.getBoundingClientRect();
      if (rect) {
        this.dropTop = rect.bottom + 6;
        this.dropLeft = rect.left;
        this.dropWidth = rect.width;
        this.cdr.detectChanges();
      }
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    } else {
      this.onTouched();
    }
  }

  selectItem(item: Record<string, any>) {
    this.value = item[this.valueKey];
    this.onChange(this.value);
    this.close();
  }

  onSearchInput() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.emitSearchChange(), 200);
  }

  private emitSearchChange() {
    this.searchChange.emit(this.searchTerm.trim());
  }

  isSelected(item: Record<string, any>): boolean {
    return String(item[this.valueKey]) === String(this.value);
  }

  close() {
    this.isOpen = false;
    this.searchTerm = '';
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
