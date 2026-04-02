import { useState } from 'react';
import { Package } from 'lucide-react';

/** Try in order; Linux hosts are case-sensitive (Logo.png vs logo.png). */
const LOGO_SRCS = ['/logo.svg', '/logo.png', '/Logo.png'];

export type BrandLogoVariant = 'default' | 'landing' | 'sidebar';

/**
 * Loads branding from `public/` (copied to site root). Preferred: `logo.svg` or `logo.png`.
 * If neither exists, shows the Package icon.
 */
export function BrandLogo({
  variant = 'default',
  height = 48,
  maxWidth: maxWidthProp,
  className,
  accentFallback,
}: {
  variant?: BrandLogoVariant;
  /** Used when variant is `default` (px). */
  height?: number;
  /** Max width in px when variant is `default`. */
  maxWidth?: number;
  className?: string;
  accentFallback?: boolean;
}) {
  const [srcIndex, setSrcIndex] = useState(0);

  if (srcIndex >= LOGO_SRCS.length) {
    const iconSize =
      variant === 'landing' ? 96 : variant === 'sidebar' ? 56 : height;
    const fallbackStyle =
      variant === 'sidebar'
        ? { color: 'var(--sidebar-text)' }
        : accentFallback || variant === 'landing'
          ? { color: 'var(--accent)' }
          : undefined;
    return (
      <Package size={iconSize} className={className} style={fallbackStyle} />
    );
  }

  const src = LOGO_SRCS[srcIndex];

  if (variant === 'landing') {
    return (
      <img
        src={src}
        alt="EquipForge"
        className={className}
        style={{
          width: '100%',
          maxWidth: 'min(440px, 92vw)',
          height: 'auto',
          maxHeight: 'clamp(100px, 28vw, 260px)',
          objectFit: 'contain',
          objectPosition: 'center',
          display: 'block',
          margin: '0 auto',
        }}
        onError={() => setSrcIndex((i) => i + 1)}
      />
    );
  }

  if (variant === 'sidebar') {
    return (
      <img
        src={src}
        alt=""
        className={className}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: 'clamp(40px, min(18vw, 14vh), 96px)',
          maxWidth: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          display: 'block',
        }}
        onError={() => setSrcIndex((i) => i + 1)}
      />
    );
  }

  const maxWidth = maxWidthProp ?? Math.min(height * 6, 280);

  return (
    <img
      src={src}
      alt="EquipForge"
      className={className}
      height={height}
      style={{
        height,
        width: 'auto',
        maxWidth: `${maxWidth}px`,
        maxHeight: `${height}px`,
        objectFit: 'contain',
        objectPosition: 'left center',
        display: 'block',
      }}
      onError={() => setSrcIndex((i) => i + 1)}
    />
  );
}
