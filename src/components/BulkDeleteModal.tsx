import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api';

interface Props {
  equipmentIds: number[];
  onClose: () => void;
  onDeleted: () => void;
}

export default function BulkDeleteModal({ equipmentIds, onClose, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const canDelete = confirmText.trim().toLowerCase() === 'delete';

  const handleDelete = async () => {
    if (!canDelete) return;
    setError('');
    setDeleting(true);
    try {
      for (const id of equipmentIds) {
        await api.equipment.delete(id);
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>
            <Trash2 size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Delete {equipmentIds.length} item{equipmentIds.length === 1 ? '' : 's'}
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          This cannot be undone. Type <strong>delete</strong> below to confirm.
        </p>
        <div className="form-group">
          <label>Confirmation</label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            autoComplete="off"
            style={{ width: '100%' }}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={!canDelete || deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
