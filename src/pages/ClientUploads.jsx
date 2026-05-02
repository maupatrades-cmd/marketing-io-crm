import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Download } from "lucide-react";

export default function ClientUploads() {
  const [uploads, setUploads] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const ups = await base44.entities.ClientUpload.filter({ client_id: c.id }, "-created_date", 100);
        setUploads(ups);
      }
      setLoading(false);
    });
  }, []);

  const handleUpload = async (files) => {
    if (!files.length || !client) return;
    const file = files[0];
    const uploaded = await base44.integrations.Core.UploadFile({ file });
    const newUpload = await base44.entities.ClientUpload.create({
      client_id: client.id,
      uploaded_by_id: client.id,
      file_url: uploaded.file_url,
      file_name: file.name,
      file_type: "document",
      file_size_bytes: file.size,
      mime_type: file.type,
    });
    setUploads(prev => [newUpload, ...prev]);
  };

  const handleDelete = async (id) => {
    await base44.entities.ClientUpload.update(id, { is_active: false });
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Your Files</h1>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-border/40 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors mb-6">
          <input type="file" onChange={(e) => handleUpload(e.target.files)} hidden id="upload-input" />
          <label htmlFor="upload-input" className="cursor-pointer block">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
          </label>
        </div>

        {/* Uploads List */}
        <div className="space-y-2">
          {uploads.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No files uploaded</p></div>
          ) : (
            uploads.map(u => (
              <div key={u.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{u.file_name}</p>
                  <p className="text-xs text-muted-foreground">{(u.file_size_bytes / 1024 / 1024).toFixed(1)} MB • {new Date(u.created_date).toLocaleDateString("en-ZA")}</p>
                </div>
                <div className="flex gap-2">
                  <a href={u.file_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download className="w-4 h-4" /></Button>
                  </a>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(u.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}