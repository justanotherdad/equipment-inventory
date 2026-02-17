// Web API client - uses fetch to communicate with the backend server

const API_BASE = import.meta.env.VITE_API_URL || '';

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Fetch a URL with auth header (for endpoints that require it, e.g. file downloads) */
export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(options?.headers as Record<string, string> ?? {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...options, headers });
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
  setAuthToken,
  auth: {
    getProfile: () => request<{ id: number; auth_user_id: string; email: string; display_name: string | null; phone: string | null; role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin' }>('/api/auth/me'),
  },
  admin: {
    getProfiles: () => request<{ id: number; email: string; display_name: string | null; role: string; company_name?: string | null }[]>('/api/admin/profiles'),
    updateProfileRole: (id: number, role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin') =>
      request(`/api/admin/profiles/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateProfile: (id: number, data: { display_name?: string | null; email?: string; company_id?: number | null }) =>
      request(`/api/admin/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProfile: (id: number) => request(`/api/admin/profiles/${id}`, { method: 'DELETE' }),
    getProfileAccess: (id: number) =>
      request<{ site_id: number; department_id: number | null; equipment_id?: number | null; site_name?: string; department_name?: string }[]>(`/api/admin/profiles/${id}/access`),
    setProfileAccess: (id: number, access: { site_id: number; department_id?: number | null; equipment_id?: number | null }[]) =>
      request(`/api/admin/profiles/${id}/access`, { method: 'PUT', body: JSON.stringify({ access }) }),
    getSites: () => request<{ id: number; name: string; company_id?: number | null; company_name?: string | null }[]>('/api/admin/sites'),
    createSite: (name: string, companyId?: number) =>
      request('/api/admin/sites', { method: 'POST', body: JSON.stringify({ name, company_id: companyId }) }),
    updateSite: (id: number, data: { name: string; company_id?: number | null }) =>
      request(`/api/admin/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSite: (id: number) => request(`/api/admin/sites/${id}`, { method: 'DELETE' }),
    getDepartments: () => request<{ id: number; site_id: number; name: string; site_name?: string; company_name?: string | null }[]>('/api/admin/departments'),
    createDepartment: (siteId: number, name: string) =>
      request('/api/admin/departments', { method: 'POST', body: JSON.stringify({ site_id: siteId, name }) }),
    updateDepartment: (id: number, data: { name: string; site_id: number }) =>
      request(`/api/admin/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDepartment: (id: number) => request(`/api/admin/departments/${id}`, { method: 'DELETE' }),
    createUser: (email: string, password: string, access?: { site_id: number; department_id?: number | null; equipment_id?: number | null }[], role?: string, companyId?: number) =>
      request('/api/admin/users', { method: 'POST', body: JSON.stringify({ email, password, access: access ?? [], role, company_id: companyId }) }),
    getCompanies: () => request<{ id: number; name: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null; subscription_level: number; subscription_active: boolean; subscription_activated_at: string | null }[]>('/api/admin/companies'),
    getCompany: (id: number) => request<{ id: number; name: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null }>(`/api/admin/companies/${id}`),
    getOnboardingStatus: () => request<{ needsOnboarding: boolean }>('/api/admin/onboarding-status'),
    completeOnboarding: () => request('/api/admin/onboarding-complete', { method: 'POST' }),
    updateCompany: (id: number, data: { name?: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null; subscription_level?: number; subscription_active?: boolean }) =>
      request(`/api/admin/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    createCompany: (data: { name: string; contact_email?: string; contact_name?: string; create_admin?: boolean; admin_email?: string; admin_password?: string }) =>
      request<{ id?: number }>('/api/admin/companies', { method: 'POST', body: JSON.stringify(data) }),
    updateCompanySubscription: (id: number, subscriptionActive: boolean, subscriptionLevel?: number) =>
      request(`/api/admin/companies/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ subscription_active: subscriptionActive, subscription_level: subscriptionLevel }) }),
    deleteCompany: (id: number) => request(`/api/admin/companies/${id}`, { method: 'DELETE' }),
    closeCompany: (id: number, confirm: string) =>
      request(`/api/admin/companies/${id}/close`, { method: 'POST', body: JSON.stringify({ confirm }) }),
  },
  payments: {
    getOrders: () => request<{ id: number; amount_cents: number; plan_name: string | null; status: string; created_at: string }[]>('/api/payments/orders'),
    process: (data: { sourceId: string; amountCents: number; planName?: string; idempotencyKey?: string }) =>
      request<{ ok: boolean; paymentId?: string }>('/api/payments/process', { method: 'POST', body: JSON.stringify(data) }),
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
    bulkUpdate: (ids: number[], data: object) => request('/api/equipment/bulk', { method: 'PUT', body: JSON.stringify({ ids, ...data }) }),
    delete: (id: number) => request(`/api/equipment/${id}`, { method: 'DELETE' }),
  },
  signOuts: {
    getAll: () => request('/api/sign-outs'),
    getActive: () => request('/api/sign-outs/active'),
    getByEquipment: (equipmentId: number) => request(`/api/sign-outs/equipment/${equipmentId}`),
    getActiveByEquipmentId: (equipmentId: number) => request(`/api/sign-outs/active/equipment/${equipmentId}`),
    getInDateRange: (start: string, end: string) =>
      request(`/api/sign-outs/date-range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    create: (data: object) => request('/api/sign-outs', { method: 'POST', body: JSON.stringify(data) }),
    checkIn: (id: number, data: { signed_in_by: string }) =>
      request(`/api/sign-outs/${id}/check-in`, { method: 'POST', body: JSON.stringify(data) }),
  },
  equipmentTested: {
    getAll: () => request<Array<{ equipment_number_to_test: string; site_name: string | null; building: string | null; room_number: string | null; last_tested_at: string }>>('/api/equipment-tested'),
    getDetail: (equipmentNumber: string) =>
      request<{
        equipment_number_to_test: string;
        tests: Array<{
          sign_out_id: number;
          signed_out_at: string;
          signed_in_at: string | null;
          site_name: string | null;
          building: string | null;
          room_number: string | null;
          equipment_used: Array<{ id: number; make: string; model: string; serial_number: string; equipment_number: string | null }>;
          usage_equipment: string[];
        }>;
      }>(`/api/equipment-tested/${encodeURIComponent(equipmentNumber)}`),
  },
  sites: {
    getAll: () => request<{ id: number; name: string }[]>('/api/sites'),
  },
  checkouts: {
    create: (data: {
      equipment_ids: number[];
      site_id?: number | null;
      building?: string | null;
      room_number?: string | null;
      equipment_number_to_test?: string | null;
      signed_out_by: string;
      purpose?: string | null;
    }) => request<{ checkout_id: number; sign_out_ids: number[] }>('/api/checkouts', { method: 'POST', body: JSON.stringify(data) }),
  },
  calibrationRecords: {
    getAll: () => request('/api/calibration-records'),
    getByEquipment: (equipmentId: number) => request(`/api/calibration-records/equipment/${equipmentId}`),
    add: async (equipmentId: number, file: File, calDate?: string | null, dueDate?: string | null) => {
      const form = new FormData();
      form.append('pdf', file);
      if (calDate) form.append('cal_date', calDate);
      if (dueDate) form.append('due_date', dueDate);
      await request(`/api/calibration-records/equipment/${equipmentId}`, {
        method: 'POST',
        body: form,
      });
    },
    update: (id: number, data: { cal_date?: string | null; due_date?: string | null }) =>
      request(`/api/calibration-records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/api/calibration-records/${id}`, { method: 'DELETE' }),
    getDownloadUrl: (id: number) => `${API_BASE}/api/calibration-records/${id}/download`,
    /** Fetch PDF with auth and open in new tab (avoids "Authentication required" when using direct link) */
    openInNewTab: async (id: number) => {
      const res = await fetchWithAuth(`${API_BASE}/api/calibration-records/${id}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
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
      equipment_id?: number;
      equipment_ids?: number[];
      requester_name: string;
      requester_email: string;
      requester_phone: string;
      site_id?: number | null;
      building: string;
      room_number?: string | null;
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
