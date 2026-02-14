import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  equipmentTypes: {
    getAll: () => ipcRenderer.invoke('equipment-types:getAll'),
    create: (data: { name: string; requires_calibration: boolean; calibration_frequency_months?: number }) =>
      ipcRenderer.invoke('equipment-types:create', data),
    update: (id: number, data: Partial<{ name: string; requires_calibration: boolean; calibration_frequency_months: number | null }>) =>
      ipcRenderer.invoke('equipment-types:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('equipment-types:delete', id),
  },
  equipment: {
    getAll: () => ipcRenderer.invoke('equipment:getAll'),
    getById: (id: number) => ipcRenderer.invoke('equipment:getById', id),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('equipment:getByBarcode', barcode),
    create: (data: object) => ipcRenderer.invoke('equipment:create', data),
    update: (id: number, data: object) => ipcRenderer.invoke('equipment:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('equipment:delete', id),
    getCalibrationStatus: () => ipcRenderer.invoke('equipment:getCalibrationStatus'),
  },
  signOuts: {
    getAll: () => ipcRenderer.invoke('signouts:getAll'),
    getActive: () => ipcRenderer.invoke('signouts:getActive'),
    getByEquipment: (equipmentId: number) => ipcRenderer.invoke('signouts:getByEquipment', equipmentId),
    getActiveByEquipmentId: (equipmentId: number) => ipcRenderer.invoke('signouts:getActiveByEquipmentId', equipmentId),
    create: (data: object) => ipcRenderer.invoke('signouts:create', data),
    checkIn: (id: number, data: { signed_in_by: string }) => ipcRenderer.invoke('signouts:checkIn', id, data),
  },
  calibrationRecords: {
    getByEquipment: (equipmentId: number) => ipcRenderer.invoke('calibration-records:getByEquipment', equipmentId),
    add: (equipmentId: number, filePath: string) => ipcRenderer.invoke('calibration-records:add', equipmentId, filePath),
    delete: (id: number) => ipcRenderer.invoke('calibration-records:delete', id),
    getPath: () => ipcRenderer.invoke('calibration-records:getPath'),
  },
  usage: {
    getBySignOut: (signOutId: number) => ipcRenderer.invoke('usage:getBySignOut', signOutId),
    add: (data: { sign_out_id: number; system_equipment: string; notes?: string }) =>
      ipcRenderer.invoke('usage:add', data),
    remove: (id: number) => ipcRenderer.invoke('usage:remove', id),
  },
  dialog: {
    openFile: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:openFile', filters),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },
});
