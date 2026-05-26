import { useState, useEffect, useCallback } from 'react';
import {
  User, FileText, Clock, CheckCircle, XCircle, Eye,
  ChevronRight, Loader2, RefreshCw, ArrowRight,
  Briefcase, Building2, CreditCard, Shield,
  Pencil, Save, X, AlertCircle, FolderOpen,
  Download, ShieldCheck, Wifi, Pen, Banknote
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useProfile, type ProfileData } from '../lib/ProfileContext';
import LoanContractModal, { type LoanContractRecord } from './LoanContractModal';

// ── Types ────────────────────────────────────────────────────────────
interface LoanApplication {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  mobile_number: string;
  email: string;
  loan_amount: number;
  loan_term_days: number;
  total_repayable: number;
  interest_amount: number;
  service_fee: number;
  vat_amount: number;
  monthly_income: number;
  employer_name: string;
  pay_date: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  loan_disbursed_at: string | null;
  loan_paid_at: string | null;
  loan_lifecycle: 'approved' | 'disbursed' | 'repaid' | 'defaulted' | null;
}

interface AppDocument {
  id: string;
  application_id: string;
  category: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_at?: string;
}

interface MandateInfo {
  status: string;
}

interface ContractInfo {
  id: string;
  status: 'pending_signature' | 'signed' | 'cancelled';
  contract_number: string;
  signed_at: string | null;
}

type Tab = 'tracker' | 'history' | 'documents' | 'profile';

// ── Status config ────────────────────────────────────────────────────
const statusSteps = [
  { key: 'submitted',   label: 'Submitted',    icon: FileText },
  { key: 'under_review',label: 'Under Review', icon: Eye },
  { key: 'decision',    label: 'Decision',     icon: CheckCircle },
  { key: 'contract',    label: 'Loan Contract',icon: Pen },
  { key: 'debicheck',   label: 'DebiCheck',    icon: ShieldCheck },
  { key: 'disbursed',   label: 'Disbursed',    icon: Banknote },
] as const;

const statusConfig: Record<LoanApplication['status'], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:      { label: 'Submitted',    color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Clock },
  under_review: { label: 'Under Review', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Eye },
  approved:     { label: 'Approved',     color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  rejected:     { label: 'Declined',     color: 'text-red-700',    bg: 'bg-red-100',    icon: XCircle },
};

