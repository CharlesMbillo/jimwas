import type { UserRole } from './types';

export function canVoid(role: UserRole): boolean {
  return role === 'admin' || role === 'manager' || role === 'cashier';
}

export function canApproveVoid(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}

export function canManageProducts(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}

export function canManageSettings(role: UserRole): boolean {
  return role === 'admin' || role === 'manager';
}
