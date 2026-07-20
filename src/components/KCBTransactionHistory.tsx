import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getAllKCBTransactions, getKCBPaymentStats } from '../lib/db';
import type { KCBPaymentTransaction } from '../lib/db';

type FilterStatus = 'all' | 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-orange-100 text-orange-800',
  timeout: 'bg-orange-100 text-orange-800',
  insufficient_balance: 'bg-purple-100 text-purple-800',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  processing: <Loader2 className="w-4 h-4 animate-spin" />,
  success: <CheckCircle2 className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  cancelled: <AlertCircle className="w-4 h-4" />,
  timeout: <AlertCircle className="w-4 h-4" />,
  insufficient_balance: <AlertCircle className="w-4 h-4" />,
};

interface KCBTransactionHistoryProps {
  maxHeight?: string;
}

export function KCBTransactionHistory({ maxHeight = 'max-h-96' }: KCBTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<KCBPaymentTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<KCBPaymentTransaction[]>([]);
  const [stats, setStats] = useState({ total_success: 0, total_amount_success: 0, total_failed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTransactions();
    loadStats();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchTerm, filterStatus]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await getAllKCBTransactions(100);
      const sorted = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(sorted);
    } catch (error) {
      console.error('[v0] Failed to load KCB transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getKCBPaymentStats();
      setStats(statsData);
    } catch (error) {
      console.error('[v0] Failed to load KCB stats:', error);
    }
  };

  const filterTransactions = () => {
    let result = [...transactions];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((t) => t.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((t) =>
        t.phone_number.includes(term) ||
        t.invoice_number.toLowerCase().includes(term) ||
        t.mpesa_receipt_number?.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(result);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadTransactions(), loadStats()]);
    setIsRefreshing(false);
  };

  const toggleSecret = (id: string) => {
    const newSet = new Set(showSecrets);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setShowSecrets(newSet);
  };

  const exportTransactions = () => {
    const csv = [
      ['ID', 'Phone', 'Amount', 'Status', 'Receipt', 'Created'],
      ...filteredTransactions.map((t) => [
        t.id,
        t.phone_number,
        (t.amount / 100).toFixed(2),
        t.status,
        t.mpesa_receipt_number || 'N/A',
        new Date(t.created_at).toLocaleString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kcb-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-400 mb-1">Successful Payments</p>
          <p className="text-2xl font-bold text-green-400">{stats.total_success}</p>
          <p className="text-xs text-slate-500 mt-1">KES {(stats.total_amount_success / 100).toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-400 mb-1">Failed Payments</p>
          <p className="text-2xl font-bold text-red-400">{stats.total_failed}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-xs text-slate-400 mb-1">Total Transactions</p>
          <p className="text-2xl font-bold text-blue-400">{transactions.length}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by phone, receipt, or invoice..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="timeout">Timeout</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportTransactions}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className={`${maxHeight} overflow-y-auto bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <p>No transactions found</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="hover:bg-slate-700/50 transition">
              {/* Transaction Row */}
              <button
                onClick={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-700/50 transition"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Status Icon */}
                  <div className="text-slate-400 flex-shrink-0">{STATUS_ICONS[transaction.status]}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{transaction.phone_number}</p>
                    <p className="text-xs text-slate-500">{transaction.invoice_number}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">
                      KES {(transaction.amount / 100).toLocaleString()}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[transaction.status]}`}>
                      {transaction.status}
                    </span>
                  </div>

                  {/* Expand Icon */}
                  <div className="flex-shrink-0 text-slate-400">
                    {expandedId === transaction.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === transaction.id && (
                <div className="px-4 py-3 bg-slate-700/30 border-t border-slate-700 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs">Transaction ID</p>
                      <p className="font-mono text-xs text-white break-all">{transaction.id}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Message ID</p>
                      <p className="font-mono text-xs text-white break-all">{transaction.message_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs">Receipt Number</p>
                      <p className="font-mono text-xs text-white">
                        {transaction.mpesa_receipt_number ? (
                          <>
                            {showSecrets.has(transaction.id) ? transaction.mpesa_receipt_number : '••••••••••'}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSecret(transaction.id);
                              }}
                              className="ml-2 text-slate-400 hover:text-slate-300"
                            >
                              {showSecrets.has(transaction.id) ? (
                                <EyeOff className="w-3 h-3 inline" />
                              ) : (
                                <Eye className="w-3 h-3 inline" />
                              )}
                            </button>
                          </>
                        ) : (
                          'Pending'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Created</p>
                      <p className="text-white">
                        {new Date(transaction.created_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {transaction.status === 'failed' && transaction.kcb_error_message && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded p-2">
                      <p className="text-red-400 text-xs">{transaction.kcb_error_message}</p>
                    </div>
                  )}

                  {transaction.ipn_received && (
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>IPN callback received</span>
                    </div>
                  )}

                  {transaction.status === 'processing' && (
                    <div className="flex items-center gap-2 text-xs text-blue-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Awaiting M-Pesa confirmation</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
