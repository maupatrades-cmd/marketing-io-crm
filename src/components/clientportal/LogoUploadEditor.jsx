import { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function LogoUploadEditor({ client, onLogoUpdate }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(client?.logo_file || null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    setSuccess(false);
    setIsUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);

      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      if (uploadRes?.file_url) {
        // Update client record
        await base44.entities.Client.update(client.id, {
          logo_file: uploadRes.file_url
        });

        setSuccess(true);
        onLogoUpdate(uploadRes.file_url);

        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Failed to upload logo');
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsUploading(true);
    try {
      await base44.entities.Client.update(client.id, {
        logo_file: null
      });
      setPreview(null);
      setSuccess(true);
      onLogoUpdate(null);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError('Failed to remove logo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass rounded-lg p-4 border border-border/50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">Business Logo</h3>
          <p className="text-xs text-muted-foreground mt-1">Upload your business logo for your marketing page</p>
        </div>
        {preview && !isUploading && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Preview */}
      {preview ? (
        <div className="mb-4">
          <div className="w-24 h-24 bg-white rounded-lg p-2 flex items-center justify-center border border-border/50">
            <img 
              src={preview} 
              alt="Logo preview" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-4">
          {client?.business_name?.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex gap-2 p-3 rounded-lg bg-success/10 border border-success/20 mb-4">
          <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
          <p className="text-xs text-success">Logo updated successfully!</p>
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        variant="outline"
        className="w-full"
      >
        <Upload className="w-4 h-4 mr-2" />
        {isUploading ? 'Uploading...' : 'Choose Logo Image'}
      </Button>

      <p className="text-xs text-muted-foreground mt-3">
        PNG, JPG, GIF • Max 5MB • Recommended: 1:1 square format
      </p>
    </div>
  );
}