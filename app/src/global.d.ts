declare interface ElectronDialogOptions {
  title?: string;
  defaultPath?: string;
  properties?: string[];
  filters?: Array<{ name: string; extensions: string[] }>;
}

declare interface ElectronAPI {
  dialog: {
    openFile: (options?: ElectronDialogOptions) => Promise<string | null>;
    saveFile: (options?: ElectronDialogOptions) => Promise<string | null>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
