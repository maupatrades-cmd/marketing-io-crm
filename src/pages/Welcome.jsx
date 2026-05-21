import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { base44 } from '@/api/base44Client';

const LOTTIE_URL = 'https://media.base44.com/files/public/69f52863b2b733d922d90b62/a117d386c_Create_me_a_video_with_these_t1.json';

export default function Welcome() {
  // ── Text + button state — available immediately, zero dependency on video ──
  const [firstName, setFirstName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [continuing, setContinuing] = useState(false);

  // ── Lottie progressive-loading state ──
  const [lottieData, setLottieData] = useState(null);
  const [lottieVisible, setLottieVisible] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    // 1. Read user synchronously from localStorage — zero network latency
    const stored = localStorage.getItem('mio_session_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setFirstName(u.full_name ? u.full_name.split(' ')[0] : '');
      } catch (_) {}
    }

    // 2. Fetch business name from client record (non-blocking)
    base44.functions.invoke('getMyClient', {})
      .then(res => {
        const client = res?.data?.client || res?.data;
        if (client?.business_name) setBusinessName(client.business_name);
      })
      .catch(() => {});

    // 3. Async fetch Lottie JSON from CDN — does NOT block page render
    fetch(LOTTIE_URL)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(data => {
        setLottieData(data);
        // Tiny delay so the CSS opacity transition actually fires
        setTimeout(() => setLottieVisible(true), 50);
      })
      .catch(() => setVideoFailed(true));
  }, []);

  const handleContinue = async () => {
    setContinuing(true);
    try {
      const token = localStorage.getItem('mio_session_token');
      await base44.functions.invoke('mark-welcome-seen', { session_token: token });
    } catch (_) {}
    // Clear the new-signup flag so repeat visits don't re-trigger welcome
    localStorage.removeItem('mio_new_signup');
    window.location.href = '/client-portal';
  };

  const displayName = businessName || firstName || 'your business';
  const greetName = firstName || 'there';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #0A0F1C 0%, #1a0a2e 45%, #0d1a3a 100%)' }}
    >
      {/* Ambient glows — purely decorative */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div
          className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7729FF 0%, #FF2994 50%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center">

        {/* Logo */}
        <img
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
          alt="Marketing iO"
          className="h-14 mx-auto mb-6 object-contain"
          style={{ filter: 'drop-shadow(0 0 10px rgba(119,41,255,0.6)) drop-shadow(0 0 24px rgba(255,41,148,0.4))' }}
        />

        {/* ── GREETING — renders at t=0ms, no video dependency ── */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Welcome to Marketing iO, {greetName}! 🎉
        </h1>
        <p className="text-slate-400 text-sm mb-6">Your journey to being found starts right now.</p>

        {/* ── ANIMATION AREA — placeholder → Lottie with 300ms fade ── */}
        <div className="my-6 flex items-center justify-center" style={{ minHeight: 220 }}>
          {lottieData ? (
            <div
              style={{
                width: '100%',
                maxWidth: 400,
                opacity: lottieVisible ? 1 : 0,
                transition: 'opacity 300ms ease',
              }}
            >
              <Lottie animationData={lottieData} loop autoplay />
            </div>
          ) : !videoFailed ? (
            /* Pulsing glow placeholder — visible while video loads */
            <div
              className="rounded-full animate-pulse"
              style={{
                width: 200,
                height: 200,
                background: 'radial-gradient(circle, rgba(167,100,230,0.28) 0%, rgba(236,72,153,0.12) 60%, transparent 100%)',
                border: '1px solid rgba(167,100,230,0.25)',
                boxShadow: '0 0 50px rgba(167,100,230,0.18)',
              }}
            />
          ) : null}
        </div>

        {/* ── MESSAGE CARD — renders at t=0ms ── */}
        <div
          className="rounded-2xl p-6 sm:p-8 mb-8 text-left"
          style={{
            background: 'rgba(28, 28, 48, 0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-lg sm:text-xl font-semibold text-white mb-4">
            {displayName} just took the smartest step it could.
          </p>
          <p className="text-slate-300 mb-4 leading-relaxed">
            By joining us, you've unlocked{' '}
            <strong className="text-white">Ignite</strong> — your business's launchpad into being
            seen, found, and chosen by customers wherever they are.
          </p>

          <p className="text-sm font-semibold text-purple-300 mb-3">Here's what Ignite gives you:</p>
          <ul className="space-y-2 text-slate-300 text-sm mb-6">
            <li>✨ A professional online presence that makes you findable on Google</li>
            <li>📱 Active social media that keeps your business top-of-mind</li>
            <li>🎯 Real marketing that turns visibility into walk-ins, calls, and sales</li>
            <li>💪 A team in your corner — South African, hands-on, here when you need us</li>
            <li>📈 Locked monthly pricing so growth doesn't cost you a fortune</li>
          </ul>

          <p className="text-sm font-semibold text-pink-300 mb-2">Why this matters:</p>
          <p className="text-slate-300 text-sm mb-4 leading-relaxed">
            Most small businesses are invisible online — and they don't even know it. That stops
            today for you. From this moment,{' '}
            <strong className="text-white">{displayName}</strong> starts showing up where it counts.
          </p>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            No fluff. No fake promises. Just real work that makes your business scale, sell, and
            stand out.
          </p>
          <p className="text-slate-200 text-sm font-medium">
            You've made a great choice,{' '}
            <strong className="text-white">{displayName}</strong>. Welcome to the family. Let's go
            put you on the map.
          </p>
          <p className="text-slate-500 text-xs mt-3">
            — The Marketing iO Team
            <br />
            <em>Too good to stay hidden.</em>
          </p>
        </div>

        {/* ── CONTINUE BUTTON — renders at t=0ms, always functional ── */}
        <button
          onClick={handleContinue}
          disabled={continuing}
          className="px-10 py-4 rounded-xl font-bold text-white text-base transition disabled:opacity-60 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)',
            boxShadow: '0 0 28px rgba(167,100,230,0.45), 0 0 60px rgba(236,72,153,0.2)',
          }}
        >
          {continuing ? 'Loading your dashboard…' : 'Continue to dashboard →'}
        </button>

        <p className="text-slate-600 text-xs mt-6">
          Need help?{' '}
          <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">
            support@marketingio.co.za
          </a>
        </p>
      </div>
    </div>
  );
}