// ── Helpers ──────────────────────────────────────────────────────────
function fmtZar(n: number) { return 'R ' + n.toLocaleString('en-ZA'); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtBytes(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function getProgressStep(
  status: LoanApplication['status'],
  lifecycle?: string | null,
  contractStatus?: string,
  mandateStatus?: string,
): number {
  if (status === 'pending') return 1;
  if (status === 'under_review') return 2;
  if (status === 'rejected') return 3;  // decision step, red
  if (status === 'approved') {
    if (!contractStatus || contractStatus === 'pending_signature') return 4;
    if (contractStatus === 'signed') {
      if (mandateStatus && ['mandate_submitted','pending_bank'].includes(mandateStatus)) return 5;
      if (lifecycle === 'disbursed' || lifecycle === 'repaid') return 6;
      return 5;
    }
    return 4;
  }
  return 3;
}

// ── Component ────────────────────────────────────────────────────────
interface ClientDashboardProps {
  user: SupabaseUser;
  onApply: () => void;
  showWelcome?: boolean;
  onWelcomeDismiss?: () => void;
}

export default function ClientDashboard({ user, onApply, showWelcome, onWelcomeDismiss }: ClientDashboardProps) {
  const { profile, updateProfile } = useProfile();
  const [tab, setTab] = useState<Tab>('tracker');
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [mandate, setMandate] = useState<MandateInfo | null>(null);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [fullContract, setFullContract] = useState<LoanContractRecord | null>(null);
  const [lifecycle, setLifecycle] = useState<string | null>(null);
  const [userDocs, setUserDocs] = useState<AppDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const apps = (data as LoanApplication[]) || [];
    setApplications(apps);

    // Fetch contract + mandate for the most active app
    const active = apps.find(a => a.status === 'pending' || a.status === 'under_review' || a.status === 'approved') || apps[0];
    if (active) {
      const [{ data: m }, { data: c }] = await Promise.all([
        supabase
          .from('debicheck_mandates')
          .select('status')
          .eq('application_id', active.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('loan_contracts')
          .select('id, status, contract_number, signed_at')
          .eq('application_id', active.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setMandate(m as MandateInfo | null);
      setContract(c as ContractInfo | null);
      setLifecycle(active.loan_lifecycle ?? null);
    }
    setLoading(false);
  }, [user.id]);

  const fetchUserDocs = useCallback(async () => {
    setDocsLoading(true);
    const { data } = await supabase
      .from('application_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setUserDocs((data as AppDocument[]) || []);
    setDocsLoading(false);
  }, [user.id]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  // Lazy-load docs only when that tab is opened
  useEffect(() => { if (tab === 'documents') fetchUserDocs(); }, [tab, fetchUserDocs]);

  const activeApp = applications.find(a => ['pending','under_review','approved'].includes(a.status)) || applications[0] || null;

  // Disable new application while a loan is disbursed but not yet repaid
  const hasActiveLoan = !!activeApp && (activeApp.loan_lifecycle === 'disbursed');

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'tracker', label: 'Application Tracker', icon: FileText },
    { key: 'history', label: 'Loan History', icon: Clock },
    { key: 'documents', label: 'Documents', icon: FolderOpen },
    { key: 'profile', label: 'My Profile', icon: User },
  ];

  return (
    <div className="bg-slate-50 pb-16">
      {/* Dark navy page header */}
      <div className="bg-navy-950 pt-20 pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {showWelcome && (
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl px-5 py-4 mb-6 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-white text-sm">Application Submitted Successfully!</h3>
                  <p className="text-white/60 text-xs mt-1">Your application has been received and is being processed.</p>
                </div>
              </div>
              <button onClick={onWelcomeDismiss} className="text-white/40 hover:text-white text-xs font-medium flex-shrink-0 transition-colors">Dismiss</button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Dashboard</p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Welcome back, {profile.firstName || user.email?.split('@')[0]}
              </h1>
              <p className="text-white/50 text-sm mt-1.5">Manage your loan applications and personal information.</p>
              <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.24em] flex items-center gap-2">
                <span className="h-px w-5 bg-brand-500/40 flex-shrink-0" />
                <span className="text-white/35">Pay Day Too Far</span>
                <span className="text-brand-500 mx-0.5">·</span>
                <span className="text-brand-400">We Got You</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchApplications}
                className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-white/[0.1] transition-all">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={hasActiveLoan ? undefined : onApply}
                disabled={hasActiveLoan}
                title={hasActiveLoan ? 'You have an active disbursed loan. Disabled until repayment is confirmed.' : undefined}
                className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:bg-navy-800 disabled:text-navy-500 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25">
                New Application <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-1 pt-6">

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-200/60 rounded-2xl p-1 mb-6">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setSelectedApp(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700'}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── APPLICATION TRACKER TAB ───────────────────────────────── */}
        {tab === 'tracker' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-navy-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading...
              </div>
            ) : !activeApp ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-display font-bold text-navy-900 text-lg mb-2">No Active Applications</h3>
                <p className="text-navy-500 text-sm mb-6">You don't have any active loan applications right now.</p>
                <button onClick={onApply}
                  className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25">
                  Start New Application <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-navy-900">Application Progress</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[activeApp.status].bg} ${statusConfig[activeApp.status].color}`}>
                      {statusConfig[activeApp.status].label}
                    </span>
                  </div>

                  {/* Visual progress stepper */}
                  <div className="flex items-center justify-between mb-4">
                    {statusSteps.map((s, idx) => {
                      const current = getProgressStep(activeApp.status, lifecycle, contract?.status, mandate?.status);
                      const isActive = idx + 1 <= current;
                      const isCurrent = idx + 1 === current;
                      const isDecisionStep = s.key === 'decision';
                      const isApproved = isDecisionStep && activeApp.status === 'approved';
                      const isRejected  = isDecisionStep && activeApp.status === 'rejected';
                      const isDebiWaiting = s.key === 'debicheck' && mandate && ['mandate_submitted','pending_bank'].includes(mandate.status);
                      const isContractPending = s.key === 'contract' && contract?.status === 'pending_signature';
                      const isDisbursedStep = s.key === 'disbursed';
                      const isDisbursed = isDisbursedStep && (lifecycle === 'disbursed' || lifecycle === 'repaid');

                      let bgClass = 'bg-gray-100';
                      if (isRejected)   bgClass = 'bg-red-500';
                      else if (isApproved && isActive) bgClass = 'bg-brand-500';
                      else if (isCurrent) bgClass = 'bg-brand-500 shadow-lg shadow-brand-500/30';
                      else if (isActive)  bgClass = 'bg-brand-500';

                      let StepIcon = s.icon;
                      let iconEl: React.ReactNode;
                      if (isRejected)  iconEl = <XCircle className="w-5 h-5 text-white" />;
                      else if (isApproved) iconEl = <CheckCircle className="w-5 h-5 text-white" />;
                      else iconEl = <StepIcon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />;

                      let label: string = s.label;
                      if (isRejected)            label = 'Rejected';
                      else if (isApproved)        label = 'Approved';
                      else if (isDebiWaiting)     label = 'Awaiting Auth';
                      else if (isContractPending) label = 'Sign Contract';

                      return (
                        <div key={s.key} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 transition-all ${bgClass}`}>
                              {iconEl}
                            </div>
                            <span className={`text-[10px] font-medium text-center leading-tight ${
                              isRejected ? 'text-red-600' : isActive ? 'text-gray-900' : 'text-gray-400'
                            }`}>{label}</span>
                            {isDebiWaiting && (
                              <span className="text-[10px] text-amber-600 font-medium animate-pulse">Check banking app</span>
                            )}
                            {isContractPending && (
                              <span className="text-[10px] text-amber-600 font-medium animate-pulse">Action required</span>
                            )}
                            {isDisbursed && lifecycle === 'repaid' && (
                              <span className="text-[10px] text-green-600 font-medium">Repaid</span>
                            )}
                          </div>
                          {idx < statusSteps.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 -mt-5 rounded-full ${idx + 1 < current ? 'bg-brand-500' : 'bg-slate-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-navy-400 text-xs mt-2">
                    Submitted on {fmtDateTime(activeApp.created_at)}
                    {activeApp.reviewed_at && ` · Reviewed on ${fmtDateTime(activeApp.reviewed_at)}`}
                  </p>
                </div>

                {/* ── Loan Contract Card (shown when approved & contract exists) ── */}
                {activeApp.status === 'approved' && contract && (
                  <div className={`border rounded-2xl p-6 shadow-sm ${
                    contract.status === 'signed'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          contract.status === 'signed' ? 'bg-green-200' : 'bg-amber-200'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            contract.status === 'signed' ? 'text-green-700' : 'text-amber-700'
                          }`} />
                        </div>
                        <div>
                          <h3 className={`font-bold ${
                            contract.status === 'signed' ? 'text-green-800' : 'text-amber-800'
                          }`}>
                            {contract.status === 'signed' ? 'Loan Agreement Signed' : 'Loan Agreement Requires Your Signature'}
                          </h3>
                          <p className={`text-xs mt-0.5 ${
                            contract.status === 'signed' ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {contract.status === 'signed'
                              ? `Signed · Ref: ${contract.contract_number}`
                              : `Contract ref: ${contract.contract_number} · Please sign before DebiCheck authorisation`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const { data } = await supabase
                            .from('loan_contracts')
                            .select('*')
                            .eq('id', contract.id)
                            .single();
                          setFullContract(data as LoanContractRecord);
                          setContractModalOpen(true);
                        }}
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
                          contract.status === 'signed'
                            ? 'bg-green-200 hover:bg-green-300 text-green-800'
                            : 'bg-[#fc5107] hover:bg-[#e03d00] text-white shadow-sm'
                        }`}
                      >
                        <Pen className="w-3.5 h-3.5" />
                        {contract.status === 'signed' ? 'View Contract' : 'Sign Now'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── No contract yet but approved ─────────────────── */}
                {activeApp.status === 'approved' && !contract && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-blue-800">Loan Approved — Contract Coming Soon</h3>
                      <p className="text-sm text-blue-600 mt-1">Your loan has been approved. A loan agreement contract is being prepared for your signature. Check back shortly.</p>
                    </div>
                  </div>
                )}

                {/* ── Active Loan Summary (disbursed) ───────────────── */}
                {activeApp.loan_lifecycle === 'disbursed' && activeApp.loan_disbursed_at && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-200 flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <h3 className="font-bold text-emerald-900">Active Loan — Funds Disbursed</h3>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          Disbursed on {fmtDate(activeApp.loan_disbursed_at)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white rounded-xl p-4 border border-emerald-100">
                        <p className="text-xs text-gray-500 mb-1">Amount Received</p>
                        <p className="text-xl font-black text-emerald-700">{fmtZar(activeApp.loan_amount)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-emerald-100">
                        <p className="text-xs text-gray-500 mb-1">Total Repayable</p>
                        <p className="text-xl font-black text-gray-900">{fmtZar(activeApp.total_repayable)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-emerald-100">
                        <p className="text-xs text-gray-500 mb-1">Repayment Due</p>
                        <p className="font-bold text-gray-900">
                          {fmtDate((() => { const d = new Date(activeApp.loan_disbursed_at!); d.setDate(d.getDate() + activeApp.loan_term_days); return d.toISOString(); })())}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-emerald-100">
                        <p className="text-xs text-gray-500 mb-1">Term</p>
                        <p className="font-bold text-gray-900">{activeApp.loan_term_days} days</p>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-700 mt-4 bg-emerald-100 rounded-xl px-4 py-3">
                      Repayment will be collected via DebiCheck debit order on the due date. Ensure sufficient funds are available.
                    </p>
                  </div>
                )}

                {/* ── Loan fully repaid ──────────────────────────────── */}
                {activeApp.loan_lifecycle === 'repaid' && activeApp.loan_paid_at && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-green-800">Loan Fully Repaid</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Your loan of {fmtZar(activeApp.total_repayable)} was successfully repaid on {fmtDate(activeApp.loan_paid_at)}.
                        You may now apply for a new loan.
                      </p>
                    </div>
                  </div>
                )}

                {/* Active application summary */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <h2 className="font-display font-bold text-navy-900">Loan Details</h2>
                    <span className="text-2xl font-black text-brand-600">{fmtZar(activeApp.loan_amount)}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6 p-6">
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Loan Breakdown</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Principal</span><span className="font-medium text-gray-900">{fmtZar(activeApp.loan_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Interest &amp; Service Fees</span><span className="font-medium text-gray-900">{fmtZar(activeApp.interest_amount + activeApp.service_fee)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="font-medium text-gray-900">{fmtZar(activeApp.vat_amount)}</span></div>
                        <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-navy-700 font-medium">Total Repayable</span><span className="font-bold text-brand-600">{fmtZar(activeApp.total_repayable)}</span></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Details</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Term</span><span className="font-medium text-gray-900">{activeApp.loan_term_days} days</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Employer</span><span className="font-medium text-gray-900">{activeApp.employer_name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Monthly Income</span><span className="font-medium text-gray-900">{fmtZar(activeApp.monthly_income)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium text-gray-900">{activeApp.bank_name}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Admin feedback (if reviewed) */}
                  {activeApp.admin_notes && (activeApp.status === 'approved' || activeApp.status === 'rejected') && (
                    <div className="border-t border-gray-100 px-6 py-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reviewer Feedback</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100">{activeApp.admin_notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LOAN HISTORY TAB ─────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading...
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-display font-bold text-navy-900 text-lg mb-2">No Loan History</h3>
                <p className="text-navy-500 text-sm">You haven't submitted any applications yet.</p>
              </div>
            ) : selectedApp ? (
              /* Detail view for a past application */
              <div className="space-y-6">
                <button onClick={() => setSelectedApp(null)}
                  className="text-gray-500 hover:text-gray-900 text-sm font-medium flex items-center gap-1.5 transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back to History
                </button>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-gray-900">Application Details</h2>
                      <p className="text-xs text-gray-500 mt-1">Submitted {fmtDateTime(selectedApp.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-brand-600">{fmtZar(selectedApp.loan_amount)}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig[selectedApp.status].bg} ${statusConfig[selectedApp.status].color}`}>
                        {statusConfig[selectedApp.status].label}
                      </span>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-6 p-6">
                    <div className="space-y-1.5 text-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Loan</p>
                      <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{fmtZar(selectedApp.loan_amount)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Term</span><span className="font-medium">{selectedApp.loan_term_days} days</span></div>
                      <div className="flex justify-between"><span className="text-navy-500">Total</span><span className="font-bold text-brand-600">{fmtZar(selectedApp.total_repayable)}</span></div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fees</p>
                      <div className="flex justify-between"><span className="text-gray-500">Interest &amp; Service Fees</span><span className="font-medium">{fmtZar(selectedApp.interest_amount + selectedApp.service_fee)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">VAT</span><span className="font-medium">{fmtZar(selectedApp.vat_amount)}</span></div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Employment</p>
                      <div className="flex justify-between"><span className="text-gray-500">Employer</span><span className="font-medium">{selectedApp.employer_name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Income</span><span className="font-medium">{fmtZar(selectedApp.monthly_income)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">{selectedApp.bank_name}</span></div>
                    </div>
                  </div>
                  {selectedApp.admin_notes && (
                    <div className="border-t border-gray-100 px-6 py-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reviewer Feedback</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100">{selectedApp.admin_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* History list */
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-bold text-gray-900">All Applications ({applications.length})</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {applications.map(app => {
                    const cfg = statusConfig[app.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <button key={app.id} onClick={() => setSelectedApp(app)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors text-left">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                            <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{fmtZar(app.loan_amount)} <span className="text-gray-500 font-normal text-sm">· {app.loan_term_days} days</span></p>
                            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(app.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTS TAB (Document Vault) ──────────────────────── */}
        {tab === 'documents' && (
          <div className="space-y-4">
            {docsLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading documents...
              </div>
            ) : userDocs.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-bold text-gray-900 text-lg mb-2">No Documents Yet</h3>
                <p className="text-gray-500 text-sm">Documents you upload with your applications will appear here.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <h2 className="font-display font-bold text-navy-900 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-brand-500" /> Document Vault
                  </h2>
                  <span className="text-xs text-gray-400">{userDocs.length} document{userDocs.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Group by category */}
                {(['id_copy', 'payslip', 'bank_statement'] as const).map(cat => {
                  const catDocs = userDocs.filter(d => d.category === cat);
                  if (catDocs.length === 0) return null;
                  const catLabel = cat === 'id_copy' ? 'Identity Documents' : cat === 'payslip' ? 'Payslips' : 'Bank Statements';
                  const CatIcon = cat === 'bank_statement' ? Building2 : cat === 'payslip' ? Briefcase : User;
                  return (
                    <div key={cat}>
                      <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                          <CatIcon className="w-3.5 h-3.5" /> {catLabel}
                          <span className="ml-auto text-gray-400 font-normal">{catDocs.length}</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {catDocs.map(doc => {
                          const isOzow = doc.mime_type === 'application/json' && doc.file_name.startsWith('Ozow');
                          return (
                            <div key={doc.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/40 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOzow ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                  {isOzow ? <Wifi className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-gray-500" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-900 font-medium truncate">{doc.file_name}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {isOzow ? 'Ozow Verified' : fmtBytes(doc.file_size)}
                                    {doc.created_at && ` · ${fmtDate(doc.created_at)}`}
                                  </p>
                                </div>
                              </div>
                              {!isOzow && (
                                <button
                                  onClick={async () => {
                                    const { data } = await supabase.storage.from('loan_documents').createSignedUrl(doc.storage_path, 120);
                                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-semibold bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                                  <Download className="w-3.5 h-3.5" /> View
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ──────────────────────────────────────────── */}
        {tab === 'profile' && (
          <ProfileTab profile={profile} userEmail={user.email || ''} updateProfile={updateProfile} />
        )}
      </div>

      {/* ── Loan Contract Modal ────────────────────────────────────── */}
      {activeApp && fullContract && (
        <LoanContractModal
          isOpen={contractModalOpen}
          onClose={() => { setContractModalOpen(false); setFullContract(null); }}
          application={activeApp}
          existingContract={fullContract}
          isAdminView={false}
          onContractUpdate={(updated) => {
            setContract({
              id: updated.id,
              status: updated.status,
              contract_number: updated.contract_number,
              signed_at: updated.signed_at,
            });
            setFullContract(updated);
            if (updated.status === 'signed') {
              setContractModalOpen(false);
              setFullContract(null);
              fetchApplications();
            }
          }}
        />
      )}
    </div>
  );
}

// ── Profile Tab (editable) ───────────────────────────────────────────
const SA_BANKS = ['Standard Bank', 'FNB', 'Absa', 'Capitec', 'Nedbank', 'TymeBank', 'African Bank', 'Investec'];
const PAY_DATES = ['1st', '15th', '20th', '25th', '26th', '27th', '28th', '29th', '30th', 'Last day of month', 'Weekly', 'Bi-weekly'];

function ProfileTab({ profile, userEmail, updateProfile }: {
  profile: ProfileData;
  userEmail: string;
  updateProfile: (data: ProfileData) => Promise<{ error: string | null }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(profile);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync draft when profile changes externally
  useEffect(() => {
    if (!editing) setDraft(profile);
  }, [profile, editing]);

  function upd(field: keyof ProfileData, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  function startEdit() {
    setDraft(profile);
    setEditing(true);
    setSaveError('');
    setSaveSuccess(false);
  }

  function cancelEdit() {
    setDraft(profile);
    setEditing(false);
    setSaveError('');
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const { error } = await updateProfile(draft);
    setSaving(false);
    if (error) {
      setSaveError(error);
    } else {
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          {saveSuccess && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Profile saved successfully
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {saveError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#fc5107] hover:bg-[#e03d00] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={startEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
              <Pencil className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-[#fc5107]" /> Personal Information
          </h2>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Auto-filled on new applications</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 p-6">
          <EditableField label="First Name" value={draft.firstName} editing={editing} onChange={v => upd('firstName', v)} placeholder="Sipho" />
          <EditableField label="Last Name" value={draft.lastName} editing={editing} onChange={v => upd('lastName', v)} placeholder="Dlamini" />
          <EditableField label="SA ID Number" value={draft.idNumber} editing={editing} onChange={v => upd('idNumber', v.replace(/\D/g, '').slice(0, 13))} placeholder="8001015009087" mono inputMode="numeric" />
          <EditableField label="Mobile Number" value={draft.mobileNumber} editing={editing} onChange={v => upd('mobileNumber', v)} placeholder="082 000 0000" type="tel" />
          <EditableField label="Email Address" value={draft.email || userEmail} editing={editing} onChange={v => upd('email', v)} placeholder="sipho@email.com" type="email" />
        </div>
      </div>

      {/* Employment Details */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#fc5107]" /> Employment Details
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 p-6">
          <EditableField label="Employer" value={draft.employerName} editing={editing} onChange={v => upd('employerName', v)} placeholder="ABC Company (Pty) Ltd" />
          <EditableField label="Monthly Income (ZAR)" value={draft.monthlyIncome} editing={editing} onChange={v => upd('monthlyIncome', v.replace(/\D/g, ''))} placeholder="8500" prefix="R" inputMode="numeric" displayValue={draft.monthlyIncome ? fmtZar(parseInt(draft.monthlyIncome, 10)) : ''} />
          {editing ? (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Pay Date</label>
              <select value={draft.payDate} onChange={e => upd('payDate', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#fc5107]/50 transition-colors">
                <option value="">Select pay date</option>
                {PAY_DATES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          ) : (
            <ReadOnlyField label="Pay Date" value={draft.payDate} />
          )}
        </div>
      </div>

      {/* Banking Details */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#fc5107]" /> Banking Details
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 p-6">
          {editing ? (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Bank Name</label>
              <select value={draft.bankName} onChange={e => upd('bankName', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#fc5107]/50 transition-colors">
                <option value="">Select your bank</option>
                {SA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ) : (
            <ReadOnlyField label="Bank" value={draft.bankName} />
          )}
          <EditableField label="Account Number" value={draft.accountNumber} editing={editing} onChange={v => upd('accountNumber', v.replace(/\D/g, ''))} placeholder="12345678901" mono inputMode="numeric" />
          {editing ? (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {['cheque', 'savings', 'transmission'].map(type => (
                  <button key={type} type="button" onClick={() => upd('accountType', type)}
                    className={`py-2.5 rounded-xl border text-sm font-semibold capitalize transition-all duration-200 ${draft.accountType === type ? 'bg-[#fc5107] border-[#fc5107] text-white' : 'border-gray-200 text-gray-600 hover:border-[#fc5107]/40'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ReadOnlyField label="Account Type" value={draft.accountType} capitalize />
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Changes saved here will be auto-filled into your next loan application.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
function ReadOnlyField({ label, value, mono, capitalize: cap }: {
  label: string; value: string; mono?: boolean; capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm text-gray-900 font-medium ${mono ? 'font-mono' : ''} ${cap ? 'capitalize' : ''}`}>
        {value || <span className="text-gray-300 italic">Not provided</span>}
      </p>
    </div>
  );
}

function EditableField({ label, value, editing, onChange, placeholder, type = 'text', inputMode, prefix, mono, displayValue }: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  prefix?: string;
  mono?: boolean;
  displayValue?: string;
}) {
  if (!editing) {
    return <ReadOnlyField label={label} value={displayValue ?? value} mono={mono} />;
  }
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">{prefix}</span>
        )}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-2.5 text-sm focus:outline-none focus:border-[#fc5107]/50 transition-colors placeholder:text-gray-400 ${prefix ? 'pl-8 pr-4' : 'px-4'} ${mono ? 'font-mono' : ''}`}
        />
      </div>
    </div>
  );
}
