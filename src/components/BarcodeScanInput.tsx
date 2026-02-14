import { useRef, useEffect } from 'react';
import { ScanBarcode } from 'lucide-react';

interface Props {
  onScan: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function BarcodeScanInput({ onScan, placeholder = 'Scan barcode or type and press Enter', disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
