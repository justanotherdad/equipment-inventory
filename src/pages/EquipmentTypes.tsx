import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import EquipmentTypeModal from '../components/EquipmentTypeModal';
import { api } from '../api';

interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
}

export default function EquipmentTypes() {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    const data = await api.equipmentTypes.getAll();
    setTypes(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this equipment type? Equipment of this type must be deleted or reassigned first.')) return;
    try {
      await api.equipmentTypes.delete(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment Types</h2>
          <p>Configure equipment categories and calibration requirements</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true); }}>
          <Plus size={18} />
          Add Type
        </button>
      </div>

      <div className="card">
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Equipment types define categories (e.g. Temperature Logger, Laptop). For each type, you can specify whether
          calibration is required and the recalibration frequency in months.
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Requires Calibration</th>
                <th>Frequency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.requires_calibration ? 'Yes' : 'No'}</td>
                  <td>{t.calibration_frequency_months ? `Every ${t.calibration_frequency_months} months` : '—'}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }} onClick={() => { setEditingId(t.id); setShowModal(true); }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {types.length === 0 && (
          <div className="empty-state">
            <p>No equipment types. Add one to get started.</p>
          </div>
        )}
      </div>

      {showModal && (
        <EquipmentTypeModal
          typeId={editingId}
          onClose={() => { setShowModal(false); setEditingId(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditingId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
