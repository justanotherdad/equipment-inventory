// Web API client - uses fetch to communicate with the backend server

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  equipmentTypes: {
    getAll: () => request('/api/equipment-types'),
    create: (data: { name: string; requires_calibration: boolean; calibration_frequency_months?: number }) =>
      request('/api/equipment-types', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; requires_calibration: boolean; calibration_frequency_months: number | null }>) =>
      request(`/api/equipment-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/api/equipment-types/${id}`, { method: 'DELETE' }),
  },
  equipment: {
    getAll: () => request('/api/equipment'),
    getById: (id: number) => request(`/api/equipment/${id}`),
    getByBarcode: (barcode: string) => request(`/api/equipment/barcode/${encodeURIComponent(barcode)}`),
    getCalibrationStatus: () => request('/api/equipment/calibration-status'),
    create: (data: object) => request('/api/equipment', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: object) => request(`/api/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/api/equipment/${id}`, { method: 'DELETE' }),
  },
  signOuts: {
    getAll: () => request('/api/sign-outs'),
    getActive: () => request('/api/sign-outs/active'),
    getByEquipment: (equipmentId: number) => request(`/api/sign-outs/equipment/${equipmentId}`),
    getActiveByEquipmentId: (equipmentId: number) => request(`/api/sign-outs/active/equipment/${equipmentId}`),
    create: (data: object) => request('/api/sign-outs', { method: 'POST', body: JSON.stringify(data) }),
    checkIn: (id: number, data: { signed_in_by: string }) =>
      request(`/api/sign-outs/${id}/check-in`, { method: 'POST', body: JSON.stringify(data) }),
  },
  calibrationRecords: {
    getByEquipment: (equipmentId: number) => request(`/api/calibration-records/equipment/${equipmentId}`),
    add: async (equipmentId: number, file: File) => {
      const form = new FormData();
      form.append('pdf', file);
      await request(`/api/calibration-records/equipment/${equipmentId}`, {
        method: 'POST',
        body: form,
      });
    },
    delete: (id: number) => request(`/api/calibration-records/${id}`, { method: 'DELETE' }),
    getDownloadUrl: (id: number) => `${API_BASE}/api/calibration-records/${id}/download`,
  },
  usage: {
    getBySignOut: (signOutId: number) => request(`/api/usage/sign-out/${signOutId}`),
    add: (data: { sign_out_id: number; system_equipment: string; notes?: string }) =>
      request('/api/usage', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number) => request(`/api/usage/${id}`, { method: 'DELETE' }),
  },
};
