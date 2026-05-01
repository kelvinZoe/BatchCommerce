import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  isElectron(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI;
  }

  async openFile(options?: any): Promise<string | null> {
    if (!this.isElectron()) return null;
    try {
      return await (window as any).electronAPI.dialog.openFile(options);
    } catch (err) {
      console.warn('Electron openFile failed', err);
      return null;
    }
  }

  async saveFile(options?: any): Promise<string | null> {
    if (!this.isElectron()) return null;
    try {
      return await (window as any).electronAPI.dialog.saveFile(options);
    } catch (err) {
      console.warn('Electron saveFile failed', err);
      return null;
    }
  }
}
