/**
 * Sales API
 */

import { apiClient } from './client';
import type { Customer, SalesInvoice, Payment } from '@/lib/types/sales';
import type { PaginationParams, PaginatedResult } from '@/lib/types/common';

export const salesApi = {
  // Customers
  getCustomers: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<Customer>>('/sales/customers');
  },

  getCustomer: async (id: string) => {
    return apiClient.get<Customer>(`/sales/customers/${id}`);
  },

  createCustomer: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<Customer>('/sales/customers', data, idempotencyKey);
  },

  updateCustomer: async (id: string, data: any) => {
    return apiClient.patch<Customer>(`/sales/customers/${id}`, data);
  },

  // Invoices
  getInvoices: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<SalesInvoice>>('/sales/invoices');
  },

  getInvoice: async (id: string) => {
    return apiClient.get<SalesInvoice>(`/sales/invoices/${id}`);
  },

  createInvoice: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<SalesInvoice>('/sales/invoices', data, idempotencyKey);
  },

  postInvoice: async (id: string) => {
    return apiClient.post<SalesInvoice>(`/sales/invoices/${id}/post`);
  },

  // Payments
  getPayments: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<Payment>>('/sales/payments');
  },

  createPayment: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<Payment>('/sales/payments', data, idempotencyKey);
  },
};
