import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Eye, Play, RefreshCw, Zap, Mail, BarChart2, TestTube } from 'lucide-react';
import { toast } from 'sonner';

const TRIGGER_LABELS = {
  after_signup_verified: 'After Signup',
  after_login_inactivity: 'Re-engagement',
  after_anniversary: 'Anniversary',
  scheduled: 'Scheduled',
  manual: 'Manual'
};

export default function OwnerCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [sends, setSends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [sending, setSending] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [testEmail, setTestEmail] = useState('maupatrades@gmail.com');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        base44.entities.MarketingCampaign.list('-created_date', 50),
        base44.entities.CampaignSend.list('-sent_at', 200)
      ]);
      setCampaigns(c || []);
      setSends(s || []);
    } catch (err) {
      toast.error('Failed to load campaigns');
    }
    setLoading(false);
  };

  const handleSeedCampaigns = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('seed-campaigns', {});
      toast.success(`Campaigns seeded: ${res.data?.created} created, ${res.data?.skipped} updated`);
      loadData();
    } catch (err) {
      toast.error('Failed to seed campaigns');
    }
    setSeeding(false);
  };

  const handleTestSend = async (campaign) => {
    if (!testEmail) return;
    setSending(true);
    try {
      // Find a user with this email for test send
      const users = await base44.entities.User.list();
      const user = users?.find(u => u.email === testEmail) || users?.[0];
      if (!user) { toast.error('Test user not found'); setSending(false); return; }

      const res = await base44.functions.invoke('send-campaign', {
        campaign_slug: campaign.slug,
        user_id: user.id,
        test_mode: true
      });
      if (res.data?.success) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.error(res.data?.error || 'Send failed');
      }
    } catch (err) {
      toast.error('Test send failed: ' + err.message);
    }
    setSending(false);
  };

  const handleBroadcast = async (campaign) => {
    if (!confirm(`Send "${campaign.name}" to all eligible active clients?`)) return;
    setSending(true);
    try {
      const clients = await base44.entities.Client.filter({ status: 'active' });
      let sentCount = 0;
      for (const client of (clients || [])) {
        if (!client.client_user_id) continue;
        try {
          await base44.functions.invoke('send-campaign', {
            campaign_slug: campaign.slug,
            user_id: client.client_user_id
          });
          sentCount++;
        } catch (_) {}
      }
      toast.success(`Broadcast sent to ${sentCount} clients`);
      loadData();
    } catch (err) {
      toast.error('Broadcast failed');
    }
    setSending(false);
  };

  const handleSaveEdit = async () => {
    try {
      await base44.entities.MarketingCampaign.update(selectedCampaign.id, editData);
      toast.success('Campaign updated');
      setEditMode(false);
      loadData();
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const openCampaign = (c) => {
    setSelectedCampaign(c);
    setEditData({ subject_line: c.subject_line, preheader: c.preheader, body_template: c.body_template, image_prompt: c.image_prompt });
    setEditMode(false);
  };

  // Stats
  const thisMonth = new Date().toISOString().substring(0, 7);
  const monthSends = sends.filter(s => s.sent_at?.startsWith(thisMonth));
  const totalSent = monthSends.filter(s => s.status === 'sent').length;
  const totalOptedOut = sends.filter(s => s.status === 'opted_out').length;
  const totalOpened = sends.filter(s => s.opened).length;
  const optOutRate = sends.length > 0 ? ((totalOptedOut / sends.length) * 100).toFixed(1) : '0.0';
  const openRate = sends.filter(s => s.status === 'sent').length > 0
    ? ((totalOpened / sends.filter(s => s.status === 'sent').length) * 100).toFixed(1)
    : '0.0';

  const getCampaignSends = (c) => sends.filter(s => s.campaign_id === c.id);

  return (
    <AppLayout title="Campaign Manager" subtitle="Marketing iO Email Campaigns">
      <div className="space-y-6">

        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Sent This Month', value: totalSent, icon: Send },
            { label: 'Total Opt-outs', value: totalOptedOut, icon: Mail },
            { label: 'Opt-out Rate', value: `${optOutRate}%`, icon: BarChart2 },
            { label: 'Open Rate', value: `${openRate}%`, icon: Eye }
          ].map(stat => (
            <Card key={stat.label} className="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSeedCampaigns} disabled={seeding} variant="outline" className="gap-2">
            {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Seed / Refresh Campaigns
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">Test email:</span>
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="w-56 text-sm"
              placeholder="test@email.com"
            />
          </div>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 glass rounded-xl">
            <p className="text-muted-foreground mb-4">No campaigns found. Click "Seed Campaigns" to get started.</p>
            <Button onClick={handleSeedCampaigns} disabled={seeding} className="gradient-bg">
              {seeding ? 'Seeding...' : 'Seed 8 Campaigns'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map(c => {
              const campaignSends = getCampaignSends(c);
              const lastSend = campaignSends.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
              const isNewsletter = c.slug === 'monthly_newsletter';
              const isSpotlight = c.slug === 'service_spotlight';
              const canBroadcast = isNewsletter || isSpotlight;

              return (
                <Card key={c.id} className="glass hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                          <Badge variant={c.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {c.active ? 'Active' : 'Paused'}
                          </Badge>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {TRIGGER_LABELS[c.trigger_type] || c.trigger_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.subject_line}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{campaignSends.length} total sends</span>
                          {lastSend && <span>Last: {new Date(lastSend.sent_at).toLocaleDateString()}</span>}
                          {c.trigger_offset_days > 0 && <span>Offset: {c.trigger_offset_days}d</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs"
                          onClick={() => openCampaign(c)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => handleTestSend(c)}
                          disabled={sending}
                        >
                          <TestTube className="w-3.5 h-3.5" />
                          Test
                        </Button>
                        {canBroadcast && (
                          <Button
                            size="sm"
                            className="gap-1 text-xs gradient-bg"
                            onClick={() => handleBroadcast(c)}
                            disabled={sending}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {isNewsletter ? 'Send Newsletter' : 'Send Spotlight'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign Preview / Edit Dialog */}
      {selectedCampaign && (
        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCampaign.name}
                <Badge variant="outline" className="text-xs">
                  {TRIGGER_LABELS[selectedCampaign.trigger_type]}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            {!editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Subject</label>
                    <p className="text-sm mt-1">{selectedCampaign.subject_line}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Preheader</label>
                    <p className="text-sm mt-1">{selectedCampaign.preheader || '—'}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Image Prompt (Gemini)</label>
                  <p className="text-sm mt-1 text-muted-foreground italic">{selectedCampaign.image_prompt || 'None'}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Email Body Preview</label>
                  <div
                    className="border rounded-lg overflow-hidden"
                    style={{ height: 400 }}
                  >
                    <iframe
                      srcDoc={selectedCampaign.body_template}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="Email preview"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setEditMode(true)}>Edit Campaign</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTestSend(selectedCampaign)} disabled={sending}>
                      <TestTube className="w-4 h-4 mr-1" />
                      Test Send to {testEmail}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Line</label>
                  <Input
                    value={editData.subject_line}
                    onChange={e => setEditData(d => ({ ...d, subject_line: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Preheader</label>
                  <Input
                    value={editData.preheader}
                    onChange={e => setEditData(d => ({ ...d, preheader: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Image Prompt</label>
                  <Textarea
                    value={editData.image_prompt}
                    onChange={e => setEditData(d => ({ ...d, image_prompt: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Body Template (HTML)</label>
                  <Textarea
                    value={editData.body_template}
                    onChange={e => setEditData(d => ({ ...d, body_template: e.target.value }))}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveEdit} className="gradient-bg">Save Changes</Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}