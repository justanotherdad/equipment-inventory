import { useCallback, useEffect, useRef, useState } from 'react';
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
  const onDetectedRef = useRef(onDetected);
  const handledRef = useRef(false);
  const deviceIndexRef = useRef(0);
  const userSwitchedRef = useRef(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraEpoch, setCameraEpoch] = useState(0);

  onDetectedRef.current = onDetected;

  const emitCode = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || handledRef.current) return;
    handledRef.current = true;
    controlsRef.current?.stop();
    onDetectedRef.current(text);
  }, []);

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;
    setError('');
    setHint('');
    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera access is not supported on this device or browser. You can still type the serial or equipment number.');
          return;
        }
        const cams = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(cams);
        const rearIdx = cams.findIndex((d) => /back|rear|environment/i.test(d.label));
        const idx = userSwitchedRef.current
          ? deviceIndexRef.current
          : rearIdx >= 0
            ? rearIdx
            : 0;
        deviceIndexRef.current = idx;
        const deviceId = cams[idx]?.deviceId;
        if (!videoRef.current) return;

        controlsRef.current = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (result) emitCode(result.getText());
          }
        );
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/permission|denied|notallowed/i.test(msg)) {
          setError('Camera permission was denied. Enable camera access in your browser settings, or type the serial or equipment number.');
        } else if (/notfound|no camera|requested device/i.test(msg)) {
          setError('No camera was found on this device. You can still type the serial or equipment number.');
        } else {
          setError(`Unable to start the camera: ${msg}. You can still type the serial or equipment number.`);
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraEpoch, emitCode]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    controlsRef.current?.stop();
    handledRef.current = false;
    userSwitchedRef.current = true;
    deviceIndexRef.current = (deviceIndexRef.current + 1) % devices.length;
    setHint('');
    setCameraEpoch((n) => n + 1);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || capturing || handledRef.current) return;
    if (!video.videoWidth || !video.videoHeight) {
      setHint('Camera is still starting. Wait a moment and try again.');
      return;
    }
    setCapturing(true);
    setHint('Reading barcode…');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setHint("Couldn't capture a photo. Try again or type the serial.");
        return;
      }
      ctx.drawImage(video, 0, 0);
      const fromZxing = decodeFromCanvas(canvas);
      if (fromZxing) {
        emitCode(fromZxing);
        return;
      }
      const fromNative = await decodeNative(canvas);
      if (fromNative) {
        emitCode(fromNative);
        return;
      }
      setHint("Couldn't read the barcode. Try again, hold steadier, or type the serial.");
    } catch {
      setHint("Couldn't read the barcode. Try again or type the serial.");
    } finally {
      setCapturing(false);
    }
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
              Point the camera at the barcode — it scans automatically. If it doesn’t, take a photo.
            </p>
            {hint && (
              <p style={{ fontSize: '0.85rem', color: 'var(--warning, #b45309)', marginTop: '0.5rem' }}>{hint}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => void takePhoto()} disabled={capturing}>
                {capturing ? 'Reading…' : 'Take photo'}
              </button>
              {devices.length > 1 && (
                <button type="button" className="btn btn-secondary" onClick={switchCamera}>
                  <SwitchCamera size={16} /> Switch camera
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function decodeFromCanvas(canvas: HTMLCanvasElement): string | null {
  try {
    const reader = new BrowserMultiFormatReader();
    const result = reader.decodeFromCanvas(canvas);
    return result.getText().trim() || null;
  } catch {
    return null;
  }
}

async function decodeNative(source: HTMLCanvasElement): Promise<string | null> {
  const BD = (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (src: HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
      };
    }
  ).BarcodeDetector;
  if (!BD) return null;
  try {
    const detector = new BD({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a', 'codabar', 'itf', 'data_matrix'],
    });
    const codes = await detector.detect(source);
    return codes[0]?.rawValue?.trim() || null;
  } catch {
    return null;
  }
}
