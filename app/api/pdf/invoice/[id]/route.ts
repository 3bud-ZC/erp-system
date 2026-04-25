/**
 * INVOICE PDF EXPORT API
 * 
 * Generates and downloads professional PDF for sales and purchase invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InvoicePDFGenerator } from '@/lib/pdf/invoice-pdf-generator';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'sales' or 'purchase'

    if (!type || (type !== 'sales' && type !== 'purchase')) {
      return new NextResponse('Invalid invoice type', { status: 400 });
    }

    // Fetch invoice data based on type
    let invoiceData;
    
    if (type === 'sales') {
      const invoice = await prisma.salesInvoice.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!invoice) {
        return new NextResponse('Invoice not found', { status: 404 });
      }

      invoiceData = {
        type: 'sales' as const,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        
        companyName: 'Factory ERP System',
        companyNameAr: 'نظام تخطيط موارد المصنع',
        companyAddress: 'Industrial Area, Riyadh, Saudi Arabia',
        companyPhone: '+966 XX XXX XXXX',
        companyEmail: 'info@factory-erp.com',
        companyTaxNumber: '300000000000003',
        
        customerName: invoice.customer.nameEn || invoice.customer.nameAr,
        customerNameAr: invoice.customer.nameAr,
        customerAddress: invoice.customer.address || undefined,
        customerPhone: invoice.customer.phone || undefined,
        customerTaxNumber: invoice.customer.taxNumber || undefined,
        
        items: invoice.items.map(item => ({
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn || undefined,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.total),
        })),
        
        subtotal: Number(invoice.total),
        tax: Number(invoice.tax || 0),
        taxRate: invoice.tax ? 15 : undefined,
        discount: Number(invoice.discount || 0),
        grandTotal: Number(invoice.grandTotal),
        
        notes: invoice.notes || undefined,
      };
    } else {
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!invoice) {
        return new NextResponse('Invoice not found', { status: 404 });
      }

      invoiceData = {
        type: 'purchase' as const,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        
        companyName: 'Factory ERP System',
        companyNameAr: 'نظام تخطيط موارد المصنع',
        companyAddress: 'Industrial Area, Riyadh, Saudi Arabia',
        companyPhone: '+966 XX XXX XXXX',
        companyEmail: 'info@factory-erp.com',
        companyTaxNumber: '300000000000003',
        
        customerName: invoice.supplier.nameEn || invoice.supplier.nameAr,
        customerNameAr: invoice.supplier.nameAr,
        customerAddress: invoice.supplier.address || undefined,
        customerPhone: invoice.supplier.phone || undefined,
        customerTaxNumber: invoice.supplier.taxNumber || undefined,
        
        items: invoice.items.map(item => ({
          nameAr: item.product.nameAr,
          nameEn: item.product.nameEn || undefined,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.total),
        })),
        
        subtotal: Number(invoice.total),
        tax: 0,
        discount: 0,
        grandTotal: Number(invoice.total),
        
        notes: invoice.notes || undefined,
      };
    }

    // Generate PDF
    const generator = new InvoicePDFGenerator();
    const pdfBuffer = await generator.generate(invoiceData);

    // Return PDF as downloadable file
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate PDF', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
