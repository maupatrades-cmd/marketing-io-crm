import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, CheckCircle2, X, Loader2 } from "lucide-react";

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function FileUploadField({ label, required, accept = "image/*,application/pdf", value, onChange, error }) {
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setLocalError(null);
    if (file.size > MAX_BYTES) {
      setLocalError(`File too large. Max ${MAX_MB}MB allowed.`);
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setLocalError("Only JPG, PNG, WEBP or PDF files accepted.");
      return;
    }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  };

  const displayError = error || localError;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-green-200 bg-green-50">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-700 flex-1 truncate">File uploaded ✓</span>
          <button type="button" onClick={() => { onChange(null); setLocalError(null); }}
            className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50 ${displayError ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-xs text-gray-500">{uploading ? "Uploading…" : `Click or drag to upload · Max ${MAX_MB}MB · JPG/PNG/PDF`}</span>
          <input ref={inputRef} type="file" accept={accept} className="hidden"
            onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      )}
      {displayError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1">⚠ {displayError}</p>}
    </div>
  );
}