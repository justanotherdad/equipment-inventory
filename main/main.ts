import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { Database } from './database';

let mainWindow: BrowserWindow | null = null;
let db: Database;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'equipment-inventory.db');
  const calRecordsPath = path.join(userDataPath, 'calibration-records');
  
  db = new Database(dbPath, calRecordsPath);
  db.initialize();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers - Equipment Types
ipcMain.handle('equipment-types:getAll', () => db.getEquipmentTypes());
ipcMain.handle('equipment-types:create', (_, data) => db.createEquipmentType(data));
ipcMain.handle('equipment-types:update', (_, id, data) => db.updateEquipmentType(id, data));
ipcMain.handle('equipment-types:delete', (_, id) => db.deleteEquipmentType(id));

// IPC Handlers - Equipment
ipcMain.handle('equipment:getAll', () => db.getAllEquipment());
ipcMain.handle('equipment:getById', (_, id) => db.getEquipmentById(id));
ipcMain.handle('equipment:getByBarcode', (_, barcode) => db.getEquipmentByBarcode(barcode));
ipcMain.handle('equipment:create', (_, data) => db.createEquipment(data));
ipcMain.handle('equipment:update', (_, id, data) => db.updateEquipment(id, data));
ipcMain.handle('equipment:delete', (_, id) => db.deleteEquipment(id));
ipcMain.handle('equipment:getCalibrationStatus', () => db.getCalibrationStatus());

// IPC Handlers - Sign-outs
ipcMain.handle('signouts:getAll', () => db.getAllSignOuts());
ipcMain.handle('signouts:getActive', () => db.getActiveSignOuts());
ipcMain.handle('signouts:getByEquipment', (_, equipmentId) => db.getSignOutsByEquipment(equipmentId));
ipcMain.handle('signouts:getActiveByEquipmentId', (_, equipmentId) => db.getActiveSignOutByEquipmentId(equipmentId));
ipcMain.handle('signouts:create', (_, data) => db.createSignOut(data));
ipcMain.handle('signouts:checkIn', (_, id, data) => db.checkInSignOut(id, data));

// IPC Handlers - Calibration Records
ipcMain.handle('calibration-records:getByEquipment', (_, equipmentId) => db.getCalibrationRecords(equipmentId));
ipcMain.handle('calibration-records:add', (_, equipmentId, filePath) => db.addCalibrationRecord(equipmentId, filePath));
ipcMain.handle('calibration-records:delete', (_, id) => db.deleteCalibrationRecord(id));
ipcMain.handle('calibration-records:getPath', () => db.getCalRecordsPath());

// IPC Handlers - Usage (equipment used on systems)
ipcMain.handle('usage:getBySignOut', (_, signOutId) => db.getUsageBySignOut(signOutId));
ipcMain.handle('usage:add', (_, data) => db.addUsage(data));
ipcMain.handle('usage:remove', (_, id) => db.removeUsage(id));

// IPC Handlers - Dialog & Shell
ipcMain.handle('dialog:openFile', async (_, filters?: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: filters ?? [{ name: 'PDF', extensions: ['pdf'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('shell:openPath', (_, filePath: string) => shell.openPath(filePath));
