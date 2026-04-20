import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { validatePaymentAmount } from '@/lib/validation';
import { createPaymentJournalEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';

// GET - Read payments with filters
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const supplierId = searchParams.get('supplierId');
    const salesInvoiceId = searchParams.get('salesInvoiceId');
    const purchaseInvoiceId = searchParams.get('purchaseInvoiceId');
    const type = searchParams.get('type');

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;
    if (salesInvoiceId) where.salesInvoiceId = salesInvoiceId;
    if (purchaseInvoiceId) where.purchaseInvoiceId = purchaseInvoiceId;
    if (type) where.type = type;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: {
          select: { id: true, code: true, nameAr: true }
        },
        supplier: {
          select: { id: true, code: true, nameAr: true }
        },
        salesInvoice: {
          select: { id: true, invoiceNumber: true, total: true }
        },
        purchaseInvoice: {
          select: { id: true, invoiceNumber: true, total: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return apiSuccess(payments, 'Payments fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch payments');
  }
}

// POST - Create payment
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const { amount, date, type, customerId, supplierId, salesInvoiceId, purchaseInvoiceId, notes } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return apiError('المبلغ مطلوب ويجب أن يكون رقماً موجباً', 400);
    }
    if (!type || (type !== 'incoming' && type !== 'outgoing')) {
      return apiError('نوع الدفع يجب أن يكون incoming أو outgoing', 400);
    }
    if (!customerId && !supplierId) {
      return apiError('يجب تحديد عميل أو مورد', 400);
    }

    // Validate payment amount doesn't exceed remaining balance
    if (salesInvoiceId) {
      const validation = await validatePaymentAmount(salesInvoiceId, 'sales', amount);
      if (!validation.valid) {
        return apiError(validation.error || 'Payment amount exceeds remaining balance', 400);
      }
    }
    if (purchaseInvoiceId) {
      const validation = await validatePaymentAmount(purchaseInvoiceId, 'purchase', amount);
      if (!validation.valid) {
        return apiError(validation.error || 'Payment amount exceeds remaining balance', 400);
      }
    }

    // Create payment with transaction
    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          amount,
          date: new Date(date),
          type,
          customerId,
          supplierId,
          salesInvoiceId,
          purchaseInvoiceId,
          notes
        }
      });

      // Update invoice paid amount
      if (salesInvoiceId) {
        await tx.salesInvoice.update({
          where: { id: salesInvoiceId },
          data: { paidAmount: { increment: amount } }
        });
      }
      if (purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: purchaseInvoiceId },
          data: { paidAmount: { increment: amount } }
        });
      }

      // Create journal entry for payment (integrate cash into General Ledger)
      const journalEntry = await createPaymentJournalEntry(
        newPayment.id,
        amount,
        type,
        new Date(date)
      );

      // Link journal entry to payment
      await tx.payment.update({
        where: { id: newPayment.id },
        data: { journalEntryId: journalEntry.id }
      });

      // Post the journal entry to update account balances
      await postJournalEntry(journalEntry.id);

      return newPayment;
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'CREATE',
      'financials',
      'Payment',
      payment.id,
      { payment },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(payment, 'Payment created successfully');
  } catch (error) {
    return handleApiError(error, 'Create payment');
  }
}

// PUT - Update payment
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const { id, amount, date, type, notes } = body;

    if (!id) {
      return apiError('معرف الدفع مطلوب', 400);
    }

    // Update payment with transaction to handle journal reversal
    const payment = await prisma.$transaction(async (tx) => {
      // Get existing payment with journal entry
      const existingPayment = await tx.payment.findUnique({
        where: { id },
        include: { journalEntry: true }
      });

      if (!existingPayment) {
        throw new Error('Payment not found');
      }

      // Reverse existing journal entry if it exists
      if (existingPayment.journalEntryId) {
        await reverseJournalEntry(existingPayment.journalEntryId, tx);
      }

      // Reverse invoice paid amount adjustment
      const oldAmount = existingPayment.amount;
      if (existingPayment.salesInvoiceId) {
        await tx.salesInvoice.update({
          where: { id: existingPayment.salesInvoiceId },
          data: { paidAmount: { decrement: oldAmount } }
        });
      }
      if (existingPayment.purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: existingPayment.purchaseInvoiceId },
          data: { paidAmount: { decrement: oldAmount } }
        });
      }

      // Update payment
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          ...(amount !== undefined && { amount }),
          ...(date && { date: new Date(date) }),
          ...(type && { type }),
          ...(notes !== undefined && { notes }),
          journalEntryId: null // Will be set after creating new journal
        }
      });

      // Update invoice paid amount with new amount
      const newAmount = amount !== undefined ? amount : oldAmount;
      if (updatedPayment.salesInvoiceId) {
        await tx.salesInvoice.update({
          where: { id: updatedPayment.salesInvoiceId },
          data: { paidAmount: { increment: newAmount } }
        });
      }
      if (updatedPayment.purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: updatedPayment.purchaseInvoiceId },
          data: { paidAmount: { increment: newAmount } }
        });
      }

      // Create new journal entry if amount or type changed
      if (amount !== undefined || type) {
        const journalEntry = await createPaymentJournalEntry(
          updatedPayment.id,
          newAmount,
          type || updatedPayment.type,
          date ? new Date(date) : updatedPayment.date
        );

        // Link journal entry to payment
        await tx.payment.update({
          where: { id: updatedPayment.id },
          data: { journalEntryId: journalEntry.id }
        });

        // Post the journal entry
        await postJournalEntry(journalEntry.id);
      }

      return updatedPayment;
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'UPDATE',
      'financials',
      'Payment',
      payment.id,
      { payment },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(payment, 'Payment updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update payment');
  }
}

// DELETE - Delete payment
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف الدفع مطلوب', 400);
    }

    // Get payment details before deletion
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { journalEntry: true }
    });

    if (!payment) {
      return apiError('الدفع غير موجود', 404);
    }

    // Delete payment with transaction to reverse updates
    await prisma.$transaction(async (tx) => {
      // Reverse journal entry if it exists
      if (payment.journalEntryId) {
        await reverseJournalEntry(payment.journalEntryId, tx);
      }

      // Reverse invoice paid amount
      if (payment.salesInvoiceId) {
        await tx.salesInvoice.update({
          where: { id: payment.salesInvoiceId },
          data: { paidAmount: { decrement: payment.amount } }
        });
      }
      if (payment.purchaseInvoiceId) {
        await tx.purchaseInvoice.update({
          where: { id: payment.purchaseInvoiceId },
          data: { paidAmount: { decrement: payment.amount } }
        });
      }

      // Delete payment
      await tx.payment.delete({
        where: { id }
      });
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'DELETE',
      'financials',
      'Payment',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Payment deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete payment');
  }
}
