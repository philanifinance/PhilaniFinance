import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, FileText, Download, CheckCircle, Loader2,
  Pen, RotateCcw, AlertCircle, Shield, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

// ── Types ─────────────────────────────────────────────────────────────
export interface LoanContractRecord {
  id: string;
  application_id: string;
  user_id: string;
  contract_number: string;
  generated_by: string | null;
  generated_at: string;
  signed_by_client: boolean;
  client_signature: string | null;
  signed_at: string | null;
  status: 'pending_signature' | 'signed' | 'cancelled';
  created_at: string;
}

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
  created_at: string;
}

interface LoanContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: LoanApplication;
  existingContract: LoanContractRecord | null;
  isAdminView: boolean;
  onContractUpdate: (contract: LoanContractRecord) => void;
}

// ── NCR / Company Constants ───────────────────────────────────────────
const COMPANY = {
  name: 'Philani Financial Services',
  ncr: 'NCRCP18260',
  reg: 'NCRCP18260',
  address: '3663 Mtshilibe Street, Ratanda, Heidelberg, 1441',
  phone: '013 752 2478',
  email: 'info@philanifinance.co.za',
};

// ── Helpers ───────────────────────────────────────────────────────────
function fmtZar(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function generateContractNumber(appId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const short = appId.slice(0, 6).toUpperCase();
  return `PFC-${short}-${ts}`;
}

// ── Signature Pad ─────────────────────────────────────────────────────
function SignaturePad({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasStrokes(true);
    };
    const onUp = () => { drawing.current = false; };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onClear();
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 hover:border-[#22c55e]/50 transition-colors cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full h-[120px] touch-none"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasStrokes}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" /> Apply Signature
        </button>
      </div>
      <p className="text-[10px] text-gray-400">Draw your signature above using mouse or touch, then click "Apply Signature".</p>
    </div>
  );
}

// ── Contract Document (printable) ─────────────────────────────────────
function ContractDocument({
  app,
  contractNumber,
  generatedAt,
  signature,
  signedAt,
}: {
  app: LoanApplication;
  contractNumber: string;
  generatedAt: string;
  signature?: string | null;
  signedAt?: string | null;
}) {
  const repayDate = (() => {
    const d = new Date(app.created_at);
    d.setDate(d.getDate() + app.loan_term_days);
    return fmtDate(d.toISOString());
  })();

  return (
    <div id="loan-contract-document" className="bg-white text-gray-900 text-sm leading-relaxed space-y-6 p-2">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-black text-[#22c55e]">{COMPANY.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">NCR Registration: <span className="font-semibold">{COMPANY.ncr}</span></p>
          <p className="text-xs text-gray-500">Company Reg: {COMPANY.reg}</p>
          <p className="text-xs text-gray-500">{COMPANY.address}</p>
          <p className="text-xs text-gray-500">{COMPANY.phone} &middot; {COMPANY.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Loan Agreement Contract</p>
          <p className="text-xs text-gray-400 mt-1">Contract No: <span className="font-mono font-semibold text-gray-700">{contractNumber}</span></p>
          <p className="text-xs text-gray-400">Date: {fmtDate(generatedAt)}</p>
        </div>
      </div>

      {/* Parties */}
      <section>
        <h2 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#22c55e]" /> Parties to this Agreement
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-2">Credit Provider</p>
            <p className="font-bold text-gray-900">{COMPANY.name}</p>
            <p className="text-xs text-gray-600">NCR No: {COMPANY.ncr}</p>
            <p className="text-xs text-gray-600">Reg No: {COMPANY.reg}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-2">Consumer (Client)</p>
            <p className="font-bold text-gray-900">{app.first_name} {app.last_name}</p>
            <p className="text-xs text-gray-600">SA ID: {app.id_number}</p>
            <p className="text-xs text-gray-600">{app.email}</p>
            <p className="text-xs text-gray-600">{app.mobile_number}</p>
          </div>
        </div>
      </section>

      {/* Loan Details */}
      <section>
        <h2 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-[#22c55e]" /> Loan Details (Pre-Agreement Statement & Quotation)
        </h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 font-medium w-1/2">Principal Loan Amount</td>
                <td className="px-4 py-2.5 font-bold text-gray-900">{fmtZar(app.loan_amount)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-gray-500 font-medium">Loan Term</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">{app.loan_term_days} days</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 font-medium">Interest Amount</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">{fmtZar(app.interest_amount)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-gray-500 font-medium">Initiation / Service Fee</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">{fmtZar(app.service_fee)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 font-medium">VAT (15%)</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">{fmtZar(app.vat_amount)}</td>
              </tr>
              <tr className="bg-green-50">
                <td className="px-4 py-2.5 text-gray-700 font-bold">Total Amount Repayable</td>
                <td className="px-4 py-2.5 font-black text-[#22c55e] text-base">{fmtZar(app.total_repayable)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-gray-500 font-medium">Repayment Date</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">{repayDate}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 font-medium">Repayment Method</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">DebiCheck Debit Order</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Banking & Employment */}
      <section>
        <h2 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-3">Consumer Banking & Employment</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-semibold">{app.bank_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account No.</span><span className="font-semibold font-mono">{app.account_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account Type</span><span className="font-semibold capitalize">{app.account_type}</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Employer</span><span className="font-semibold">{app.employer_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Monthly Income</span><span className="font-semibold">{fmtZar(app.monthly_income)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Pay Date</span><span className="font-semibold">{app.pay_date}</span></div>
          </div>
        </div>
      </section>

      {/* Terms & Conditions */}
      <section>
        <h2 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#22c55e]" /> Terms & Conditions
        </h2>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-xs text-gray-600">
          <p><strong>1. National Credit Act (NCA).</strong> This agreement is governed by the National Credit Act 34 of 2005. {COMPANY.name} is a registered credit provider (NCR No: {COMPANY.ncr}).</p>
          <p><strong>2. Repayment.</strong> The consumer agrees to repay the Total Amount Repayable of {fmtZar(app.total_repayable)} on or before {repayDate} via DebiCheck debit order from the banking account specified above.</p>
          <p><strong>3. Interest & Fees.</strong> All fees and interest are as per the NCA prescribed limits. A breakdown is provided in the Loan Details table above.</p>
          <p><strong>4. Late Payments.</strong> A late payment penalty fee may be charged in accordance with NCA regulations. The credit provider reserves the right to report defaults to credit bureaus.</p>
          <p><strong>5. Cooling-Off Period.</strong> The consumer may cancel this agreement within 5 business days of signing, without penalty, by providing written notice to the credit provider.</p>
          <p><strong>6. Default.</strong> Failure to repay on the agreed date constitutes a default. The credit provider may institute legal proceedings and report the consumer to credit bureaus after sending a Section 129 notice as required by the NCA.</p>
          <p><strong>7. POPIA Consent.</strong> The consumer consents to the processing of their personal information as described in {COMPANY.name}'s Privacy Policy, for the purpose of administering this credit agreement.</p>
          <p><strong>8. Dispute Resolution.</strong> Any disputes shall be referred to the National Credit Regulator (NCR) or the National Consumer Tribunal (NCT) as applicable.</p>
          <p><strong>9. Electronic Signature.</strong> The consumer's electronic signature below constitutes a valid and binding signature in accordance with the Electronic Communications and Transactions Act 25 of 2002 (ECTA).</p>
        </div>
      </section>

      {/* Signature Block */}
      <section className="border-t-2 border-gray-200 pt-4">
        <h2 className="text-xs font-black text-gray-700 uppercase tracking-wide mb-4">Signatures</h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Consumer signature */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">Consumer Signature</p>
            {signature ? (
              <div className="border border-green-200 bg-green-50 rounded-xl p-2 flex items-center justify-center min-h-[80px]">
                <img src={signature} alt="Client Signature" className="max-h-[70px] object-contain" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl min-h-[80px] flex items-center justify-center">
                <span className="text-xs text-gray-400 italic">Awaiting signature</span>
              </div>
            )}
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>Name: <span className="font-semibold">{app.first_name} {app.last_name}</span></p>
              <p>ID No: <span className="font-mono font-semibold">{app.id_number}</span></p>
              <p>Date: <span className="font-semibold">{signedAt ? fmtDate(signedAt) : '_______________'}</span></p>
            </div>
          </div>
          {/* Provider signature */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">Credit Provider (Authorised Signatory)</p>
            <div className="border border-gray-200 bg-gray-50 rounded-xl min-h-[80px] flex items-center justify-center">
              <span className="text-xs text-gray-400 italic">Philani Finance (Pty) Ltd</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p>Company: <span className="font-semibold">{COMPANY.name}</span></p>
              <p>NCR No: <span className="font-semibold">{COMPANY.ncr}</span></p>
              <p>Date: <span className="font-semibold">{fmtDate(generatedAt)}</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-400 text-center">
        <p>{COMPANY.name} · Reg No: {COMPANY.reg} · NCR No: {COMPANY.ncr}</p>
        <p>Contract Ref: {contractNumber} · Generated: {fmtDate(generatedAt)}</p>
        <p>This document is governed by the National Credit Act 34 of 2005 and the Electronic Communications and Transactions Act 25 of 2002.</p>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────
export default function LoanContractModal({
  isOpen,
  onClose,
  application,
  existingContract,
  isAdminView,
  onContractUpdate,
}: LoanContractModalProps) {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [contract, setContract] = useState<LoanContractRecord | null>(existingContract);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [signatureApplied, setSignatureApplied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setContract(existingContract);
    setPendingSignature(null);
    setSignatureApplied(false);
    setError('');
  }, [existingContract, isOpen]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const contractNumber = generateContractNumber(application.id);

      const { data: inserted, error: insertErr } = await supabase
        .from('loan_contracts')
        .insert({
          application_id: application.id,
          user_id: application.user_id,
          contract_number: contractNumber,
          generated_by: user.id,
          status: 'pending_signature',
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      const newContract = inserted as LoanContractRecord;
      setContract(newContract);
      onContractUpdate(newContract);

      await logAudit('contract_generated', 'loan_contract', newContract.id, {
        contract_number: contractNumber,
        application_id: application.id,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [application, onContractUpdate]);

  const handleSignatureApplied = useCallback((dataUrl: string) => {
    setPendingSignature(dataUrl);
    setSignatureApplied(true);
  }, []);

  const handleSignatureClear = useCallback(() => {
    setPendingSignature(null);
    setSignatureApplied(false);
  }, []);

  const handleSubmitSigned = useCallback(async () => {
    if (!contract || !pendingSignature) return;
    setSubmitting(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const { data: updated, error: updateErr } = await supabase
        .from('loan_contracts')
        .update({
          signed_by_client: true,
          client_signature: pendingSignature,
          signed_at: now,
          status: 'signed',
        })
        .eq('id', contract.id)
        .select()
        .single();

      if (updateErr) throw new Error(updateErr.message);

      const updatedContract = updated as LoanContractRecord;
      setContract(updatedContract);
      onContractUpdate(updatedContract);

      await logAudit('contract_signed', 'loan_contract', contract.id, {
        contract_number: contract.contract_number,
        signed_at: now,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [contract, pendingSignature, onContractUpdate]);

  const handleDownloadPDF = useCallback(() => {
    setDownloading(true);
    // Open the contract in a new printable window
    const el = document.getElementById('loan-contract-document');
    if (!el) { setDownloading(false); return; }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { setDownloading(false); return; }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Loan Agreement - ${contract?.contract_number || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20mm; }
          h1 { font-size: 18px; color: #22c55e; }
          h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .section { margin-bottom: 20px; }
          .sig-box { border: 1px solid #d1d5db; border-radius: 8px; min-height: 70px; display: flex; align-items: center; justify-content: center; padding: 8px; }
          .footer { border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; font-size: 9px; color: #9ca3af; }
          .green { color: #16a34a; font-weight: bold; }
          img { max-height: 60px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      setDownloading(false);
    }, 500);
  }, [contract]);

  if (!isOpen) return null;

  const isSigned = contract?.status === 'signed';
  const isPending = contract?.status === 'pending_signature';

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-3xl shadow-2xl my-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#22c55e]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Loan Agreement Contract</h2>
              {contract && (
                <p className="text-xs text-gray-400 font-mono">{contract.contract_number}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {contract && (
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download / Print
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Badge */}
        {contract && (
          <div className={`px-6 py-3 flex items-center gap-2 border-b border-gray-100 text-sm font-medium ${
            isSigned ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {isSigned ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {isSigned
              ? `Contract signed on ${fmtDate(contract.signed_at!)}`
              : 'Contract pending client signature'}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Generate button — admin only, no contract yet */}
          {isAdminView && !contract && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
              <FileText className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Generate Loan Agreement Contract</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will create a formal loan agreement pre-populated with the client's information and {COMPANY.name}'s NCR details. The contract will be sent to the client for signing.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-sm"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {generating ? 'Generating…' : 'Generate Contract'}
              </button>
            </div>
          )}

          {/* Contract document */}
          {contract && (
            <ContractDocument
              app={application}
              contractNumber={contract.contract_number}
              generatedAt={contract.generated_at}
              signature={contract.client_signature}
              signedAt={contract.signed_at}
            />
          )}

          {/* Client signature section — client view only, contract pending */}
          {!isAdminView && contract && isPending && (
            <div className="border-t-2 border-dashed border-gray-200 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Pen className="w-5 h-5 text-[#22c55e]" />
                <h3 className="font-bold text-gray-900">Sign the Agreement</h3>
              </div>
              <p className="text-sm text-gray-500">
                By signing below, you confirm that you have read, understood, and agree to all the terms and conditions of this loan agreement.
              </p>

              {!signatureApplied ? (
                <SignaturePad onSave={handleSignatureApplied} onClear={handleSignatureClear} />
              ) : (
                <div className="space-y-3">
                  <div className="border border-green-200 bg-green-50 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Signature applied</span>
                    </div>
                    <button
                      onClick={handleSignatureClear}
                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Redo
                    </button>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <strong>Please note:</strong> Once submitted, your signature cannot be changed. This constitutes a legally binding electronic signature under ECTA 25 of 2002.
                  </div>
                  <button
                    onClick={handleSubmitSigned}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-green-500/20"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {submitting ? 'Submitting…' : 'Submit Signed Contract'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Signed confirmation */}
          {!isAdminView && contract && isSigned && (
            <div className="border-t-2 border-green-200 pt-5 bg-green-50 rounded-2xl p-5 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800">Contract Signed Successfully</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your signed loan agreement has been submitted to {COMPANY.name}. You may download a copy for your records. The next step is the DebiCheck debit mandate authorisation.
                </p>
              </div>
            </div>
          )}

          {/* Admin: no generate button needed when contract exists — show read-only status */}
          {isAdminView && contract && !isSigned && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Awaiting client signature. The client can view and sign the contract from their dashboard.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
