/**
 * Centralized React Query keys.
 * Single source of truth — prevents typo-driven cache misses.
 */

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  customers: ['customers'] as const,
  suppliers: ['suppliers'] as const,
  products: (type?: string) => ['products', type ?? 'all'] as const,
  expenses: ['expenses'] as const,
  warehouses: ['warehouses'] as const,
  journalEntries: ['journal-entries'] as const,
  salesInvoices: ['sales-invoices'] as const,
  salesInvoice: (id: string) => ['sales-invoices', id] as const,
  purchaseInvoices: ['purchase-invoices'] as const,
  purchaseInvoice: (id: string) => ['purchase-invoices', id] as const,
};
