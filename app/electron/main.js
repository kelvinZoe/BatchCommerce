const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../src/assets/icon.png')
  });

  // Load the Angular app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:4300');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/shakhis-commerce/browser/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers (dialogs only — DB is now Supabase)
function setupIpcHandlers() {
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    if (result.canceled) return null;
    return result.filePath;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
