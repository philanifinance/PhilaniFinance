import { useState } from 'react';
import {
  User, Briefcase, Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle, AlertCircle, Upload, X, FileCheck, Lock
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { validateSaId } from '../lib/saIdValidator';
import { supabase } from '../lib/supabase';
import { calcLoan } from '../lib/loanCalculator';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const SA_BANKS = ['Standard Bank', 'FNB', 'Absa', 'Capitec', 'Nedbank', 'TymeBank', 'African Bank', 'Investec'];

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
}

export default function ApplicationForm({ isAuthenticated, onRequestAuth, user, onBack }: ApplicationFormProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initial);
  const [idError, setIdError] = useState('');
  const [idSuccess, setIdSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState<DocCategory[]>(initialDocs);
  const [uploadProgress, setUploadProgress] = useState<string>('');

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

  function canProceed() {
    if (step === 1) {
      const idOk = validateSaId(form.idNumber).valid;
      return form.firstName && form.lastName && idOk && form.mobileNumber && form.email;
    }
    if (step === 2) return form.employerName && form.monthlyIncome && form.payDate;
    if (step === 3) return form.bankName && form.accountNumber && form.accountType;
    if (step === 4) {
      return docs.every(d => d.files.length >= d.requiredCount);
    }
    return false;
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Only PDF, JPEG, and PNG are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 5MB.';
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
        if (err) errors.push(`${f.name}: ${err}`);
        else validFiles.push(f);
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

  async function uploadDocuments(applicationId: string): Promise<boolean> {
    setUploadProgress('Uploading documents...');
    try {
      for (const cat of docs) {
        for (let i = 0; i < cat.files.length; i++) {
          const file = cat.files[i];
          const ext = file.name.split('.').pop() || '';
          const path = `${user!.id}/${applicationId}/${cat.id}_${i + 1}.${ext}`;
          const { error: upError } = await supabase.storage
            .from('loan_documents')
            .upload(path, file, { upsert: false });
          if (upError) {
            setUploadProgress('');
            setError(`Document upload failed for ${cat.label}: ${upError.message}`);
            return false;
          }
        }
      }
      setUploadProgress('');
      return true;
    } catch (err) {
      setUploadProgress('');
      setError('Document upload failed. Please try again.');
      return false;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    // Validate documents before submitting
    const missingDocs = docs.filter(d => d.files.length < d.requiredCount);
    if (missingDocs.length > 0) {
      setError(`Please upload all required documents: ${missingDocs.map(d => d.label).join(', ')}`);
      setSubmitting(false);
      return;
    }

    const calc = calcLoan(2000, 14);
    const applicationId = crypto.randomUUID ? crypto.randomUUID() : `app-${Date.now()}`;

    const { error: dbError } = await supabase.from('loan_applications').insert({
      id: applicationId,
      user_id: user?.id,
      loan_amount: 2000,
      loan_term_days: 14,
      interest_amount: calc.interest,
      service_fee: calc.serviceFee,
      vat_amount: calc.vat,
      total_repayable: calc.totalRepayable,
      first_name: form.firstName,
      last_name: form.lastName,
      id_number: form.idNumber,
      mobile_number: form.mobileNumber,
      email: form.email,
      employer_name: form.employerName,
      monthly_income: parseFloat(form.monthlyIncome),
      pay_date: form.payDate,
      bank_name: form.bankName,
      account_number: form.accountNumber,
      account_type: form.accountType,
      document_uploaded: true,
    }).select();

    if (dbError) {
      setSubmitting(false);
      setError('There was an issue submitting your application. Please try again.');
      return;
    }

    const uploadOk = await uploadDocuments(applicationId);
    if (!uploadOk) {
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section id="apply" className="bg-[#f8fafc] py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="bg-white border border-[#22c55e]/30 rounded-2xl p-12 shadow-sm">
            <CheckCircle className="w-16 h-16 text-[#22c55e] mx-auto mb-4" />
            <h2 className="text-gray-900 font-black text-2xl mb-3">Application Submitted!</h2>
            <p className="text-gray-600 leading-relaxed">
              Thank you, <strong className="text-gray-900">{form.firstName}</strong>. We've received your application and our team will be in touch shortly at <strong className="text-gray-900">{form.email}</strong>.
            </p>
            <div className="mt-6 bg-gray-50 rounded-xl px-5 py-3 text-sm text-gray-600 border border-gray-100">
              Reference: <span className="text-[#22c55e] font-mono font-bold">{`PF-${Date.now().toString(36).toUpperCase()}`}</span>
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
          <p className="text-gray-600 mt-3">Takes less than 5 minutes. All information is kept confidential.</p>
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

        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2"><User className="w-5 h-5 text-[#22c55e]" /> Personal Details</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First Name" value={form.firstName} onChange={v => update('firstName', v)} placeholder="Sipho" />
                <Field label="Last Name" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Dlamini" />
              </div>
              <div>
                <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={v => update('idNumber', v.replace(/\D/g, '').slice(0, 13))} placeholder="8001015009087" type="text" inputMode="numeric" />
                {idError && <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{idError}</p>}
                {idSuccess && <p className="mt-1.5 text-[#22c55e] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{idSuccess}</p>}
              </div>
              <Field label="Mobile Number" value={form.mobileNumber} onChange={v => update('mobileNumber', v)} placeholder="082 000 0000" type="tel" />
              <Field label="Email Address" value={form.email} onChange={v => update('email', v)} placeholder="sipho@email.com" type="email" />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#22c55e]" /> Employment Details</h3>
              <Field label="Employer Name" value={form.employerName} onChange={v => update('employerName', v)} placeholder="ABC Company (Pty) Ltd" />
              <Field label="Monthly Income (ZAR)" value={form.monthlyIncome} onChange={v => update('monthlyIncome', v.replace(/\D/g, ''))} placeholder="8500" type="text" inputMode="numeric" prefix="R" />
              <div>
                <label className="text-gray-400 text-sm font-medium mb-1.5 block">Pay Date</label>
                <select
                  value={form.payDate}
                  onChange={e => update('payDate', e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors"
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
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#22c55e]" /> Banking Details</h3>
              <div>
                <label className="text-gray-400 text-sm font-medium mb-1.5 block">Bank Name</label>
                <select
                  value={form.bankName}
                  onChange={e => update('bankName', e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors"
                >
                  <option value="">Select your bank</option>
                  {SA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <Field label="Account Number" value={form.accountNumber} onChange={v => update('accountNumber', v.replace(/\D/g, ''))} placeholder="12345678901" type="text" inputMode="numeric" />
              <div>
                <label className="text-gray-400 text-sm font-medium mb-1.5 block">Account Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {['cheque', 'savings', 'transmission'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => update('accountType', type)}
                      className={`py-3 rounded-xl border text-sm font-semibold capitalize transition-all duration-200 ${form.accountType === type ? 'bg-[#22c55e] border-[#22c55e] text-white' : 'border-white/10 text-gray-400 hover:border-[#22c55e]/40'}`}
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
              <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2"><FileText className="w-5 h-5 text-[#22c55e]" /> Document Upload</h3>
              <p className="text-gray-400 text-sm mb-4">
                All documents are mandatory. Accepted formats: PDF, JPEG, PNG (max 5MB each).
              </p>

              {docs.map(cat => {
                const isComplete = cat.files.length >= cat.requiredCount;
                return (
                  <div key={cat.id} className="bg-[#0f172a] rounded-xl border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold text-sm flex items-center gap-2">
                        {isComplete ? (
                          <FileCheck className="w-4 h-4 text-[#22c55e]" />
                        ) : (
                          <Upload className="w-4 h-4 text-gray-400" />
                        )}
                        {cat.label}
                      </span>
                      <span className={`text-xs font-medium ${isComplete ? 'text-[#22c55e]' : 'text-amber-400'}`}>
                        {cat.files.length} / {cat.requiredCount} uploaded
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mb-3">{cat.description}</p>

                    <label className="flex items-center justify-center w-full bg-[#1e293b] border-2 border-dashed border-white/10 rounded-xl px-4 py-6 cursor-pointer hover:border-[#22c55e]/40 transition-colors">
                      <input
                        type="file"
                        multiple={cat.requiredCount > 1}
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => handleFileChange(cat.id, e.target.files)}
                      />
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                        <span className="text-gray-400 text-sm font-medium">Click to upload</span>
                        <span className="text-gray-600 text-xs block mt-1">PDF, JPEG, PNG up to 5MB</span>
                      </div>
                    </label>

                    {cat.error && (
                      <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {cat.error}
                      </p>
                    )}

                    {cat.files.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {cat.files.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-[#1e293b] rounded-lg px-3 py-2">
                            <span className="text-gray-300 text-xs truncate max-w-[200px]">{file.name}</span>
                            <button
                              onClick={() => removeFile(cat.id, idx)}
                              className="text-gray-500 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {uploadProgress && (
                <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-4 py-3 text-[#22c55e] text-sm flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full" />
                  {uploadProgress}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 px-5 py-3 border border-white/10 text-gray-300 rounded-xl font-semibold hover:border-white/30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#22c55e]/30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#22c55e]/30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
                {!submitting && <CheckCircle className="w-4 h-4" />}
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
      <label className="text-gray-400 text-sm font-medium mb-1.5 block">{label}</label>
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
          className={`w-full bg-[#1e293b] border border-white/10 text-white rounded-xl py-3 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors placeholder:text-gray-600 ${prefix ? 'pl-8 pr-4' : 'px-4'}`}
        />
      </div>
    </div>
  );
}
