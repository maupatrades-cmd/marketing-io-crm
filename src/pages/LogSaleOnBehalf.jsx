import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle2, AlertTriangle, Loader2, FileText, FilePlus2 } from 'lucide-react';
import { PRODUCT_CATALOG } from '@/data/ProductCatalog';

const ALLOWED_CONSULTANT_ROLES = ['cpc', 'field_agent', 'admin', 'owner'];

const ACCEPTED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const PACKAGES = PRODUCT_CATALOG.filter((p) => p.type === 'package' || p.type === 'physical');
const ADDONS   = PRODUCT_CATALOG.filter((p) => p.type === 'addon');

function fmtZAR(n) {
  return `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export default function LogSaleOnBehalf() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data sources
  const [consultants, setConsultants] = useState([]);
  const [clients, setClients]         = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Section 1 — consultant
  const [consultantId, setConsultantId] = useState('');

  // Section 2 — client
  const [clientMode, setClientMode] = useState('existing'); // 'existing' | 'new'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClient, setNewClient] = useState({
    business_name: '', contact_person: '', email: '', phone: '', address: '',
  });

  // Section 3 — product + amount
  const [productId, setProductId] = useState('');
  const [amount, setAmount]       = useState('');

  // Section 4 — contract path
  const [contractPath, setContractPath] = useState('paper'); // 'paper' | 'digital'
  const [file, setFile]               = useState(null);
  const [fileError, setFileError]     = useState(null);

  // Section 5 — notes
  const [notes, setNotes] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null); // { kind: 'success'|'warning'|'error', payload }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLookups(true);
      try {
        const [users, allClients] = await Promise.all([
          base44.entities.AppUser.filter({}),
          base44.entities.Client.list('-created_date', 500),
        ]);
        if (cancelled) return;
        const userList = Array.isArray(users) ? users : [];
        setConsultants(
          userList
            .filter((u) => ALLOWED_CONSULTANT_ROLES.includes(u.role))
            .sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email))),
        );
        const clientList = Array.isArray(allClients) ? allClients : [];
        setClients(
          clientList.sort((a, b) => String(a.business_name || '').localeCompare(String(b.business_name || ''))),
        );
      } catch (err) {
        console.error('[LogSaleOnBehalf] lookup load failed:', err);
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedProduct = useMemo(
    () => PRODUCT_CATALOG.find((p) => p.id === productId) || null,
    [productId],
  );
  const productType = selectedProduct?.type === 'addon' ? 'add_on' : 'package';

  // When product changes, auto-fill amount with setup_price (or monthly_price
  // for monthly-only add-ons). Admin can override.
  useEffect(() => {
    if (!selectedProduct) return;
    const setup   = Number(selectedProduct.setup_price || 0);
    const monthly = Number(selectedProduct.monthly_price || 0);
    const defaultAmount = setup > 0 ? setup : monthly;
    setAmount(String(defaultAmount));
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  function invoiceTypeFromSelection() {
    if (productType === 'package') return 'setup_fee';
    if (Number(selectedProduct?.setup_price || 0) > 0) return 'add_on_setup';
    return 'add_on_monthly';
  }

  function handleFilePick(e) {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) { setFile(null); return; }
    if (!ACCEPTED_MIME.has(f.type)) {
      setFile(null);
      setFileError(`Unsupported file type (${f.type || 'unknown'}). Only PDF, JPG, PNG.`);
      e.target.value = '';
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError(`File is too large (${fmtBytes(f.size)}). Max 10 MB.`);
      e.target.value = '';
      return;
    }
    setFile(f);
  }

  function clientValid() {
    if (clientMode === 'existing') return !!selectedClientId;
    return (
      String(newClient.business_name).trim().length > 0 &&
      String(newClient.contact_person).trim().length > 0 &&
      isValidEmail(newClient.email)
    );
  }

  const formValid =
    !!consultantId &&
    clientValid() &&
    !!productId &&
    Number(amount) > 0 &&
    ['paper', 'digital'].includes(contractPath) &&
    (contractPath === 'digital' || !!file) &&
    String(notes).trim().length >= 10;

  async function submit() {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      let file_url = null;
      if (contractPath === 'paper' && file) {
        try {
          const uploaded = await base44.integrations.Core.UploadFile({ file });
          file_url = uploaded?.file_url || uploaded?.url || null;
          if (!file_url) throw new Error('UploadFile returned no file_url');
        } catch (err) {
          console.error('[LogSaleOnBehalf] file upload failed:', err);
          setResult({
            kind: 'error',
            payload: { error: 'file_upload_failed', detail: err?.message || 'Upload failed before sale was recorded. Try again.' },
          });
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        token:         localStorage.getItem('mio_session_token'),
        consultant_id: consultantId,
        product_id:    productId,
        product_type:  productType,
        invoice_type:  invoiceTypeFromSelection(),
        amount:        Number(amount),
        contract_path: contractPath,
        ...(contractPath === 'paper' ? { file_url } : {}),
        notes:         String(notes).trim(),
        ...(clientMode === 'existing'
          ? { client_id: selectedClientId }
          : { new_client_data: {
              business_name:  String(newClient.business_name).trim(),
              contact_person: String(newClient.contact_person).trim(),
              email:          String(newClient.email).trim(),
              phone:          String(newClient.phone || '').trim(),
              address:        String(newClient.address || '').trim(),
            } }),
      };

      const res = await base44.functions.invoke('log-sale-on-behalf', payload);
      const data = res?.data ?? res;

      if (data?.success && !data?.warnings?.length) {
        setResult({ kind: 'success', payload: data });
      } else if (data?.success && Array.isArray(data?.warnings) && data.warnings.length > 0) {
        setResult({ kind: 'warning', payload: data });
      } else {
        setResult({ kind: 'error', payload: data || { error: 'unknown_response' } });
      }
    } catch (err) {
      console.error('[LogSaleOnBehalf] submit failed:', err);
      setResult({ kind: 'error', payload: { error: 'network_or_unexpected_error', detail: err?.message || String(err) } });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setConsultantId('');
    setClientMode('existing');
    setSelectedClientId('');
    setNewClient({ business_name: '', contact_person: '', email: '', phone: '', address: '' });
    setProductId('');
    setAmount('');
    setContractPath('paper');
    setFile(null);
    setFileError(null);
    setNotes('');
    setResult(null);
  }

  if (result?.kind === 'success' || result?.kind === 'warning') {
    return (
      <AppLayout
        title="Log Sale on Behalf"
        subtitle={result.kind === 'success' ? 'Sale logged' : 'Sale logged with issues'}
      >
        <ResultScreen
          result={result}
          onReset={resetForm}
          onViewInvoices={() => navigate('/my-invoices')}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Log Sale on Behalf" subtitle="Record an off-platform sale closed by a consultant">
      <div className="max-w-2xl mx-auto space-y-6">

        {loadingLookups && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading consultants and clients…
          </div>
        )}

        {!loadingLookups && (
          <>
            {/* Section 1 — Consultant */}
            <Section step="1" title="Consultant">
              <Label className="text-xs text-muted-foreground mb-1 block">Who closed this sale?</Label>
              <Select value={consultantId} onValueChange={setConsultantId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select consultant…" />
                </SelectTrigger>
                <SelectContent>
                  {consultants.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No consultants found.</div>
                  ) : consultants.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {(u.full_name || u.email)}{u.role ? ` · ${u.role.replace(/_/g, ' ')}` : ''}{u.id === user?.id ? ' (you)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            {/* Section 2 — Client */}
            <Section step="2" title="Client">
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setClientMode('existing')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    clientMode === 'existing'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  Existing client
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode('new')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    clientMode === 'new'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  New client
                </button>
              </div>

              {clientMode === 'existing' ? (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select existing client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.business_name || '(no business name)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <F label="Business name *" value={newClient.business_name} onChange={(v) => setNewClient((n) => ({ ...n, business_name: v }))} className="col-span-2" />
                  <F label="Contact person *" value={newClient.contact_person} onChange={(v) => setNewClient((n) => ({ ...n, contact_person: v }))} />
                  <F label="Phone"            value={newClient.phone}          onChange={(v) => setNewClient((n) => ({ ...n, phone: v }))} />
                  <F label="Email *"          value={newClient.email}          onChange={(v) => setNewClient((n) => ({ ...n, email: v }))} />
                  <F label="City"             value={newClient.address}        onChange={(v) => setNewClient((n) => ({ ...n, address: v }))} />
                  {clientMode === 'new' && newClient.email && !isValidEmail(newClient.email) && (
                    <p className="col-span-2 text-xs text-rose-600">That doesn't look like a valid email.</p>
                  )}
                </div>
              )}
            </Section>

            {/* Section 3 — Product + amount */}
            <Section step="3" title="Product &amp; amount">
              <Label className="text-xs text-muted-foreground mb-1 block">Product sold</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Packages</SelectLabel>
                    {PACKAGES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — Setup {fmtZAR(p.setup_price)} / Monthly {fmtZAR(p.monthly_price)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Add-ons</SelectLabel>
                    {ADDONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — Setup {fmtZAR(p.setup_price)} / Monthly {fmtZAR(p.monthly_price)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {selectedProduct && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">Amount (R)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-filled from catalog. Edit if the actual price was different.
                    Invoice type will be <code className="text-gray-700">{invoiceTypeFromSelection()}</code>.
                  </p>
                </div>
              )}
            </Section>

            {/* Section 4 — Contract path */}
            <Section step="4" title="Contract">
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setContractPath('paper')}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border transition flex items-center justify-center gap-2 ${
                    contractPath === 'paper'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Upload signed paper contract
                </button>
                <button
                  type="button"
                  onClick={() => setContractPath('digital')}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium border transition flex items-center justify-center gap-2 ${
                    contractPath === 'digital'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  <FilePlus2 className="w-4 h-4" /> Generate digital draft
                </button>
              </div>

              {contractPath === 'paper' && (
                <div>
                  <label className="block">
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={handleFilePick}
                      className="hidden"
                      id="lsob-file"
                    />
                    <span
                      className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-rose-400 transition"
                      onClick={() => document.getElementById('lsob-file')?.click()}
                    >
                      <Upload className="w-6 h-6 text-gray-400 mb-2" />
                      {file ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fmtBytes(file.size)} — click to replace</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700">Tap or drop the signed contract</p>
                          <p className="text-xs text-gray-500 mt-0.5">PDF, JPG or PNG · max 10 MB</p>
                        </>
                      )}
                    </span>
                  </label>
                  {fileError && (
                    <p className="mt-2 text-xs text-rose-600">{fileError}</p>
                  )}
                </div>
              )}

              {contractPath === 'digital' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  A draft contract will be created in the <strong>/contracts</strong> queue. You can review and send it for signing from there. This does <em>not</em> auto-send to the client.
                </div>
              )}
            </Section>

            {/* Section 5 — Notes */}
            <Section step="5" title="Reason / notes (required)">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this being logged on behalf? (e.g. 'Network outage in Polokwane; field agent emailed signed PDF on 23 May.')"
                rows={4}
                className="bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 characters. This is permanent audit trail — be specific.
                {String(notes).trim().length > 0 && String(notes).trim().length < 10 && (
                  <span className="text-rose-600"> ({10 - String(notes).trim().length} more chars needed)</span>
                )}
              </p>
            </Section>

            {/* Submit */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                {formValid
                  ? 'Ready to submit. This creates an invoice, contract, notification + audit log.'
                  : 'Fill in all required fields to enable submit.'}
              </p>
              <Button
                onClick={submit}
                disabled={!formValid || submitting}
                className="bg-rose-600 hover:brightness-110 text-white shrink-0"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging sale…</>
                  : 'Log sale'}
              </Button>
            </div>

            {result?.kind === 'error' && (
              <ErrorCard payload={result.payload} onRetry={() => setResult(null)} />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Section({ step, title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{step}</div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function F({ label, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-white" />
    </div>
  );
}

function ResultScreen({ result, onReset, onViewInvoices }) {
  const isWarning = result.kind === 'warning';
  const d = result.payload || {};
  const Icon = isWarning ? AlertTriangle : CheckCircle2;
  const iconCls = isWarning ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className="max-w-lg mx-auto mt-12 rounded-2xl border border-gray-200 bg-white p-10 text-center">
      <Icon className={`w-16 h-16 mx-auto mb-4 ${iconCls}`} />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {isWarning ? 'Sale logged with issues' : 'Sale logged'}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Invoice <strong>{d.invoice_number || d.invoice_id}</strong> created for <strong>{d.consultant_name || 'the consultant'}</strong>.
      </p>
      {isWarning && Array.isArray(d.warnings) && d.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-left text-sm mb-4">
          <p className="font-semibold mb-1">Please verify:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {d.warnings.map((w, i) => <li key={i} className="text-xs"><code>{w}</code></li>)}
          </ul>
          <p className="text-xs mt-2">Sale data is saved. The consultant may not have received notification — check with them.</p>
        </div>
      )}
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={onReset}>Log another sale</Button>
        <Button onClick={onViewInvoices} className="bg-rose-600 hover:brightness-110 text-white">View in My Invoices</Button>
      </div>
    </div>
  );
}

function ErrorCard({ payload, onRetry }) {
  const errCode = payload?.error || 'unknown_error';
  const step = payload?.step;
  const detail = payload?.detail;
  const partial = payload?.partial_state;
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-rose-600" />
        <h3 className="font-semibold text-rose-900">Could not complete the sale</h3>
      </div>
      <p className="text-sm text-rose-800">
        <code className="text-xs">{errCode}</code>{step ? ` (step ${step})` : ''}{detail ? ` — ${detail}` : ''}
      </p>
      {partial?.invoice_number && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Invoice <strong>{partial.invoice_number}</strong> was created before the failure.
          It has been flagged with an <code>[ORPHAN]</code> note in <strong>/admin/invoices</strong> for manual review.
          Please review and re-attach the contract manually.
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={onRetry}>Dismiss and edit</Button>
      </div>
    </div>
  );
}
