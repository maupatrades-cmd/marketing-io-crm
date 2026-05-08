import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getCurrentUser } from '@/lib/customAuth';
import {
  FileText, Download, CreditCard, ArrowLeft, AlertTriangle, CheckCircle2,
  Clock, XCircle,
} from 'lucide-react';

// Round 5 — replaces the 25-line "Coming soon" stub with a real invoice
// detail page. Reachable from ClientInvoices when the client taps a row.

const STATUS_STYLE = {
  draft:     { label: 'Draft',     icon: Clock,         className: 'bg-slate-700 text-slate-200' },
  sent:      { label: 'Unpaid',    icon: AlertTriangle, className: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' },
  paid:      { label: 'Paid',      icon: CheckCircle2,  className: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  overdue:   { label: 'Overdue',   icon: AlertTriangle, className: 'bg-red-500/20 text-red-200 border-red-400/40' },
  failed:    { label: 'Failed',    icon: XCircle,       className: 'bg-red-500/20 text-red-200 border-red-400/40' },
  cancelled: { label: 'Cancelled', icon: XCircle,       className: 'bg-slate-700 text-slate-300' },
  partial:   { label: 'Partial',   icon: Clock,         className: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
};

function fmtMoney(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function unwrap(rows) {
  if (!rows) return [];
  return Array.isArray(rows) ? rows : [rows];
}

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getCurrentUser().catch(() => null);
        if (!me) { window.location.href = '/login'; return; }
        const [invRows, payRows] = await Promise.all([
          base44.entities.Invoice.filter({ id: invoiceId }).catch(() => []),
          base44.entities.Payment.filter({ invoice_id: invoiceId }, '-created_date', 50).catch(() => []),
        ]);
        if (cancelled) return;
        const inv = unwrap(invRows)[0] || null;
        if (!inv) {
          setError('Invoice not found.');
        } else {
          setInvoice(inv);
          setPayments(unwrap(payRows));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load invoice.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const lineItems = Array.isArray(invoice?.line_items) ? invoice.line_items : [];
  const total = Number(invoice?.total_amount || invoice?.total || invoice?.amount || 0);
  const isPayable = invoice && (invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'partial');
  const status = STATUS_STYLE[invoice?.status] || STATUS_STYLE.draft;
  const StatusIcon = status.icon;

  const payNow = async () => {
    if (!invoice) return;
    setPaying(true);
    try {
      const res = await base44.functions.invoke('payfast-checkout-init', {
        invoice_id: invoice.id,
        client_id:  invoice.client_id,
        amount:     total,
        return_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/payment-cancelled`,
      });
      const payload = res?.data ?? res;
      const url = payload?.checkout_url || payload?.payfast_url || payload?.url;
      if (url) { window.location.href = url; return; }
      throw new Error(payload?.error || 'Could not start checkout');
    } catch (err) {
      setError(err.message || 'Could not start payment.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="h-8 bg-slate-800 rounded w-64 mb-6 animate-pulse" />
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 space-y-4">
            <div className="h-6 bg-slate-800 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-800 rounded w-1/2 animate-pulse" />
            <div className="h-32 bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link to="/client/invoices" className="inline-flex items-center gap-2 text-slate-400 text-sm mb-4 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" /> Back to invoices
          </Link>
          <div className="bg-red-500/10 border border-red-400/40 rounded-2xl p-6 text-red-200">
            <AlertTriangle className="w-6 h-6 mb-2" />
            {error || 'Invoice not found.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/client/invoices" className="inline-flex items-center gap-2 text-slate-400 text-sm mb-4 hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> Back to invoices
        </Link>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-700/60 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Invoice</div>
              <div className="font-mono text-xl text-white mt-1">{invoice.invoice_number || invoiceId}</div>
              <div className="text-sm text-slate-400 mt-1">{invoice.invoice_type?.replace(/_/g, ' ') || ''}</div>
            </div>
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${status.className}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-6 py-5 border-b border-slate-700/60 text-sm">
            <Field label="Issued"   value={fmtDate(invoice.issue_date || invoice.issued_at)} />
            <Field label="Due"      value={fmtDate(invoice.due_date)} />
            <Field label="Paid at"  value={fmtDate(invoice.paid_at)} />
            <Field label="Method"   value={invoice.payment_method || '—'} />
            <Field label="Currency" value={invoice.currency || 'ZAR'} />
            <Field label="Total"    value={fmtMoney(total)} highlight />
          </div>

          {lineItems.length > 0 && (
            <div className="px-6 py-5 border-b border-slate-700/60">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Line items</div>
              <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                {lineItems.map((li, i) => {
                  const liAmount = Number(li.amount || 0) * Number(li.quantity || 1);
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40 last:border-b-0">
                      <div>
                        <div className="text-sm text-white">{li.product_name || li.description || '—'}</div>
                        {li.description && li.description !== li.product_name && (
                          <div className="text-xs text-slate-400 mt-0.5">{li.description}</div>
                        )}
                        {Number(li.quantity || 1) !== 1 && (
                          <div className="text-xs text-slate-400 mt-0.5">{li.quantity} × {fmtMoney(li.amount)}</div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-white tabular-nums">{fmtMoney(liAmount)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t border-slate-700/60">
                <div className="text-sm text-slate-400">Total due</div>
                <div className="text-lg font-semibold text-white tabular-nums">{fmtMoney(total)}</div>
              </div>
            </div>
          )}

          <div className="px-6 py-5 border-b border-slate-700/60">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Payment history</div>
            {payments.length === 0 ? (
              <div className="text-sm text-slate-400">No payments recorded against this invoice yet.</div>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="rounded-lg bg-slate-800/40 border border-slate-700/60 px-4 py-3 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="text-white">
                        {(p.type || 'payment').replace(/_/g, ' ')}
                        {p.gateway_reference && <span className="text-slate-400"> · {p.gateway_reference}</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{fmtDate(p.completed_at || p.created_date)} · {p.status}</div>
                    </div>
                    <div className="text-sm font-medium text-white tabular-nums">{fmtMoney(p.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-5 flex flex-wrap items-center gap-3">
            {isPayable && (
              <button
                type="button"
                onClick={payNow}
                disabled={paying}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white font-semibold disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {paying ? 'Starting checkout…' : `Pay ${fmtMoney(total)} now`}
              </button>
            )}
            {invoice.pdf_url && (
              <a
                href={invoice.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm border border-slate-600/60"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => navigate('/client/invoices')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm border border-slate-600/60"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-4">
          <FileText className="w-3 h-3 inline mr-1" />
          Questions about this invoice? Reply to your last invoice email or contact accounts@marketingio.co.za.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, highlight = false }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 ${highlight ? 'text-lg font-semibold text-white' : 'text-sm text-white'}`}>{value}</div>
    </div>
  );
}
