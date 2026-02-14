import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import { LayoutDashboard, Package, ClipboardList, CalendarCheck, Settings, Menu, Send, Inbox, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetail from './pages/EquipmentDetail';
import SignOuts from './pages/SignOuts';
import CalibrationStatus from './pages/CalibrationStatus';
import EquipmentTypes from './pages/EquipmentTypes';
import RequestEquipment from './pages/RequestEquipment';
import RequestQueue from './pages/RequestQueue';
import Admin from './pages/Admin';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/equipment', icon: Package, label: 'Equipment' },
  { to: '/request', icon: Send, label: 'Request Equipment' },
  { to: '/requests', icon: Inbox, label: 'Request Queue' },
  { to: '/sign-outs', icon: ClipboardList, label: 'Sign-outs' },
  { to: '/calibration', icon: CalendarCheck, label: 'Calibration Status' },
  { to: '/settings', icon: Settings, label: 'Equipment Types' },
  { to: '/admin', icon: Shield, label: 'Admin' },
];

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <BrowserRouter>
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
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/request" element={<RequestEquipment />} />
            <Route path="/requests" element={<RequestQueue />} />
            <Route path="/sign-outs" element={<SignOuts />} />
            <Route path="/calibration" element={<CalibrationStatus />} />
            <Route path="/settings" element={<EquipmentTypes />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
