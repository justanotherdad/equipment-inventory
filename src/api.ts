// Web API client - uses fetch to communicate with the backend server

const API_BASE = import.meta.env.VITE_API_URL || '';

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> ?? {}),
    ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  auth: {
    getProfile: () => request<{ id: number; auth_user_id: string; email: string; display_name: string | null; phone: string | null; role: 'user' | 'equipment_manager' | 'admin' }>('/api/auth/me'),
  },
  admin: {
    getProfiles: () => request<{ id: number; email: string; display_name: string | null; role: string }[]>('/api/admin/profiles'),
    updateProfileRole: (id: number, role: 'user' | 'equipment_manager' | 'admin') =>
      request(`/api/admin/profiles/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    getProfileAccess: (id: number) =>
      request<{ site_id: number; department_id: number | null; site_name?: string; department_name?: string }[]>(`/api/admin/profiles/${id}/access`),
    setProfileAccess: (id: number, access: { site_id: number; department_id?: number | null }[]) =>
      request(`/api/admin/profiles/${id}/access`, { method: 'PUT', body: JSON.stringify({ access }) }),
    getSites: () => request<{ id: number; name: string }[]>('/api/admin/sites'),
    createSite: (name: string) => request('/api/admin/sites', { method: 'POST', body: JSON.stringify({ name }) }),
    getDepartments: () => request<{ id: number; site_id: number; name: string; site_name?: string }[]>('/api/admin/departments'),
    createDepartment: (siteId: number, name: string) =>
      request('/api/admin/departments', { method: 'POST', body: JSON.stringify({ site_id: siteId, name }) }),
  },
  departments: {
    getAll: () => request<{ id: number; site_id: number; name: string; site_name?: string }[]>('/api/departments'),
  },
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
    getAll: () => request('/api/calibration-records'),
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
  equipmentRequests: {
    getAll: (status?: 'pending' | 'approved' | 'rejected') =>
      request(`/api/equipment-requests${status ? `?status=${status}` : ''}`),
    create: (data: {
      equipment_id: number;
      requester_name: string;
      requester_email: string;
      requester_phone: string;
      building: string;
      equipment_number_to_test: string;
      date_from: string;
      date_to: string;
    }) => request('/api/equipment-requests', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: number, reviewedBy: string) =>
      request(`/api/equipment-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ reviewed_by: reviewedBy }) }),
    reject: (id: number, reviewedBy: string, comment?: string) =>
      request(`/api/equipment-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reviewed_by: reviewedBy, comment }) }),
  },
};
