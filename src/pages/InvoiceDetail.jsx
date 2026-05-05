import { Link, useParams } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-700/60 rounded-2xl p-8 text-center">
        <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Invoice {invoiceId}</h1>
        <p className="text-slate-400 mb-6">Coming soon — full invoice detail view.</p>
        <Link
          to="/client/invoices"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white font-semibold"
        >
          Back to Invoices <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
