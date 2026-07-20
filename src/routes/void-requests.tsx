import { useState, useEffect } from 'react';
import { Trash2, CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Send, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { RoleGuard } from '../context/AuthContext';
import { getAllVoidRequests } from '../lib/db';
import { approveRequest, rejectRequest } from '../lib/approvals';
import { hasPermission } from '../lib/permissions';
import type { VoidRequest } from '../lib/security-types';

export function VoidRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [voidRequests, setVoidRequests] = useState<VoidRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VoidRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadRequests();
    checkPermissions();
  }, [user]);

  const checkPermissions = async () => {
    if (!user) return;
    const can = await hasPermission(user.id, 'approval.approve');
    setCanApprove(can);
  };

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const all = await getAllVoidRequests();
      setVoidRequests(
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } catch (error) {
      console.error('[v0] Error loading void requests:', error);
      toast.show('Failed to load void requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: VoidRequest) => {
    if (!user) return;
    if (!request.approval_request_id) {
      toast.show('No linked approval request found', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await approveRequest(request.approval_request_id, user.id, approvalNotes || undefined);
      if (result.success) {
        toast.show('Void request approved — transaction has been reversed', 'success');
        setSelectedRequest(null);
        setApprovalNotes('');
        loadRequests();
      } else {
        toast.show(result.error || 'Failed to approve request', 'error');
      }
    } catch (error) {
      console.error('[v0] Error approving:', error);
      toast.show('Error approving request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: VoidRequest) => {
    if (!user) return;
    if (!request.approval_request_id) {
      toast.show('No linked approval request found', 'error');
      return;
    }
    if (!approvalNotes.trim()) {
      toast.show('Please provide a reason for rejection', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await rejectRequest(request.approval_request_id, user.id, approvalNotes);
      if (result.success) {
        toast.show('Void request rejected', 'success');
        setSelectedRequest(null);
        setApprovalNotes('');
        loadRequests();
      } else {
        toast.show(result.error || 'Failed to reject request', 'error');
      }
    } catch (error) {
      console.error('[v0] Error rejecting:', error);
      toast.show('Error rejecting request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const pending = voidRequests.filter(r => r.status === 'pending');
  const approved = voidRequests.filter(r => r.status === 'approved' || r.status === 'completed');
  const rejected = voidRequests.filter(r => r.status === 'rejected');

  const displayed = activeTab === 'pending' ? pending : voidRequests;

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Void Requests</h1>
              <p className="text-sm text-slate-400">Review and approve transaction void requests</p>
            </div>
          </div>
          <button
            onClick={loadRequests}
            disabled={isLoading}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-slate-400 text-sm">Pending</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{pending.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 text-sm">Approved</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{approved.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-slate-400 text-sm">Rejected</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{rejected.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'pending'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            Pending ({pending.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            All ({voidRequests.length})
          </button>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {activeTab === 'pending' ? 'No pending void requests' : 'No void requests found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((request) => (
              <div
                key={request.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Transaction info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-0.5">Transaction ID</p>
                        <p className="font-mono text-white text-sm truncate">{request.transaction_id}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-0.5">Amount</p>
                        <p className="text-white text-lg font-bold">KES {request.transaction_total.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-0.5">Requested By</p>
                        <p className="text-white text-sm">{request.requester_name}</p>
                        <p className="text-slate-500 text-xs capitalize">{request.requester_role}</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="p-3 bg-slate-700/50 rounded-lg border-l-2 border-yellow-500">
                      <p className="text-slate-400 text-xs font-medium mb-0.5">Reason</p>
                      <p className="text-slate-300 text-sm">{request.reason}</p>
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={request.status} />
                        <span className="text-slate-500 text-xs">
                          {new Date(request.created_at).toLocaleString()}
                        </span>
                      </div>

                      {canApprove && request.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setApprovalNotes('');
                          }}
                          className="px-4 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition text-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>

                    {/* Approver notes if resolved */}
                    {request.approver_name && (
                      <div className="text-xs text-slate-500">
                        {request.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                        <span className="text-slate-400">{request.approver_name}</span>
                        {request.approved_at && (
                          <> on {new Date(request.approved_at).toLocaleString()}</>
                        )}
                        {request.rejection_reason && (
                          <> &mdash; {request.rejection_reason}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Review Void Request
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white transition"
                disabled={isProcessing}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction ID</span>
                  <span className="font-mono text-white text-xs">{selectedRequest.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span className="font-bold text-white">KES {selectedRequest.transaction_total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Requested By</span>
                  <span className="text-white">{selectedRequest.requester_name}</span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Reason for void</p>
                <p className="text-slate-300 text-sm bg-slate-700/50 p-3 rounded-lg">{selectedRequest.reason}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Notes <span className="text-slate-500 font-normal">(required for rejection)</span>
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add comments about your decision..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 resize-none"
                  rows={3}
                  disabled={isProcessing}
                />
              </div>

              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-300">
                Approving will immediately reverse the transaction and restore inventory levels.
              </div>
            </div>

            <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end bg-slate-700/30">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedRequest)}
                className="px-4 py-2 rounded-lg bg-slate-600 text-white hover:bg-slate-500 transition disabled:opacity-50 flex items-center gap-2"
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button
                onClick={() => handleApprove(selectedRequest)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    case 'approved':
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-300">
          <CheckCircle2 className="w-3 h-3" /> Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-300">
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
          {status}
        </span>
      );
  }
}
