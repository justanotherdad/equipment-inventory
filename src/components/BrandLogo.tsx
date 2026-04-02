import { useState } from 'react';
import { Package } from 'lucide-react';

type LogoStage = 'svg' | 'png' | 'fail';

/**
 * Loads branding from `public/logo.svg` or `public/logo.png`.
 * Add one of those files (transparent background recommended). If neither exists, shows the Package icon.
 */
export function BrandLogo({
  height,
  className,
  accentFallback,
}: {
  height: number;
  className?: string;
  /** When using the icon fallback, use accent color (e.g. landing hero). */
  accentFallback?: boolean;
}) {
  const [stage, setStage] = useState<LogoStage>('svg');

  if (stage === 'fail') {
    return (
      <Package
        size={height}
        className={className}
        style={accentFallback ? { color: 'var(--accent)' } : undefined}
      />
    );
  }

  const src = stage === 'svg' ? '/logo.svg' : '/logo.png';

  return (
    <img
      src={src}
      alt="EquipForge"
      className={className}
      height={height}
      style={{
        height,
        width: 'auto',
        maxWidth: `${Math.min(height * 6, 280)}px`,
        objectFit: 'contain',
        display: 'block',
      }}
      onError={() => setStage((s) => (s === 'svg' ? 'png' : 'fail'))}
    />
  );
}
