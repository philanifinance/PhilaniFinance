import { useState, useMemo, useCallback } from 'react';
import {
  X, Loader2, CheckCircle, AlertCircle, Shield,
  CreditCard, User, Briefcase, Calendar, Clock,
  Send, Ban, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

// ── Types ────────────────────────────────────────────────────────────
interface LoanApplication {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  mobile_number: string;
  email: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  loan_amount: number;
  loan_term_days: number;
  total_repayable: number;
  interest_amount: number;
  service_fee: number;
  vat_amount: number;
  created_at: string;
}

export interface MandateRecord {
  id: string;
  application_id: string;
  contract_ref: string;
  nupay_mandate_id: string | null;
  debicheck_type: string;
  instalment_amount: number;
  num_instalments: number;
  frequency: string;
  first_strike_date: string;
  tracking_days: number;
  status: string;
  nupay_response_code: string | null;
  nupay_response_message: string | null;
  error_details: string | null;
  initiated_at: string;
  status_updated_at: string;
}

type ModalView = 'form' | 'submitting' | 'result';

// ── SA Bank Branch Codes ─────────────────────────────────────────────
const BRANCH_CODES: Record<string, string> = {
  'Standard Bank': '051001',
  'FNB':           '250655',
  'Absa':          '632005',
  'Capitec':       '470010',
  'Nedbank':       '198765',
  'TymeBank':      '678910',
  'African Bank':  '430000',
  'Investec':      '580105',
};

// ── Mandate Status Config ─────────────────────────────────────────────
const mandateStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:              { label: 'Draft',          color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Clock },
  mandate_submitted:  { label: 'Submitted',      color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Send },
  pending_bank:       { label: 'At Bank',         color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Clock },
  accepted:           { label: 'Accepted',        color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  rejected:           { label: 'Rejected',        color: 'text-red-700',    bg: 'bg-red-100',    icon: Ban },
  cancelled:          { label: 'Cancelled',       color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Ban },
  error:              { label: 'Error',           color: 'text-red-700',    bg: 'bg-red-100',    icon: AlertCircle },
};

// ── Helpers ───────────────────────────────────────────────────────────
function fmtZar(n: number) { return 'R ' + n.toLocaleString('en-ZA'); }

function generateContractRef(appId: string): string {
  const prefix = 'PF';
  const ts = Date.now().toString(36).toUpperCase();
  const short = appId.slice(0, 8).toUpperCase();
  return `${prefix}-${short}-${ts}`;
}

function getDefaultStrikeDate(daysFromNow: number = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

// ── Props ─────────────────────────────────────────────────────────────
interface DebiCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: LoanApplication;
  existingMandate: MandateRecord | null;
  onMandateUpdate: (mandate: MandateRecord) => void;
}

// ── Component ─────────────────────────────────────────────────────────
export default function DebiCheckModal({
  isOpen, onClose, application, existingMandate, onMandateUpdate
}: DebiCheckModalProps) {
  const app = application;
  const branchCode = BRANCH_CODES[app.bank_name] || '';

  // Form state
  const [debiCheckType, setDebiCheckType] = useState<'TT1' | 'TT2'>('TT1');
  const [instalmentAmount, setInstalmentAmount] = useState(app.total_repayable);
  const [numInstalments, setNumInstalments] = useState(1);
  const [frequency, setFrequency] = useState('once-off');
  const [firstStrikeDate, setFirstStrikeDate] = useState(getDefaultStrikeDate(3));
  const [trackingDays, setTrackingDays] = useState(10);
  const [customBranchCode, setCustomBranchCode] = useState(branchCode);

  // UI state
  const [modalView, setModalView] = useState<ModalView>('form');
  const [resultStatus, setResultStatus] = useState<'success' | 'error'>('success');
  const [resultMessage, setResultMessage] = useState('');

  const contractRef = useMemo(() => generateContractRef(app.id), [app.id]);

  // Check if mandate already exists and is active
  const mandateBlocked = existingMandate && !['rejected', 'cancelled', 'error'].includes(existingMandate.status);

  const handleSubmit = useCallback(async () => {
    if (mandateBlocked) return;

    setModalView('submitting');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Insert mandate record as "draft"
      const mandatePayload = {
        application_id: app.id,
        user_id: app.user_id,
        contract_ref: contractRef,
        debicheck_type: debiCheckType,
        instalment_amount: instalmentAmount,
        num_instalments: numInstalments,
        frequency,
        first_strike_date: firstStrikeDate,
        tracking_days: trackingDays,
        client_name: `${app.first_name} ${app.last_name}`,
        client_id_number: app.id_number,
        client_mobile: app.mobile_number,
        client_bank: app.bank_name,
        client_account_number: app.account_number,
        client_account_type: app.account_type,
        client_branch_code: customBranchCode,
        status: 'draft',
        initiated_by: user.id,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('debicheck_mandates')
        .insert(mandatePayload)
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);
      const mandate = inserted as MandateRecord;

      // 2. Call the Edge Function to initiate with NuPay
      const { data: fnResult, error: fnErr } = await supabase.functions.invoke('nupay-initiate', {
        body: { mandate_id: mandate.id },
      });

      if (fnErr) {
        // Edge Function failed — update mandate to error
        await supabase.from('debicheck_mandates')
          .update({ status: 'error', error_details: fnErr.message, status_updated_at: new Date().toISOString() })
          .eq('id', mandate.id);

        await logAudit('debicheck_error', 'debicheck_mandate', mandate.id, { error: fnErr.message });

        setResultStatus('error');
        setResultMessage(`NuPay API call failed: ${fnErr.message}`);
        setModalView('result');
        onMandateUpdate({ ...mandate, status: 'error', error_details: fnErr.message });
        return;
      }

      // 3. Update mandate with NuPay response
      const updated = fnResult as MandateRecord;
      await logAudit('debicheck_initiated', 'debicheck_mandate', mandate.id, {
        contract_ref: contractRef,
        type: debiCheckType,
        amount: instalmentAmount,
        nupay_response: updated.nupay_response_code,
      });

      setResultStatus('success');
      setResultMessage(
        debiCheckType === 'TT1'
          ? 'DebiCheck request sent! The client should receive a push notification on their banking app now. Ask them to authenticate immediately.'
          : 'DebiCheck mandate submitted for non-real-time processing. The bank will process this within 2-3 business days.'
      );
      setModalView('result');
      onMandateUpdate(updated);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setResultStatus('error');
      setResultMessage(msg);
      setModalView('result');
    }
  }, [app, contractRef, debiCheckType, instalmentAmount, numInstalments, frequency, firstStrikeDate, trackingDays, customBranchCode, mandateBlocked, onMandateUpdate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">NuPay DebiCheck</h2>
              <p className="text-xs text-gray-500">Mandate Initiation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── EXISTING MANDATE STATUS ──────────────────────────────── */}
        {existingMandate && (
          <div className={`mx-6 mt-4 p-4 rounded-xl border ${mandateBlocked ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = mandateStatusConfig[existingMandate.status] || mandateStatusConfig.draft;
                  const Icon = cfg.icon;
                  return (
                    <>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      <span className="text-xs text-gray-500">Ref: <span className="font-mono">{existingMandate.contract_ref}</span></span>
                    </>
                  );
                })()}
              </div>
              <span className="text-[10px] text-gray-400">
                {new Date(existingMandate.status_updated_at).toLocaleString('en-ZA')}
              </span>
            </div>
            {existingMandate.nupay_response_message && (
              <p className="text-xs text-gray-600 mt-2">{existingMandate.nupay_response_message}</p>
            )}
            {existingMandate.error_details && (
              <p className="text-xs text-red-600 mt-2">{existingMandate.error_details}</p>
            )}
            {mandateBlocked && (
              <p className="text-xs text-amber-700 mt-2 font-medium">
                A mandate is already active for this loan. You cannot send a duplicate request.
              </p>
            )}
          </div>
        )}

        {/* ── FORM VIEW ───────────────────────────────────────────── */}
        {modalView === 'form' && (
          <div className="p-6 space-y-6">

            {/* Client Identifiers (read-only, pre-filled) */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Client Identifiers
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <ReadField label="Full Name" value={`${app.first_name} ${app.last_name}`} />
                <ReadField label="SA ID Number" value={app.id_number} mono />
                <ReadField label="Mobile (USSD/Push)" value={app.mobile_number} />
              </div>
            </div>

            {/* Bank Details (read-only, pre-filled) */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Bank Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <ReadField label="Bank" value={app.bank_name} />
                <ReadField label="Account Number" value={app.account_number} mono />
                <ReadField label="Account Type" value={app.account_type} capitalize />
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Branch Code</label>
                  <input type="text" value={customBranchCode}
                    onChange={e => setCustomBranchCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-mono rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                    placeholder="000000" />
                </div>
              </div>
            </div>

            {/* Contract Details (configurable) */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Contract Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <ReadField label="Loan Reference" value={contractRef} mono />
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Instalment Amount (ZAR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R</span>
                    <input type="number" value={instalmentAmount}
                      onChange={e => setInstalmentAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg pl-8 pr-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-400 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Number of Instalments</label>
                  <input type="number" min={1} max={36} value={numInstalments}
                    onChange={e => setNumInstalments(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Frequency</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors">
                    <option value="once-off">Once-Off</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> First Strike Date
                  </label>
                  <input type="date" value={firstStrikeDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setFirstStrikeDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">Tracking Days</label>
                  <div className="flex gap-2">
                    {[10, 32].map(d => (
                      <button key={d} type="button" onClick={() => setTrackingDays(d)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${trackingDays === d ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                        {d} days
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {trackingDays === 10 ? 'Standard: NuPay retries for 10 days if account has insufficient funds.' : 'Extended: NuPay retries for 32 days — use for salary-dependent clients.'}
                  </p>
                </div>
              </div>
            </div>

            {/* DebiCheck Type */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> DebiCheck Type
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setDebiCheckType('TT1')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${debiCheckType === 'TT1' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <p className="font-bold text-sm text-gray-900">TT1 — Real-Time</p>
                  <p className="text-xs text-gray-500 mt-1">Immediate push to client's banking app. Best for phone-based onboarding.</p>
                  <span className="inline-block mt-2 text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Recommended</span>
                </button>
                <button type="button" onClick={() => setDebiCheckType('TT2')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${debiCheckType === 'TT2' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                  <p className="font-bold text-sm text-gray-900">TT2 — Non-Real-Time</p>
                  <p className="text-xs text-gray-500 mt-1">Bank processes offline. Client approves within 2-3 business days.</p>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Mandate Summary</h4>
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-gray-900 text-right">{fmtZar(instalmentAmount)}</span>
                <span className="text-gray-500">Instalments</span>
                <span className="font-medium text-gray-900 text-right">{numInstalments} × {frequency}</span>
                <span className="text-gray-500">First Debit</span>
                <span className="font-medium text-gray-900 text-right">{firstStrikeDate}</span>
                <span className="text-gray-500">Tracking</span>
                <span className="font-medium text-gray-900 text-right">{trackingDays} days</span>
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900 text-right">{debiCheckType} ({debiCheckType === 'TT1' ? 'Real-Time' : 'Non-Real-Time'})</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit}
                disabled={!!mandateBlocked || !customBranchCode || !firstStrikeDate || instalmentAmount <= 0}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-blue-500/20">
                <Send className="w-4 h-4" /> Initiate DebiCheck
              </button>
            </div>
          </div>
        )}

        {/* ── SUBMITTING VIEW ─────────────────────────────────────── */}
        {modalView === 'submitting' && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Initiating NuPay DebiCheck</h3>
            <p className="text-sm text-gray-500">
              Authenticating with NuPay and submitting mandate request...
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-gray-400">
              <span>• Generating JWT authentication token</span>
              <span>• Sending {debiCheckType} mandate to NuPay API</span>
              <span>• Awaiting confirmation...</span>
            </div>
          </div>
        )}

        {/* ── RESULT VIEW ─────────────────────────────────────────── */}
        {modalView === 'result' && (
          <div className="p-12 text-center">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${resultStatus === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
              {resultStatus === 'success'
                ? <CheckCircle className="w-8 h-8 text-green-600" />
                : <AlertCircle className="w-8 h-8 text-red-600" />}
            </div>
            <h3 className={`text-lg font-bold mb-2 ${resultStatus === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {resultStatus === 'success' ? 'Mandate Request Sent' : 'Initiation Failed'}
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">{resultMessage}</p>
            {resultStatus === 'success' && debiCheckType === 'TT1' && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left max-w-md mx-auto">
                <p className="text-xs font-bold text-blue-800 mb-1">📱 Next Step</p>
                <p className="text-xs text-blue-700">
                  Tell the client: "I've just sent the DebiCheck request. Please open your banking app now and approve the debit order."
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-6 max-w-sm mx-auto">
              <button onClick={onClose}
                className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Close
              </button>
              {resultStatus === 'error' && (
                <button onClick={() => setModalView('form')}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mandate Status Badge (exported for use in AdminDashboard) ────────
export function MandateStatusBadge({ mandate }: { mandate: MandateRecord | null }) {
  if (!mandate) return null;
  const cfg = mandateStatusConfig[mandate.status] || mandateStatusConfig.draft;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
      <span className="text-[10px] text-gray-400 font-mono">{mandate.contract_ref}</span>
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────
function ReadField({ label, value, mono, capitalize: cap }: {
  label: string; value: string; mono?: boolean; capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 ${mono ? 'font-mono' : ''} ${cap ? 'capitalize' : ''}`}>
        {value || <span className="text-gray-300 italic">N/A</span>}
      </p>
    </div>
  );
}
