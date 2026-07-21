import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { PosUser, UserRole } from '../lib/types';

interface AuthContextValue {
  user: PosUser | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PosUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('jimwas_pos_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('jimwas_pos_user');
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string) {
    // Demo mode - accept demo emails without database
    const demoUsers: Record<string, PosUser> = {
      'admin@jimwas.co.ke': {
        id: 'user-admin',
        email: 'admin@jimwas.co.ke',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      'manager@jimwas.co.ke': {
        id: 'user-manager',
        email: 'manager@jimwas.co.ke',
        full_name: 'Manager User',
        role: 'manager',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      'cashier@jimwas.co.ke': {
        id: 'user-cashier',
        email: 'cashier@jimwas.co.ke',
        full_name: 'Cashier User',
        role: 'cashier',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };

    if (demoUsers[email]) {
      const posUser = demoUsers[email];
      setUser(posUser);
      localStorage.setItem('jimwas_pos_user', JSON.stringify(posUser));
      return;
    }

    // Try database lookup for non-demo users
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error('Login failed');
    if (!data) throw new Error('User not found or inactive');

    const posUser = data as PosUser;
    setUser(posUser);
    localStorage.setItem('jimwas_pos_user', JSON.stringify(posUser));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('jimwas_pos_user');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
