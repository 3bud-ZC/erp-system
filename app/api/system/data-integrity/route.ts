import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Run data integrity validation
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 'all', 'inventory', 'accounting', 'sales', 'purchases'

    const validationResults: any[] = [];
    let totalIssues = 0;

    // Inventory validation
    if (!category || category === 'all' || category === 'inventory') {
      // Check for negative stock
      const negativeStockProducts = await (prisma as any).product.findMany({
        where: { stock: { lt: 0 } },
      });

      if (negativeStockProducts.length > 0) {
        validationResults.push({
          category: 'inventory',
          rule: 'negative_stock',
          severity: 'critical',
          message: 'Products with negative stock',
          count: negativeStockProducts.length,
          details: negativeStockProducts.map((p: any) => ({ id: p.id, code: p.code, stock: p.stock })),
        });
        totalIssues += negativeStockProducts.length;
      }

      // Check for products without cost
      const productsWithoutCost = await (prisma as any).product.findMany({
        where: { OR: [{ cost: null }, { cost: 0 }] },
      });

      if (productsWithoutCost.length > 0) {
        validationResults.push({
          category: 'inventory',
          rule: 'missing_cost',
          severity: 'warning',
          message: 'Products without cost',
          count: productsWithoutCost.length,
          details: productsWithoutCost.map((p: any) => ({ id: p.id, code: p.code, cost: p.cost })),
        });
        totalIssues += productsWithoutCost.length;
      }
    }

    // Accounting validation
    if (!category || category === 'all' || category === 'accounting') {
      // Check for unposted journal entries
      const unpostedEntries = await (prisma as any).journalEntry.count({
        where: { isPosted: false },
      });

      if (unpostedEntries > 0) {
        validationResults.push({
          category: 'accounting',
          rule: 'unposted_journal_entries',
          severity: 'warning',
          message: 'Unposted journal entries',
          count: unpostedEntries,
        });
        totalIssues += unpostedEntries;
      }

      // Check for journal entries without lines
      const entriesWithoutLines = await (prisma as any).journalEntry.findMany({
        where: { lines: { none: {} } },
      });

      if (entriesWithoutLines.length > 0) {
        validationResults.push({
          category: 'accounting',
          rule: 'journal_without_lines',
          severity: 'critical',
          message: 'Journal entries without lines',
          count: entriesWithoutLines.length,
          details: entriesWithoutLines.map((e: any) => ({ id: e.id, entryNumber: e.entryNumber })),
        });
        totalIssues += entriesWithoutLines.length;
      }

      // Check for unbalanced journal entries
      const allEntries = await (prisma as any).journalEntry.findMany({
        where: { isPosted: true },
        include: { lines: true },
      });

      const unbalancedEntries = allEntries.filter((entry: any) => {
        const totalDebit = entry.lines.reduce((sum: number, line: any) => sum + Number(line.debit), 0);
        const totalCredit = entry.lines.reduce((sum: number, line: any) => sum + Number(line.credit), 0);
        return Math.abs(totalDebit - totalCredit) > 0.01;
      });

      if (unbalancedEntries.length > 0) {
        validationResults.push({
          category: 'accounting',
          rule: 'unbalanced_journal_entries',
          severity: 'critical',
          message: 'Unbalanced journal entries',
          count: unbalancedEntries.length,
          details: unbalancedEntries.map((e: any) => ({ id: e.id, entryNumber: e.entryNumber })),
        });
        totalIssues += unbalancedEntries.length;
      }
    }

    // Sales validation
    if (!category || category === 'all' || category === 'sales') {
      // Check for sales invoices without customer
      const invoicesWithoutCustomer = await (prisma as any).salesInvoice.findMany({
        where: { customerId: null },
      });

      if (invoicesWithoutCustomer.length > 0) {
        validationResults.push({
          category: 'sales',
          rule: 'invoice_without_customer',
          severity: 'critical',
          message: 'Sales invoices without customer',
          count: invoicesWithoutCustomer.length,
          details: invoicesWithoutCustomer.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber })),
        });
        totalIssues += invoicesWithoutCustomer.length;
      }

      // Check for sales invoices without items
      const invoicesWithoutItems = await (prisma as any).salesInvoice.findMany({
        where: { items: { none: {} } },
      });

      if (invoicesWithoutItems.length > 0) {
        validationResults.push({
          category: 'sales',
          rule: 'invoice_without_items',
          severity: 'critical',
          message: 'Sales invoices without items',
          count: invoicesWithoutItems.length,
          details: invoicesWithoutItems.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber })),
        });
        totalIssues += invoicesWithoutItems.length;
      }
    }

    // Purchases validation
    if (!category || category === 'all' || category === 'purchases') {
      // Check for purchase invoices without supplier
      const invoicesWithoutSupplier = await (prisma as any).purchaseInvoice.findMany({
        where: { supplierId: null },
      });

      if (invoicesWithoutSupplier.length > 0) {
        validationResults.push({
          category: 'purchases',
          rule: 'invoice_without_supplier',
          severity: 'critical',
          message: 'Purchase invoices without supplier',
          count: invoicesWithoutSupplier.length,
          details: invoicesWithoutSupplier.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber })),
        });
        totalIssues += invoicesWithoutSupplier.length;
      }
    }

    // Overall health score
    const healthScore = Math.max(0, 100 - (totalIssues * 5));
    const healthStatus = healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical';

    return apiSuccess(
      {
        validationResults,
        summary: {
          totalIssues,
          healthScore,
          healthStatus,
          rulesChecked: validationResults.length,
        },
      },
      'Data integrity validation completed'
    );
  } catch (error) {
    return handleApiError(error, 'Validate data integrity');
  }
}

// POST - Fix data integrity issues
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { rule, autoFix } = body;

    if (!rule) {
      return apiError('Rule is required', 400);
    }

    let fixedCount = 0;
    let message = '';

    switch (rule) {
      case 'negative_stock':
        // Reset negative stock to zero
        const negativeProducts = await (prisma as any).product.findMany({
          where: { stock: { lt: 0 } },
        });
        for (const product of negativeProducts) {
          await (prisma as any).product.update({
            where: { id: product.id },
            data: { stock: 0 },
          });
          fixedCount++;
        }
        message = `Reset stock for ${fixedCount} products`;
        break;

      case 'unposted_journal_entries':
        // This cannot be auto-fixed without user confirmation
        if (!autoFix) {
          return apiError('Auto-fix not supported for this rule. Manual review required.', 400);
        }
        message = 'Manual review required for unposted journal entries';
        break;

      case 'journal_without_lines':
        // Delete journal entries without lines
        const emptyEntries = await (prisma as any).journalEntry.findMany({
          where: { lines: { none: {} } },
        });
        for (const entry of emptyEntries) {
          await (prisma as any).journalEntry.delete({
            where: { id: entry.id },
          });
          fixedCount++;
        }
        message = `Deleted ${fixedCount} empty journal entries`;
        break;

      default:
        return apiError('Unknown rule or auto-fix not supported', 400);
    }

    return apiSuccess(
      { fixedCount, rule, message },
      'Data integrity fix completed'
    );
  } catch (error) {
    return handleApiError(error, 'Fix data integrity issues');
  }
}
