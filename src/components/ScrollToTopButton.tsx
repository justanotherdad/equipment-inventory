import { useEffect, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';

type Props = {
  /** Scrollable element (e.g. `<main className="main-content">`). */
  scrollContainerRef: RefObject<HTMLElement | null>;
};

const SHOW_AFTER_PX = 320;

/**
 * Fixed bottom-right control to smooth-scroll the app main pane to the top.
 * Uses the main content ref because `.main-content` scrolls, not `window`.
 */
export default function ScrollToTopButton({ scrollContainerRef }: Props) {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const update = () => setVisible(el.scrollTop > SHOW_AFTER_PX);
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, [scrollContainerRef, location.pathname]);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-btn"
      aria-label="Scroll to top"
      title="Back to top"
      onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ChevronUp size={22} strokeWidth={2.5} />
    </button>
  );
}
