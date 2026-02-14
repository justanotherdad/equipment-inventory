import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ClipboardList, CalendarClock, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, signedOut: 0, dueSoon: 0, overdue: 0 });

  useEffect(() => {
    (async () => {
      const [equipment, activeSignOuts, calStatus] = await Promise.all([
        api.equipment.getAll(),
        api.signOuts.getActive(),
        api.equipment.getCalibrationStatus(),
      ]);
      const dueSoon = (calStatus as { status: string }[]).filter((e) => e.status === 'due_soon').length;
      const overdue = (calStatus as { status: string }[]).filter((e) => e.status === 'due').length;
      setStats({
        total: equipment.length,
        signedOut: activeSignOuts.length,
        dueSoon,
        overdue,
      });
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your equipment inventory</p>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Package size={24} color="var(--accent)" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Equipment</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total}</div>
          <Link to="/equipment" className="link" style={{ fontSize: '0.875rem', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <ClipboardList size={24} color="var(--warning)" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Currently Signed Out</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.signedOut}</div>
          <Link to="/sign-outs" className="link" style={{ fontSize: '0.875rem', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Manage sign-outs <ArrowRight size={14} />
          </Link>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CalendarClock size={24} color="var(--danger)" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Calibration Due</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>
            {stats.overdue > 0 ? <span style={{ color: 'var(--danger)' }}>{stats.overdue}</span> : 0} overdue
            {stats.dueSoon > 0 && <span style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>+ {stats.dueSoon} soon</span>}
          </div>
          <Link to="/calibration" className="link" style={{ fontSize: '0.875rem', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            View status <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/equipment" className="btn btn-primary">
            <Package size={18} />
            Add Equipment
          </Link>
          <Link to="/sign-outs" className="btn btn-secondary">
            <ClipboardList size={18} />
            Sign Out Equipment
          </Link>
          <Link to="/calibration" className="btn btn-secondary">
            <CalendarClock size={18} />
            Check Calibration Status
          </Link>
        </div>
      </div>
    </div>
  );
}
