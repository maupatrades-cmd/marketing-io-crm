import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Receipt, FileText, Download, Trash2, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const CATEGORIES = ["setup_fee", "monthly_retainer", "add_on", "expense", "commission_payout", "other"];

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ client_id: "", client_name: "", category: "monthly_retainer", amount: "", date: "", description: "", notes: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    base44.entities.Invoice.list("-created_date", 300),
    base44.entities.Client.list("-created_date", 200),
  ]).then(([inv, c]) => {
    setReceipts(inv.filter(i => i.status === "paid" || i.document_url));
    setClients(c);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const filtered = receipts.filter(r =>
    !search || r.client_name?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const save = async () => {
    setSaving(true);
    let file_url = "";
    if (file) {
      setUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file });
      file_url = res.file_url;
      setUploading(false);
    }
    await base44.entities.Invoice.create({
      ...form,
      amount: Number(form.amount) || 0,
      total_amount: Number(form.amount) || 0,
      invoice_type: form.category,
      status: "paid",
      document_url: file_url,
    });
    setSaving(false);
    setShowForm(false);
    setFile(null);
    load();
  };

  return (
    <AppLayout title="Receipts & Documents" subtitle="Upload and manage payment receipts">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search receipts…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Button onClick={() => setShowForm(true)} className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Upload Receipt
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <Receipt className="w-12 h-12 mx-auto mb-3" style={{ color: "#6b6b85" }} />
          <p style={{ color: "#a8a8c0" }}>No receipts yet</p>
          <p className="text-xs mt-1" style={{ color: "#6b6b85" }}>Upload receipts to keep records of payments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(167,100,230,0.12)", border: "1px solid rgba(167,100,230,0.2)" }}>
                <FileText className="w-5 h-5" style={{ color: "#a764e6" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color: "#f4f4fa" }}>{r.client_name || "—"}</p>
                <p className="text-xs" style={{ color: "#a8a8c0" }}>
                  {r.description || r.invoice_type?.replace(/_/g, " ")}
                  {r.payment_date ? ` · ${new Date(r.payment_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-sm" style={{ color: "#f4f4fa" }}>R{(r.total_amount || r.amount || 0).toLocaleString()}</span>
                <Badge className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs">Paid</Badge>
                {r.document_url && (
                  <a href={r.document_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="border-border/50 text-xs h-7 px-2">
                      <Download className="w-3 h-3 mr-1" /> View
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">Upload Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Client</Label>
              <Select value={form.client_id} onValueChange={v => {
                const c = clients.find(c => c.id === v);
                setForm(f => ({ ...f, client_id: v, client_name: c?.business_name || "" }));
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select client…" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Amount (R)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-secondary/50 border-border/50" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/50 border-border/50" />
            </div>
            {/* File upload */}
            <div>
              <Label className="text-xs mb-2 block" style={{ color: "#a8a8c0" }}>Receipt File (PDF / Image)</Label>
              <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl cursor-pointer transition-all"
                style={{ border: "2px dashed rgba(167,100,230,0.3)", background: "rgba(167,100,230,0.05)" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(167,100,230,0.6)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(167,100,230,0.3)"}>
                <Upload className="w-6 h-6 mb-2" style={{ color: "#a764e6" }} />
                <span className="text-xs" style={{ color: "#a8a8c0" }}>{file ? file.name : "Click to upload or drag & drop"}</span>
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white hover:opacity-90">
              {uploading ? "Uploading…" : saving ? "Saving…" : "Save Receipt"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}