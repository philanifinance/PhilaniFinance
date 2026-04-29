import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, Eye, CheckCircle, XCircle, FileText,
  ArrowLeft, Clock, User, Briefcase, Building2,
  AlertCircle, ShieldCheck, ChevronDown, ChevronUp, History,
  Loader2, Lock, RefreshCw, CreditCard, MessageSquare,
  Download, Save, BarChart3, Fingerprint, Activity,
  AlertTriangle, CircleDollarSign, BadgeCheck,
  Mail, Phone, Bell
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import DebiCheckModal, { MandateStatusBadge, type MandateRecord } from './DebiCheckModal';

// ── Types ────────────────────────────────────────────────────────────
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
  credit_consent_given: boolean;
  credit_consent_at: string | null;
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

interface CreditCheckSummary {
  check_id: string;
  identity_status: 'verified' | 'warning' | 'mismatch' | 'unknown' | 'error';
  identity_details: string | null;
  credit_score: number | null;
  credit_score_band: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' | null;
  risk_category: string | null;
  has_judgments: boolean;
  has_defaults: boolean;
  has_debt_review: boolean;
  adverse_count: number;
  adverse_summary: string | null;
  bureau_monthly_income: number | null;
  bureau_debt_obligations: number | null;
  user_monthly_income: number;
  income_match: 'match' | 'mismatch' | 'unavailable' | null;
  created_at?: string;
}

type ViewMode = 'queue' | 'detail';
type StatusFilter = 'all' | LoanApplication['status'];

// ── Config ───────────────────────────────────────────────────────────
const statusConfig: Record<LoanApplication['status'], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:      { label: 'Pending',      color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Clock },
  under_review: { label: 'Under Review', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Eye },
  approved:     { label: 'Approved',     color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  rejected:     { label: 'Rejected',     color: 'text-red-700',    bg: 'bg-red-100',    icon: XCircle },
};

const docCategoryConfig: Record<AppDocument['category'], { label: string; description: string }> = {
  payslip:        { label: 'Payslips (3 Months)',    description: 'Most recent three months of payslips' },
  bank_statement: { label: 'Bank Statements (3 Months)', description: 'Most recent three months of bank statements' },
  id_copy:        { label: 'ID Document',            description: 'South African identity document copy' },
};

