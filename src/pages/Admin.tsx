import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminWorkspace from '../components/admin/AdminWorkspace';

/** Company Admin + Equipment Manager admin surface (not Super Admin). */
export default function Admin() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'super_admin') return <Navigate to="/platform" replace />;
  if (profile.role !== 'company_admin' && profile.role !== 'equipment_manager') {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminWorkspace mode="company" />;
}
