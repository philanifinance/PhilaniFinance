import { useState, useEffect } from 'react';
import {
  User, Briefcase, Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle, AlertCircle, Upload, X, FileCheck, Lock, Loader2,
  Wifi, WifiOff, Link2, ShieldCheck
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { validateSaId } from '../lib/saIdValidator';
import { supabase } from '../lib/supabase';
import { calcLoan, formatCurrency } from '../lib/loanCalculator';
import { useProfile, type ProfileData } from '../lib/ProfileContext';
import type { ToastMessage } from './Toast';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const SA_BANKS = ['Standard Bank', 'FNB', 'Absa', 'Capitec', 'Nedbank', 'TymeBank', 'African Bank', 'Investec'];

// Maps frontend category ids → DB category values
const CATEGORY_DB_MAP: Record<string, string> = {
  payslips: 'payslip',
  bank_statements: 'bank_statement',
  id_copy: 'id_copy',
};

interface FormData {
  firstName: string;
  lastName: string;
  idNumber: string;
  mobileNumber: string;
  email: string;
  employerName: string;
  monthlyIncome: string;
  payDate: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
}

interface DocCategory {
  id: string;
  label: string;
  description: string;
  requiredCount: number;
  files: File[];
  error: string;
}

const initial: FormData = {
  firstName: '', lastName: '', idNumber: '', mobileNumber: '', email: '',
  employerName: '', monthlyIncome: '', payDate: '',
  bankName: '', accountNumber: '', accountType: '',
};

const initialDocs = (): DocCategory[] => [
  {
    id: 'payslips',
    label: 'Payslips',
    description: 'Upload payslips for the last 3 months (PDF, JPEG, PNG)',
    requiredCount: 3,
    files: [],
    error: '',
  },
  {
    id: 'bank_statements',
    label: 'Bank Statements',
    description: 'Upload bank statements for the last 3 months (PDF, JPEG, PNG)',
    requiredCount: 3,
    files: [],
    error: '',
  },
  {
    id: 'id_copy',
    label: 'Identity Document',
    description: 'Upload a valid copy of your ID (PDF, JPEG, PNG)',
    requiredCount: 1,
    files: [],
    error: '',
  },
];

interface ApplicationFormProps {
  isAuthenticated: boolean;
  onRequestAuth: () => void;
  user: SupabaseUser | null;
  onBack: () => void;
  loanAmount?: number;
  loanTermDays?: number;
  onSubmitSuccess?: () => void;
  addToast?: (toast: Omit<ToastMessage, 'id'>) => void;
}

export default function ApplicationForm({
  isAuthenticated, onRequestAuth, user, onBack,
  loanAmount = 2000, loanTermDays = 14,
  onSubmitSuccess, addToast,
}: ApplicationFormProps) {
  const { profile, profileLoaded, saveProfile } = useProfile();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initial);
  const [autoFilled, setAutoFilled] = useState(false);
  const [idError, setIdError] = useState('');
  const [idSuccess, setIdSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState<DocCategory[]>(initialDocs);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [submitPhase, setSubmitPhase] = useState('');

  // Ozow hybrid bank statement state
  const [bankStatementMode, setBankStatementMode] = useState<'choose' | 'ozow' | 'manual'>('choose');
  const [ozowLoading, setOzowLoading] = useState(false);
  const [ozowComplete, setOzowComplete] = useState(false);
  const [ozowError, setOzowError] = useState('');
  const [ozowTxnId, setOzowTxnId] = useState('');

  // Auto-fill from profile context when data becomes available
  useEffect(() => {
    if (profileLoaded && !autoFilled && profile.firstName) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        idNumber: profile.idNumber,
        mobileNumber: profile.mobileNumber,
        email: profile.email,
        employerName: profile.employerName,
        monthlyIncome: profile.monthlyIncome,
        payDate: profile.payDate,
        bankName: profile.bankName,
        accountNumber: profile.accountNumber,
        accountType: profile.accountType,
      });
      // Validate ID if present
      if (profile.idNumber.length === 13) {
        const result = validateSaId(profile.idNumber);
        if (result.valid) setIdSuccess(result.message);
      }
      setAutoFilled(true);
      addToast?.({ type: 'info', title: 'Profile auto-filled', message: 'Your saved details were loaded. Only update what changed.' });
    }
  }, [profileLoaded, profile, autoFilled, addToast]);

  // Fallback: set email from auth if profile is empty
  useEffect(() => {
    if (user?.email && !form.email && !autoFilled) {
      setForm(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user, form.email, autoFilled]);

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'idNumber') {
      setIdError('');
      setIdSuccess('');
      if (value.length === 13) {
        const result = validateSaId(value);
        if (result.valid) setIdSuccess(result.message);
        else setIdError(result.message);
      }
    }
  }

  function renderFileUpload(categoryId: string) {
    const cat = docs.find(d => d.id === categoryId);
    if (!cat) return null;
    return (
      <>
        <label className="flex items-center justify-center w-full bg-white border-2 border-dashed border-gray-200 rounded-xl px-4 py-6 cursor-pointer hover:border-[#22c55e]/40 transition-colors">
          <input type="file" multiple={cat.requiredCount > 1} accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={e => handleFileChange(cat.id, e.target.files)} />
          <div className="text-center">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <span className="text-gray-600 text-sm font-medium">Click to upload</span>
            <span className="text-gray-400 text-xs block mt-1">PDF, JPEG, PNG up to 5MB</span>
          </div>
        </label>
        {cat.error && (
          <p className="mt-2 text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {cat.error}</p>
        )}
        {cat.files.length > 0 && (
          <div className="mt-3 space-y-2">
            {cat.files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-gray-700 text-xs truncate max-w-[200px]">{file.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-[10px]">{(file.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => removeFile(cat.id, idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  function renderDocCategory(categoryId: string) {
    const cat = docs.find(d => d.id === categoryId);
    if (!cat) return null;
    const isComplete = cat.files.length >= cat.requiredCount;
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-900 font-semibold text-sm flex items-center gap-2">
            {isComplete ? <FileCheck className="w-4 h-4 text-[#22c55e]" /> : <Upload className="w-4 h-4 text-gray-400" />}
            {cat.label}
          </span>
          <span className={`text-xs font-medium ${isComplete ? 'text-[#22c55e]' : 'text-amber-600'}`}>
            {cat.files.length} / {cat.requiredCount} uploaded
          </span>
        </div>
        <p className="text-gray-500 text-xs mb-3">{cat.description}</p>
        {renderFileUpload(categoryId)}
      </div>
    );
  }

  function canProceed() {
    if (step === 1) {
      const idOk = validateSaId(form.idNumber).valid;
      return form.firstName && form.lastName && idOk && form.mobileNumber && form.email;
    }
    if (step === 2) return form.employerName && form.monthlyIncome && form.payDate;
    if (step === 3) return form.bankName && form.accountNumber && form.accountType;
    if (step === 4) {
      // Bank statements satisfied by either Ozow or manual upload
      const bankStmtCat = docs.find(d => d.id === 'bank_statements');
      const bankStatementsOk = ozowComplete || (bankStmtCat ? bankStmtCat.files.length >= bankStmtCat.requiredCount : false);
      const otherDocs = docs.filter(d => d.id !== 'bank_statements');
      return bankStatementsOk && otherDocs.every(d => d.files.length >= d.requiredCount);
    }
    return false;
  }

  async function handleOzowLink() {
    if (!user) return;
    setOzowLoading(true);
    setOzowError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ozow-bank-link', {
        body: {
          action: 'init',
          user_id: user.id,
          success_url: window.location.origin + '?ozow=success',
          error_url: window.location.origin + '?ozow=error',
          cancel_url: window.location.origin + '?ozow=cancel',
        },
      });

      if (fnErr) throw new Error(fnErr.message);

      const { redirect_url, transaction_id } = data as { redirect_url: string; transaction_id: string };
      setOzowTxnId(transaction_id);

      if (redirect_url) {
        // Open Ozow in a new tab for PIN auth
        window.open(redirect_url, '_blank', 'noopener,noreferrer');
        addToast?.({ type: 'info', title: 'Ozow opened', message: 'Complete authentication in the new tab, then come back here.' });
        setBankStatementMode('ozow');
      } else {
        throw new Error('No redirect URL received from Ozow');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Ozow';
      setOzowError(msg);
      addToast?.({ type: 'error', title: 'Ozow error', message: msg });
    } finally {
      setOzowLoading(false);
    }
  }

  async function checkOzowStatus() {
    if (!ozowTxnId || !user) return;
    setOzowLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ozow-bank-link', {
        body: { action: 'fetch', user_id: user.id, transaction_id: ozowTxnId },
      });
      if (fnErr) throw new Error(fnErr.message);
      const result = data as { status: string; transactions_count: number };
      if (result.status === 'complete' && result.transactions_count > 0) {
        setOzowComplete(true);
        addToast?.({ type: 'success', title: 'Bank data retrieved', message: `${result.transactions_count} transactions fetched via Ozow.` });
      } else {
        addToast?.({ type: 'info', title: 'Still processing', message: 'Please complete authentication in the Ozow tab first.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to check Ozow status';
      setOzowError(msg);
    } finally {
      setOzowLoading(false);
    }
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Only PDF, JPEG, and PNG are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`;
    }
    return null;
  }

  function handleFileChange(categoryId: string, newFiles: FileList | null) {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);

    setDocs(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;

      const errors: string[] = [];
      const validFiles: File[] = [];
      for (const f of fileArray) {
        const err = validateFile(f);
        if (err) {
          errors.push(`${f.name}: ${err}`);
          addToast?.({ type: 'error', title: 'File rejected', message: `${f.name}: ${err}` });
        } else {
          validFiles.push(f);
        }
      }

      const combined = [...cat.files, ...validFiles];
      const errorMsg = errors.length > 0 ? errors.join('; ') : '';

      return {
        ...cat,
        files: combined.slice(0, cat.requiredCount + 2),
        error: errorMsg,
      };
    }));
  }

  function removeFile(categoryId: string, index: number) {
    setDocs(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, files: cat.files.filter((_, i) => i !== index), error: '' }
        : cat
    ));
  }

  async function uploadDocumentsAndRecord(applicationId: string): Promise<boolean> {
    // Skip bank_statements if Ozow was completed
    const docsToUpload = ozowComplete ? docs.filter(d => d.id !== 'bank_statements') : docs;
    const totalFiles = docsToUpload.reduce((s, c) => s + c.files.length, 0);
    let uploaded = 0;

    try {
      for (const cat of docsToUpload) {
        const dbCategory = CATEGORY_DB_MAP[cat.id];
        for (let i = 0; i < cat.files.length; i++) {
          const file = cat.files[i];
          uploaded++;
          setUploadProgress(`Uploading ${uploaded} of ${totalFiles}: ${file.name}`);

          const ext = file.name.split('.').pop() || '';
          const path = `${user!.id}/${applicationId}/${cat.id}_${i + 1}.${ext}`;

          // Upload to Storage
          const { error: upError } = await supabase.storage
            .from('loan_documents')
            .upload(path, file, { upsert: false });

          if (upError) {
            const msg = upError.message.toLowerCase();
            if (msg.includes('payload too large') || msg.includes('too large')) {
              addToast?.({ type: 'error', title: 'File too large', message: `${file.name} exceeds the server limit.` });
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
              addToast?.({ type: 'error', title: 'Upload timeout', message: `${file.name} timed out. Check your connection.` });
            } else {
              addToast?.({ type: 'error', title: 'Upload failed', message: `${cat.label}: ${upError.message}` });
            }
            setUploadProgress('');
            setError(`Document upload failed for ${cat.label}: ${upError.message}`);
            return false;
          }

          // Insert record into application_documents
          const { error: docErr } = await supabase.from('application_documents').insert({
            application_id: applicationId,
            user_id: user!.id,
            category: dbCategory,
            file_name: file.name,
            storage_path: path,
            file_size: file.size,
            mime_type: file.type,
          });

          if (docErr) {
            console.error('Doc record insert failed:', docErr);
            // Non-fatal: file is still in storage
          }
        }
      }
      setUploadProgress('');
      return true;
    } catch (err) {
      setUploadProgress('');
      addToast?.({ type: 'error', title: 'Upload error', message: 'An unexpected error occurred during upload.' });
      setError('Document upload failed. Please try again.');
      return false;
    }
  }

  async function handleSubmit() {
    if (submitting) return; // Prevent double-submit
    setSubmitting(true);
    setError('');
    setSubmitPhase('Validating...');

    // Validate documents before submitting
    const missingDocs = docs.filter(d => d.files.length < d.requiredCount);
    if (missingDocs.length > 0) {
      setError(`Please upload all required documents: ${missingDocs.map(d => d.label).join(', ')}`);
      addToast?.({ type: 'error', title: 'Missing documents', message: missingDocs.map(d => d.label).join(', ') });
      setSubmitting(false);
      setSubmitPhase('');
      return;
    }

    setSubmitPhase('Saving application...');

    const calc = calcLoan(loanAmount, loanTermDays);

    // Insert application — no document_uploaded column, integers for financial fields
    const { data: insertedApp, error: dbError } = await supabase.from('loan_applications').insert({
      user_id: user?.id,
      loan_amount: Math.round(loanAmount),
      loan_term_days: loanTermDays,
      interest_amount: Math.round(calc.interest),
      service_fee: Math.round(calc.serviceFee),
      vat_amount: Math.round(calc.vat),
      total_repayable: Math.round(calc.totalRepayable),
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      id_number: form.idNumber.trim(),
      mobile_number: form.mobileNumber.trim(),
      email: form.email.trim(),
      employer_name: form.employerName.trim(),
      monthly_income: parseInt(form.monthlyIncome, 10) || 0,
      pay_date: form.payDate,
      bank_name: form.bankName,
      account_number: form.accountNumber.trim(),
      account_type: form.accountType,
    }).select('id').single();

    if (dbError || !insertedApp) {
      setSubmitting(false);
      setSubmitPhase('');
      const msg = dbError?.message || 'Unknown error';
      if (msg.toLowerCase().includes('timeout')) {
        addToast?.({ type: 'error', title: 'Server timeout', message: 'The server took too long. Please try again.' });
      } else if (msg.toLowerCase().includes('violates')) {
        addToast?.({ type: 'error', title: 'Validation error', message: 'Some fields don\'t match the expected format.' });
      } else {
        addToast?.({ type: 'error', title: 'Submission failed', message: msg });
      }
      setError('There was an issue submitting your application. Please try again.');
      return;
    }

    const applicationId = insertedApp.id;

    setSubmitPhase('Uploading documents...');
    const uploadOk = await uploadDocumentsAndRecord(applicationId);
    if (!uploadOk) {
      setSubmitting(false);
      setSubmitPhase('');
      return;
    }

    // Save profile data for auto-fill on future applications
    saveProfile(form as ProfileData);

    setSubmitting(false);
    setSubmitPhase('');
    setSubmitted(true);
    addToast?.({ type: 'success', title: 'Application submitted!', message: 'You will be redirected to your dashboard.' });

    // Redirect to client dashboard after short delay
    if (onSubmitSuccess) {
      setTimeout(() => onSubmitSuccess(), 2000);
    }
  }

  if (submitted) {
    return (
      <section id="apply" className="bg-[#f8fafc] py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="bg-white border border-[#22c55e]/30 rounded-2xl p-12 shadow-sm">
            <CheckCircle className="w-16 h-16 text-[#22c55e] mx-auto mb-4" />
            <h2 className="text-gray-900 font-black text-2xl mb-3">Application Submitted!</h2>
            <p className="text-gray-600 leading-relaxed">
              Thank you, <strong className="text-gray-900">{form.firstName}</strong>. We've received your application
              for <strong className="text-[#22c55e]">{formatCurrency(loanAmount)}</strong> and
              our team will review it shortly.
            </p>
            <p className="text-gray-500 text-sm mt-4">Redirecting to your dashboard...</p>
            <div className="mt-4">
              <Loader2 className="w-5 h-5 text-[#22c55e] animate-spin mx-auto" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section id="apply" className="bg-[#f8fafc] py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="bg-white border border-gray-200 rounded-2xl p-10 sm:p-12 shadow-sm">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-gray-900 font-bold text-xl mb-3">Authentication Required</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              To protect your personal information and comply with NCR regulations, you must sign in or create an account before applying for a loan.
            </p>
            <button
              onClick={onRequestAuth}
              className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25"
            >
              Sign In to Apply
            </button>
          </div>
        </div>
      </section>
    );
  }

  const steps = [
    { num: 1, label: 'Personal', icon: User },
    { num: 2, label: 'Employment', icon: Briefcase },
    { num: 3, label: 'Banking', icon: Building2 },
    { num: 4, label: 'Documents', icon: FileText },
  ];

  const loanCalc = calcLoan(loanAmount, loanTermDays);

  return (
    <section id="apply" className="bg-[#f8fafc] py-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <button
          onClick={onBack}
          className="mb-6 text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Home
        </button>
        <div className="text-center mb-10">
          <span className="text-[#22c55e] text-sm font-semibold uppercase tracking-wider">Ready to Apply?</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">Your Application</h2>
          <p className="text-gray-600 mt-3">
            Applying for <strong className="text-[#22c55e]">{formatCurrency(loanAmount)}</strong> over {loanTermDays} days
            &middot; Total repayable: <strong>{formatCurrency(loanCalc.totalRepayable)}</strong>
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map(({ num, label, icon: Icon }, idx) => (
            <div key={num} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${step === num ? 'bg-[#22c55e] text-white' : step > num ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{num}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-8 h-px mx-1 transition-colors duration-300 ${step > num ? 'bg-[#22c55e]' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Auto-fill banner */}
        {autoFilled && step === 1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-700 text-sm flex items-center gap-2 mb-6">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Your details were auto-filled from your last application. Only update what's changed.
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-gray-900 font-bold text-lg mb-5 flex items-center gap-2"><User className="w-5 h-5 text-[#22c55e]" /> Personal Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First Name" value={form.firstName} onChange={v => update('firstName', v)} placeholder="Sipho" />
                <Field label="Last Name" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Dlamini" />
              </div>
              <div>
                <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={v => update('idNumber', v.replace(/\D/g, '').slice(0, 13))} placeholder="8001015009087" type="text" inputMode="numeric" />
                {idError && <p className="mt-1.5 text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{idError}</p>}
                {idSuccess && <p className="mt-1.5 text-[#22c55e] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{idSuccess}</p>}
              </div>
              <Field label="Mobile Number" value={form.mobileNumber} onChange={v => update('mobileNumber', v)} placeholder="082 000 0000" type="tel" />
              <Field label="Email Address" value={form.email} onChange={v => update('email', v)} placeholder="sipho@email.com" type="email" />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-gray-900 font-bold text-lg mb-5 flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#22c55e]" /> Employment Details</h3>
              <Field label="Employer Name" value={form.employerName} onChange={v => update('employerName', v)} placeholder="ABC Company (Pty) Ltd" />
              <Field label="Monthly Income (ZAR)" value={form.monthlyIncome} onChange={v => update('monthlyIncome', v.replace(/\D/g, ''))} placeholder="8500" type="text" inputMode="numeric" prefix="R" />
              <div>
                <label className="text-gray-600 text-sm font-medium mb-1.5 block">Pay Date</label>
                <select
                  value={form.payDate}
                  onChange={e => update('payDate', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors"
                >
                  <option value="">Select pay date</option>
                  {['1st', '15th', '20th', '25th', '26th', '27th', '28th', '29th', '30th', 'Last day of month', 'Weekly', 'Bi-weekly'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-gray-900 font-bold text-lg mb-5 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#22c55e]" /> Banking Details</h3>
              <div>
                <label className="text-gray-600 text-sm font-medium mb-1.5 block">Bank Name</label>
                <select
                  value={form.bankName}
                  onChange={e => update('bankName', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors"
                >
                  <option value="">Select your bank</option>
                  {SA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <Field label="Account Number" value={form.accountNumber} onChange={v => update('accountNumber', v.replace(/\D/g, ''))} placeholder="12345678901" type="text" inputMode="numeric" />
              <div>
                <label className="text-gray-600 text-sm font-medium mb-1.5 block">Account Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {['cheque', 'savings', 'transmission'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => update('accountType', type)}
                      className={`py-3 rounded-xl border text-sm font-semibold capitalize transition-all duration-200 ${form.accountType === type ? 'bg-[#22c55e] border-[#22c55e] text-white' : 'border-gray-200 text-gray-600 hover:border-[#22c55e]/40'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-gray-900 font-bold text-lg mb-5 flex items-center gap-2"><FileText className="w-5 h-5 text-[#22c55e]" /> Document Upload</h3>

              {/* ── Bank Statements: Hybrid Ozow + Manual ────────────── */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 rounded-xl border border-blue-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-900 font-semibold text-sm flex items-center gap-2">
                    {ozowComplete ? <ShieldCheck className="w-4 h-4 text-[#22c55e]" /> : <Building2 className="w-4 h-4 text-blue-600" />}
                    Bank Statements (3 Months)
                  </span>
                  {ozowComplete && (
                    <span className="text-xs font-semibold text-[#22c55e] bg-green-100 px-2.5 py-0.5 rounded-full">✓ Verified via Ozow</span>
                  )}
                </div>

                {ozowComplete ? (
                  <div className="bg-white border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Bank data retrieved successfully</p>
                      <p className="text-xs text-gray-500 mt-0.5">90 days of transaction history fetched via Ozow. No manual upload needed.</p>
                    </div>
                  </div>
                ) : bankStatementMode === 'choose' ? (
                  <div className="space-y-3">
                    <p className="text-gray-500 text-xs">Choose how to provide your bank statements:</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button type="button" onClick={handleOzowLink} disabled={ozowLoading}
                        className="p-4 rounded-xl border-2 border-blue-200 bg-white hover:border-blue-400 text-left transition-all group">
                        <div className="flex items-center gap-2 mb-2">
                          <Wifi className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-sm text-gray-900">Ozow PIN (Instant)</span>
                        </div>
                        <p className="text-xs text-gray-500">Link your bank securely. We fetch 90 days of statements automatically.</p>
                        <span className="inline-block mt-2 text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Recommended</span>
                      </button>
                      <button type="button" onClick={() => setBankStatementMode('manual')}
                        className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-300 text-left transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Upload className="w-4 h-4 text-gray-500" />
                          <span className="font-bold text-sm text-gray-900">Manual Upload</span>
                        </div>
                        <p className="text-xs text-gray-500">Upload 3 months of PDF bank statements manually.</p>
                      </button>
                    </div>
                    {ozowError && (
                      <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {ozowError}</p>
                    )}
                  </div>
                ) : bankStatementMode === 'ozow' ? (
                  <div className="space-y-3">
                    <div className="bg-white border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Link2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">Ozow session started</p>
                          <p className="text-xs text-gray-500 mt-0.5">Complete the PIN authentication in the new tab, then click below.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={checkOzowStatus} disabled={ozowLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                        {ozowLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        {ozowLoading ? 'Checking...' : "I've Completed Ozow"}
                      </button>
                      <button type="button" onClick={() => setBankStatementMode('manual')}
                        className="px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors">
                        <WifiOff className="w-4 h-4" />
                      </button>
                    </div>
                    {ozowError && (
                      <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {ozowError}</p>
                    )}
                  </div>
                ) : (
                  /* Manual upload fallback for bank statements */
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button type="button" onClick={() => setBankStatementMode('choose')}
                        className="text-blue-600 text-xs font-medium hover:underline flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Switch to Ozow instead
                      </button>
                      {(() => {
                        const cat = docs.find(d => d.id === 'bank_statements');
                        return cat ? (
                          <span className={`text-xs font-medium ${cat.files.length >= cat.requiredCount ? 'text-[#22c55e]' : 'text-amber-600'}`}>
                            {cat.files.length} / {cat.requiredCount} uploaded
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {renderFileUpload('bank_statements')}
                  </div>
                )}
              </div>

              {/* ── Payslips (always manual) ─────────────────────────── */}
              {renderDocCategory('payslips')}

              {/* ── ID Copy (always manual) ──────────────────────────── */}
              {renderDocCategory('id_copy')}

              {uploadProgress && (
                <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-4 py-3 text-[#22c55e] text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadProgress}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {submitPhase || 'Submitting...'}
                  </>
                ) : (
                  <>Submit Application <CheckCircle className="w-4 h-4" /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  prefix?: string;
}

function Field({ label, value, onChange, placeholder, type = 'text', inputMode, prefix }: FieldProps) {
  return (
    <div>
      <label className="text-gray-600 text-sm font-medium mb-1.5 block">{label}</label>
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
          className={`w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors placeholder:text-gray-400 ${prefix ? 'pl-8 pr-4' : 'px-4'}`}
        />
      </div>
    </div>
  );
}
