import { Component, Input, Output, EventEmitter, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Generic dropdown wrapper.
 *
 * Usage:
 *   <app-dropdown icon="calendar_month" [label]="labelText" [active]="hasFilter">
 *     <!-- any content goes here — has full parent scope access -->
 *   </app-dropdown>
 *
 * Inputs:
 *   icon    — optional Material icon name shown before the label
 *   label   — text shown in the trigger button
 *   active  — when true the trigger is highlighted (e.g. a filter is applied)
 *
 * Outputs:
 *   opened  — fires when the panel opens (use to sync state, e.g. year picker)
 *   closed  — fires when the panel closes
 */
@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dd-wrap">
      <button class="dd-trigger" [class.dd-active]="active" (click)="toggle($event)">
        <span *ngIf="icon" class="material-icons dd-icon">{{ icon }}</span>
        <span class="dd-label">{{ label }}</span>
        <span class="material-icons dd-chevron" [class.dd-chevron-open]="isOpen">expand_more</span>
      </button>
      <div *ngIf="isOpen" class="dd-backdrop" (click)="close()"></div>
      <div *ngIf="isOpen" class="dd-panel" [class.dd-panel-right]="anchorRight" (click)="$event.stopPropagation()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }

    .dd-wrap { position: relative; display: inline-block; }

    /* Trigger button */
    .dd-trigger {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 12px; border: 1px solid #ccc; border-radius: 9px;
      background: #f8fafc; font-size: 12px; font-weight: 600; color: #475569;
      cursor: pointer; white-space: nowrap;
      transition: border-color 0.13s, background 0.13s, color 0.13s;
    }
    .dd-trigger:hover { border-color: var(--primary-light, #a5b4fc); }

    /* Active state — a filter is applied */
    .dd-active {
      border-color: var(--primary-color, #6366f1);
      background: rgba(var(--primary-rgb, 99,102,241), 0.06);
      color: var(--primary-color, #6366f1);
    }

    .dd-icon  { font-size: 16px; }
    .dd-label { line-height: 1; }

    .dd-chevron {
      font-size: 16px; color: #94a3b8;
      transition: transform 0.2s;
    }
    .dd-chevron-open { transform: rotate(180deg); }

    /* Backdrop — closes panel on outside click */
    .dd-backdrop { position: fixed; inset: 0; z-index: 99; }

    /* Floating panel */
    .dd-panel {
      position: absolute; top: calc(100% + 6px); left: 0; z-index: 100;
      background: #fff; border: 1px solid #ccc; border-radius: 12px;
      padding: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      min-width: 240px;
    }
    .dd-panel-right { left: auto; right: 0; }
  `]
})
export class DropdownComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() active = false;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  isOpen = false;
  anchorRight = false;

  constructor(private el: ElementRef, private cdr: ChangeDetectorRef) {}

  toggle(e: Event) {
    e.stopPropagation();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.computeAnchor();
      this.opened.emit();
    } else {
      this.closed.emit();
    }
  }

  close() {
    if (this.isOpen) {
      this.isOpen = false;
      this.closed.emit();
    }
  }

  private computeAnchor() {
    // After the panel renders, check if it would overflow the right edge.
    // We estimate using the trigger position + panel min-width (240px).
    requestAnimationFrame(() => {
      const trigger = this.el.nativeElement.querySelector('.dd-trigger') as HTMLElement;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const panelMinWidth = 240;
      const spaceRight = window.innerWidth - rect.left;
      this.anchorRight = spaceRight < panelMinWidth + 16; // 16px breathing room
      this.cdr.markForCheck();
    });
  }
}
