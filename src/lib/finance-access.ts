import type { TeamRole } from '@/lib/state/auth-store';

export type FinanceSection = 'overview' | 'expenses' | 'refunds' | 'procurement' | 'settings';

export const canAccessFinanceScreen = (role: TeamRole): boolean => {
  return role === 'admin' || role === 'manager' || role === 'staff';
};

export const canShowFinanceNavigation = (role: TeamRole): boolean => {
  return role === 'admin' || role === 'manager';
};

export const canCreateExpenseRequestForRole = (role: TeamRole): boolean => {
  return role === 'admin' || role === 'manager' || role === 'staff';
};

export const canCreateProcurementRequestForRole = (role: TeamRole): boolean => {
  return role === 'admin' || role === 'manager';
};

export const canCreateRefundRequestForRole = (role: TeamRole): boolean => {
  return role === 'admin' || role === 'manager';
};

export const getAllowedFinanceSections = (role: TeamRole): FinanceSection[] => {
  if (role === 'admin') return ['overview', 'expenses', 'refunds', 'procurement', 'settings'];
  if (role === 'manager') return ['expenses', 'refunds', 'procurement'];
  return ['expenses', 'refunds'];
};

export const getDefaultFinanceSectionForRole = (role: TeamRole): FinanceSection => {
  if (role === 'manager') return 'expenses';
  if (role === 'staff') return 'expenses';
  return 'overview';
};
