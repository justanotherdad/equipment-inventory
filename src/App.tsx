import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './App.css';
import { LayoutDashboard, Package, ClipboardList, CalendarCheck, Settings, Menu, Send, Inbox, Shield, Download, LogOut, Key } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { api } from './api';
import CompanyAdminOnboarding from './components/CompanyAdminOnboarding';
import ChangePasswordModal from './components/ChangePasswordModal';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import Dashboard from './pages/Dashboard';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetail from './pages/EquipmentDetail';
import SignOuts from './pages/SignOuts';
import CalibrationStatus from './pages/CalibrationStatus';
import EquipmentTypes from './pages/EquipmentTypes';
import RequestEquipment from './pages/RequestEquipment';
import RequestQueue from './pages/RequestQueue';
import Admin from './pages/Admin';
import CalibrationDownloads from './pages/CalibrationDownloads';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/equipment', icon: Package, label: 'Equipment' },
  { to: '/request', icon: Send, label: 'Request Equipment' },
  { to: '/requests', icon: Inbox, label: 'Request Queue' },
  { to: '/sign-outs', icon: ClipboardList, label: 'Sign-outs' },
  { to: '/calibration', icon: CalendarCheck, label: 'Calibration Status' },
  { to: '/calibration-downloads', icon: Download, label: 'Download Cal Certs' },
  { to: '/settings', icon: Settings, label: 'Equipment Types' },
  { to: '/admin', icon: Shield, label: 'Admin' },
];

function ProtectedLayout() {
  const { profile, loading, signOut, refreshProfile } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<{ needsOnboarding: boolean } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (profile?.role === 'company_admin') {
      api.admin.getOnboardingStatus()
        .then(setOnboardingStatus)
        .catch(() => setOnboardingStatus({ needsOnboarding: true }));
    } else {
      setOnboardingStatus(null);
    }
  }, [profile?.role]);

  if (loading) {
    return (
      <div className="app-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const showOnboarding = profile.role === 'company_admin' && onboardingStatus?.needsOnboarding;
  if (showOnboarding) {
    return (
      <div className="app-layout" style={{ alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
          <CompanyAdminOnboarding
            onComplete={async () => {
              await refreshProfile();
              setOnboardingStatus({ needsOnboarding: false });
            }}
          />
        </main>
      </div>
    );
  }

  const filteredNavItems = (profile.role === 'super_admin' || profile.role === 'company_admin')
    ? navItems
    : (profile.role === 'equipment_manager'
      ? navItems.map((item) => item.to === '/admin' ? { ...item, label: 'Create User' } : item)
      : navItems.filter((item) => item.to !== '/admin'));

  return (
    <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <Package size={28} />
            <h1>Equipment Inventory</h1>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setNavOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
          </div>
          <nav className={`sidebar-nav ${navOpen ? '' : 'collapsed'}`}>
            {filteredNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              className="nav-item"
              onClick={() => setShowChangePassword(true)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              <Key size={20} />
              <span>Change password</span>
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => signOut()}
              style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              <LogOut size={20} />
              <span>Sign out</span>
            </button>
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: 'auto' }}>
              {profile.email}
            </div>
          </nav>
        </aside>
        {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/request" element={<RequestEquipment />} />
            <Route path="/requests" element={<RequestQueue />} />
            <Route path="/sign-outs" element={<SignOuts />} />
            <Route path="/calibration" element={<CalibrationStatus />} />
            <Route path="/calibration-downloads" element={<CalibrationDownloads />} />
            <Route path="/settings" element={<EquipmentTypes />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
