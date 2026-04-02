import { useState } from 'react';
import { Package } from 'lucide-react';

/** Try in order; Linux hosts are case-sensitive (Logo.png vs logo.png). */
const LOGO_SRCS = ['/logo.svg', '/logo.png', '/Logo.png'];

/**
 * Loads branding from `public/` (copied to site root). Preferred: `logo.svg` or `logo.png`.
 * If neither exists, shows the Package icon.
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
  const [srcIndex, setSrcIndex] = useState(0);

  if (srcIndex >= LOGO_SRCS.length) {
    return (
      <Package
        size={height}
        className={className}
        style={accentFallback ? { color: 'var(--accent)' } : undefined}
      />
    );
  }

  const src = LOGO_SRCS[srcIndex];

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
      onError={() => setSrcIndex((i) => i + 1)}
    />
  );
}
