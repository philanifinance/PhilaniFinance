import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Loader2, RefreshCw, Search, ShieldCheck, Clock,
  CheckCircle, Ban, AlertCircle, Send, ChevronDown, ChevronUp,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────
interface MandateRow {
  id: string;
  application_id: string;
  contract_ref: string;
  nupay_mandate_id: string | null;
  debicheck_type: string;
  instalment_amount: number;
  num_instalments: number;
  frequency: string;
  first_strike_date: string;
  status: string;
  client_name: string;
  client_bank: string;
  nupay_response_message: string | null;
  initiated_at: string;
  status_updated_at: string;
  total_collected: number | null;
  total_failed: number | null;
  collections_count: number | null;
  last_collection_date: string | null;
  next_collection_date: string | null;
}

interface InstalmentRow {
  instalment_number: number;
  instalment_amount: number;
  due_date: string;
  status: string;
  collected_date: string | null;
  collected_amount: number | null;
  nupay_response_message: string | null;
}

type StatusFilter = 'all' | 'awaiting' | 'accepted' | 'rejected' | 'cancelled' | 'error';

// ── Status display config ───────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:             { label: 'Draft',       color: 'text-gray-600',  bg: 'bg-gray-100',  icon: Clock },
  mandate_submitted: { label: 'Submitted',   color: 'text-blue-700',  bg: 'bg-blue-100',  icon: Send },
  pending_bank:      { label: 'At Bank',     color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  accepted:          { label: 'Accepted',    color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  rejected:          { label: 'Rejected',    color: 'text-red-700',   bg: 'bg-red-100',   icon: Ban },
  cancelled:         { label: 'Cancelled',   color: 'text-gray-600',  bg: 'bg-gray-100',  icon: Ban },
  error:             { label: 'Error',       color: 'text-red-700',   bg: 'bg-red-100',   icon: AlertCircle },
};

const instalmentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700', bg: 'bg-amber-100' },
  collected: { label: 'Collected', color: 'text-green-700', bg: 'bg-green-100' },
  failed:    { label: 'Failed',    color: 'text-red-700',   bg: 'bg-red-100' },
  waived:    { label: 'Waived',    color: 'text-gray-600',  bg: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600',  bg: 'bg-gray-100' },
};

// ── Helpers ──────────────────────────────────────────────────────────
function fmtZar(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return 'R 0';
  return 'R ' + n.toLocaleString('en-ZA');
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Collapses the 7 granular statuses into the filter buckets this report
// cares about — matches the same Pending/Rejected/Active grouping used by
// the NuPay mandate status webservice itself.
function statusBucket(status: string): StatusFilter {
  if (status === 'accepted') return 'accepted';
  if (status === 'rejected') return 'rejected';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'error') return 'error';
  return 'awaiting'; // draft, mandate_submitted, pending_bank
}

// ── Component ────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
}

