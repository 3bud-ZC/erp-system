import { prisma } from './db';

/**
 * Business Rules and Validation Functions
 * Handles credit limits, discount rules, and other business logic
 */

export interface CreditCheckResult {
  passed: boolean;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  message?: string;
}

/**
 * Check if customer has sufficient credit limit for a new order
 */
export async function checkCustomerCreditLimit(
  customerId: string,
  orderAmount: number
): Promise<CreditCheckResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      salesInvoices: {
        where: {
          paymentStatus: 'credit',
          status: 'pending',
        },
      },
    },
  });

  if (!customer) {
    return {
      passed: false,
      currentBalance: 0,
      creditLimit: 0,
      availableCredit: 0,
      message: 'Customer not found',
    };
  }

  const currentBalance = customer.salesInvoices.reduce((sum, inv) => sum + (inv.grandTotal - inv.paidAmount), 0);
  const creditLimit = customer.creditLimit || 0;
  const availableCredit = creditLimit - currentBalance;

  if (availableCredit >= orderAmount) {
    return {
      passed: true,
      currentBalance,
      creditLimit,
      availableCredit,
    };
  } else {
    return {
      passed: false,
      currentBalance,
      creditLimit,
      availableCredit,
      message: `Insufficient credit. Available: ${availableCredit.toFixed(2)}, Required: ${orderAmount.toFixed(2)}`,
    };
  }
}

export interface DiscountRule {
  type: 'percentage' | 'fixed';
  value: number;
  minQuantity?: number;
  minOrderValue?: number;
  customerTier?: string;
}

/**
 * Apply discount rules based on customer and order
 */
export function calculateDiscount(
  orderTotal: number,
  customerCreditLimit?: number,
  discountRules?: DiscountRule[]
): number {
  if (!discountRules || discountRules.length === 0) {
    return 0;
  }

  let totalDiscount = 0;

  for (const rule of discountRules) {
    let applicable = true;

    // Check minimum order value
    if (rule.minOrderValue && orderTotal < rule.minOrderValue) {
      applicable = false;
    }

    if (applicable) {
      if (rule.type === 'percentage') {
        totalDiscount += orderTotal * (rule.value / 100);
      } else {
        totalDiscount += rule.value;
      }
    }
  }

  // Ensure discount doesn't exceed order total
  return Math.min(totalDiscount, orderTotal);
}

/**
 * Calculate sales tax (VAT)
 * Default is 15% but can be configured
 */
export function calculateSalesTax(subtotal: number, taxRate: number = 0.15): number {
  return subtotal * taxRate;
}

/**
 * Calculate grand total with discount and tax
 */
export function calculateGrandTotal(
  subtotal: number,
  discount: number,
  taxRate: number = 0.15
): {
  discount: number;
  taxableAmount: number;
  tax: number;
  grandTotal: number;
} {
  const discountedAmount = subtotal - discount;
  const tax = calculateSalesTax(discountedAmount, taxRate);
  const grandTotal = discountedAmount + tax;

  return {
    discount,
    taxableAmount: discountedAmount,
    tax,
    grandTotal,
  };
}
