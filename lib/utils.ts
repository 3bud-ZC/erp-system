import { formatCurrency as formatCurrencyBase, formatNumber as formatNumberBase, formatDate as formatDateBase } from './format';

export const formatCurrency = formatCurrencyBase;
export const formatNumber = formatNumberBase;
export const formatDate = formatDateBase;
export const formatDateTime = formatDateBase;

export function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}
