import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'shakhis_primary_color';
  readonly DEFAULT_COLOR = '#6366f1';

  get primaryColor(): string {
    return localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_COLOR;
  }

  /** Apply saved (or provided) color to :root CSS variables */
  applyTheme(hex?: string) {
    const color = hex || this.primaryColor;
    const hsl = this.hexToHsl(color);
    const dark  = this.hslToHex(hsl.h, hsl.s, Math.max(0,  hsl.l - 12));
    const light = this.hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 12));
    const rgb   = this.hexToRgb(color);
    const rgbaStr = rgb ? `${rgb.r},${rgb.g},${rgb.b}` : '99,102,241';

    const r = document.documentElement;
    r.style.setProperty('--primary-color',  color);
    r.style.setProperty('--primary-dark',   dark);
    r.style.setProperty('--primary-light',  light);
    r.style.setProperty('--primary-rgb',    rgbaStr);
  }

  /** Persist and apply */
  savePrimaryColor(hex: string) {
    localStorage.setItem(this.STORAGE_KEY, hex);
    this.applyTheme(hex);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res ? { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) } : null;
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 50 };
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToHex(h: number, s: number, l: number): string {
    h /= 360; s /= 100; l /= 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
