/**
 * LoadingDots — three pulsing dots in the brand accent colours.
 *
 * Props:
 *   size  – diameter of each dot in px (default 12)
 *   gap   – horizontal space between dots in px (default 16)
 *   className – passthrough for layout (centering, etc.)
 *
 * Behaviour: each dot scales 1.0 → 1.4 → 1.0 over a 1.4s loop, staggered
 * by 0.2s, using pure CSS keyframes (no animation library).
 */
const DOT_COLORS = ['#E63946', '#22D3EE', '#EC4899'];

export default function LoadingDots({ size = 12, gap = 16, className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-flex items-center ${className}`}
      style={{ gap: `${gap}px` }}
    >
      {DOT_COLORS.map((color, i) => (
        <span
          key={color}
          aria-hidden="true"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '9999px',
            display: 'inline-block',
            backgroundColor: color,
            animation: 'mio-dot-pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            willChange: 'transform',
          }}
        />
      ))}
      <style>{`
        @keyframes mio-dot-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.4); }
        }
      `}</style>
    </span>
  );
}
