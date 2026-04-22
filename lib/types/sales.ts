/**
 * Sales Types
 */

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  balance: number;
  tenantId: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: Date;
  total: number;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED';
  isPosted: boolean;
  postedDate?: Date;
  tenantId: string;
  items: SalesInvoiceItem[];
}

export interface SalesInvoiceItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  date: Date;
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD';
  reference?: string;
  tenantId: string;
}
