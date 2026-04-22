/**
 * Inventory API
 */

import { apiClient } from './client';
import type { Product, InventoryTransaction, StockValuationReport, LowStockItem } from '@/lib/types/inventory';
import type { PaginationParams, PaginatedResult } from '@/lib/types/common';

export const inventoryApi = {
  // Products
  getProducts: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<Product>>('/inventory/products');
  },

  getProduct: async (id: string) => {
    return apiClient.get<Product>(`/inventory/products/${id}`);
  },

  createProduct: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<Product>('/inventory/products', data, idempotencyKey);
  },

  updateProduct: async (id: string, data: any) => {
    return apiClient.patch<Product>(`/inventory/products/${id}`, data);
  },

  // Stock Movements
  getStockMovements: async (params?: PaginationParams) => {
    return apiClient.get<PaginatedResult<InventoryTransaction>>('/inventory/movements');
  },

  // Stock Adjustments
  createStockAdjustment: async (data: any, idempotencyKey?: string) => {
    return apiClient.post<InventoryTransaction>('/inventory/adjustments', data, idempotencyKey);
  },

  // Reports
  getStockValuation: async (asOfDate?: Date) => {
    return apiClient.get<StockValuationReport>('/inventory/reports/valuation');
  },

  getLowStockReport: async () => {
    return apiClient.get<LowStockItem[]>('/inventory/reports/low-stock');
  },
};
