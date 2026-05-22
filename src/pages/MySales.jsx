import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, CheckCircle2, Clock, Zap, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  pending_verification: 'bg-amber-100 text-amber-700',
  verified:             'bg-blue-100 text-blue-700',
  needs_clarification:  'bg-orange-100 text-orange-700',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MySales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]               = useState('leads');
  const [leads, setLeads]           = useState([]);
  const [closedSales, setClosedSales] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    const IN_PROGRESS_STATUSES = ['pending_verification', 'verified', 'needs_clarification'];

    Promise.all([
      // My leads in progress
      base44.entities.Lead.filter({ submitted_by: user.id }, '-created_date', 200),
      // My closed clients
      base44.entities.Client.filter({ signed_up_by_id: user.id }, '-created_date', 200),
    ])
      .then(([leadRows, clientRows]) => {
        const allLeads   = Array.isArray(leadRows)   ? leadRows   : [];
        const allClients = Array.isArray(clientRows) ? clientRows : [];
        setLeads(allLeads.filter(l => IN_PROGRESS_STATUSES.includes(l.status)));
        setClosedSales(allClients.filter(c => c.lifecycle_stage === 'active'));
      })
      .catch(err => console.error('[MySales]', err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const tabs = [
    { key: 'leads',  label: 'Leads in Progress', icon: Clock,        count: leads.length },
    { key: 'closed', label: 'Closed Sales',       icon: CheckCircle2, count: closedSales.length },
  ];

  return (
    <AppLayout title="My Sales" subtitle="Your pipeline and closed deals">
      <div className="max-w-4xl mx-auto">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
              <p className="text-xs text-gray-500">Leads in Progress</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{closedSales.length}</p>
              <p className="text-xs text-gray-500">Closed Sales</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                tab === t.key ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-500'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : tab === 'leads' ? (
          leads.length === 0 ? (
            <Empty icon={Zap} message="No leads in progress. Add a lead to get started." />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {leads.map(lead => (
                <div key={lead.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{lead.business_name}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.contact_person} · {lead.phone}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge className={`text-xs border-0 ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-gray-400">{fmtDate(lead.created_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          closedSales.length === 0 ? (
            <Empty icon={TrendingUp} message="No closed sales yet. Go close something!" />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {closedSales.map(client => (
                <div
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{client.business_name}</p>
                    <p className="text-xs text-gray-500 truncate">{client.contact_person || '—'} · {client.phone || '—'}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                    <span className="text-xs text-gray-400">{fmtDate(client.created_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}

function Empty({ icon: Icon, message }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}