export default function DebiCheckMandatesReport({ onBack }: Props) {
  const [mandates, setMandates] = useState<MandateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [instalments, setInstalments] = useState<Record<string, InstalmentRow[]>>({});
  const [instalmentsLoading, setInstalmentsLoading] = useState<string | null>(null);

  const fetchMandates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('debicheck_mandates')
      .select('id, application_id, contract_ref, nupay_mandate_id, debicheck_type, instalment_amount, num_instalments, frequency, first_strike_date, status, client_name, client_bank, nupay_response_message, initiated_at, status_updated_at, total_collected, total_failed, collections_count, last_collection_date, next_collection_date')
      .order('initiated_at', { ascending: false });
    setMandates((data as MandateRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMandates(); }, [fetchMandates]);

  const handleRunReconciliation = useCallback(async () => {
    setReconciling(true);
    setReconcileMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('nupay-reconcile-instalments', { body: {} });
      if (error) {
        setReconcileMessage(`Reconciliation failed: ${error.message}`);
      } else {
        setReconcileMessage(
          `Checked ${data?.rows_seen ?? 0} instalment records, matched ${data?.rows_matched ?? 0}, updated ${data?.mandates_updated ?? 0} mandate(s).`
        );
        await fetchMandates();
      }
    } catch (err) {
      setReconcileMessage(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  }, [fetchMandates]);

  const toggleExpand = useCallback(async (mandate: MandateRow) => {
    if (expandedId === mandate.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(mandate.id);
    if (!instalments[mandate.id]) {
      setInstalmentsLoading(mandate.id);
      const { data } = await supabase
        .from('debicheck_instalments')
        .select('instalment_number, instalment_amount, due_date, status, collected_date, collected_amount, nupay_response_message')
        .eq('mandate_id', mandate.id)
        .order('instalment_number', { ascending: true });
      setInstalments(prev => ({ ...prev, [mandate.id]: (data as InstalmentRow[]) || [] }));
      setInstalmentsLoading(null);
    }
  }, [expandedId, instalments]);

  // ── Aggregate stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = mandates.length;
    const awaiting = mandates.filter(m => statusBucket(m.status) === 'awaiting').length;
    const accepted = mandates.filter(m => statusBucket(m.status) === 'accepted').length;
    const rejected = mandates.filter(m => statusBucket(m.status) === 'rejected').length;
    const cancelled = mandates.filter(m => statusBucket(m.status) === 'cancelled').length;
    const errored = mandates.filter(m => statusBucket(m.status) === 'error').length;
    const totalCollected = mandates.reduce((s, m) => s + (m.total_collected || 0), 0);
    const totalFailedInstalments = mandates.reduce((s, m) => s + (m.total_failed || 0), 0);
    // Rough outstanding estimate: full mandate value minus what's been
    // collected so far, for mandates still active (accepted).
    const totalOutstanding = mandates
      .filter(m => m.status === 'accepted')
      .reduce((s, m) => s + Math.max(0, (m.instalment_amount * m.num_instalments) - (m.total_collected || 0)), 0);
    return { total, awaiting, accepted, rejected, cancelled, errored, totalCollected, totalFailedInstalments, totalOutstanding };
  }, [mandates]);

  const filtered = useMemo(() => {
    let list = mandates;
    if (statusFilter !== 'all') {
      list = list.filter(m => statusBucket(m.status) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.client_name.toLowerCase().includes(q) ||
        m.contract_ref.toLowerCase().includes(q) ||
        (m.nupay_mandate_id || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [mandates, statusFilter, search]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'awaiting', label: 'Awaiting Approval', count: stats.awaiting },
    { key: 'accepted', label: 'Accepted', count: stats.accepted },
    { key: 'rejected', label: 'Rejected', count: stats.rejected },
    { key: 'cancelled', label: 'Cancelled', count: stats.cancelled },
    { key: 'error', label: 'Error', count: stats.errored },
  ];

  return (
    <div className="bg-slate-50 pb-16">
      {/* Dark navy header */}
      <div className="bg-navy-950 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <button onClick={onBack}
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm font-medium mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Reporting</p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-brand-400" /> DebiCheck Mandates
              </h1>
              <p className="text-white/40 text-sm mt-1.5">Portfolio-wide view across every client's DebiCheck mandate.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRunReconciliation} disabled={reconciling}
                className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-white/[0.1] transition-all disabled:opacity-50">
                {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {reconciling ? 'Reconciling…' : 'Run Reconciliation'}
              </button>
              <button onClick={fetchMandates}
                className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white/70 hover:text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-white/[0.1] transition-all">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Key metric chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Total Mandates</p>
              <p className="text-xl font-extrabold tabular-nums leading-tight text-white">{stats.total}</p>
              <p className="text-white/30 text-xs mt-1">{stats.accepted} accepted · {stats.awaiting} awaiting</p>
            </div>
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Total Collected</p>
              <p className="text-xl font-extrabold tabular-nums leading-tight text-emerald-400">{fmtZar(stats.totalCollected)}</p>
              <p className="text-white/30 text-xs mt-1">across all mandates</p>
            </div>
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Outstanding</p>
              <p className="text-xl font-extrabold tabular-nums leading-tight text-amber-400">{fmtZar(stats.totalOutstanding)}</p>
              <p className="text-white/30 text-xs mt-1">on accepted mandates</p>
            </div>
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-4">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Failed Instalments</p>
              <p className="text-xl font-extrabold tabular-nums leading-tight text-red-400">{stats.totalFailedInstalments}</p>
              <p className="text-white/30 text-xs mt-1">{stats.rejected} mandates rejected · {stats.errored} errored</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-4">

        {reconcileMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {reconcileMessage}
          </div>
        )}

        {/* Filter tabs + search */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-2 flex-1">
            {filterTabs.map(t => (
              <button key={t.key} onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === t.key ? 'bg-brand-500 text-white' : 'bg-slate-100 text-navy-600 hover:bg-slate-200'
                }`}>
                {t.label} <span className="tabular-nums">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search client, contract ref..."
              className="w-full bg-slate-50 border border-slate-200 text-navy-900 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500/40 transition-colors" />
          </div>
        </div>

        {/* Mandates table */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-navy-900">Mandates ({filtered.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-navy-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-navy-400 text-sm">No mandates match these filters.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(m => {
                const cfg = statusConfig[m.status] || statusConfig.draft;
                const Icon = cfg.icon;
                const isExpanded = expandedId === m.id;
                const rows = instalments[m.id];
                return (
                  <div key={m.id}>
                    <button onClick={() => toggleExpand(m)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy-900 truncate">{m.client_name}</p>
                        <p className="text-xs text-navy-400 font-mono mt-0.5">{m.contract_ref}</p>
                      </div>
                      <div className="hidden sm:block text-right w-28 flex-shrink-0">
                        <p className="text-sm font-bold text-navy-900">{fmtZar(m.instalment_amount)}</p>
                        <p className="text-xs text-navy-400">{m.num_instalments} × {m.frequency}</p>
                      </div>
                      <div className="hidden md:block text-right w-32 flex-shrink-0">
                        <p className="text-sm font-semibold text-emerald-600">{fmtZar(m.total_collected)}</p>
                        <p className="text-xs text-navy-400">{m.collections_count || 0} collected</p>
                      </div>
                      <div className="hidden lg:block text-right w-32 flex-shrink-0">
                        <p className="text-xs text-navy-500">{m.client_bank}</p>
                        <p className="text-xs text-navy-400">{fmtDate(m.initiated_at)}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-navy-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-navy-400 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="bg-slate-50/80 px-6 py-5 border-t border-slate-100">
                        {m.nupay_response_message && (
                          <p className="text-xs text-navy-500 mb-4">{m.nupay_response_message}</p>
                        )}
                        <div className="grid sm:grid-cols-4 gap-3 mb-5 text-xs">
                          <div><span className="text-navy-400">NuPay Mandate ID</span><p className="font-mono text-navy-700 mt-0.5">{m.nupay_mandate_id || '—'}</p></div>
                          <div><span className="text-navy-400">First Strike Date</span><p className="text-navy-700 mt-0.5">{fmtDate(m.first_strike_date)}</p></div>
                          <div><span className="text-navy-400">Last Collection</span><p className="text-navy-700 mt-0.5">{fmtDate(m.last_collection_date)}</p></div>
                          <div><span className="text-navy-400">Next Collection</span><p className="text-navy-700 mt-0.5">{fmtDate(m.next_collection_date)}</p></div>
                        </div>

                        <h3 className="text-xs font-bold text-navy-500 uppercase tracking-wide mb-2">Instalment History</h3>
                        {instalmentsLoading === m.id ? (
                          <div className="flex items-center gap-2 text-navy-400 text-xs py-4">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading instalments...
                          </div>
                        ) : !rows || rows.length === 0 ? (
                          <p className="text-xs text-navy-400 py-2">
                            No instalment data yet — populated by the daily reconciliation job, or run it manually above.
                          </p>
                        ) : (
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-navy-400 uppercase tracking-wide">
                                  <th className="text-left px-3 py-2 font-semibold">#</th>
                                  <th className="text-left px-3 py-2 font-semibold">Due Date</th>
                                  <th className="text-right px-3 py-2 font-semibold">Amount</th>
                                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                                  <th className="text-left px-3 py-2 font-semibold">Collected</th>
                                  <th className="text-left px-3 py-2 font-semibold">Note</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {rows.map(r => {
                                  const icfg = instalmentStatusConfig[r.status] || instalmentStatusConfig.pending;
                                  return (
                                    <tr key={r.instalment_number}>
                                      <td className="px-3 py-2 text-navy-700 font-medium">{r.instalment_number}</td>
                                      <td className="px-3 py-2 text-navy-600">{fmtDate(r.due_date)}</td>
                                      <td className="px-3 py-2 text-right text-navy-700 font-medium">{fmtZar(r.instalment_amount)}</td>
                                      <td className="px-3 py-2">
                                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${icfg.bg} ${icfg.color}`}>{icfg.label}</span>
                                      </td>
                                      <td className="px-3 py-2 text-navy-600">{r.collected_date ? fmtDate(r.collected_date) : '—'}</td>
                                      <td className="px-3 py-2 text-navy-400">{r.nupay_response_message || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-navy-400 text-center px-4">
          Instalment history is kept in sync by a daily reconciliation job against NuPay's Instalment Report webservice.
          Use "Run Reconciliation" above to refresh it on demand.
        </p>
      </div>
    </div>
  );
}
