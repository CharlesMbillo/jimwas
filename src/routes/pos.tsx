import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Minus, Trash2, Search, User, ShoppingCart, Banknote, CreditCard, Smartphone, X, Package, Archive, ArchiveRestore, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, FlaskConical, Zap } from 'lucide-react';
import { generateId, saveProduct, getAllProducts, getAllCustomers, saveCustomer, getMpesaSettings } from '../lib/db';
import { syncInsertCustomer, syncInsertProduct, getSupabase } from '../lib/sync';
import { logSaleCompleted, logCustomerCreated } from '../lib/audit';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { initiateSTKPush, pollForPaymentCompletion } from '../lib/mpesa';
import { completeSale, validatePhoneNumber, validatePrice, validateStock, sanitizeInput } from '../lib/transaction-utils';
import { useDebounce } from '../hooks/useDebounce';
import { SaleTypeSelector } from '../components/SaleTypeSelector';
import type { Product, Customer, CartItem } from '../lib/types';

const LOYALTY_POINTS_PER_SHILLING = 100;

export function POSTerminal() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: '' });
  const [parkedSales, setParkedSales] = useState<Array<{id: string; cart: CartItem[]; customer: Customer | null; timestamp: string}>>([]);
  const [showParkedSales, setShowParkedSales] = useState(false);

  // M-Pesa STK Push state
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'initiating' | 'waiting' | 'checking' | 'success' | 'failed' | 'cancelled'>('idle');
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState<string | null>(null);
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [mpesaReceiptNumber, setMpesaReceiptNumber] = useState<string | null>(null);
  const [mpesaStartTime, setMpesaStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mpesaEnabled, setMpesaEnabled] = useState<boolean | null>(null);
  const [mpesaConfigured, setMpesaConfigured] = useState<boolean>(false);
  const [mpesaEnvironment, setMpesaEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [mpesaSimulating, setMpesaSimulating] = useState(false);
  
  // Sale type state
  const [saleType, setSaleType] = useState<'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama'>('standard');
  const [depositAmount, setDepositAmount] = useState(0);

  useEffect(() => {
    loadData();
    // Load cart from storage on mount
    loadSavedCart();
    // Load parked sales on mount
    loadSavedParkedSales();
  }, []);

  // Auto-save cart to IndexedDB whenever it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cart.length > 0) {
        saveCartToStorage();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, selectedCustomer, saleType, depositAmount]);

  // Timer for M-Pesa in-progress states only — do NOT reset on failure/success so the final time remains visible
  useEffect(() => {
    if (mpesaStatus !== 'waiting' && mpesaStatus !== 'initiating' && mpesaStatus !== 'checking') {
      return;
    }

    const interval = setInterval(() => {
      if (mpesaStartTime) {
        setElapsedSeconds(Math.floor((Date.now() - mpesaStartTime.getTime()) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mpesaStatus, mpesaStartTime]);

  const loadData = async () => {
    const [prods, custs, idbMpesa] = await Promise.all([
      getAllProducts(),
      getAllCustomers(),
      getMpesaSettings(),
    ]);
    setProducts(prods.filter(p => p.is_active));
    setCustomers(custs);

    // Always try Supabase first for M-Pesa settings (authoritative source)
    let mpesa = idbMpesa;
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('mpesa_settings')
        .select('*')
        .eq('id', 'mpesa-settings')
        .maybeSingle();
      if (data) mpesa = data;
    }

    setMpesaEnabled(mpesa?.is_enabled ?? false);
    setMpesaEnvironment(mpesa?.environment ?? 'sandbox');
    // M-Pesa is "configured" when enabled + has consumer key + secret (minimum to attempt)
    // passkey and short_code are validated at the edge function level with clear errors
    const hasCredentials = !!(mpesa?.is_enabled &&
      mpesa.consumer_key &&
      mpesa.consumer_secret);
    setMpesaConfigured(hasCredentials);
  };

  const saveCartToStorage = async () => {
    try {
      const { saveCartSession } = await import('../lib/db');
      await saveCartSession({
        id: 'current-cart',
        items: cart,
        selectedCustomer,
        total: cartTotal,
        saleType,
        depositAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[v0] Failed to save cart:', error);
    }
  };

  const loadSavedCart = async () => {
    try {
      const { loadCartSession } = await import('../lib/db');
      const savedCart = await loadCartSession();
      if (savedCart && savedCart.items.length > 0) {
        setCart(savedCart.items);
        setSelectedCustomer(savedCart.selectedCustomer);
        setSaleType(savedCart.saleType || 'standard');
        setDepositAmount(savedCart.depositAmount || 0);
      }
    } catch (error) {
      console.error('[v0] Failed to load cart:', error);
    }
  };

  const loadSavedParkedSales = async () => {
    try {
      const { getAllParkedSales } = await import('../lib/db');
      const parked = await getAllParkedSales();
      if (parked.length > 0) {
        console.log(`[v0] Loaded ${parked.length} parked sales`);
        // You can display these in a UI list if needed
      }
    } catch (error) {
      console.error('[v0] Failed to load parked sales:', error);
    }
  };

  // Debounce search terms for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const debouncedCustomerSearch = useDebounce(customerSearch, 200);

  const filteredProducts = useMemo(() => {
    const term = debouncedSearchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    );
  }, [products, debouncedSearchTerm]);

  const filteredCustomers = useMemo(() => {
    const term = debouncedCustomerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.phone?.includes(debouncedCustomerSearch)
    );
  }, [customers, debouncedCustomerSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const change = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, paid - cartTotal);
  }, [amountPaid, cartTotal]);

  const loyaltyPointsToEarn = useMemo(() => {
    if (!selectedCustomer) return 0;
    return Math.floor(cartTotal / LOYALTY_POINTS_PER_SHILLING);
  }, [cartTotal, selectedCustomer]);

  const addToCart = useCallback((product: Product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product_id === product.id);
      if (existing) {
        return prevCart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      }

      return [...prevCart, {
        id: generateId(),
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
      }];
    });
  }, []);

  const updateCartItem = useCallback((itemId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id !== itemId) return item;
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, subtotal: newQty * item.unit_price };
      }).filter(item => item.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  }, []);

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setAmountPaid('');
    setShowCheckout(false);
    // Reset M-Pesa state
    setMpesaPhone('');
    setMpesaStatus('idle');
    setMpesaCheckoutId(null);
    setMpesaError(null);
    setMpesaReceiptNumber(null);
    setMpesaStartTime(null);
    setElapsedSeconds(0);
    // Reset sale type
    setSaleType('standard');
    setDepositAmount(0);
  };

  // Handle M-Pesa STK Push
  const handleMpesaPayment = async () => {
    if (!mpesaConfigured) {
      setMpesaStatus('failed');
      setMpesaError(mpesaEnabled
        ? 'M-Pesa API credentials not configured. Go to Settings > Payments to add Consumer Key, Secret, Passkey, and Short Code.'
        : 'M-Pesa is not enabled. Go to Settings > Payments to enable it.');
      return;
    }

    if (!mpesaPhone || mpesaPhone.length < 9) {
      setMpesaError('Please enter a valid phone number');
      return;
    }

    setMpesaStatus('initiating');
    setMpesaError(null);
    setMpesaStartTime(new Date());

    try {
      const result = await initiateSTKPush(mpesaPhone, cartTotal, {
        cashierId: user?.id,
        cashierName: user?.name,
        accountReference: `POS-${Date.now()}`,
        transactionDesc: 'POS Purchase',
      });

      if (!result.success || !result.checkoutRequestId) {
        setMpesaStatus('failed');
        setMpesaError(result.error || 'Failed to initiate payment');
        return;
      }

      setMpesaCheckoutId(result.checkoutRequestId);
      setMpesaStatus('waiting');
      toast.show('Payment request sent. Check your phone for M-Pesa prompt.');

      // Start polling for completion
      const statusResult = await pollForPaymentCompletion(result.checkoutRequestId, {
        maxAttempts: 36, // 3 minutes
        intervalMs: 5000,
        onStatusChange: (status) => {
          if (status.status === 'processing') {
            setMpesaStatus('checking');
          }
        },
      });

      if (statusResult.status === 'success') {
        setMpesaStatus('success');
        setMpesaReceiptNumber(statusResult.mpesaReceiptNumber || null);
        toast.show('Payment successful!');
        // Auto-complete the sale
        await completeMpesaSale(statusResult.mpesaReceiptNumber);
      } else if (statusResult.status === 'cancelled') {
        setMpesaStatus('cancelled');
        setMpesaError('Payment was cancelled by user');
      } else if (statusResult.status === 'timeout') {
        setMpesaStatus('failed');
        setMpesaError('Payment timed out. Please try again.');
      } else if (statusResult.status === 'insufficient_balance') {
        setMpesaStatus('failed');
        setMpesaError('Insufficient M-Pesa balance');
      } else {
        setMpesaStatus('failed');
        setMpesaError(statusResult.resultDesc || 'Payment failed');
      }
    } catch (error) {
      setMpesaStatus('failed');
      setMpesaError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  // Sandbox only: simulate a payment via Daraja simulate endpoint
  const handleSimulatePayment = async () => {
    if (mpesaEnvironment !== 'sandbox') return;
    setMpesaSimulating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          checkoutRequestId: mpesaCheckoutId || `sim-${Date.now()}`,
          phone: mpesaPhone,
          amount: cart.reduce((s, i) => s + i.product.selling_price * i.quantity, 0),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMpesaError(data.error || 'Simulation failed');
        return;
      }
      // Directly mark as success — don't rely on polling
      setMpesaReceiptNumber(data.receiptNumber);
      setMpesaStatus('success');
      toast.show('Payment simulated successfully!');
      await completeMpesaSale(data.receiptNumber);
    } catch (error) {
      setMpesaError(error instanceof Error ? error.message : 'Simulation failed');
    } finally {
      setMpesaSimulating(false);
    }
  };

  // Complete sale after M-Pesa payment
  const completeMpesaSale = useCallback(async (mpesaReceipt?: string) => {
    const result = await completeSale({
      cart,
      cartTotal,
      products,
      selectedCustomer,
      paymentMethod: 'mpesa',
      amountPaid: cartTotal,
      change: 0,
      userId: user?.id || 'system',
      mpesaReceipt,
    });

    if (result.success) {
      await logSaleCompleted(result.transactionId, { cart, total_amount: cartTotal }, user?.id);

      // Brief delay to show success, then close
      setTimeout(() => {
        clearCart();
        loadData();
      }, 1500);
    }
  }, [cart, cartTotal, products, selectedCustomer, user?.id]);

  const parkSale = () => {
    if (cart.length === 0) return;
    const parkedSale = {
      id: generateId(),
      cart: [...cart],
      customer: selectedCustomer,
      timestamp: new Date().toISOString(),
    };
    setParkedSales(prev => [...prev, parkedSale]);
    clearCart();
  };

  const resumeSale = (parkedId: string) => {
    const sale = parkedSales.find(s => s.id === parkedId);
    if (!sale) return;
    setCart(sale.cart);
    setSelectedCustomer(sale.customer);
    setParkedSales(prev => prev.filter(s => s.id !== parkedId));
    setShowParkedSales(false);
  };

  const deleteParkedSale = (parkedId: string) => {
    setParkedSales(prev => prev.filter(s => s.id !== parkedId));
  };

  const handleAddProduct = useCallback(async () => {
    const sanitizedName = sanitizeInput(newProduct.name);
    if (!sanitizedName) {
      toast.show('Product name is required', 'error');
      return;
    }

    const priceValidation = validatePrice(newProduct.price);
    if (!priceValidation.valid) {
      toast.show(priceValidation.error || 'Invalid price', 'error');
      return;
    }

    const stockValidation = validateStock(newProduct.stock);
    if (!stockValidation.valid) {
      toast.show(stockValidation.error || 'Invalid stock', 'error');
      return;
    }

    const product: Product = {
      id: generateId(),
      name: sanitizedName,
      price: priceValidation.value!,
      cost: 0,
      stock: stockValidation.value!,
      category: sanitizeInput(newProduct.category),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveProduct(product);
    syncInsertProduct(product);
    setProducts(prev => [...prev, product]);
    setNewProduct({ name: '', price: '', stock: '', category: '' });
    setShowAddProduct(false);
    toast.show('Product added successfully!');
  }, [newProduct, toast]);

  const handleCreateCustomer = useCallback(async () => {
    const sanitizedName = sanitizeInput(newCustomer.name);
    if (!sanitizedName) {
      toast.show('Customer name is required', 'error');
      return;
    }

    if (newCustomer.phone) {
      const phoneValidation = validatePhoneNumber(newCustomer.phone);
      if (!phoneValidation.valid) {
        toast.show(phoneValidation.error || 'Invalid phone number', 'error');
        return;
      }
    }

    const customer: Customer = {
      id: generateId(),
      name: sanitizedName,
      phone: newCustomer.phone ? sanitizeInput(newCustomer.phone) : undefined,
      email: newCustomer.email ? sanitizeInput(newCustomer.email) : undefined,
      loyalty_points: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveCustomer(customer);
    syncInsertCustomer(customer);
    await logCustomerCreated(customer.id, customer, user?.id);
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
    setNewCustomer({ name: '', phone: '', email: '' });
    setShowNewCustomer(false);
    toast.show('Customer created successfully!');
  }, [newCustomer, user?.id, toast]);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;

    // Stock validation
    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      if (product.stock < item.quantity) {
        toast.show(`Insufficient stock for ${item.product_name}. Available: ${product.stock}`, 'error');
        return;
      }
    }

    // Calculate amount paid based on sale type
    let paid = parseFloat(amountPaid) || cartTotal;
    let amountRequired = cartTotal;
    
    // For Lipa Mdogo and Kyama, only deposit is required today
    if (saleType === 'lipa_mdogo' || saleType === 'kyama') {
      amountRequired = depositAmount;
      paid = Math.min(parseFloat(amountPaid) || depositAmount, cartTotal);
    }
    
    if (paid < amountRequired) {
      const requiredLabel = (saleType === 'lipa_mdogo' || saleType === 'kyama') 
        ? 'deposit amount' 
        : 'total amount due';
      toast.show(`Amount paid is less than ${requiredLabel}`, 'error');
      return;
    }

    const result = await completeSale({
      cart,
      cartTotal,
      products,
      selectedCustomer,
      paymentMethod,
      amountPaid: paid,
      change: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? 0 : change,
      userId: user?.id || 'system',
      saleType,
      depositAmount: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? depositAmount : 0,
      balanceAmount: (saleType === 'lipa_mdogo' || saleType === 'kyama') ? (cartTotal - depositAmount) : 0,
    });

    if (result.success) {
      await logSaleCompleted(result.transactionId, { cart, total_amount: cartTotal }, user?.id);
      clearCart();
      loadData();
      toast.show('Transaction completed successfully!');
    }
  }, [cart, cartTotal, products, selectedCustomer, paymentMethod, amountPaid, change, user?.id, toast]);

  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      {/* Product Grid */}
      <div className="col-span-2 bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Search and Products */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <Plus size={20} />
              Add Product
            </button>
          </div>
        </div>

        {/* Products Grid - Only scrollable section */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className={`bg-slate-700 rounded-lg p-4 text-left transition ${
                  product.stock > 0
                    ? 'hover:bg-slate-600 hover:ring-2 hover:ring-emerald-500'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-white">{product.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    product.stock > 10 ? 'bg-emerald-600/20 text-emerald-400' :
                    product.stock > 0 ? 'bg-amber-600/20 text-amber-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>
                    {product.stock} in stock
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  KES {product.price.toLocaleString()}
                </p>
                {product.category && (
                  <p className="text-xs text-slate-400 mt-2">{product.category}</p>
                )}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart - Fixed height with internal scroll for items */}
      <div className="bg-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
        {/* Cart Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-400" />
              <span className="font-medium text-white">Cart</span>
              <span className="text-slate-400">({cart.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {parkedSales.length > 0 && (
                <button
                  onClick={() => setShowParkedSales(true)}
                  className="relative p-2 text-amber-400 hover:bg-slate-700 rounded-lg transition"
                  title={`${parkedSales.length} parked sale(s)`}
                >
                  <Archive size={18} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                    {parkedSales.length}
                  </span>
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-slate-400 hover:text-red-400 transition"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {cart.map((item) => (
            <div key={item.id} className="bg-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-medium">{item.product_name}</span>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartItem(item.id, -1)}
                    className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center hover:bg-slate-500 text-white"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-white w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartItem(item.id, 1)}
                    className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center hover:bg-slate-500 text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-emerald-400 font-medium">
                  KES {item.subtotal.toLocaleString()}
                </span>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          )}
        </div>

        {/* Customer Selection */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <User size={18} className="text-emerald-400" />
                <div>
                  <p className="text-white font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-400">
                    {selectedCustomer.loyalty_points} points
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-red-400"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 text-sm"
                />
              </div>
              {customerSearch && (
                <div className="bg-slate-700 rounded-lg max-h-40 overflow-auto">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                      }}
                      className="w-full p-2 text-left hover:bg-slate-600 flex items-center gap-2"
                    >
                      <User size={16} className="text-slate-400" />
                      <div>
                        <p className="text-white text-sm">{customer.name}</p>
                        <p className="text-xs text-slate-400">{customer.phone}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="w-full p-2 text-left hover:bg-slate-600 text-emerald-400 text-sm flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add new customer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total and Checkout */}
        <div className="flex-shrink-0 p-4 border-t border-slate-700 space-y-4">
          <div className="flex justify-between text-lg">
            <span className="text-slate-400">Total</span>
            <span className="text-white font-bold">KES {cartTotal.toLocaleString()}</span>
          </div>

          {selectedCustomer && loyaltyPointsToEarn > 0 && (
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              <span>+{loyaltyPointsToEarn} loyalty points</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={parkSale}
              disabled={cart.length === 0}
              className="py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Archive size={18} />
              Park Sale
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Checkout</h3>
              <button
                onClick={() => {
                  if (mpesaStatus === 'waiting' || mpesaStatus === 'initiating') {
                    if (confirm('M-Pesa payment is in progress. Are you sure you want to cancel?')) {
                      setShowCheckout(false);
                      setMpesaStatus('idle');
                    }
                  } else {
                    setShowCheckout(false);
                  }
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sale Type Selector */}
              <SaleTypeSelector
                saleType={saleType}
                onSaleTypeChange={setSaleType}
                cartTotal={cartTotal}
                depositAmount={depositAmount}
                onDepositChange={setDepositAmount}
              />

              {/* Payment Method */}
              <div>
                <label className="text-sm text-slate-400 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', icon: Banknote, label: 'Cash' },
                    { id: 'card', icon: CreditCard, label: 'Card' },
                    { id: 'mpesa', icon: Smartphone, label: 'M-Pesa' },
                  ].map(({ id, icon: Icon, label }) => {
                    const isLocked = mpesaStatus === 'waiting' || mpesaStatus === 'initiating';
                    const isMpesaUnconfigured = id === 'mpesa' && !mpesaConfigured;
                    return (
                      <button
                        key={id}
                        onClick={() => setPaymentMethod(id as 'cash' | 'card' | 'mpesa')}
                        disabled={isLocked}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition relative ${
                          paymentMethod === id
                            ? 'border-emerald-500 bg-emerald-600/20'
                            : 'border-slate-600 hover:border-slate-500'
                        } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon size={24} className={paymentMethod === id ? 'text-emerald-400' : isMpesaUnconfigured ? 'text-slate-500' : 'text-slate-400'} />
                        <span className={`text-sm ${paymentMethod === id ? 'text-white' : isMpesaUnconfigured ? 'text-slate-500' : 'text-slate-400'}`}>
                          {label}
                        </span>
                        {isMpesaUnconfigured && (
                          <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded">
                            {!mpesaEnabled ? 'OFF' : 'KEY'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* M-Pesa STK Push Section */}
              {paymentMethod === 'mpesa' && (
                <div className="bg-slate-700 rounded-lg p-4 space-y-4">
                  {/* Sandbox badge */}
                  {mpesaEnvironment === 'sandbox' && (
                    <div className="flex items-center gap-2 bg-blue-900/40 border border-blue-700 rounded-lg px-3 py-2">
                      <FlaskConical size={14} className="text-blue-400" />
                      <span className="text-blue-300 text-xs font-semibold">SANDBOX / UAT MODE</span>
                      <span className="text-blue-400/70 text-xs ml-auto">No real money moves</span>
                    </div>
                  )}
                  {mpesaStatus === 'idle' && (
                    <>
                      {!mpesaConfigured && (
                        <div className="flex items-start gap-3 bg-amber-900/30 border border-amber-700 rounded-lg p-3">
                          <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-amber-300 text-sm font-medium">M-Pesa not ready</p>
                            <p className="text-amber-400/80 text-xs mt-0.5">
                              {!mpesaEnabled
                                ? 'Enable M-Pesa in Settings › Payments'
                                : 'Add Consumer Key & Secret in Settings › Payments'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-slate-400">M-Pesa Phone Number</label>
                          {mpesaEnvironment === 'sandbox' && (
                            <button
                              type="button"
                              onClick={() => setMpesaPhone('254708374149')}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              <Zap size={11} />
                              Use test number
                            </button>
                          )}
                        </div>
                        <input
                          type="tel"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder={mpesaEnvironment === 'sandbox' ? '254708374149 (test)' : '07XX XXX XXX'}
                          className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-emerald-500 focus:outline-none text-lg"
                        />
                        {mpesaEnvironment === 'sandbox' && (
                          <p className="text-xs text-blue-400/70 mt-1">Sandbox test number: 254708374149 • PIN: any 4 digits</p>
                        )}
                      </div>
                      <button
                        onClick={handleMpesaPayment}
                        disabled={!mpesaConfigured || !mpesaPhone || mpesaPhone.length < 9}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Smartphone size={20} />
                        Send Payment Request
                      </button>
                    </>
                  )}

                  {(mpesaStatus === 'initiating' || mpesaStatus === 'waiting' || mpesaStatus === 'checking') && (
                    <div className="space-y-4">
                      {/* Saving Action Bar */}
                      <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border border-emerald-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Loader2 size={32} className="animate-spin text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {mpesaStatus === 'initiating' && 'Initiating Payment...'}
                                {mpesaStatus === 'waiting' && 'Waiting for Confirmation...'}
                                {mpesaStatus === 'checking' && 'Verifying Payment...'}
                              </p>
                              <p className="text-emerald-300 text-sm">
                                KES {cartTotal.toLocaleString()} to {mpesaPhone}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Clock size={16} />
                              <span className="font-mono text-lg font-bold">
                                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">elapsed</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (elapsedSeconds / 180) * 100)}%`,
                              animation: 'pulse 2s ease-in-out infinite'
                            }}
                          />
                        </div>

                        {/* Timestamp info */}
                        {mpesaStartTime && (
                          <p className="text-xs text-slate-400 mt-2 text-center">
                            Started at {mpesaStartTime.toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      {/* Instructions */}
                      <div className="flex items-start gap-3 bg-slate-600/50 rounded-lg p-3">
                        <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-300">
                          {mpesaStatus === 'initiating' && (
                            <p>Connecting to M-Pesa servers. Please wait...</p>
                          )}
                          {mpesaStatus === 'waiting' && (
                            <p>Check your phone for the M-Pesa prompt and enter your PIN to confirm payment.</p>
                          )}
                          {mpesaStatus === 'checking' && (
                            <p>Payment detected. Verifying transaction with M-Pesa...</p>
                          )}
                        </div>
                      </div>

                      {/* Sandbox simulate button */}
                      {mpesaEnvironment === 'sandbox' && mpesaStatus === 'waiting' && (
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FlaskConical size={14} className="text-blue-400" />
                              <p className="text-blue-300 text-xs font-medium">Sandbox: no phone prompt is sent</p>
                            </div>
                            <button
                              onClick={handleSimulatePayment}
                              disabled={mpesaSimulating}
                              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition whitespace-nowrap"
                            >
                              {mpesaSimulating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                              Simulate Success
                            </button>
                          </div>
                          <p className="text-blue-400/60 text-[10px] mt-1.5">Triggers Daraja sandbox simulate endpoint to mark this payment as successful</p>
                        </div>
                      )}
                    </div>
                  )}

                  {mpesaStatus === 'success' && (
                    <div className="space-y-4">
                      {/* Success Action Bar */}
                      <div className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-600 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 size={40} className="text-emerald-400" />
                          <div className="flex-1">
                            <p className="text-white font-bold text-lg">Payment Successful!</p>
                            <p className="text-emerald-300">KES {cartTotal.toLocaleString()} received</p>
                          </div>
                        </div>

                        {mpesaReceiptNumber && (
                          <div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-slate-400 text-sm">M-Pesa Receipt</span>
                            <span className="text-white font-mono font-bold">{mpesaReceiptNumber}</span>
                          </div>
                        )}

                        {mpesaStartTime && (
                          <p className="text-xs text-slate-400 mt-3 text-center">
                            Completed at {new Date().toLocaleTimeString()} ({elapsedSeconds}s)
                          </p>
                        )}
                      </div>

                      {/* Completing sale message */}
                      <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Completing sale...</span>
                      </div>
                    </div>
                  )}

                  {(mpesaStatus === 'failed' || mpesaStatus === 'cancelled') && (
                    <div className="space-y-4">
                      {/* Failed Action Bar */}
                      <div className="bg-gradient-to-r from-red-900/50 to-rose-900/50 border border-red-700 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <XCircle size={40} className="text-red-400" />
                          <div className="flex-1">
                            <p className="text-white font-bold text-lg">
                              {mpesaStatus === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
                            </p>
                            <p className="text-red-300">KES {cartTotal.toLocaleString()} not received</p>
                          </div>
                        </div>

                        {mpesaError && (
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-slate-300 text-sm">{mpesaError}</p>
                          </div>
                        )}

                        {mpesaStartTime && (
                          <p className="text-xs text-slate-400 mt-3 text-center">
                            Failed after {elapsedSeconds}s at {new Date().toLocaleTimeString()}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setMpesaStatus('idle');
                          setMpesaError(null);
                          setMpesaStartTime(null);
                          setElapsedSeconds(0);
                        }}
                        className="w-full py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition flex items-center justify-center gap-2"
                      >
                        Try Again
                      </button>

                      {/* Sandbox simulate in failed state */}
                      {mpesaEnvironment === 'sandbox' && (
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FlaskConical size={14} className="text-blue-400" />
                              <p className="text-blue-300 text-xs font-medium">Sandbox: simulate a successful payment</p>
                            </div>
                            <button
                              onClick={handleSimulatePayment}
                              disabled={mpesaSimulating}
                              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition whitespace-nowrap"
                            >
                              {mpesaSimulating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                              Simulate Success
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Cash/Card Payment Section */}
              {paymentMethod !== 'mpesa' && (
                <>
                  {/* Amount Paid */}
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">
                      {saleType === 'lipa_mdogo' || saleType === 'kyama' 
                        ? 'Deposit Amount (KES)' 
                        : 'Amount Paid (KES)'}
                    </label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={(saleType === 'lipa_mdogo' || saleType === 'kyama' 
                        ? depositAmount 
                        : cartTotal).toString()}
                      className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-lg"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-700 rounded-lg p-4 space-y-2">
                    {saleType === 'lipa_mdogo' || saleType === 'kyama' ? (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Total Amount</span>
                          <span>KES {cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-emerald-400">
                          <span>Deposit Today</span>
                          <span>KES {depositAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Received</span>
                          <span>KES {(parseFloat(amountPaid) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-slate-600 pt-2">
                          <span className="text-white">Balance Due</span>
                          <span className="text-amber-400">KES {Math.max(0, cartTotal - depositAmount).toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Total</span>
                          <span>KES {cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Paid</span>
                          <span>KES {(parseFloat(amountPaid) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-slate-600 pt-2">
                          <span className="text-white">Change</span>
                          <span className="text-emerald-400">KES {change.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Complete Button */}
                  <button
                    onClick={handleCheckout}
                    className="w-full py-4 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                  >
                    Complete Sale
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Customer</h3>
              <button onClick={() => setShowNewCustomer(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleCreateCustomer}
                disabled={!newCustomer.name}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Product</h3>
              <button onClick={() => setShowAddProduct(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Price (KES) *</label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Stock</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Category</label>
                  <input
                    type="text"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleAddProduct}
                disabled={!newProduct.name || !newProduct.price}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parked Sales Modal */}
      {showParkedSales && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Parked Sales</h3>
              <button onClick={() => setShowParkedSales(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parkedSales.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Archive size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No parked sales</p>
                </div>
              ) : (
                parkedSales.map((sale) => {
                  const saleTotal = sale.cart.reduce((sum, item) => sum + item.subtotal, 0);
                  return (
                    <div key={sale.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-white font-medium">
                            {sale.cart.length} item{sale.cart.length !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(sale.timestamp).toLocaleString()}
                          </p>
                          {sale.customer && (
                            <p className="text-xs text-emerald-400 mt-1">
                              Customer: {sale.customer.name}
                            </p>
                          )}
                        </div>
                        <p className="text-lg font-bold text-emerald-400">
                          KES {saleTotal.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeSale(sale.id)}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                        >
                          <ArchiveRestore size={16} />
                          Resume
                        </button>
                        <button
                          onClick={() => deleteParkedSale(sale.id)}
                          className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
