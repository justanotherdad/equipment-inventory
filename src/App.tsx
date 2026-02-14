import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import { LayoutDashboard, Package, ClipboardList, CalendarCheck, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetail from './pages/EquipmentDetail';
import SignOuts from './pages/SignOuts';
import CalibrationStatus from './pages/CalibrationStatus';
import EquipmentTypes from './pages/EquipmentTypes';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/equipment', icon: Package, label: 'Equipment' },
  { to: '/sign-outs', icon: ClipboardList, label: 'Sign-outs' },
  { to: '/calibration', icon: CalendarCheck, label: 'Calibration Status' },
  { to: '/settings', icon: Settings, label: 'Equipment Types' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <Package size={28} />
            <h1>Equipment Inventory</h1>
          </div>
          <nav className="sidebar-nav">
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
            <Route path="/sign-outs" element={<SignOuts />} />
            <Route path="/calibration" element={<CalibrationStatus />} />
            <Route path="/settings" element={<EquipmentTypes />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
