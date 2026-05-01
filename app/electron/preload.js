const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options)
  }
});