// ── Helpers ──────────────────────────────────────────────────────────
function fmtZar(n: number) {
  return 'R ' + n.toLocaleString('en-ZA');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Component ────────────────────────────────────────────────────────
export default function AdminDashboard({ isOwner = false }: { isOwner?: boolean }) {
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

  const [internalNote, setInternalNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // DebiCheck state
  const [mandate, setMandate] = useState<MandateRecord | null>(null);
  const [debiCheckOpen, setDebiCheckOpen] = useState(false);

  // Credit Check state
  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [creditCheckLoading, setCreditCheckLoading] = useState(false);
  const [creditReport, setCreditReport] = useState<CreditCheckSummary | null>(null);
  const [creditError, setCreditError] = useState('');

  // Notification state
  const [notificationLogs, setNotificationLogs] = useState<{ id: string; channel: string; trigger_event: string; status: string; recipient: string; created_at: string }[]>([]);
  const [notifSending, setNotifSending] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────
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

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  // ── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter(a => a.status === 'pending').length;
    const reviewing = applications.filter(a => a.status === 'under_review').length;
    const approved = applications.filter(a => a.status === 'approved').length;
    const rejected = applications.filter(a => a.status === 'rejected').length;
    const totalValue = applications.filter(a => a.status !== 'rejected').reduce((sum, a) => sum + a.loan_amount, 0);
    return { total, pending, reviewing, approved, rejected, totalValue };
  }, [applications]);

  // ── Filtered list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
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

  // ── Open detail — auto-marks pending → under_review ────────────────
  const openDetail = useCallback(async (app: LoanApplication) => {
    setSelectedApp(app);
    setView('detail');
    setDetailLoading(true);
    setDocuments([]);
    setDocUrls({});
    setAuditLogs([]);
    setInternalNote(app.admin_notes || '');

    await logAudit('viewed_application', 'loan_application', app.id);

    // Auto-mark pending applications as under_review
    if (app.status === 'pending') {
      const { error: statusErr } = await supabase
        .from('loan_applications')
        .update({ status: 'under_review' })
        .eq('id', app.id);
      if (!statusErr) {
        app = { ...app, status: 'under_review' };
        setSelectedApp(app);
        setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'under_review' } : a));
        await logAudit('updated_status', 'loan_application', app.id, { from: 'pending', to: 'under_review' });
      }
    }

    // Fetch documents
    const { data: docs } = await supabase
      .from('application_documents')
      .select('*')
      .eq('application_id', app.id);
    const docList = (docs as AppDocument[]) || [];
    setDocuments(docList);

    // Generate signed URLs (120 seconds)
    const urls: Record<string, string> = {};
    for (const doc of docList) {
      const { data: signed } = await supabase.storage
        .from('loan_documents')
        .createSignedUrl(doc.storage_path, 120);
      if (signed?.signedUrl) urls[doc.id] = signed.signedUrl;
    }
    setDocUrls(urls);

    // Fetch existing DebiCheck mandate for this application
    const { data: mandateData } = await supabase
      .from('debicheck_mandates')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setMandate((mandateData as MandateRecord) || null);

    // Fetch existing credit check for this application
    const { data: existingCheck } = await supabase
      .from('credit_checks')
      .select('*')
      .eq('application_id', app.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingCheck) {
      setCreditReport({
        check_id: existingCheck.id,
        identity_status: existingCheck.identity_status,
        identity_details: existingCheck.identity_details,
        credit_score: existingCheck.credit_score,
        credit_score_band: existingCheck.credit_score_band,
        risk_category: existingCheck.risk_category,
        has_judgments: existingCheck.has_judgments,
        has_defaults: existingCheck.has_defaults,
        has_debt_review: existingCheck.has_debt_review,
        adverse_count: existingCheck.adverse_count,
        adverse_summary: existingCheck.adverse_summary,
        bureau_monthly_income: existingCheck.bureau_monthly_income,
        bureau_debt_obligations: existingCheck.bureau_debt_obligations,
        user_monthly_income: existingCheck.user_monthly_income,
        income_match: existingCheck.income_match,
        created_at: existingCheck.created_at,
      });
    } else {
      setCreditReport(null);
    }

    // Fetch audit logs
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_type', 'loan_application')
      .eq('target_id', app.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setAuditLogs((logs as AuditEntry[]) || []);

    // Fetch notification logs
    const { data: notifLogs } = await supabase
      .from('communication_log')
      .select('id, channel, trigger_event, status, recipient, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotificationLogs(notifLogs || []);

    setDetailLoading(false);
  }, []);

  const backToQueue = useCallback(() => {
    setView('queue');
    setSelectedApp(null);
    setDecisionOpen(false);
    setDecisionComment('');
    setMandate(null);
    setDebiCheckOpen(false);
    setCreditReport(null);
    setCreditCheckOpen(false);
    setCreditError('');
    setNotificationLogs([]);
    fetchApplications();
  }, [fetchApplications]);

  // ── Save internal notes ────────────────────────────────────────────
  const saveInternalNote = useCallback(async () => {
    if (!selectedApp) return;
    setSavingNote(true);
    const { error: noteErr } = await supabase
      .from('loan_applications')
      .update({ admin_notes: internalNote.trim() || null })
      .eq('id', selectedApp.id);
    if (!noteErr) {
      setSelectedApp({ ...selectedApp, admin_notes: internalNote.trim() || null });
      setApplications(prev =>
        prev.map(a => a.id === selectedApp.id ? { ...a, admin_notes: internalNote.trim() || null } : a)
      );
      await logAudit('added_note', 'loan_application', selectedApp.id, { note_length: internalNote.trim().length });
    }
    setSavingNote(false);
  }, [selectedApp, internalNote]);

  // ── Decision logic ─────────────────────────────────────────────────
  const openDecision = useCallback((type: 'approved' | 'rejected') => {
    setDecisionType(type);
    setDecisionComment('');
    setDecisionOpen(true);
  }, []);

  // ── Notification helper ───────────────────────────────────────────
  const sendNotification = useCallback(async (
    triggerEvent: 'loan_approved' | 'debicheck_initiated' | 'debicheck_reminder',
    app: LoanApplication,
    extra?: Record<string, unknown>,
  ) => {
    setNotifSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload = {
        trigger_event: triggerEvent,
        application_id: app.id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        mobile_number: app.mobile_number,
        loan_amount: app.loan_amount,
        interest_amount: app.interest_amount,
        total_repayable: app.total_repayable,
        loan_term_days: app.loan_term_days,
        bank_name: app.bank_name,
        ...extra,
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      console.log('Notification result:', result);

      // Refresh notification logs
      const { data: notifLogs } = await supabase
        .from('communication_log')
        .select('id, channel, trigger_event, status, recipient, created_at')
        .eq('application_id', app.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotificationLogs(notifLogs || []);

      await logAudit('notification_sent' as never, 'loan_application', app.id, {
        trigger_event: triggerEvent,
        results: result.results,
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    } finally {
      setNotifSending(false);
    }
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
      'loan_application', selectedApp.id, { notes: decisionComment.trim() }
    );

    // Trigger loan approval notification (SMS + Email)
    if (decisionType === 'approved') {
      await sendNotification('loan_approved', selectedApp);
    }

    setSelectedApp({ ...selectedApp, ...updates });
    setApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, ...updates } : a));
    setInternalNote(decisionComment.trim());
    setDecisionOpen(false);
    setSubmittingDecision(false);
  }, [selectedApp, decisionType, decisionComment, sendNotification]);

  // ── Credit Bureau Check ───────────────────────────────────────────
  const runCreditCheck = useCallback(async () => {
    if (!selectedApp) return;
    setCreditCheckLoading(true);
    setCreditError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/credit-bureau-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          application_id: selectedApp.id,
          id_number: selectedApp.id_number,
          first_name: selectedApp.first_name,
          last_name: selectedApp.last_name,
          monthly_income: selectedApp.monthly_income,
          consent_reference: `APP-${selectedApp.id}-CONSENT-${selectedApp.credit_consent_at}`,
          consent_timestamp: selectedApp.credit_consent_at,
        }),
      });

      const data = await res.json();
      console.error('Credit check response:', res.status, data);
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Credit check request failed');
      }

      setCreditReport({
        check_id: data.check_id,
        ...data.summary,
      });
      setCreditCheckOpen(false);
      await logAudit('credit_check_performed', 'loan_application', selectedApp.id, { check_id: data.check_id });

      // Refresh audit logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('target_type', 'loan_application')
        .eq('target_id', selectedApp.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setAuditLogs((logs as AuditEntry[]) || []);
    } catch (err) {
      setCreditError((err as Error).message);
      await logAudit('credit_check_error', 'loan_application', selectedApp.id, { error: (err as Error).message });
    } finally {
      setCreditCheckLoading(false);
    }
  }, [selectedApp]);

  // ── DETAIL VIEW ────────────────────────────────────────────────────
  if (view === 'detail' && selectedApp) {
    const groupedDocs: Record<AppDocument['category'], AppDocument[]> = {
      payslip: documents.filter(d => d.category === 'payslip'),
      bank_statement: documents.filter(d => d.category === 'bank_statement'),
      id_copy: documents.filter(d => d.category === 'id_copy'),
    };

    return (
      <div className="bg-[#f8fafc] pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Breadcrumb header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={backToQueue}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" /> All Applications
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[selectedApp.status].bg} ${statusConfig[selectedApp.status].color}`}>
              {statusConfig[selectedApp.status].label}
            </span>
          </div>

          {/* Applicant header card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-gray-900">
                  {selectedApp.first_name} {selectedApp.last_name}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {selectedApp.email} &middot; {selectedApp.mobile_number} &middot; ID: <span className="font-mono">{selectedApp.id_number}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Submitted {fmtDate(selectedApp.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-[#22c55e]">{fmtZar(selectedApp.loan_amount)}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedApp.loan_term_days} day term &middot; Total: {fmtZar(selectedApp.total_repayable)}</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── LEFT COLUMN (2/3) ──────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Application details */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#22c55e]" /> Applicant Information
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-6 p-6">
                  <InfoBlock icon={User} title="Personal Details" items={[
                    { label: 'Full Name', value: `${selectedApp.first_name} ${selectedApp.last_name}` },
                    { label: 'SA ID Number', value: selectedApp.id_number },
                    { label: 'Mobile', value: selectedApp.mobile_number },
                    { label: 'Email', value: selectedApp.email },
                  ]} />
                  <InfoBlock icon={Briefcase} title="Employment" items={[
                    { label: 'Employer', value: selectedApp.employer_name },
                    { label: 'Monthly Income', value: fmtZar(selectedApp.monthly_income) },
                    { label: 'Pay Date', value: selectedApp.pay_date },
                  ]} />
                  <InfoBlock icon={Building2} title="Banking Details" items={[
                    { label: 'Bank', value: selectedApp.bank_name },
                    { label: 'Account Number', value: selectedApp.account_number },
                    { label: 'Account Type', value: selectedApp.account_type },
                  ]} />
                  <InfoBlock icon={CreditCard} title="Loan Breakdown" items={[
                    { label: 'Principal', value: fmtZar(selectedApp.loan_amount) },
                    { label: 'Interest', value: fmtZar(selectedApp.interest_amount) },
                    { label: 'Service Fee', value: fmtZar(selectedApp.service_fee) },
                    { label: 'VAT', value: fmtZar(selectedApp.vat_amount) },
                    { label: 'Total Repayable', value: fmtZar(selectedApp.total_repayable), highlight: true },
                  ]} />
                </div>
              </div>

              {/* ── Document Verification ─────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#22c55e]" /> Document Verification
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Documents served via time-limited signed URLs (120s). Refresh page to regenerate.</p>
                </div>
                <div className="p-6 space-y-6">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading documents...
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm font-medium">No documents uploaded</p>
                      <p className="text-gray-400 text-xs mt-1">The applicant has not uploaded any supporting documents.</p>
                    </div>
                  ) : (
                    (['payslip', 'bank_statement', 'id_copy'] as const).map(cat => {
                      const catDocs = groupedDocs[cat];
                      const cfg = docCategoryConfig[cat];
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">{cfg.label}</h3>
                              <p className="text-xs text-gray-500">{cfg.description}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catDocs.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {catDocs.length > 0 ? `${catDocs.length} file${catDocs.length > 1 ? 's' : ''}` : 'Missing'}
                            </span>
                          </div>
                          {catDocs.length > 0 ? (
                            <div className="grid sm:grid-cols-2 gap-3">
                              {catDocs.map(doc => {
                                const url = docUrls[doc.id];
                                const isImage = doc.mime_type.startsWith('image/');
                                return (
                                  <div key={doc.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-[#22c55e]/40 transition-colors group">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-900 font-medium truncate">{doc.file_name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{fmtBytes(doc.file_size)} &middot; {doc.mime_type}</p>
                                      </div>
                                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                    </div>
                                    {url ? (
                                      <>
                                        {isImage && (
                                          <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 bg-white">
                                            <img src={url} alt={doc.file_name} className="w-full h-32 object-cover" />
                                          </div>
                                        )}
                                        <div className="flex gap-2 mt-3">
                                          <a href={url} target="_blank" rel="noopener noreferrer"
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs text-[#22c55e] hover:text-[#16a34a] font-semibold bg-green-50 hover:bg-green-100 rounded-lg py-2 transition-colors"
                                            onClick={() => logAudit('viewed_document', 'application_document', doc.id)}>
                                            <Eye className="w-3.5 h-3.5" /> View
                                          </a>
                                          <a href={url} download className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors">
                                            <Download className="w-3.5 h-3.5" /> Download
                                          </a>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                                        <Lock className="w-3.5 h-3.5" /> Generating secure link...
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-red-50/50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
                              No {cfg.label.toLowerCase()} uploaded by the applicant.
                            </div>
                          )}
                          {cat !== 'id_copy' && <div className="border-b border-gray-100 mt-6" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Internal Notes ─────────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#22c55e]" /> Internal Notes
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Private comments visible only to administrators.</p>
                </div>
                <div className="p-6">
                  <textarea
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    placeholder="Add private notes about this application — reasons for approval/denial, follow-up items, etc."
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">
                      {selectedApp.reviewed_at ? `Last reviewed: ${fmtDate(selectedApp.reviewed_at)}` : 'Not yet reviewed'}
                    </p>
                    <button
                      onClick={saveInternalNote}
                      disabled={savingNote || internalNote === (selectedApp.admin_notes || '')}
                      className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (1/3) ─────────────────────────────── */}
            <div className="space-y-6">
              {/* Action Center */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#22c55e]" /> Action Center
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => openDecision('approved')}
                    disabled={selectedApp.status === 'approved'}
                    className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-green-500/20"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve Application
                  </button>
                  <button
                    onClick={() => openDecision('rejected')}
                    disabled={selectedApp.status === 'rejected'}
                    className="w-full flex items-center justify-center gap-2 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed font-semibold py-3.5 rounded-xl transition-all duration-200"
                  >
                    <XCircle className="w-4 h-4" /> Reject Application
                  </button>
                </div>
                {(selectedApp.status === 'approved' || selectedApp.status === 'rejected') && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    This application has already been {selectedApp.status}.
                  </p>
                )}
              </div>

              {/* ── Credit Bureau Check (Owner-Only) ──────────── */}
              {isOwner && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-purple-600" /> Credit &amp; Identity Check
                  </h3>

                  {/* Results panel */}
                  {creditReport ? (
                    <CreditReportPanel report={creditReport} />
                  ) : creditCheckLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full border-4 border-purple-100 border-t-purple-500 animate-spin" />
                        <Activity className="w-5 h-5 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Querying Credit Bureau…</p>
                      <p className="text-[10px] text-gray-400">This usually takes 5–15 seconds</p>
                    </div>
                  ) : null}

                  {creditError && (
                    <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {creditError}
                    </div>
                  )}

                  {!creditCheckLoading && (
                    <button
                      onClick={() => setCreditCheckOpen(true)}
                      disabled={!selectedApp.credit_consent_given}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-purple-500/20"
                    >
                      <Fingerprint className="w-4 h-4" />
                      {creditReport ? 'Re-Run Credit Check' : 'Run Credit & Identity Check'}
                    </button>
                  )}
                  {!selectedApp.credit_consent_given && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Client has not provided credit check consent. Cannot proceed.
                    </div>
                  )}
                  {!creditReport && !creditCheckLoading && selectedApp.credit_consent_given && (
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                      Owner-only. Client consent on file. Results stored as summary only (POPIA).
                    </p>
                  )}
                </div>
              )}

              {/* DebiCheck Mandate */}
              {selectedApp.status === 'approved' && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" /> NuPay DebiCheck
                  </h3>
                  {mandate && (
                    <div className="mb-4">
                      <MandateStatusBadge mandate={mandate} />
                      {mandate.nupay_response_message && (
                        <p className="text-xs text-gray-500 mt-2">{mandate.nupay_response_message}</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setDebiCheckOpen(true)}
                    disabled={!!(mandate && !['rejected', 'cancelled', 'error'].includes(mandate.status) && mandate.status !== 'draft')}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-blue-500/20"
                  >
                    <CreditCard className="w-4 h-4" />
                    {mandate && !['rejected', 'cancelled', 'error'].includes(mandate.status) && mandate.status !== 'draft'
                      ? 'Mandate In Progress'
                      : mandate && ['rejected', 'cancelled', 'error'].includes(mandate.status)
                        ? 'Retry DebiCheck'
                        : 'Initiate NuPay DebiCheck'}
                  </button>
                  {!mandate && (
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                      Sends a TT1 real-time push to the client's banking app for immediate authentication.
                    </p>
                  )}
                </div>
              )}

              {/* Loan Summary */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Quick Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Debt-to-Income</span>
                    <span className="font-bold text-gray-900">
                      {selectedApp.monthly_income > 0
                        ? ((selectedApp.total_repayable / selectedApp.monthly_income) * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Interest Rate</span>
                    <span className="font-bold text-gray-900">
                      {selectedApp.loan_amount > 0
                        ? ((selectedApp.interest_amount / selectedApp.loan_amount) * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Fees</span>
                    <span className="font-bold text-gray-900">{fmtZar(selectedApp.service_fee + selectedApp.vat_amount)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="text-gray-500 font-medium">Net Payout</span>
                    <span className="font-black text-[#22c55e]">{fmtZar(selectedApp.loan_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-500" /> Audit Trail
                </h3>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No actions recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {auditLogs.map(log => (
                      <div key={log.id} className="border-l-2 border-gray-200 pl-3 py-1">
                        <p className="text-xs font-semibold text-gray-700 capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(log.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications Sent */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-500" /> Notifications
                  {notifSending && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 ml-auto" />}
                </h3>
                {notificationLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No notifications sent yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {notificationLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="mt-0.5">
                          {log.channel === 'email'
                            ? <Mail className="w-3.5 h-3.5 text-blue-500" />
                            : <Phone className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700 capitalize">
                              {log.trigger_event.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              log.status === 'sent' || log.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              log.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            {log.channel === 'email' ? log.recipient : log.recipient} &middot; {new Date(log.created_at).toLocaleString('en-ZA')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── DebiCheck Modal ─────────────────────────────────────── */}
        {selectedApp && (
          <DebiCheckModal
            isOpen={debiCheckOpen}
            onClose={() => setDebiCheckOpen(false)}
            application={selectedApp}
            existingMandate={mandate}
            onMandateUpdate={(updated) => {
              setMandate(updated);
              setDebiCheckOpen(false);
              // Trigger DebiCheck notification when mandate is successfully sent
              if (updated.status === 'sent' && selectedApp) {
                sendNotification('debicheck_initiated', selectedApp, {
                  instalment_amount: updated.instalment_amount,
                  contract_ref: updated.contract_ref,
                });
              }
            }}
          />
        )}

        {/* ── Decision Modal ──────────────────────────────────────── */}
        {decisionOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDecisionOpen(false)} />
            <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${decisionType === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
                {decisionType === 'approved'
                  ? <CheckCircle className="w-6 h-6 text-green-600" />
                  : <XCircle className="w-6 h-6 text-red-600" />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {decisionType === 'approved' ? 'Approve Application' : 'Reject Application'}
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                for <span className="font-semibold text-gray-900">{selectedApp.first_name} {selectedApp.last_name}</span> &mdash; {fmtZar(selectedApp.loan_amount)}
              </p>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Reason / Comments <span className="text-red-500">*</span>
              </label>
              <textarea
                value={decisionComment}
                onChange={e => setDecisionComment(e.target.value)}
                placeholder={decisionType === 'approved'
                  ? 'e.g., All documents verified, income sufficient...'
                  : 'e.g., Insufficient income, missing bank statements...'}
                rows={4}
                className="mt-2 w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors resize-none"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDecisionOpen(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={submitDecision}
                  disabled={!decisionComment.trim() || submittingDecision}
                  className={`flex-1 py-3 font-semibold rounded-xl text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    decisionType === 'approved' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-red-500 hover:bg-red-600'
                  }`}>
                  {submittingDecision ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </span>
                  ) : decisionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Credit Check Confirmation Modal ─────────────────────── */}
        {creditCheckOpen && selectedApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCreditCheckOpen(false)} />
            <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-purple-100">
                <Fingerprint className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Credit &amp; Identity Check</h3>
              <p className="text-sm text-gray-500 mb-5">
                You are about to query the credit bureau for <span className="font-semibold text-gray-900">{selectedApp.first_name} {selectedApp.last_name}</span>.
              </p>

              {/* Data summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID Number</span>
                  <span className="font-mono font-semibold text-gray-900">{selectedApp.id_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Full Name</span>
                  <span className="font-semibold text-gray-900">{selectedApp.first_name} {selectedApp.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consent Reference</span>
                  <span className="font-mono text-xs text-gray-700">APP-{selectedApp.id.slice(0, 8)}…</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consent Given</span>
                  <span className={`text-xs font-bold ${selectedApp.credit_consent_given ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedApp.credit_consent_given ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Consent Timestamp</span>
                  <span className="text-gray-700 text-xs">
                    {selectedApp.credit_consent_at ? fmtDate(selectedApp.credit_consent_at) : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  This action will query the credit bureau in real-time. Only the summary will be stored locally (POPIA compliant). An audit log entry will be created.
                </span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setCreditCheckOpen(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={runCreditCheck}
                  disabled={creditCheckLoading}
                  className="flex-1 py-3 font-semibold rounded-xl text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {creditCheckLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Querying…</>
                  ) : (
                    <><Fingerprint className="w-4 h-4" /> Confirm &amp; Run Check</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── QUEUE VIEW ─────────────────────────────────────────────────────
  return (
    <div className="bg-[#f8fafc] pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#22c55e]" /> Admin Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">Review, process, and manage loan applications.</p>
          </div>
          <button onClick={fetchApplications}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} color="text-gray-900" bg="bg-white" />
          <StatCard label="Pending" value={stats.pending} color="text-amber-700" bg="bg-amber-50" />
          <StatCard label="Reviewing" value={stats.reviewing} color="text-blue-700" bg="bg-blue-50" />
          <StatCard label="Approved" value={stats.approved} color="text-green-700" bg="bg-green-50" />
          <StatCard label="Rejected" value={stats.rejected} color="text-red-700" bg="bg-red-50" />
          <StatCard label="Total Value" value={fmtZar(stats.totalValue)} color="text-[#22c55e]" bg="bg-green-50" isText />
        </div>

        {/* Search & Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or ID number..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#22c55e]/50">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button onClick={() => setSortDesc(s => !s)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:bg-gray-100 transition-colors" title="Toggle sort order">
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

        {/* Table */}
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
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-600 px-5 py-3.5">Applicant</th>
                    <th className="text-left font-semibold text-gray-600 px-5 py-3.5 hidden lg:table-cell">ID Number</th>
                    <th className="text-left font-semibold text-gray-600 px-5 py-3.5">Loan Amount</th>
                    <th className="text-left font-semibold text-gray-600 px-5 py-3.5">Status</th>
                    <th className="text-left font-semibold text-gray-600 px-5 py-3.5 hidden md:table-cell">Submitted</th>
                    <th className="text-right font-semibold text-gray-600 px-5 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(app => {
                    const cfg = statusConfig[app.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={app.id} className="hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => openDetail(app)}>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-900">{app.first_name} {app.last_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{app.email}</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 font-mono text-xs hidden lg:table-cell">{app.id_number}</td>
                        <td className="px-5 py-3.5 font-bold text-gray-900">{fmtZar(app.loan_amount)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs hidden md:table-cell">{fmtDateShort(app.created_at)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={e => { e.stopPropagation(); openDetail(app); }}
                            className="inline-flex items-center gap-1.5 text-[#22c55e] hover:text-[#16a34a] font-semibold text-xs transition-colors bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg">
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500 flex justify-between items-center bg-gray-50/50">
              <span>Showing {filtered.length} of {applications.length} applications</span>
              <span>Last refreshed: {new Date().toLocaleTimeString('en-ZA')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function StatCard({ label, value, color, bg, isText }: {
  label: string; value: number | string; color: string; bg: string; isText?: boolean;
}) {
  return (
    <div className={`${bg} border border-gray-200 rounded-xl px-4 py-3 shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-black mt-1 ${color} ${isText ? '!text-base' : ''}`}>{isText ? value : value}</p>
    </div>
  );
}

function InfoBlock({
  icon: Icon, title, items,
}: {
  icon: React.ElementType;
  title: string;
  items: { label: string; value: string; highlight?: boolean }[];
}) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h4>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-gray-500">{item.label}</span>
            <span className={`font-medium text-right ${item.highlight ? 'text-[#22c55e] font-bold' : 'text-gray-900'}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Credit Report Results Panel ──────────────────────────────────────
const scoreColors: Record<string, { text: string; bg: string; bar: string }> = {
  excellent: { text: 'text-green-700', bg: 'bg-green-100', bar: 'bg-green-500' },
  good:      { text: 'text-emerald-700', bg: 'bg-emerald-100', bar: 'bg-emerald-500' },
  fair:      { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-500' },
  poor:      { text: 'text-orange-700', bg: 'bg-orange-100', bar: 'bg-orange-500' },
  very_poor: { text: 'text-red-700', bg: 'bg-red-100', bar: 'bg-red-500' },
};

const identityIcons: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  verified: { icon: BadgeCheck, color: 'text-green-600', bg: 'bg-green-50', label: 'Verified — Match' },
  warning:  { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Identity Warning' },
  mismatch: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Identity Mismatch' },
  unknown:  { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Unknown' },
  error:    { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Error' },
};

function CreditReportPanel({ report }: { report: CreditCheckSummary }) {
  const band = report.credit_score_band || 'fair';
  const sc = scoreColors[band] || scoreColors.fair;
  const id = identityIcons[report.identity_status] || identityIcons.unknown;
  const IdIcon = id.icon;

  const scorePct = report.credit_score
    ? Math.min(100, Math.max(0, ((report.credit_score - 300) / 600) * 100))
    : 0;

  return (
    <div className="space-y-4 mb-4">
      {/* Identity Status */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${id.bg}`}>
        <IdIcon className={`w-5 h-5 ${id.color}`} />
        <div>
          <p className={`text-sm font-bold ${id.color}`}>{id.label}</p>
          {report.identity_details && (
            <p className="text-xs text-gray-600 mt-0.5">{report.identity_details}</p>
          )}
        </div>
      </div>

      {/* Credit Score */}
      {report.credit_score !== null && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Credit Score</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} capitalize`}>
              {band.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className={`text-3xl font-black tabular-nums ${sc.text}`}>{report.credit_score}</span>
            <span className="text-xs text-gray-400 pb-1">/ 900</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${sc.bar} transition-all duration-500`}
              style={{ width: `${scorePct}%` }} />
          </div>
          {report.risk_category && (
            <p className="text-[10px] text-gray-400 mt-1.5">Risk: {report.risk_category}</p>
          )}
        </div>
      )}

      {/* Adverse Indicators */}
      <div className="bg-gray-50 rounded-xl p-4">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <AlertTriangle className="w-3 h-3" /> Adverse Indicators
        </span>
        <div className="grid grid-cols-3 gap-2">
          <div className={`text-center py-2 rounded-lg ${report.has_judgments ? 'bg-red-100' : 'bg-green-50'}`}>
            <p className={`text-[10px] font-bold uppercase ${report.has_judgments ? 'text-red-600' : 'text-green-600'}`}>Judgments</p>
            <p className={`text-xs font-bold mt-0.5 ${report.has_judgments ? 'text-red-700' : 'text-green-700'}`}>
              {report.has_judgments ? 'Yes' : 'None'}
            </p>
          </div>
          <div className={`text-center py-2 rounded-lg ${report.has_defaults ? 'bg-red-100' : 'bg-green-50'}`}>
            <p className={`text-[10px] font-bold uppercase ${report.has_defaults ? 'text-red-600' : 'text-green-600'}`}>Defaults</p>
            <p className={`text-xs font-bold mt-0.5 ${report.has_defaults ? 'text-red-700' : 'text-green-700'}`}>
              {report.has_defaults ? 'Yes' : 'None'}
            </p>
          </div>
          <div className={`text-center py-2 rounded-lg ${report.has_debt_review ? 'bg-red-100' : 'bg-green-50'}`}>
            <p className={`text-[10px] font-bold uppercase ${report.has_debt_review ? 'text-red-600' : 'text-green-600'}`}>Debt Review</p>
            <p className={`text-xs font-bold mt-0.5 ${report.has_debt_review ? 'text-red-700' : 'text-green-700'}`}>
              {report.has_debt_review ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
        {report.adverse_summary && (
          <p className="text-[10px] text-gray-500 mt-2">{report.adverse_summary}</p>
        )}
      </div>

      {/* Affordability Match */}
      <div className="bg-gray-50 rounded-xl p-4">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <CircleDollarSign className="w-3 h-3" /> Affordability
        </span>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Bureau Income</span>
            <span className="font-semibold text-gray-900">
              {report.bureau_monthly_income ? fmtZar(report.bureau_monthly_income) : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">User-Reported</span>
            <span className="font-semibold text-gray-900">{fmtZar(report.user_monthly_income)}</span>
          </div>
          {report.bureau_debt_obligations !== null && report.bureau_debt_obligations !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-500">Debt Obligations</span>
              <span className="font-semibold text-gray-900">{fmtZar(report.bureau_debt_obligations)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
            <span className="text-gray-500 font-medium">Income Match</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              report.income_match === 'match' ? 'bg-green-100 text-green-700' :
              report.income_match === 'mismatch' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {report.income_match === 'match' ? '✓ Match' :
               report.income_match === 'mismatch' ? '✗ Mismatch' :
               'Unavailable'}
            </span>
          </div>
        </div>
      </div>

      {report.created_at && (
        <p className="text-[10px] text-gray-400 text-center">
          Check performed: {new Date(report.created_at).toLocaleString('en-ZA')}
        </p>
      )}
    </div>
  );
}
