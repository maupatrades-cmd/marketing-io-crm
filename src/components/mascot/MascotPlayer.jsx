import { useEffect } from 'react';
import Lottie from 'lottie-react';
import mascotData from '@/assets/lottie/mascot-mj-dance.json';
import { useEscapeKey } from '@/lib/useEscapeKey';

// Marketing iO mascot Lottie player. Two modes:
//
//   <MascotPlayer mode="overlay" onDismiss={fn} />
//     Full-screen dark backdrop with the mascot centred. Click anywhere or
//     press Escape to dismiss. Auto-dismisses after 6 seconds (the clip is
//     6s at 60fps, so this is exactly one loop). Used by the sign-up welcome
//     and payment-celebration moments.
//
//   <MascotPlayer mode="loop" size={180} className="..." />
//     Transparent background, loops forever, pointer-events disabled so it
//     never blocks UI underneath. Used as decoration on the client portal.
//
// All three placements share the same JSON file (src/assets/lottie/
// mascot-mj-dance.json) — Vite bundles it as a static asset on import.

const AUTO_DISMISS_MS = 6000;

export default function MascotPlayer({ mode, onDismiss, size = 180, className }) {
  // ESC handler (only active in overlay mode).
  useEscapeKey(mode === 'overlay', onDismiss);

  // Auto-dismiss after one loop (overlay mode only).
  useEffect(() => {
    if (mode !== 'overlay' || typeof onDismiss !== 'function') return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [mode, onDismiss]);

  if (mode === 'overlay') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Marketing iO mascot celebration"
        onClick={onDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(10, 10, 46, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 400, height: 400, maxWidth: '85vw', maxHeight: '85vw' }}>
          <Lottie animationData={mascotData} loop autoplay />
        </div>
      </div>
    );
  }

  // mode === "loop" (or unknown)
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        pointerEvents: 'none',
      }}
    >
      <Lottie animationData={mascotData} loop autoplay />
    </div>
  );
}
