import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/client-portal'), 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful! 🎉</h1>
        <p className="text-slate-300 mb-4">
          Your payment has been received. We'll be in touch within 24 hours to start your project.
        </p>
        {ref && <p className="text-xs text-slate-500 mb-6">Reference: {ref}</p>}
        <button
          onClick={() => navigate('/client-portal')}
          className="bg-gradient-to-br from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition"
        >
          Go to Portal →
        </button>
        <p className="text-xs text-slate-500 mt-4">Auto-redirecting in 5 seconds...</p>
      </div>
    </div>
  );
}
