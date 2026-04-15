/**
 * Utility functions for consistent page behavior across the ERP system
 */

/**
 * Generate a unique document number with format: PREFIX-YYYYMMDD-XXX
 * @param prefix - Document prefix (e.g., 'INV', 'SO', 'PO', 'PROD', 'EXP')
 * @returns Generated document number
 */
export function generateDocumentNumber(prefix: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${year}${month}${day}-${random}`;
}

/**
 * Fetch data with timeout and error handling
 * @param url - API endpoint
 * @param headers - Request headers
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Parsed JSON data or empty array on error
 */
export async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = 30000
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    }
    return [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Request timeout:', url);
      throw new Error('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
    }
    throw error;
  }
}

/**
 * Ensure data is an array (defensive programming)
 * @param data - Data to check
 * @returns Array or empty array
 */
export function ensureArray(data: any): any[] {
  return Array.isArray(data) ? data : (data?.data || []);
}

/**
 * Calculate item total (quantity * price - discount + tax)
 * @param quantity - Item quantity
 * @param price - Item price
 * @param discount - Discount amount (default: 0)
 * @param tax - Tax amount (default: 0)
 * @returns Calculated total
 */
export function calculateItemTotal(
  quantity: number,
  price: number,
  discount: number = 0,
  tax: number = 0
): number {
  return quantity * price - discount + tax;
}

/**
 * Calculate grand total from items array
 * @param items - Array of items with 'total' property
 * @returns Sum of all item totals
 */
export function calculateGrandTotal(items: Array<{ total: number }>): number {
  return items.reduce((sum, item) => sum + (item.total || 0), 0);
}

/**
 * Format currency for display
 * @param amount - Amount to format
 * @param currency - Currency symbol (default: 'ج.م')
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency: string = 'ج.م'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Format date for display in Arabic
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDateArabic(date: string | Date): string {
  return new Date(date).toLocaleDateString('ar-SA');
}

/**
 * Get status badge configuration
 * @param status - Status string
 * @returns Badge configuration with color and text
 */
export function getStatusBadge(status: string): {
  color: string;
  text: string;
  bgColor: string;
  textColor: string;
} {
  const badges: Record<string, any> = {
    pending: { color: 'yellow', text: 'قيد الانتظار', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
    confirmed: { color: 'blue', text: 'مؤكد', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    shipped: { color: 'purple', text: 'تم الشحن', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
    delivered: { color: 'green', text: 'تم التسليم', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    completed: { color: 'green', text: 'مكتمل', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    cancelled: { color: 'red', text: 'ملغي', bgColor: 'bg-red-100', textColor: 'text-red-800' },
    in_progress: { color: 'blue', text: 'جاري التنفيذ', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    paid: { color: 'green', text: 'مدفوع', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    unpaid: { color: 'red', text: 'غير مدفوع', bgColor: 'bg-red-100', textColor: 'text-red-800' },
    partial: { color: 'yellow', text: 'مدفوع جزئياً', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  };

  return badges[status] || badges.pending;
}

/**
 * Validate form data
 * @param data - Form data object
 * @param requiredFields - Array of required field names
 * @returns Validation result with success flag and error message
 */
export function validateForm(
  data: Record<string, any>,
  requiredFields: string[]
): { success: boolean; error?: string } {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return {
        success: false,
        error: `الحقل "${field}" مطلوب`,
      };
    }
  }
  return { success: true };
}

/**
 * Show success message
 * @param message - Success message
 */
export function showSuccess(message: string): void {
  alert(`✅ ${message}`);
}

/**
 * Show error message
 * @param message - Error message
 */
export function showError(message: string): void {
  alert(`❌ ${message}`);
}

/**
 * Confirm action
 * @param message - Confirmation message
 * @returns True if confirmed
 */
export function confirmAction(message: string): boolean {
  return confirm(`⚠️ ${message}`);
}
