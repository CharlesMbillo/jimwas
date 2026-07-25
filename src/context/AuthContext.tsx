import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { PosUser } from '../lib/types';

interface AuthContextValue {
  user: PosUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PosUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session) {
        await loadPosUser(session);
      } else {
        setLoading(false);
      }
    })();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) {
          await loadPosUser(session);
        } else {
          setUser(null);
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadPosUser(session: Session) {
    try {
      const { data, error } = await supabase
        .from('pos_users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .eq('active', true)
        .maybeSingle();

      if (error) {
        console.error('Failed to load pos_user:', error);
        setUser(null);
        return;
      }

      if (data) {
        setUser(data as PosUser);
      } else {
        // pos_users row not linked — sign out
        await supabase.auth.signOut();
        setUser(null);
      }
    } catch (err) {
      console.error('Error loading pos_user:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    // loadPosUser will be called by onAuthStateChange
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
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
