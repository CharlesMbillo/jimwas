import type { UserRole } from './types';
import type { PosUser } from './types';

export function getCurrentUserRole(): UserRole | null {
  const stored = localStorage.getItem('jimwas_pos_user');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as PosUser;
    return parsed.role;
  } catch {
    return null;
  }
}

export function getCurrentUser(): PosUser | null {
  const stored = localStorage.getItem('jimwas_pos_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PosUser;
  } catch {
    return null;
  }
}
