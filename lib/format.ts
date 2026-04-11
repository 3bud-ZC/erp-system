/**
 * Formatting utilities for currency, dates, and numbers
 * All text in Arabic with proper RTL support
 */

/**
 * Format currency in Egyptian Pounds (ج.م)
 * @param amount The amount to format
 * @param locale The locale to use (default: ar-EG)
 * @returns Formatted string like "1,234.50 ج.م"
 */
export function formatCurrency(amount: number, locale: string = 'ar-EG'): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ج.م`;
}

/**
 * Format number with thousands separator in Arabic locale
 * @param amount The number to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(amount: number, decimals: number = 0): string {
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format date in Arabic locale
 * @param date The date to format
 * @param format 'short' | 'medium' | 'long' (default: 'short')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
  };

  return new Intl.DateTimeFormat('ar-EG', optionsMap[format]).format(dateObj);
}

/**
 * Format percentage with Arabic locale
 * @param value The percentage value (0-100)
 * @param decimals Number of decimal places (default: 1)
 * @returns Formatted percentage string like "12.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return formatNumber(value, decimals) + '%';
}

/**
 * Calculate percentage change between two values
 * @param current Current value
 * @param previous Previous value
 * @returns Percentage change (positive or negative)
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Get status badge color based on status value
 * @param status The status string
 * @returns CSS color class name
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    shipped: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    draft: 'bg-gray-100 text-gray-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get Arabic status label
 * @param status The status string
 * @returns Arabic status label
 */
export function getStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    received: 'تم الاستلام',
    shipped: 'مشحون',
    cancelled: 'ملغى',
    draft: 'مسودة',
  };
  return labelMap[status] || status;
}

/**
 * Format large numbers with abbreviation (e.g., 1.2K, 3.4M)
 * @param value The value to format
 * @param decimals Number of decimal places (default: 1)
 * @returns Abbreviated string
 */
export function formatCompactNumber(value: number, decimals: number = 1): string {
  if (value >= 1_000_000) {
    return formatNumber(value / 1_000_000, decimals) + ' م';
  }
  if (value >= 1_000) {
    return formatNumber(value / 1_000, decimals) + ' ك';
  }
  return formatNumber(value, 0);
}
