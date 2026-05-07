import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Download, Image, FileText, FolderOpen, CheckCircle2, AlertCircle, Loader2, File } from "lucide-react";
import { notifyClient } from "@/lib/clientNotifier";
import { logClientActivityFromBrowser } from "@/lib/activityLog";

const FILE_TYPES = [
  { value: "logo",             label: "Logo",               icon: Image,    accept: "image/*" },
  { value: "brand_guidelines", label: "Brand Guidelines",   icon: FileText, accept: ".pdf,.doc,.docx" },
  { value: "business_photo",   label: "Business Photo",     icon: Image,    accept: "image/*" },
  { value: "document",         label: "Document",           icon: FileText, accept: ".pdf,.doc,.docx,.xls,.xlsx" },
  { value: "marketing_asset",  label: "Marketing Asset",    icon: File,     accept: "image/*,.pdf" },
  { value: "other",            label: "Other",              icon: File,     accept: "*" },
];

const TYPE_COLORS = {
  logo:             "bg-purple-500/15 text-purple-300 border-purple-500/30",
  brand_guidelines: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  business_photo:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  document:         "bg-amber-500/15 text-amber-300 border-amber-500/30",
  marketing_asset:  "bg-pink-500/15 text-pink-300 border-pink-500/30",
  other:            "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ClientUploads() {
  const [uploads, setUploads]       = useState([]);
  const [client, setClient]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selectedType, setSelectedType] = useState("logo");
  const [uploading, setUploading]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [filter, setFilter]         = useState("all");
  const [dragging, setDragging]     = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    getCurrentUser().then(async (me) => {
      if (!me) { setLoading(false); window.location.href = '/login'; return; }
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const ups = await base44.entities.ClientUpload.filter({ client_id: c.id, is_active: true }, "-created_date", 200);
        setUploads(ups);
      }
      setLoading(false);
    });
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const uploadFiles = async (files) => {
    if (!files.length || !client || uploading) return;
    setUploading(true);
    const results = [];
    for (const file of Array.from(files)) {
      try {
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        const record = await base44.entities.ClientUpload.create({
          client_id:       client.id,
          uploaded_by_id:  client.id,
          file_url:        uploaded.file_url,
          file_name:       file.name,
          file_type:       selectedType,
          file_size_bytes: file.size,
          mime_type:       file.type,
          is_active:       true,
        });
        results.push(record);
      } catch (err) {
        showToast(`Failed to upload ${file.name}`, "error");
      }
    }

    if (results.length > 0) {
      setUploads(prev => [...results, ...prev]);
      showToast(`${results.length} file${results.length > 1 ? "s" : ""} uploaded successfully`);

      // Activity audit (Client Portal PR A): document_uploaded.
      // Fire-and-forget per file (helper swallows errors internally).
      for (const r of results) {
        logClientActivityFromBrowser({
          clientId:      client.id,
          eventType:     "document_uploaded",
          eventCategory: "document",
          eventSummary:  `Uploaded ${r.file_name}`,
          eventMetadata: {
            upload_id:  r.id,
            file_name:  r.file_name,
            file_type:  r.file_type,
            file_size:  r.file_size_bytes,
            mime_type:  r.mime_type,
          },
        });
      }

      // Notify client (portal notification)
      notifyClient({
        clientId: client.id,
        type:     "system_update",
        title:    "Files uploaded",
        body:     `${results.length} file${results.length > 1 ? "s" : ""} added to your brand assets folder.`,
        relatedEntityType: "ClientUpload",
        relatedEntityId:   results[0]?.id,
        actionUrl: "/client/uploads",
      }).catch(() => {});

      // Notify assigned staff member via backend function
      base44.functions.invoke("notifyStaffOnUpload", {
        client_id:  client.id,
        upload_id:  results[0]?.id,
        file_name:  results.length === 1 ? results[0].file_name : `${results.length} files`,
        file_type:  selectedType,
      }).catch(() => {});
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.ClientUpload.update(id, { is_active: false });
    setUploads(prev => prev.filter(u => u.id !== id));
    showToast("File removed");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  const filtered = filter === "all" ? uploads : uploads.filter(u => u.file_type === filter);

  const countByType = (type) => uploads.filter(u => u.file_type === type).length;

  if (loading) return (
    <div className="min-h-full bg-background p-6 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-full bg-background p-6">
      <header className="max-w-4xl mx-auto mb-6">
        <h1 className="text-xl font-bold text-foreground">Brand Assets</h1>
        <p className="text-sm text-muted-foreground">Upload and manage your brand files</p>
      </header>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
            ${toast.type === "error" ? "bg-destructive text-white" : "bg-emerald-600 text-white"}`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Folder Summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {FILE_TYPES.map(ft => {
            const Icon = ft.icon;
            const count = countByType(ft.value);
            return (
              <button
                key={ft.value}
                onClick={() => setFilter(filter === ft.value ? "all" : ft.value)}
                className={`glass rounded-xl p-3 text-center transition-all hover:scale-105 ${
                  filter === ft.value ? "ring-2 ring-primary/60" : ""
                }`}
              >
                <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground leading-tight">{ft.label}</p>
                <p className="text-base font-bold text-foreground">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Upload Zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/40 hover:border-primary/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {/* File type selector */}
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Upload as</p>
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {FILE_TYPES.map(ft => (
              <button
                key={ft.value}
                onClick={() => setSelectedType(ft.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedType === ft.value
                    ? "gradient-bg text-white border-transparent"
                    : "border-border/40 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FILE_TYPES.find(ft => ft.value === selectedType)?.accept || "*"}
            onChange={(e) => uploadFiles(e.target.files)}
            className="hidden"
            id="upload-input"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </div>
          ) : (
            <label htmlFor="upload-input" className="cursor-pointer block">
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Drop files here or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Uploading as <span className="text-primary font-semibold">
                  {FILE_TYPES.find(ft => ft.value === selectedType)?.label}
                </span>
              </p>
            </label>
          )}
        </div>

        {/* Files List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {filter === "all" ? "All Files" : FILE_TYPES.find(ft => ft.value === filter)?.label}
              <span className="ml-2 text-primary">{filtered.length}</span>
            </h2>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-xs text-muted-foreground hover:text-foreground">
                Clear filter
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No files here yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use the upload zone above to add files</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(u => {
                const typeMeta = FILE_TYPES.find(ft => ft.value === u.file_type) || FILE_TYPES[FILE_TYPES.length - 1];
                const TypeIcon = typeMeta.icon;
                return (
                  <div key={u.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-primary/20 transition-all">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(167,100,230,0.1)" }}>
                      <TypeIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{u.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[u.file_type] || TYPE_COLORS.other}`}>
                          {typeMeta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(u.file_size_bytes)} • {new Date(u.created_date).toLocaleDateString("en-ZA")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={u.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}