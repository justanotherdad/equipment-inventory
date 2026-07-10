import { useRef, useEffect, useState } from 'react';
import { ScanBarcode, Camera } from 'lucide-react';
import CameraScanModal from './CameraScanModal';

interface Props {
  onScan: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BarcodeScanInput({ onScan, placeholder = 'Scan barcode or type and press Enter', disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        onScan(value);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  return (
    <>
      <div className="barcode-scan-area">
        <ScanBarcode size={24} color="var(--text-muted)" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn-secondary barcode-camera-btn"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          aria-label="Scan with camera"
          title="Scan with camera"
        >
          <Camera size={18} />
          <span className="barcode-camera-label">Scan</span>
        </button>
      </div>
      {cameraOpen && (
        <CameraScanModal
          onClose={() => setCameraOpen(false)}
          onDetected={(code) => {
            setCameraOpen(false);
            const value = code.trim();
            if (value) onScan(value);
          }}
        />
      )}
    </>
  );
}
