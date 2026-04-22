/**
 * Purchases Types
 */

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  balance: number;
  tenantId: string;
}
