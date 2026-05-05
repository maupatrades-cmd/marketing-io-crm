import { useSearchParams, useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center">
        <XCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
        <p className="text-slate-300 mb-6">
          No charge was made. You can try again or contact us for help.
        </p>
        {ref && <p className="text-xs text-slate-500 mb-4">Reference: {ref}</p>}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/client/invoices')}
            className="bg-gradient-to-br from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/client-portal')}
            className="bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold border border-slate-700"
          >
            Back to Portal
          </button>
        </div>
      </div>
    </div>
  );
}
