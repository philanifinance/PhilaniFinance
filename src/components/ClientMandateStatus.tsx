import { useState, useCallback } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle, Ban,
  Calendar, DollarSign, Hash, Clock, Trash2, Eye, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MandateRecord {
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
  total_collected?: number;
  total_failed?: number;
  last_collection_date?: string;
  next_collection_date?: string;
  collections_count?: number;
}

interface ClientMandateStatusProps {
  mandate: MandateRecord | null;
  applicationId: string;
  onMandateUpdate?: (mandate: MandateRecord) => void;
}

const mandateStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; description: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    icon: Clock,
    description: 'Mandate is being prepared. Not yet sent to your bank.',
  },
  mandate_submitted: {
    label: 'Submitted',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: Clock,
    description: 'Your mandate has been submitted to your bank for processing.',
  },
  pending_bank: {
    label: 'Awaiting Authentication',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: Clock,
    description: 'Check your banking app for a push notification. You need to authenticate the mandate.',
  },
  accepted: {
    label: 'Approved',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: CheckCircle,
    description: 'Your mandate has been approved. Collections will begin on the scheduled date.',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: Ban,
    description: 'Your mandate was rejected. Please contact support or try again.',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    icon: Ban,
    description: 'This mandate has been cancelled. No further collections will be made.',
  },
  error: {
    label: 'Error',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: AlertCircle,
    description: 'There was an error processing your mandate. Please contact support.',
  },
};

export default function ClientMandateStatus({
  mandate,
  applicationId,
  onMandateUpdate,
}: ClientMandateStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  const handleSyncStatus = useCallback(async () => {
    if (!mandate) return;

    setSyncing(true);
    setSyncMessage('');
    setSyncError('');

    try {
      const { data, error } = await supabase.functions.invoke('nupay-mandate-status', {
        body: { mandate_id: mandate.id },
      });

      if (error) {
        setSyncError(`Unable to sync status. Please try again later.`);
        return;
      }

      if (data?.synced) {
        setSyncMessage(`Status updated: ${data.status}`);
        if (onMandateUpdate && data.mandate_id) {
          const { data: updated } = await supabase
            .from('debicheck_mandates')
            .select('*')
            .eq('id', mandate.id)
            .single();
          if (updated) onMandateUpdate(updated as MandateRecord);
        }
      }
    } catch (err) {
      setSyncError('Unable to sync status. Please try again later.');
    } finally {
      setSyncing(false);
    }
  }, [mandate, onMandateUpdate]);

  const handleCancelMandate = useCallback(async () => {
    if (!mandate) return;

    setCancelling(true);
    setSyncError('');
    setSyncMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('nupay-mandate-cancel', {
        body: {
          mandate_id: mandate.id,
          reason: 'Cancelled by client',
        },
      });

      if (error) {
        setSyncError(`Unable to cancel mandate. Please contact support.`);
        return;
      }

      if (data?.success) {
        setSyncMessage('Mandate cancelled successfully');
        setShowCancelConfirm(false);

        if (onMandateUpdate) {
          const { data: updated } = await supabase
            .from('debicheck_mandates')
            .select('*')
            .eq('id', mandate.id)
            .single();
          if (updated) onMandateUpdate(updated as MandateRecord);
        }
      }
    } catch (err) {
      setSyncError('Unable to cancel mandate. Please contact support.');
    } finally {
      setCancelling(false);
    }
  }, [mandate, onMandateUpdate]);

  if (!mandate) {
    return null;
  }

  const cfg = mandateStatusConfig[mandate.status] || mandateStatusConfig.draft;
  const Icon = cfg.icon;
  const canCancel = ['mandate_submitted', 'pending_bank', 'accepted'].includes(mandate.status);
  const isPending = mandate.status === 'pending_bank';

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
      {/* Header with status */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-navy-900 mb-3">DebiCheck Mandate Status</h3>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              <Icon className="w-4 h-4" /> {cfg.label}
            </span>
          </div>
        </div>
        <button
          onClick={handleSyncStatus}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Status description */}
      <p className="text-sm text-navy-600 mb-4">{cfg.description}</p>

      {/* Pending bank alert */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900 mb-1">Action Required</p>
            <p className="text-xs text-amber-700">
              Check your banking app for a push notification. You need to authenticate this mandate to proceed.
            </p>
          </div>
        </div>
      )}

      {/* Mandate details grid */}
      <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 mb-4">
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Amount</p>
          <p className="text-sm font-semibold text-navy-900">R {mandate.instalment_amount.toLocaleString('en-ZA')}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Frequency</p>
          <p className="text-sm font-semibold text-navy-900">{mandate.frequency}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Instalments</p>
          <p className="text-sm font-semibold text-navy-900">{mandate.num_instalments}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">First Collection</p>
          <p className="text-sm font-semibold text-navy-900">{mandate.first_strike_date}</p>
        </div>
        {mandate.total_collected !== undefined && mandate.total_collected > 0 && (
          <div>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Collected</p>
            <p className="text-sm font-semibold text-green-600">R {mandate.total_collected.toLocaleString('en-ZA')}</p>
          </div>
        )}
        {mandate.collections_count !== undefined && mandate.collections_count > 0 && (
          <div>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Collections</p>
            <p className="text-sm font-semibold text-navy-900">{mandate.collections_count}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      {syncMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700">{syncMessage}</p>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{syncError}</p>
        </div>
      )}

      {mandate.error_details && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-[10px] font-medium text-red-700 uppercase tracking-wide mb-1">Error Details</p>
          <p className="text-xs text-red-600">{mandate.error_details}</p>
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-red-900">Cancel this mandate?</p>
          <p className="text-xs text-red-700">
            Cancelling will stop any future collections. This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelMandate}
              disabled={cancelling}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300 transition-colors"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Mandate'}
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              disabled={cancelling}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Keep Mandate
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showCancelConfirm && canCancel && (
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Cancel Mandate
        </button>
      )}

      {/* Metadata */}
      <div className="text-[10px] text-slate-400 space-y-1 pt-4 border-t border-slate-200 mt-4">
        <p>Reference: <span className="font-mono text-slate-500">{mandate.contract_ref}</span></p>
        <p>Last updated: {new Date(mandate.status_updated_at).toLocaleString('en-ZA')}</p>
      </div>
    </div>
  );
}
