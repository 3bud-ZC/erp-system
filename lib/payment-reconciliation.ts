/**
 * Payment Reconciliation Engine
 * 
 * Handles invoice ↔ payment matching, partial allocation rules, outstanding balance tracking, and AR/AP aging calculation.
 */

import { prisma } from '@/lib/db';

// ==================== PAYMENT ALLOCATION ====================

export interface PaymentAllocation {
  paymentId: string;
  invoiceId: string;
  invoiceType: 'SalesInvoice' | 'PurchaseInvoice';
  amount: number;
  allocatedAt: Date;
}

// ==================== RECONCILIATION ENGINE CLASS ====================

class PaymentReconciliationEngine {
  /**
   * Allocate payment to invoice (manual or automatic)
   */
  async allocatePayment(
    paymentId: string,
    invoiceId: string,
    invoiceType: 'SalesInvoice' | 'PurchaseInvoice',
    amount: number,
    userId?: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Get payment details
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Get invoice details
      const invoice = invoiceType === 'SalesInvoice'
        ? await tx.salesInvoice.findUnique({ where: { id: invoiceId } })
        : await tx.purchaseInvoice.findUnique({ where: { id: invoiceId } });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Validate allocation amount
      const outstandingBalance = this.calculateOutstandingBalance(invoice);
      if (amount > outstandingBalance) {
        throw new Error('Allocation amount exceeds outstanding balance');
      }

      // Create allocation record
      await tx.paymentAllocation.create({
        data: {
          paymentId,
          invoiceId,
          invoiceType,
          amount,
          allocatedAt: new Date(),
          allocatedBy: userId,
          tenantId: payment.tenantId,
        },
      });

      // Update invoice paid amount
      if (invoiceType === 'SalesInvoice') {
        await tx.salesInvoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: { increment: amount },
            paymentStatus: this.calculatePaymentStatus(invoice, amount),
          },
        });
      } else {
        await tx.purchaseInvoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: { increment: amount },
            paymentStatus: this.calculatePaymentStatus(invoice, amount),
          },
        });
      }

      // Mark payment as reconciled if fully allocated
      const totalAllocated = await this.getTotalAllocated(paymentId, tx);
      if (totalAllocated >= payment.amount) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            reconciled: true,
            reconciledAt: new Date(),
          },
        });
      }
    });
  }

  /**
   * Auto-allocate payment using FIFO or oldest invoice first rule
   */
  async autoAllocatePayment(paymentId: string): Promise<number> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Determine invoice type based on payment direction
    const invoiceType = payment.type === 'incoming' ? 'SalesInvoice' : 'PurchaseInvoice';
    const entityId = payment.customerId || payment.supplierId;

    if (!entityId) {
      throw new Error('Payment must be linked to customer or supplier');
    }

    // Get outstanding invoices ordered by date (oldest first)
    const invoices = invoiceType === 'SalesInvoice'
      ? await prisma.salesInvoice.findMany({
          where: {
            customerId: entityId,
            status: { not: 'cancelled' },
          },
          orderBy: { date: 'asc' },
        })
      : await prisma.purchaseInvoice.findMany({
          where: {
            supplierId: entityId,
            status: { not: 'cancelled' },
          },
          orderBy: { date: 'asc' },
        });

    let remainingAmount = payment.amount;
    let totalAllocated = 0;

    for (const invoice of invoices) {
      if (remainingAmount <= 0) break;

      const outstandingBalance = this.calculateOutstandingBalance(invoice);
      if (outstandingBalance <= 0) continue;

      const allocationAmount = Math.min(remainingAmount, outstandingBalance);

      await this.allocatePayment(
        paymentId,
        invoice.id,
        invoiceType,
        allocationAmount
      );

      remainingAmount -= allocationAmount;
      totalAllocated += allocationAmount;
    }

    return totalAllocated;
  }

  /**
   * Reverse a payment allocation
   */
  async reverseAllocation(allocationId: string, userId?: string): Promise<void> {
    const allocation = await prisma.paymentAllocation.findUnique({
      where: { id: allocationId },
      include: {
        payment: true,
      },
    });

    if (!allocation) {
      throw new Error('Allocation not found');
    }

    await prisma.$transaction(async (tx) => {
      // Delete allocation
      await tx.paymentAllocation.delete({
        where: { id: allocationId },
      });

      // Update invoice paid amount
      if (allocation.invoiceType === 'SalesInvoice') {
        await tx.salesInvoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: { decrement: allocation.amount },
            paymentStatus: 'partial',
          },
        });
      } else {
        await tx.purchaseInvoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: { decrement: allocation.amount },
            paymentStatus: 'partial',
          },
        });
      }

      // Update payment reconciliation status
      const totalAllocated = await this.getTotalAllocated(allocation.paymentId, tx);
      await tx.payment.update({
        where: { id: allocation.paymentId },
        data: {
          reconciled: totalAllocated >= allocation.payment.amount,
          reconciledAt: totalAllocated >= allocation.payment.amount ? new Date() : null,
        },
      });
    });
  }

  /**
   * Calculate outstanding balance for an invoice
   */
  private calculateOutstandingBalance(invoice: any): number {
    const total = invoice.grandTotal || invoice.total || 0;
    const paidAmount = invoice.paidAmount || 0;
    return total - paidAmount;
  }

  /**
   * Calculate payment status based on allocation
   */
  private calculatePaymentStatus(invoice: any, allocatedAmount: number): string {
    const total = invoice.grandTotal || invoice.total || 0;
    const paidAmount = (invoice.paidAmount || 0) + allocatedAmount;

    if (paidAmount <= 0) return 'cash';
    if (paidAmount >= total) return 'paid';
    return 'partial';
  }

  /**
   * Get total allocated amount for a payment
   */
  private async getTotalAllocated(paymentId: string, tx?: any): Promise<number> {
    const prismaClient = tx || prisma;
    const allocations = await prismaClient.paymentAllocation.findMany({
      where: { paymentId },
    });

    return allocations.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0);
  }

  // ==================== AGING CALCULATION ====================

  /**
   * Calculate AR aging for customers
   */
  async getARAging(asOfDate: Date = new Date()): Promise<any[]> {
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        status: { not: 'cancelled' },
      },
      include: {
        customer: true,
      },
    });

    const agingData: Record<string, any> = {};

    for (const invoice of invoices) {
      const customerId = invoice.customerId;
      const total = invoice.grandTotal || invoice.total || 0;
      const paidAmount = invoice.paidAmount || 0;
      const outstanding = total - paidAmount;

      if (outstanding <= 0) continue;

      if (!agingData[customerId]) {
        agingData[customerId] = {
          customerId,
          customer: invoice.customer,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          daysOver90: 0,
          total: 0,
          invoices: [],
        };
      }

      const daysOverdue = this.calculateDaysOverdue(invoice.date, asOfDate);
      const bucket = this.getAgingBucket(daysOverdue);

      agingData[customerId][bucket] += outstanding;
      agingData[customerId].total += outstanding;
      agingData[customerId].invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        amount: outstanding,
        daysOverdue,
        bucket,
      });
    }

    return Object.values(agingData);
  }

  /**
   * Calculate AP aging for suppliers
   */
  async getAPAging(asOfDate: Date = new Date()): Promise<any[]> {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: {
        status: { not: 'cancelled' },
      },
      include: {
        supplier: true,
      },
    });

    const agingData: Record<string, any> = {};

    for (const invoice of invoices) {
      const supplierId = invoice.supplierId;
      const total = invoice.total || 0;
      const paidAmount = invoice.paidAmount || 0;
      const outstanding = total - paidAmount;

      if (outstanding <= 0) continue;

      if (!agingData[supplierId]) {
        agingData[supplierId] = {
          supplierId,
          supplier: invoice.supplier,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          daysOver90: 0,
          total: 0,
          invoices: [],
        };
      }

      const daysOverdue = this.calculateDaysOverdue(invoice.date, asOfDate);
      const bucket = this.getAgingBucket(daysOverdue);

      agingData[supplierId][bucket] += outstanding;
      agingData[supplierId].total += outstanding;
      agingData[supplierId].invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        amount: outstanding,
        daysOverdue,
        bucket,
      });
    }

    return Object.values(agingData);
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(invoiceDate: Date, asOfDate: Date): number {
    const diffTime = asOfDate.getTime() - new Date(invoiceDate).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get aging bucket based on days overdue
   */
  private getAgingBucket(daysOverdue: number): string {
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return 'days1_30';
    if (daysOverdue <= 60) return 'days31_60';
    if (daysOverdue <= 90) return 'days61_90';
    return 'daysOver90';
  }

  // ==================== RECONCILIATION REPORTS ====================

  /**
   * Get unreconciled payments
   */
  async getUnreconciledPayments(): Promise<any[]> {
    const payments = await prisma.payment.findMany({
      where: { reconciled: false },
      include: {
        customer: true,
        supplier: true,
      },
      orderBy: { date: 'desc' },
    });

    return payments.map((p) => ({
      ...p,
      totalAllocated: 0, // Will be calculated
    }));
  }

  /**
   * Get outstanding invoices
   */
  async getOutstandingInvoices(): Promise<any[]> {
    const salesInvoices = await prisma.salesInvoice.findMany({
      where: {
        status: { not: 'cancelled' },
        paymentStatus: { not: 'paid' },
      },
      include: { customer: true },
    });

    const purchaseInvoices = await prisma.purchaseInvoice.findMany({
      where: {
        status: { not: 'cancelled' },
        paymentStatus: { not: 'paid' },
      },
      include: { supplier: true },
    });

    return [
      ...salesInvoices.map((i) => ({
        ...i,
        type: 'SalesInvoice',
        entity: i.customer,
        outstanding: (i.grandTotal || i.total) - (i.paidAmount || 0),
      })),
      ...purchaseInvoices.map((i) => ({
        ...i,
        type: 'PurchaseInvoice',
        entity: i.supplier,
        outstanding: i.total - (i.paidAmount || 0),
      })),
    ];
  }

  /**
   * Get payment allocation history
   */
  async getAllocationHistory(invoiceId?: string, paymentId?: string): Promise<any[]> {
    const where: any = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (paymentId) where.paymentId = paymentId;

    const allocations = await prisma.paymentAllocation.findMany({
      where,
      include: {
        payment: {
          include: {
            customer: true,
            supplier: true,
          },
        },
      },
      orderBy: { allocatedAt: 'desc' },
    });

    return allocations;
  }
}

// ==================== EXPORT SINGLETON ====================

export const paymentReconciliationEngine = new PaymentReconciliationEngine();

// ==================== HELPER FUNCTIONS ====================

/**
 * Allocate payment to invoice
 */
export async function allocatePayment(
  paymentId: string,
  invoiceId: string,
  invoiceType: 'SalesInvoice' | 'PurchaseInvoice',
  amount: number,
  userId?: string
): Promise<void> {
  await paymentReconciliationEngine.allocatePayment(
    paymentId,
    invoiceId,
    invoiceType,
    amount,
    userId
  );
}

/**
 * Auto-allocate payment using FIFO rule
 */
export async function autoAllocatePayment(paymentId: string): Promise<number> {
  return paymentReconciliationEngine.autoAllocatePayment(paymentId);
}

/**
 * Get AR aging report
 */
export async function getARAging(asOfDate?: Date): Promise<any[]> {
  return paymentReconciliationEngine.getARAging(asOfDate);
}

/**
 * Get AP aging report
 */
export async function getAPAging(asOfDate?: Date): Promise<any[]> {
  return paymentReconciliationEngine.getAPAging(asOfDate);
}
