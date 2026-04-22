/**
 * ERP Execution Engine - Types
 * Centralized transaction types for the ERP system
 */

export type ERPTransactionType =
  | "SALES_ORDER"
  | "SALES_INVOICE"
  | "SALES_RETURN"
  | "PURCHASE_ORDER"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN"
  | "PAYMENT"
  | "STOCK_TRANSFER"
  | "STOCK_ADJUSTMENT"
  | "PRODUCTION_ORDER";

export interface ERPTransaction {
  id?: string;
  type: ERPTransactionType;
  payload: any;
  context: {
    userId: string;
    tenantId: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface ERPTransactionResult {
  success: boolean;
  data: any;
  state: any;
  journalEntries?: any[];
  errors?: string[];
}

export interface BeforeState {
  entity: any;
  relatedEntities: any[];
  stock: any;
  balances: any;
}
