import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Eye, Send, Save, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_COLORS = {
  authentication: 'bg-blue-900/30 text-blue-400',
  sales: 'bg-green-900/30 text-green-400',
  onboarding: 'bg-purple-900/30 text-purple-400',
  operations: 'bg-yellow-900/30 text-yellow-400',
  legal: 'bg-red-900/30 text-red-400'
};

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editing, setEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.EmailTemplate.list();
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setEditData({
      subject: template.subject,
      preheader: template.preheader,
      html_body: template.html_body,
      plain_text_body: template.plain_text_body
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await base44.entities.EmailTemplate.update(selectedTemplate.id, {
        ...editData,
        last_updated: new Date().toISOString()
      });
      toast.success('Template updated successfully');
      setEditing(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
    }
  };

  const handleSendTest = async () => {
    setTestLoading(true);
    try {
      const user = await base44.auth.me();
      
      // Parse variables and create sample data
      const variables = JSON.parse(selectedTemplate.variables_used || '[]');
      const sampleData = {
        full_name: 'John Doe',
        business_name: 'Sample Business',
        primary_contact_name: 'John Doe',
        package_name: 'Accelerate',
        setup_fee: 'R 2,500',
        monthly_retainer: 'R 1,500',
        otp_code: '123456',
        ip_address: '192.168.1.1',
        location: 'Johannesburg, South Africa',
        device: 'Chrome on macOS',
        login_time: new Date().toLocaleString(),
        invoice_number: 'INV-001',
        amount: 'R 2,500',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        reset_link: 'https://app.marketingio.co.za/reset-password?token=abc123',
        expiry_time: new Date(Date.now() + 60 * 60 * 1000).toLocaleString(),
        change_date: new Date().toLocaleString(),
        welcome_pack_pdf_url: 'https://example.com/welcome.pdf',
        onboarding_form_link: 'https://app.marketingio.co.za/onboarding-form',
        payment_link: 'https://payment.yoco.com/abc123',
        invoice_pdf_url: 'https://example.com/invoice.pdf',
        days_outstanding: '3',
        target_go_live_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        first_deliverable_summary: 'Social media content calendar and first 2 weeks of posts',
        retry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(),
        month_year: 'January 2026',
        report_pdf_url: 'https://example.com/report.pdf',
        key_highlight_1: '45% increase in social media engagement',
        key_highlight_2: '12 new qualified leads generated',
        deliverable_title: 'Social Media Content Calendar',
        deliverable_description: 'Monthly content calendar with 40 posts across all platforms',
        review_link: 'https://app.marketingio.co.za/deliverables/123',
        deadline_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        auto_approve_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(),
        contract_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        renewal_term: '12 months',
        cancellation_email: 'accounts@marketingio.co.za',
        unsubscribe_link: 'https://app.marketingio.co.za/email-preferences'
      };

      let htmlBody = selectedTemplate.html_body;
      let plainTextBody = selectedTemplate.plain_text_body;

      // Replace all variables
      variables.forEach(variable => {
        const value = sampleData[variable] || `[${variable}]`;
        const regex = new RegExp(`{{${variable}}}`, 'g');
        htmlBody = htmlBody.replace(regex, value);
        plainTextBody = plainTextBody.replace(regex, value);
      });

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: selectedTemplate.subject.replace(/{{.*?}}/g, (match) => {
          const variable = match.slice(2, -2);
          return sampleData[variable] || match;
        }),
        body: plainTextBody
      });

      toast.success(`Test email sent to ${user.email}`);
    } catch (err) {
      console.error('Error sending test email:', err);
      toast.error('Failed to send test email');
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Email Templates" subtitle="Manage transactional emails">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Email Templates" subtitle="Manage the emails the system sends to clients and staff">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-transparent text-sm"
          >
            <option value="all">All Categories</option>
            <option value="authentication">Authentication</option>
            <option value="sales">Sales</option>
            <option value="onboarding">Onboarding</option>
            <option value="operations">Operations</option>
            <option value="legal">Legal</option>
          </select>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4">
          {filteredTemplates.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No templates found</p>
              </CardContent>
            </Card>
          ) : (
            filteredTemplates.map(template => (
              <Card key={template.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        <Badge variant="outline" className={CATEGORY_COLORS[template.category]}>
                          {template.category}
                        </Badge>
                        <Badge variant="outline" className={template.is_active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated: {new Date(template.last_updated).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setPreviewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {selectedTemplate && previewOpen && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTemplate.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Subject</label>
                <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.subject}</p>
              </div>
              <div>
                <label className="text-sm font-semibold">Preheader</label>
                <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.preheader}</p>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">HTML Preview</label>
                <iframe
                  srcDoc={selectedTemplate.html_body}
                  className="w-full h-96 border border-border rounded-md"
                  title="Email Preview"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Variables Used</label>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(selectedTemplate.variables_used || '[]').map(variable => (
                    <Badge key={variable} variant="outline">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleSendTest}
                disabled={testLoading}
                className="w-full"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending test...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {selectedTemplate && editing && (
        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Template: {selectedTemplate.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-800/50 p-3 rounded-md flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-300">
                  Available variables: {JSON.parse(selectedTemplate.variables_used || '[]').map(v => `{{${v}}}`).join(', ')}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Subject</label>
                <Input
                  value={editData.subject}
                  onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                  placeholder="Email subject with {{variables}}"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Preheader</label>
                <Input
                  value={editData.preheader}
                  onChange={(e) => setEditData({ ...editData, preheader: e.target.value })}
                  placeholder="Preview text for email clients"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">HTML Body</label>
                <textarea
                  value={editData.html_body}
                  onChange={(e) => setEditData({ ...editData, html_body: e.target.value })}
                  placeholder="HTML email body"
                  className="w-full h-48 p-3 rounded-md border border-input bg-transparent text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Plain Text Body</label>
                <textarea
                  value={editData.plain_text_body}
                  onChange={(e) => setEditData({ ...editData, plain_text_body: e.target.value })}
                  placeholder="Plain text fallback"
                  className="w-full h-32 p-3 rounded-md border border-input bg-transparent text-sm font-mono"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}