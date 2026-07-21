import { useState, useEffect } from 'react';
import { Plus, Loader2, Users, Phone, Mail } from 'lucide-react';
import { getAllCustomers, createCustomer } from '../lib/db';
import type { Customer } from '../lib/types';

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCustomer({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', notes: '' });
      await loadCustomers();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-slate-400 text-sm mt-1">{customers.length} customers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Users className="text-slate-400" size={18} />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{c.name}</p>
                <p className="text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {c.phone && (
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <Phone size={12} /> {c.phone}
                </p>
              )}
              {c.email && (
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <Mail size={12} /> {c.email}
                </p>
              )}
              {!c.phone && !c.email && (
                <p className="text-xs text-slate-600">No contact info</p>
              )}
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <Users className="mx-auto mb-2 text-slate-600" size={32} />
            No customers yet.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Add Customer</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text" placeholder="Full name" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <input
                type="tel" placeholder="Phone (optional)" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <input
                type="email" placeholder="Email (optional)" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <textarea
                placeholder="Notes (optional)" value={form.notes} rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
