import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import EquipmentModal from '../components/EquipmentModal';
import { api } from '../api';

interface Equipment {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
}

export default function EquipmentList() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const data = await api.equipment.getAll();
    setEquipment(data);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = equipment.filter(
    (e) =>
      !filter ||
      e.make.toLowerCase().includes(filter.toLowerCase()) ||
      e.model.toLowerCase().includes(filter.toLowerCase()) ||
      e.serial_number.toLowerCase().includes(filter.toLowerCase()) ||
      (e.equipment_number?.toLowerCase().includes(filter.toLowerCase()) ?? false) ||
      e.equipment_type_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment</h2>
          <p>Manage your equipment inventory</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Add Equipment
        </button>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by make, model, serial number, or type..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Make</th>
                <th>Model</th>
                <th>Serial / Equip #</th>
                <th>Last Cal</th>
                <th>Next Cal Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{e.equipment_type_name}</td>
                  <td>{e.make}</td>
                  <td>{e.model}</td>
                  <td>{e.equipment_number ? `#${e.equipment_number}` : e.serial_number}</td>
                  <td>{formatDate(e.last_calibration_date)}</td>
                  <td>{formatDate(e.next_calibration_due)}</td>
                  <td>
                    <Link to={`/equipment/${e.id}`} className="link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {filtered.map((e) => (
            <div key={e.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment</span>
                <span className="mobile-card-value">{e.make} {e.model}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Type</span>
                <span className="mobile-card-value">{e.equipment_type_name}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Serial / #</span>
                <span className="mobile-card-value">{e.equipment_number ? `#${e.equipment_number}` : e.serial_number}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Next Cal</span>
                <span className="mobile-card-value">{formatDate(e.next_calibration_due)}</span>
              </div>
              <div className="mobile-card-actions">
                <Link to={`/equipment/${e.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <p>{equipment.length === 0 ? 'No equipment yet. Add your first item.' : 'No matches for your search.'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <EquipmentModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
