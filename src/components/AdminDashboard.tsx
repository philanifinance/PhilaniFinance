import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, Eye, CheckCircle, XCircle, FileText,
  ArrowLeft, Clock, User, Briefcase, Building2,
  AlertCircle, ShieldCheck, ChevronDown, ChevronUp, History,
  Loader2, Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

interface LoanApplication {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  mobile_number: string;
  email: string;
  employer_name: string;
  monthly_income: number;
  pay_date: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  loan_amount: number;
  loan_term_days: number;
  interest_amount: number;
  service_fee: number;
  vat_amount: number;
  total_repayable: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface AppDocument {
  id: string;
  category: 'payslip' | 'bank_statement' | 'id_copy';
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

type ViewMode = 'queue' | 'detail';
type StatusFilter = 'all' | LoanApplication['status'];

const statusConfig: Record<LoanApplication['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  under_review: { label: 'Under Review', color: 'text-blue-700', bg: 'bg-blue-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

const categoryLabels: Record<AppDocument['category'], string> = {
  payslip: 'Payslip',
  bank_statement: 'Bank Statement',
  id_copy: 'ID Copy',
};

function formatCurrencyZar(n: number) {
  return 'R ' + n.toLocaleString('en-ZA');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function AdminDashboard() {
  const [view, setView] = useState<ViewMode>('queue');
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortDesc, setSortDesc] = useState(true);

  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected'>('approved');
  const [decisionComment, setDecisionComment] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('loan_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      setError('Failed to load applications: ' + err.message);
    } else {
      setApplications((data as LoanApplication[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Filtered & sorted applications
  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== 'all') {
      list = list.filter(a => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        a =>
          a.first_name.toLowerCase().includes(q) ||
          a.last_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.id_number.includes(q)
      );
    }
    return list.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDesc ? -diff : diff;
    });
  }, [applications, search, statusFilter, sortDesc]);

  // Open detail view
  const openDetail = useCallback(async (app: LoanApplication) => {
    setSelectedApp(app);
    setView('detail');
    setDetailLoading(true);
    setDocuments([]);
    setDocUrls({});
    setAuditLogs([]);

    await logAudit('viewed_application', 'loan_application', app.id);

    // Fetch documents
    const { data: docs } = await supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', app.id);

    const docList = (docs as AppDocument[]) || [];
    setDocuments(docList);

    // Generate signed URLs (60 seconds)
    const urls: Record<string, string> = {};
    for (const doc of docList) {
      const { data: signed } = await supabase
        .storage
        .from('loan_documents')
        .createSignedUrl(doc.storage_path, 60);
      if (signed?.signedUrl) {
        urls[doc.id] = signed.signedUrl;
      }
    }
    setDocUrls(urls);

    // Fetch audit logs for this application
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_type', 'loan_application')
      .eq('target_id', app.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setAuditLogs((logs as AuditEntry[]) || []);
    setDetailLoading(false);
  }, []);

  const backToQueue = useCallback(() => {
    setView('queue');
    setSelectedApp(null);
    setDecisionOpen(false);
    setDecisionComment('');
  }, []);

  const openDecision = useCallback((type: 'approved' | 'rejected') => {
    setDecisionType(type);
    setDecisionComment('');
    setDecisionOpen(true);
  }, []);

  const submitDecision = useCallback(async () => {
    if (!selectedApp || !decisionComment.trim()) return;
    setSubmittingDecision(true);

    const { data: { user } } = await supabase.auth.getUser();

    const updates = {
      status: decisionType,
      admin_notes: decisionComment.trim(),
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from('loan_applications')
      .update(updates)
      .eq('id', selectedApp.id);

    if (updateErr) {
      setError('Failed to update status: ' + updateErr.message);
      setSubmittingDecision(false);
      return;
    }

    await logAudit(
      decisionType === 'approved' ? 'approved_application' : 'rejected_application',
      'loan_application',
      selectedApp.id,
      { notes: decisionComment.trim() }
    );

    setSelectedApp({ ...selectedApp, ...updates });
    setApplications(prev =>
      prev.map(a => (a.id === selectedApp.id ? { ...a, ...updates } : a))
    );
    setDecisionOpen(false);
    setSubmittingDecision(false);
  }, [selectedApp, decisionType, decisionComment]);

  if (view === 'detail' && selectedApp) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={backToQueue}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Queue
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Applicant Info */}
            <div className="flex-1 space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Application Details</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[selectedApp.status].bg} ${statusConfig[selectedApp.status].color}`}>
                    {statusConfig[selectedApp.status].label}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <InfoBlock icon={User} title="Personal" items={[
                    { label: 'Name', value: `${selectedApp.first_name} ${selectedApp.last_name}` },
                    { label: 'SA ID', value: selectedApp.id_number },
                    { label: 'Mobile', value: selectedApp.mobile_number },
                    { label: 'Email', value: selectedApp.email },
                  ]} />
                  <InfoBlock icon={Briefcase} title="Employment" items={[
                    { label: 'Employer', value: selectedApp.employer_name },
                    { label: 'Monthly Income', value: formatCurrencyZar(selectedApp.monthly_income) },
                    { label: 'Pay Date', value: selectedApp.pay_date },
                  ]} />
                  <InfoBlock icon={Building2} title="Banking" items={[
                    { label: 'Bank', value: selectedApp.bank_name },
                    { label: 'Account', value: selectedApp.account_number },
                    { label: 'Type', value: selectedApp.account_type },
                  ]} />
                  <InfoBlock icon={FileText} title="Loan Request" items={[
                    { label: 'Amount', value: formatCurrencyZar(selectedApp.loan_amount) },
                    { label: 'Term', value: `${selectedApp.loan_term_days} days` },
                    { label: 'Interest', value: formatCurrencyZar(selectedApp.interest_amount) },
                    { label: 'Service Fee', value: formatCurrencyZar(selectedApp.service_fee) },
                    { label: 'VAT', value: formatCurrencyZar(selectedApp.vat_amount) },
                    { label: 'Total Repayable', value: formatCurrencyZar(selectedApp.total_repayable), highlight: true },
                  ]} />
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#22c55e]" /> Documents
                </h3>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-gray-500 text-sm">No documents uploaded.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => {
                      const url = docUrls[doc.id];
                      return (
                        <div key={doc.id} className="border border-gray-200 rounded-xl p-4 hover:border-[#22c55e]/40 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              {categoryLabels[doc.category]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium truncate">{doc.file_name}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatBytes(doc.file_size)}</p>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#22c55e] hover:text-[#16a34a] font-semibold transition-colors"
                              onClick={() => logAudit('viewed_document', 'application_document', doc.id)}
                            >
                              <Eye className="w-4 h-4" /> View / Download
                            </a>
                          ) : (
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                              <Lock className="w-3.5 h-3.5" /> Secure link unavailable
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              {selectedApp.admin_notes && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-500" /> Admin Decision Notes
                  </h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-100">
                    {selectedApp.admin_notes}
                  </p>
                  {selectedApp.reviewed_at && (
                    <p className="text-xs text-gray-500 mt-2">
                      Reviewed on {formatDate(selectedApp.reviewed_at)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Actions + Audit */}
            <div className="w-full lg:w-80 space-y-6">
              {/* Decision Panel */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => openDecision('approved')}
                    disabled={selectedApp.status === 'approved'}
                    className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => openDecision('rejected')}
                    disabled={selectedApp.status === 'rejected'}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed font-semibold py-3 rounded-xl transition-all duration-200"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" /> Audit Trail
                </h3>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-gray-500">No audit entries yet.</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {auditLogs.map(log => (
                      <div key={log.id} className="border-l-2 border-gray-200 pl-3 py-1">
                        <p className="text-xs font-semibold text-gray-700 capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(log.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Decision Modal */}
        {decisionOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDecisionOpen(false)} />
            <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {decisionType === 'approved' ? 'Approve Application' : 'Reject Application'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a mandatory comment or reason for this decision.
              </p>
              <textarea
                value={decisionComment}
                onChange={e => setDecisionComment(e.target.value)}
                placeholder="Enter your comments..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setDecisionOpen(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDecision}
                  disabled={!decisionComment.trim() || submittingDecision}
                  className={`flex-1 py-3 font-semibold rounded-xl text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    decisionType === 'approved'
                      ? 'bg-[#22c55e] hover:bg-[#16a34a]'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {submittingDecision ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    decisionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Queue View
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Loan Applications</h1>
            <p className="text-gray-500 text-sm mt-1">Review, process, and manage all submitted applications.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
            Admin Access
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or ID number..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#22c55e]/50"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={() => setSortDesc(s => !s)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:bg-gray-100 transition-colors"
                title="Toggle sort"
              >
                {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading applications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No applications found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">Applicant</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">ID Number</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">Loan Amount</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">Status</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">Submitted</th>
                    <th className="text-right font-semibold text-gray-600 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(app => {
                    const cfg = statusConfig[app.status];
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{app.first_name} {app.last_name}</div>
                          <div className="text-xs text-gray-500">{app.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{app.id_number}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrencyZar(app.loan_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                            {app.status === 'pending' && <Clock className="w-3 h-3" />}
                            {app.status === 'under_review' && <Eye className="w-3 h-3" />}
                            {app.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                            {app.status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(app.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openDetail(app)}
                            className="inline-flex items-center gap-1.5 text-[#22c55e] hover:text-[#16a34a] font-semibold text-xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 flex justify-between items-center">
              <span>Showing {filtered.length} of {applications.length} applications</span>
              <span>Last updated: {new Date().toLocaleTimeString('en-ZA')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: { label: string; value: string; highlight?: boolean }[];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h4>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-gray-500">{item.label}</span>
            <span className={`font-medium ${item.highlight ? 'text-[#22c55e] font-bold' : 'text-gray-900'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
