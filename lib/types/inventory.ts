/**
 * Inventory Types
 */

export interface Product {
  id: string;
  code: string;
  nameAr: string;
  stock: number;
  cost: number;
  price: number;
  minStock: number;
  version: number;
  tenantId: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  date: Date;
  referenceId: string;
  notes?: string;
  tenantId: string;
}

export interface StockValuationReport {
  tenantId: string;
  asOfDate: Date;
  totalValue: number;
  totalQuantity: number;
  items: StockValuationItem[];
}

export interface StockValuationItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

export interface LowStockItem {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  minStock: number;
  reorderQuantity: number;
}
