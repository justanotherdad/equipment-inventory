/// <reference types="vite/client" />

interface Window {
  api: {
    equipmentTypes: {
      getAll: () => Promise<unknown[]>;
      create: (data: object) => Promise<unknown>;
      update: (id: number, data: object) => Promise<unknown>;
      delete: (id: number) => Promise<unknown>;
    };
    equipment: {
      getAll: () => Promise<unknown[]>;
      getById: (id: number) => Promise<unknown>;
      getByBarcode: (barcode: string) => Promise<unknown>;
      create: (data: object) => Promise<unknown>;
      update: (id: number, data: object) => Promise<unknown>;
      delete: (id: number) => Promise<unknown>;
      getCalibrationStatus: () => Promise<unknown[]>;
    };
    signOuts: {
      getAll: () => Promise<unknown[]>;
      getActive: () => Promise<unknown[]>;
      getByEquipment: (equipmentId: number) => Promise<unknown[]>;
      getActiveByEquipmentId: (equipmentId: number) => Promise<unknown>;
      create: (data: object) => Promise<unknown>;
      checkIn: (id: number, data: object) => Promise<unknown>;
    };
    calibrationRecords: {
      getByEquipment: (equipmentId: number) => Promise<unknown[]>;
      add: (equipmentId: number, filePath: string) => Promise<unknown>;
      delete: (id: number) => Promise<unknown>;
      getPath: () => Promise<string>;
    };
    usage: {
      getBySignOut: (signOutId: number) => Promise<unknown[]>;
      add: (data: object) => Promise<unknown>;
      remove: (id: number) => Promise<unknown>;
    };
    dialog: {
      openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
    };
    shell: {
      openPath: (path: string) => Promise<string>;
    };
  };
}
