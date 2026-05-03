import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Save, Instagram, Facebook } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import MyKPIsWidget from "@/components/kpi/MyKPIsWidget";

export default function StaffProfile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) { window.location.href = '/login'; return; }
      setMe(u);
      setForm({
        profile_photo_url: u.profile_photo_url || "",
        birthday: u.birthday || "",
        phone: u.phone || "",
        job_title: u.job_title || "",
        tiktok: u.tiktok || "",
        facebook: u.facebook || "",
        instagram: u.instagram || "",
        bio: u.bio || "",
      });
    });
  }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, profile_photo_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    toast({ title: "Profile saved!" });
    setSaving(false);
  };

  if (!me) return null;

  return (
    <AppLayout title="My Profile" subtitle="Manage your personal info & social links">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* KPI Widget */}
        <MyKPIsWidget />

        {/* Avatar */}
        <div className="glass rounded-2xl p-6 flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 bg-white/10 flex items-center justify-center">
              {form.profile_photo_url ? (
                <img src={form.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 cursor-pointer gradient-bg rounded-full p-1.5 shadow-lg">
              <Camera className="w-3.5 h-3.5 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">{me.full_name}</p>
            <p className="text-sm text-muted-foreground">{me.email}</p>
            <Badge className="mt-1 gradient-bg text-white border-0 text-xs">{me.role}</Badge>
            {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
          </div>
        </div>

        {/* Personal Info */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Personal Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Job Title</label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. Field Agent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone / WhatsApp</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27 ..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Birthday</label>
              <Input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bio</label>
            <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="A short bio about yourself…" rows={3} />
          </div>
        </div>

        {/* Social Links */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Social Profiles</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                <Instagram className="w-4 h-4 text-white" />
              </div>
              <Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} placeholder="Instagram username or URL" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <Facebook className="w-4 h-4 text-white" />
              </div>
              <Input value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} placeholder="Facebook profile URL" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">TT</span>
              </div>
              <Input value={form.tiktok} onChange={e => setForm(f => ({ ...f, tiktok: e.target.value }))} placeholder="TikTok username or URL" />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gradient-bg w-full text-white border-0">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </AppLayout>
  );
}