import { motion } from 'framer-motion';

export default function AnimatedBot({ style, className }) {
  return (
    <motion.div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      className={className}
    >
      <svg
        viewBox="0 0 200 260"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="bodyGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e8e0ff" />
            <stop offset="60%" stopColor="#c4b0f0" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </radialGradient>
          <radialGradient id="headGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#f0eaff" />
            <stop offset="55%" stopColor="#d0bcff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </radialGradient>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#a21caf" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="eyeGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#a21caf" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="legGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4b0f0" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d0bcff" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Ambient glow behind bot */}
        <ellipse cx="100" cy="235" rx="55" ry="10" fill="rgba(167,100,230,0.25)" />

        {/* === LEFT ARM (stationary) === */}
        <motion.g
          animate={{ rotate: [0, 5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '52px', originY: '148px' }}
        >
          {/* upper arm */}
          <rect x="38" y="145" width="20" height="38" rx="10" fill="url(#armGrad)" />
          {/* forearm */}
          <rect x="40" y="175" width="16" height="30" rx="8" fill="#9333ea" />
          {/* hand */}
          <ellipse cx="48" cy="207" rx="10" ry="10" fill="url(#armGrad)" />
        </motion.g>

        {/* === RIGHT ARM (waving) === */}
        <motion.g
          animate={{ rotate: [-10, 20, -10] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '148px 148px' }}
        >
          {/* upper arm */}
          <rect x="142" y="130" width="20" height="38" rx="10" fill="url(#armGrad)" />
          {/* forearm */}
          <rect x="144" y="158" width="16" height="30" rx="8" fill="#9333ea" />
          {/* hand */}
          <ellipse cx="152" cy="190" rx="10" ry="10" fill="url(#armGrad)" />
          {/* wave fingers */}
          <ellipse cx="144" cy="183" rx="5" ry="7" fill="#c084fc" />
          <ellipse cx="160" cy="183" rx="5" ry="7" fill="#c084fc" />
          <ellipse cx="152" cy="178" rx="5" ry="8" fill="#c084fc" />
        </motion.g>

        {/* === BODY === */}
        <rect x="58" y="138" width="84" height="88" rx="22" fill="url(#bodyGrad)" />
        {/* Chest panel */}
        <rect x="74" y="158" width="52" height="38" rx="10" fill="rgba(30,10,60,0.5)" stroke="rgba(167,100,230,0.6)" strokeWidth="1.5" />
        {/* Chest lights */}
        <motion.circle
          cx="88" cy="172" r="5"
          fill="#ec4899"
          filter="url(#glow)"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <motion.circle
          cx="100" cy="172" r="5"
          fill="#a78bfa"
          filter="url(#glow)"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <motion.circle
          cx="112" cy="172" r="5"
          fill="#38bdf8"
          filter="url(#glow)"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        {/* Speaker grille */}
        {[0, 6, 12, 18, 24].map(i => (
          <rect key={i} x={78 + i * 4} y="186" width="2" height="6" rx="1" fill="rgba(167,100,230,0.5)" />
        ))}

        {/* === LEGS === */}
        <rect x="68" y="220" width="26" height="34" rx="10" fill="url(#legGrad)" />
        <rect x="106" y="220" width="26" height="34" rx="10" fill="url(#legGrad)" />
        {/* Feet */}
        <ellipse cx="81" cy="253" rx="16" ry="9" fill="#7c3aed" />
        <ellipse cx="119" cy="253" rx="16" ry="9" fill="#7c3aed" />

        {/* === HEAD (bobs up/down) === */}
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Neck */}
          <rect x="88" y="110" width="24" height="16" rx="6" fill="#b39ddb" />

          {/* Head */}
          <rect x="48" y="50" width="104" height="80" rx="28" fill="url(#headGrad)" />

          {/* Antenna */}
          <rect x="97" y="20" width="6" height="32" rx="3" fill="#c084fc" />
          <motion.circle
            cx="100" cy="16" r="9"
            fill="#ec4899"
            filter="url(#softGlow)"
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />

          {/* Eyes background */}
          <ellipse cx="77" cy="88" rx="18" ry="18" fill="rgba(0,0,0,0.6)" />
          <ellipse cx="123" cy="88" rx="18" ry="18" fill="rgba(0,0,0,0.6)" />

          {/* Eye glow */}
          <circle cx="77" cy="88" r="14" fill="url(#eyeGlow)" filter="url(#softGlow)" />
          <circle cx="123" cy="88" r="14" fill="url(#eyeGlow2)" filter="url(#softGlow)" />

          {/* Eye pupils */}
          <motion.g
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2 }}
            style={{ transformOrigin: '77px 88px' }}
          >
            <circle cx="77" cy="88" r="7" fill="#ffffff" />
            <circle cx="79" cy="86" r="2.5" fill="#1a003a" />
          </motion.g>
          <motion.g
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2 }}
            style={{ transformOrigin: '123px 88px' }}
          >
            <circle cx="123" cy="88" r="7" fill="#ffffff" />
            <circle cx="125" cy="86" r="2.5" fill="#1a003a" />
          </motion.g>

          {/* Smile */}
          <path
            d="M82 108 Q100 122 118 108"
            stroke="#ec4899"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          {/* Cheek blush */}
          <ellipse cx="62" cy="100" rx="8" ry="5" fill="rgba(236,72,153,0.25)" />
          <ellipse cx="138" cy="100" rx="8" ry="5" fill="rgba(236,72,153,0.25)" />
        </motion.g>
      </svg>
    </motion.div>
  );
}