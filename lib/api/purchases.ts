/**
 * Purchases API
 */

import { apiClient } from './client';
import type { Supplier } from '@/lib/types/purchases';
import type { PaginationParams, PaginatedResult } from '@/lib/types/common';

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: Date;
  total: number;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED';
  isPosted: boolean;
  postedDate?: Date;
  tenantId: string;
  items: PurchaseInvoiceItem[];
}

export interface PurchaseInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
}

export const purchasesApi = {
  // Suppliers
  getSuppliers: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<Supplier>>('/purchases/suppliers');
  },

  getSupplier: async (id: string) => {
    return apiClient.get<Supplier>(`/purchases/suppliers/${id}`);
  },

  createSupplier: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<Supplier>('/purchases/suppliers', data, idempotencyKey);
  },

  updateSupplier: async (id: string, data: any) => {
    return apiClient.patch<Supplier>(`/purchases/suppliers/${id}`, data);
  },

  // Purchase Invoices
  getPurchaseInvoices: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<PurchaseInvoice>>('/purchases/invoices');
  },

  getPurchaseInvoice: async (id: string) => {
    return apiClient.get<PurchaseInvoice>(`/purchases/invoices/${id}`);
  },

  createPurchaseInvoice: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<PurchaseInvoice>('/purchases/invoices', data, idempotencyKey);
  },

  postPurchaseInvoice: async (id: string) => {
    return apiClient.post<PurchaseInvoice>(`/purchases/invoices/${id}/post`);
  },
};
