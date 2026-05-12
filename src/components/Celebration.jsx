import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Mascot from './Mascot';

/**
 * Celebration — full-screen "Great choice!" interstitial with dancing
 * mascot and a confetti burst. Auto-dismisses after `duration`ms and
 * calls `onDone` (use it to navigate or unblock the next action).
 * A "Continue →" skip button fades in at `skipAfter`ms for impatient users.
 */
export default function Celebration({
  open,
  message = 'Great choice!',
  subMessage = 'Let’s get you set up.',
  duration = 3500,
  skipAfter = 2000,
  onDone,
}) {
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!open) {
      setCanSkip(false);
      return;
    }

    const fire = (opts) =>
      confetti({
        particleCount: 70,
        spread: 90,
        startVelocity: 45,
        ticks: 220,
        colors: ['#7729FF', '#FF2994', '#00CCFF', '#E63946', '#22D3EE'],
        ...opts,
      });
    fire({ origin: { x: 0.2, y: 0.6 }, angle: 60 });
    fire({ origin: { x: 0.8, y: 0.6 }, angle: 120 });
    const second = setTimeout(() => fire({ origin: { y: 0.4 }, spread: 120 }), 350);

    const skip = setTimeout(() => setCanSkip(true), skipAfter);
    const done = setTimeout(() => onDone?.(), duration);
    return () => {
      clearTimeout(second);
      clearTimeout(skip);
      clearTimeout(done);
    };
  }, [open, duration, skipAfter, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[#0A0F1C]/90 backdrop-blur-md px-4"
        >
          {/* Ambient gradient glow */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, #7729FF 0%, #FF2994 45%, transparent 70%)' }}
            />
          </div>

          {/* Dancing mascot */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 20 }}
            animate={{
              scale: [1, 1.05, 0.97, 1.04, 1],
              opacity: 1,
              y: [0, -14, 0, -10, 0],
              rotate: [0, -10, 10, -8, 8, 0],
            }}
            transition={{
              scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
              y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
              rotate: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
              opacity: { duration: 0.4 },
            }}
            style={{ originX: 0.5, originY: 1 }}
            className="relative w-[420px] max-w-[80vw] pointer-events-none"
          >
            <Mascot />
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
            className="relative mt-2 text-5xl sm:text-6xl font-extrabold tracking-tight text-center"
            style={{
              background: 'linear-gradient(135deg, #7729FF 0%, #FF2994 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {message}
          </motion.h2>

          {/* Sub-message */}
          {subMessage && (
            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="relative mt-3 text-slate-300 text-base sm:text-lg text-center"
            >
              {subMessage}
            </motion.p>
          )}

          {/* Skip button — fades in after skipAfter ms */}
          <AnimatePresence>
            {canSkip && (
              <motion.button
                key="continue"
                type="button"
                onClick={() => onDone?.()}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="relative mt-8 inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white border border-white/20 bg-white/5 backdrop-blur hover:bg-white/10 hover:border-white/40 transition"
              >
                Continue
                <span aria-hidden="true">→</span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
