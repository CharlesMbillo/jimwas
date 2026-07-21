import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Users, Trash2 } from 'lucide-react';
import { getAllTransactions, getAllCustomers, getAllProducts } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { canVoid } from '../lib/permissions';
import { VoidTransactionModal } from '../components/VoidTransactionModal';
import type { Transaction, Customer, Product } from '../lib/types';

export function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [voidTransaction, setVoidTransaction] = useState<Transaction | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const canVoidSales = user ? canVoid(user.role) : false;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [txData, custData, prodData] = await Promise.all([
        getAllTransactions(),
        getAllCustomers(),
        getAllProducts(),
      ]);
      setTransactions(txData);
      setCustomers(custData);
      setProducts(prodData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  const recentTransactions = useMemo(() => transactions.slice(0, 10), [transactions]);

  const stats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed');
    const totalRevenue = completed.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTx = completed.filter((t) => new Date(t.created_at) >= todayStart);
    const todayRevenue = todayTx.reduce((sum, t) => sum + Number(t.total_amount), 0);
    const lowStock = products.filter((p) => p.stock_quantity <= 5);
    return {
      totalRevenue,
      todayRevenue,
      totalSales: completed.length,
      todaySales: todayTx.length,
      totalCustomers: customers.length,
      lowStockCount: lowStock.length,
    };
  }, [transactions, customers, products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Revenue"
          value={`KES ${stats.todayRevenue.toLocaleString()}`}
          icon={<DollarSign className="text-emerald-400" size={20} />}
        />
        <StatCard
          label="Today's Sales"
          value={stats.todaySales.toString()}
          icon={<ShoppingCart className="text-blue-400" size={20} />}
        />
        <StatCard
          label="Total Revenue"
          value={`KES ${stats.totalRevenue.toLocaleString()}`}
          icon={<TrendingUp className="text-amber-400" size={20} />}
        />
        <StatCard
          label="Customers"
          value={stats.totalCustomers.toString()}
          icon={<Users className="text-purple-400" size={20} />}
        />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                <th className="pb-2">Date</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Items</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">Payment</th>
                <th className="pb-2 text-right">Status</th>
                {canVoidSales && <th className="pb-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {recentTransactions.map((tx) => {
                const customer = customers.find((c) => c.id === tx.customer_id);
                const isVoided = tx.status === 'voided';
                return (
                  <tr key={tx.id} className={`hover:bg-slate-700/50 ${isVoided ? 'opacity-50' : ''}`}>
                    <td className="py-3 text-sm text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-white text-sm">{customer?.name || 'Walk-in'}</td>
                    <td className="py-3 text-slate-400 text-sm">{tx.transaction_items?.length || 0} items</td>
                    <td className="py-3 text-right text-emerald-400 font-medium text-sm">
                      KES {Number(tx.total_amount).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                        {tx.payment_method}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        isVoided
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-emerald-900/30 text-emerald-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    {canVoidSales && (
                      <td className="py-3 text-right">
                        {tx.status === 'completed' && (
                          <button
                            onClick={() => {
                              setVoidTransaction(tx);
                              setShowVoidModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition"
                            title="Request void"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={canVoidSales ? 7 : 6} className="py-8 text-center text-slate-500 text-sm">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stats.lowStockCount > 0 && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4">
          <h3 className="text-amber-300 font-medium text-sm mb-2">Low Stock Alert</h3>
          <p className="text-amber-300/70 text-xs">
            {stats.lowStockCount} product(s) have stock at or below 5 units. Check the Products page to restock.
          </p>
        </div>
      )}

      <VoidTransactionModal
        transaction={voidTransaction}
        isOpen={showVoidModal}
        onClose={() => {
          setShowVoidModal(false);
          setVoidTransaction(null);
        }}
        onVoidComplete={() => {
          setShowVoidModal(false);
          setVoidTransaction(null);
          loadData();
        }}
      />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
