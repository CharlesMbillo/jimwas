import { useState, useEffect } from 'react';
import { Plus, Loader2, Package } from 'lucide-react';
import { getAllProducts, createProduct, updateProduct } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { canManageProducts } from '../lib/permissions';
import type { Product } from '../lib/types';

export function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    wholesale_price: '',
    stock_quantity: '',
    category: '',
  });

  const canManage = user ? canManageProducts(user.role) : false;

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', sku: '', price: '', wholesale_price: '', stock_quantity: '', category: '' });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      price: String(p.price),
      wholesale_price: p.wholesale_price ? String(p.wholesale_price) : '',
      stock_quantity: String(p.stock_quantity),
      category: p.category ?? '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      sku: form.sku || null,
      price: parseFloat(form.price) || 0,
      wholesale_price: form.wholesale_price ? parseFloat(form.wholesale_price) : null,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      category: form.category || null,
      active: true,
    };
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
      } else {
        await createProduct(payload);
      }
      setShowForm(false);
      await loadProducts();
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
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-slate-400 text-sm mt-1">{products.length} products in catalog</p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Wholesale</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3">Category</th>
              {canManage && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3 text-white text-sm">{p.name}</td>
                <td className="px-4 py-3 text-slate-400 text-sm">{p.sku || '—'}</td>
                <td className="px-4 py-3 text-right text-emerald-400 text-sm font-medium">KES {Number(p.price).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-400 text-sm">{p.wholesale_price ? `KES ${Number(p.wholesale_price).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3 text-right text-sm">
                  <span className={p.stock_quantity <= 5 ? 'text-red-400 font-medium' : 'text-slate-300'}>
                    {p.stock_quantity}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm">{p.category || '—'}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="py-12 text-center text-slate-500">
                  <Package className="mx-auto mb-2 text-slate-600" size={32} />
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">{editing ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text" placeholder="Product name" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text" placeholder="SKU (optional)" value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" step="0.01" placeholder="Price (KES)" required value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="number" step="0.01" placeholder="Wholesale (optional)" value={form.wholesale_price}
                  onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
                  className="rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" placeholder="Stock quantity" required value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  className="rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text" placeholder="Category (optional)" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">{editing ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
