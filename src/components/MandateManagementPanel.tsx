import { useState, useCallback } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle, Ban,
  Calendar, DollarSign, Hash, Clock, Trash2, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

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

interface MandateManagementPanelProps {
  mandate: MandateRecord | null;
  applicationId: string;
  onMandateUpdate?: (mandate: MandateRecord) => void;
}

const mandateStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:              { label: 'Draft',          color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Clock },
  mandate_submitted:  { label: 'Submitted',      color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Clock },
  pending_bank:       { label: 'At Bank',        color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Clock },
  accepted:           { label: 'Accepted',       color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  rejected:           { label: 'Rejected',       color: 'text-red-700',    bg: 'bg-red-100',    icon: Ban },
  cancelled:          { label: 'Cancelled',      color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Ban },
  error:              { label: 'Error',          color: 'text-red-700',    bg: 'bg-red-100',    icon: AlertCircle },
};

export default function MandateManagementPanel({
  mandate,
  applicationId,
  onMandateUpdate,
}: MandateManagementPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
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
        setSyncError(`Sync failed: ${error.message}`);
        return;
      }

      if (data?.synced) {
        setSyncMessage(`Status synced: ${data.status}`);
        if (onMandateUpdate && data.mandate_id) {
          // Fetch updated mandate from database
          const { data: updated } = await supabase
            .from('debicheck_mandates')
            .select('*')
            .eq('id', mandate.id)
            .single();
          if (updated) onMandateUpdate(updated as MandateRecord);
        }
      } else {
        setSyncMessage(`Current status: ${data?.status || 'unknown'}`);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unknown error');
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
          reason: cancelReason || 'Cancelled by admin',
        },
      });

      if (error) {
        setSyncError(`Cancellation failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        setSyncMessage('Mandate cancelled successfully');
        setShowCancelConfirm(false);
        setCancelReason('');

        if (onMandateUpdate) {
          const { data: updated } = await supabase
            .from('debicheck_mandates')
            .select('*')
            .eq('id', mandate.id)
            .single();
          if (updated) onMandateUpdate(updated as MandateRecord);
        }

        await logAudit('mandate_cancelled_admin', 'debicheck_mandate', mandate.id, {
          reason: cancelReason || 'Cancelled by admin',
        });
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCancelling(false);
    }
  }, [mandate, cancelReason, onMandateUpdate]);

  if (!mandate) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-500">No mandate initiated yet</p>
      </div>
    );
  }

  const cfg = mandateStatusConfig[mandate.status] || mandateStatusConfig.draft;
  const Icon = cfg.icon;
  const canCancel = ['mandate_submitted', 'pending_bank', 'accepted'].includes(mandate.status);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      {/* Header with status */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4" /> Mandate Details
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
            <span className="text-xs text-gray-500">Ref: <span className="font-mono">{mandate.contract_ref}</span></span>
          </div>
        </div>
        <button
          onClick={handleSyncStatus}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {syncing ? 'Syncing...' : 'Sync Status'}
        </button>
      </div>

      {/* Mandate details grid */}
      <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Type</p>
          <p className="text-sm font-semibold text-gray-900">{mandate.debicheck_type} ({mandate.debicheck_type === 'TT1' ? 'Real-Time' : 'Non-Real-Time'})</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Amount
          </p>
          <p className="text-sm font-semibold text-gray-900">R {mandate.instalment_amount.toLocaleString('en-ZA')}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Instalments
          </p>
          <p className="text-sm font-semibold text-gray-900">{mandate.num_instalments} × {mandate.frequency}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> First Strike
          </p>
          <p className="text-sm font-semibold text-gray-900">{mandate.first_strike_date}</p>
        </div>
        {mandate.total_collected !== undefined && (
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Collected</p>
            <p className="text-sm font-semibold text-green-600">R {mandate.total_collected.toLocaleString('en-ZA')}</p>
          </div>
        )}
        {mandate.collections_count !== undefined && (
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Collections</p>
            <p className="text-sm font-semibold text-gray-900">{mandate.collections_count} collected</p>
          </div>
        )}
      </div>

      {/* NuPay response details */}
      {mandate.nupay_response_message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wide mb-1">NuPay Response</p>
          <p className="text-xs text-blue-600">{mandate.nupay_response_message}</p>
        </div>
      )}

      {mandate.error_details && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-[10px] font-medium text-red-700 uppercase tracking-wide mb-1">Error</p>
          <p className="text-xs text-red-600">{mandate.error_details}</p>
        </div>
      )}

      {/* Sync/Cancel messages */}
      {syncMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700">{syncMessage}</p>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{syncError}</p>
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-900">Cancel this mandate?</p>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            className="w-full text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancelMandate}
              disabled={cancelling}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 transition-colors"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => {
                setShowCancelConfirm(false);
                setCancelReason('');
              }}
              disabled={cancelling}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
      <div className="text-[10px] text-gray-400 space-y-1 pt-2 border-t border-gray-200">
        <p>Initiated: {new Date(mandate.initiated_at).toLocaleString('en-ZA')}</p>
        <p>Last updated: {new Date(mandate.status_updated_at).toLocaleString('en-ZA')}</p>
        {mandate.nupay_mandate_id && <p>NuPay ID: <span className="font-mono">{mandate.nupay_mandate_id}</span></p>}
      </div>
    </div>
  );
}
