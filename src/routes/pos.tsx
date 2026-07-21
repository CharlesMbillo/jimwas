import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Loader2, CheckCircle } from 'lucide-react';
import { getAllProducts, getAllCustomers, createTransaction } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import type { Product, Customer, PaymentMethod, SaleType } from '../lib/types';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export function PosPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [saleType, setSaleType] = useState<SaleType>('standard');
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [prods, custs] = await Promise.all([getAllProducts(), getAllCustomers()]);
      setProducts(prods);
      setCustomers(custs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const paid = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, paid - cartTotal);

  function addToCart(product: Product) {
    const price = saleType === 'wholesale' && product.wholesale_price
      ? Number(product.wholesale_price)
      : Number(product.price);
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: price }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  function handleSaleTypeChange(newType: SaleType) {
    setSaleType(newType);
    setCart((prev) =>
      prev.map((item) => {
        const price = newType === 'wholesale' && item.product.wholesale_price
          ? Number(item.product.wholesale_price)
          : Number(item.product.price);
        return { ...item, unitPrice: price };
      })
    );
  }

  async function handleCheckout() {
    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }
    if (paymentMethod === 'cash' && paid < cartTotal) {
      setError('Amount paid is less than total.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createTransaction(
        {
          customer_id: customerId,
          cashier_id: user?.id ?? null,
          total_amount: cartTotal,
          amount_paid: paymentMethod === 'cash' ? paid : cartTotal,
          change_due: paymentMethod === 'cash' ? changeDue : 0,
          payment_method: paymentMethod,
          sale_type: saleType,
          status: 'completed',
        },
        cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
        }))
      );
      setSuccess(`Sale completed: KES ${cartTotal.toLocaleString()}`);
      setCart([]);
      setAmountPaid('');
      setCustomerId(null);
      setPaymentMethod('cash');
      setSaleType('standard');
      await loadData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setSubmitting(false);
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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">New Sale</h1>

      {success && (
        <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 p-4 text-emerald-300 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock_quantity <= 0}
                className="text-left rounded-xl bg-slate-800 border border-slate-700 p-4 hover:border-emerald-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <p className="text-white text-sm font-medium line-clamp-2">{product.name}</p>
                <p className="text-emerald-400 font-bold mt-1">KES {Number(product.price).toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">Stock: {product.stock_quantity}</p>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="col-span-full text-center text-slate-500 py-8 text-sm">No products found.</p>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-emerald-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Cart</h2>
            {cart.length > 0 && (
              <span className="ml-auto text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Sale Type</label>
            <select
              value={saleType}
              onChange={(e) => handleSaleTypeChange(e.target.value as SaleType)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="standard">Standard</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Customer</label>
            <select
              value={customerId ?? ''}
              onChange={(e) => setCustomerId(e.target.value || null)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="">Walk-in Customer</option>
              {customers.filter((c) => c.name !== 'Walk-in Customer').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-2 bg-slate-900 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{item.product.name}</p>
                  <p className="text-slate-500 text-xs">KES {item.unitPrice.toLocaleString()} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded hover:bg-slate-700 text-slate-400">
                    <Minus size={14} />
                  </button>
                  <span className="text-white text-xs w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded hover:bg-slate-700 text-slate-400">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-4">Cart is empty. Click a product to add.</p>
            )}
          </div>

          <div className="border-t border-slate-700 pt-3 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Total</span>
              <span className="text-white font-bold text-lg">KES {cartTotal.toLocaleString()}</span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
              </select>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount Paid</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="0"
                />
                {paid >= cartTotal && cartTotal > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">Change: KES {changeDue.toLocaleString()}</p>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
