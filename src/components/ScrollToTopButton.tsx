import { useEffect, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';

type Props = {
  /** Scrollable element (e.g. `<main className="main-content">`). */
  scrollContainerRef: RefObject<HTMLElement | null>;
};

const SHOW_AFTER_PX = 200;

function windowScrollY(): number {
  return window.scrollY ?? document.documentElement.scrollTop ?? document.body.scrollTop ?? 0;
}

/**
 * Fixed bottom-right control to smooth-scroll back to the top.
 * Listens to both the main pane and `window`: in this app the flex layout often lets
 * the **document** scroll while `main.scrollTop` stays 0, so a main-only listener never fired.
 */
export default function ScrollToTopButton({ scrollContainerRef }: Props) {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const el = scrollContainerRef.current;
      const mainScroll = el?.scrollTop ?? 0;
      const winScroll = windowScrollY();
      setVisible(mainScroll > SHOW_AFTER_PX || winScroll > SHOW_AFTER_PX);
    };

    update();

    const el = scrollContainerRef.current;
    el?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      el?.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
    };
  }, [scrollContainerRef, location.pathname]);

  if (!visible) return null;

  const scrollBothToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      className="scroll-to-top-btn"
      aria-label="Scroll to top"
      title="Back to top"
      onClick={scrollBothToTop}
    >
      <ChevronUp size={22} strokeWidth={2.5} />
    </button>
  );
}
