import { useEffect, useRef, useState } from 'react';
import { X, SwitchCamera } from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Full-screen camera barcode scanner for mobile devices. Uses the device camera
 * (rear-facing by default) via getUserMedia and decodes 1D/2D barcodes with ZXing.
 */
export default function CameraScanModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera access is not supported on this device or browser.');
          return;
        }
        // Prompt for permission first so device labels are available.
        const cams = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(cams);
        const rearIdx = cams.findIndex((d) => /back|rear|environment/i.test(d.label));
        const useIdx = rearIdx >= 0 ? rearIdx : deviceIndex;
        setDeviceIndex(useIdx);
        const deviceId = cams[useIdx]?.deviceId;

        controlsRef.current = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (result && !handledRef.current) {
              handledRef.current = true;
              const text = result.getText().trim();
              controlsRef.current?.stop();
              onDetected(text);
            }
          }
        );
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/permission|denied|notallowed/i.test(msg)) {
          setError('Camera permission was denied. Enable camera access in your browser settings and try again.');
        } else if (/notfound|no camera|requested device/i.test(msg)) {
          setError('No camera was found on this device.');
        } else {
          setError(`Unable to start the camera: ${msg}`);
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIndex]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    controlsRef.current?.stop();
    handledRef.current = false;
    setDeviceIndex((i) => (i + 1) % devices.length);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 200 }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '100%' }}
      >
        <div className="modal-header">
          <h3>Scan barcode</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {error ? (
          <p style={{ color: 'var(--danger)', padding: '1rem 0' }}>{error}</p>
        ) : (
          <>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                background: '#000',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
                playsInline
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: '25% 10%',
                  border: '2px solid rgba(255,255,255,0.85)',
                  borderRadius: 8,
                  boxShadow: '0 0 0 100vmax rgba(0,0,0,0.25)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Point the camera at the barcode. It will scan automatically.
            </p>
            {devices.length > 1 && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={switchCamera}>
                <SwitchCamera size={16} /> Switch camera
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
