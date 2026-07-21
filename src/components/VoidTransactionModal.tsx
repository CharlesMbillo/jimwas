import { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { Transaction } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { requestVoidSale } from '../lib/approvals';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onVoidComplete: () => void;
}

export function VoidTransactionModal({ transaction, isOpen, onClose, onVoidComplete }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async () => {
    if (!user) {
      setError('You must be logged in to request a void.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for the void request.');
      return;
    }
    if (transaction.status === 'voided') {
      setError('This transaction has already been voided.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestVoidSale(transaction, reason.trim(), user);
      setReason('');
      onVoidComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit void request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-400" size={22} />
            <h2 className="text-lg font-semibold text-white">Request Void</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition"
            disabled={submitting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Transaction</p>
            <p className="text-white font-medium">
              KES {transaction.total_amount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(transaction.created_at).toLocaleString()} · {transaction.payment_method}
            </p>
            <p className="text-xs text-slate-500">
              {transaction.transaction_items?.length ?? 0} item(s)
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">
              Reason for void <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Customer changed mind, incorrect entry..."
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-amber-900/20 border border-amber-800/50 p-3 text-xs text-amber-300">
            This will create a void request that must be approved by a manager or admin
            before the sale is reversed and stock is restored.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Void Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
