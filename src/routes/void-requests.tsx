import { useState, useEffect } from 'react';
import { FileX, Check, X, Loader as Loader2, Clock } from 'lucide-react';
import { getAllVoidRequests } from '../lib/db';
import { approveRequest, rejectRequest } from '../lib/approvals';
import { useAuth } from '../context/AuthContext';
import { canApproveVoid } from '../lib/permissions';
import type { VoidRequest } from '../lib/types';

export function VoidRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VoidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VoidRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const canApprove = user ? canApproveVoid(user.role) : false;

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    try { setRequests(await getAllVoidRequests()); } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function handleApprove(vr: VoidRequest) {
    if (!user || !vr.approval_request_id) return;
    setActionLoading(vr.id); setError(null);
    try { await approveRequest(vr.approval_request_id, user); await loadRequests(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to approve.'); }
    finally { setActionLoading(null); }
  }

  async function handleReject() {
    if (!user || !rejecting || !rejecting.approval_request_id || !rejectReason.trim()) return;
    setActionLoading(rejecting.id); setError(null);
    try { await rejectRequest(rejecting.approval_request_id, user, rejectReason.trim()); setRejecting(null); setRejectReason(''); await loadRequests(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to reject.'); }
    finally { setActionLoading(null); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-slate-400" size={24} /></div>;

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Void Requests</h1><p className="text-slate-400 text-sm mt-1">{pending.length} pending · {resolved.length} resolved</p></div>
      {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-red-300 text-sm">{error}</div>}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Pending Approval</h2>
        {pending.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center"><FileX className="mx-auto mb-3 text-slate-600" size={32} /><p className="text-slate-500 text-sm">No pending void requests.</p></div>
        ) : pending.map((vr) => (
          <div key={vr.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2"><Clock className="text-amber-400" size={16} /><span className="text-amber-400 text-xs font-medium uppercase">Pending</span><span className="text-slate-500 text-xs">{new Date(vr.created_at).toLocaleString()}</span></div>
                <div className="flex items-baseline gap-3"><p className="text-white font-bold text-lg">KES {Number(vr.transaction_total).toLocaleString()}</p><span className="text-xs text-slate-500">{vr.transaction_payment_method}</span></div>
                <p className="text-slate-300 text-sm"><span className="text-slate-500">Reason:</span> {vr.reason}</p>
                <p className="text-xs text-slate-500">Requested by {vr.requester_name} ({vr.requester_role})</p>
              </div>
              {canApprove && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => handleApprove(vr)} disabled={actionLoading === vr.id} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50">{actionLoading === vr.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve</button>
                  <button onClick={() => { setRejecting(vr); setRejectReason(''); }} disabled={actionLoading === vr.id} className="flex items-center gap-2 rounded-lg border border-red-700 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/20 transition disabled:opacity-50"><X size={14} /> Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">History</h2>
          {resolved.map((vr) => (
            <div key={vr.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className={`text-xs font-medium uppercase ${vr.status === 'completed' ? 'text-emerald-400' : vr.status === 'rejected' ? 'text-red-400' : 'text-slate-400'}`}>{vr.status}</span><span className="text-slate-500 text-xs">{new Date(vr.created_at).toLocaleDateString()}</span></div>
                  <p className="text-white text-sm font-medium">KES {Number(vr.transaction_total).toLocaleString()}</p>
                  <p className="text-slate-400 text-xs">{vr.reason}</p>
                  <p className="text-xs text-slate-500">Requested by {vr.requester_name} · {vr.approver_name ? `Approved/rejected by ${vr.approver_name}` : ''}</p>
                  {vr.rejection_reason && <p className="text-xs text-red-400 mt-1">Rejection reason: {vr.rejection_reason}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Reject Void Request</h2>
            <p className="text-sm text-slate-400 mb-3">Provide a reason for rejecting this void request for KES {Number(rejecting.transaction_total).toLocaleString()}.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Rejection reason..." className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejecting(null)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading === rejecting.id} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50">{actionLoading === rejecting.id ? 'Rejecting...' : 'Reject Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
