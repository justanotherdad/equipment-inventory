import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AdminWorkspace from '../components/admin/AdminWorkspace';

/** Super Admin–only platform management (companies, subscriptions, per-company admin). */
export default function Platform() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role !== 'super_admin') return <Navigate to="/dashboard" replace />;

  return <AdminWorkspace mode="platform" />;
}
