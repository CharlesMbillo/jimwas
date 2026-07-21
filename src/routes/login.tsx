import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (em: string) => {
    setEmail(em);
    setPassword('demo');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-xl bg-emerald-600 items-center justify-center mb-3">
            <Leaf className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Jimwas POS</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
              placeholder="you@jimwas.co.ke"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
              placeholder="Any value works (demo)"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-2 text-center">Quick login (demo):</p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => quickLogin('admin@jimwas.co.ke')} className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition">Admin</button>
              <button type="button" onClick={() => quickLogin('manager@jimwas.co.ke')} className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition">Manager</button>
              <button type="button" onClick={() => quickLogin('cashier@jimwas.co.ke')} className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition">Cashier</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
