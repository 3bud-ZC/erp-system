/**
 * PROFESSIONAL INVOICE PDF GENERATOR
 * 
 * Generates production-quality PDF invoices for Sales and Purchase invoices
 * with professional layout, proper spacing, and print-ready format (A4).
 */

import PDFDocument from 'pdfkit';

interface InvoiceItem {
  nameAr: string;
  nameEn?: string;
  quantity: number;
  price: number;
  total: number;
}

interface InvoiceData {
  type: 'sales' | 'purchase';
  invoiceNumber: string;
  date: Date;
  dueDate?: Date;
  
  // Company info
  companyName: string;
  companyNameAr: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTaxNumber?: string;
  
  // Customer/Supplier info
  customerName: string;
  customerNameAr?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerTaxNumber?: string;
  
  // Invoice items
  items: InvoiceItem[];
  
  // Totals
  subtotal: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  grandTotal: number;
  
  // Additional info
  notes?: string;
  paymentTerms?: string;
}

export class InvoicePDFGenerator {
  private doc: PDFKit.PDFDocument;
  private pageWidth = 595.28; // A4 width in points
  private pageHeight = 841.89; // A4 height in points
  private margin = 50;
  private currentY = 0;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: this.margin,
      info: {
        Title: 'Invoice',
        Author: 'ERP System',
      },
    });
    this.currentY = this.margin;
  }

  /**
   * Generate professional invoice PDF
   */
  async generate(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', (chunk) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      try {
        this.drawHeader(data);
        this.drawInvoiceInfo(data);
        this.drawPartyInfo(data);
        this.drawItemsTable(data);
        this.drawTotals(data);
        this.drawFooter(data);
        
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Draw invoice header with company info
   */
  private drawHeader(data: InvoiceData) {
    const { companyName, companyNameAr, type } = data;

    // Company name (large, bold, centered)
    this.doc
      .fontSize(26)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(companyNameAr || companyName, this.margin, this.currentY, {
        align: 'center',
      });

    this.currentY += 35;

    // Company details (centered, smaller)
    if (data.companyAddress || data.companyPhone || data.companyEmail) {
      this.doc.fontSize(9).font('Helvetica').fillColor('#64748b');
      
      const details = [
        data.companyAddress,
        data.companyPhone,
        data.companyEmail,
        data.companyTaxNumber ? `الرقم الضريبي: ${data.companyTaxNumber}` : null,
      ].filter(Boolean).join(' • ');

      this.doc.text(details, this.margin, this.currentY, {
        align: 'center',
      });

      this.currentY += 25;
    }

    // Invoice type badge (centered)
    const invoiceType = type === 'sales' ? 'فاتورة مبيعات' : 'فاتورة مشتريات';
    const badgeColor = type === 'sales' ? '#10b981' : '#3b82f6';
    
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(badgeColor)
      .text(invoiceType, this.margin, this.currentY, {
        align: 'center',
      });

    this.currentY += 25;

    // Horizontal line (thicker, colored)
    this.doc
      .strokeColor(badgeColor)
      .lineWidth(3)
      .moveTo(this.margin, this.currentY)
      .lineTo(this.pageWidth - this.margin, this.currentY)
      .stroke();

    this.currentY += 35;
  }

  /**
   * Draw invoice information (number, date, type)
   */
  private drawInvoiceInfo(data: InvoiceData) {
    const { invoiceNumber, date, dueDate } = data;

    // Invoice details in two columns with better spacing
    const leftX = this.margin;
    const rightX = this.pageWidth / 2 + 20;

    this.doc.fontSize(10).font('Helvetica').fillColor('#1e293b');

    // Left column - Invoice Number
    this.doc
      .font('Helvetica-Bold')
      .text('رقم الفاتورة:', leftX, this.currentY);
    this.doc
      .font('Helvetica')
      .text(invoiceNumber, leftX + 80, this.currentY);

    // Right column
    this.doc
      .font('Helvetica-Bold')
      .text('Date:', rightX, this.currentY);
    this.doc
      .font('Helvetica')
      .text(this.formatDate(date), rightX + 50, this.currentY);

    this.currentY += 20;

    if (dueDate) {
      this.doc
        .font('Helvetica-Bold')
        .text('Due Date:', rightX, this.currentY);
      this.doc
        .font('Helvetica')
        .text(this.formatDate(dueDate), rightX + 50, this.currentY);
      
      this.currentY += 20;
    }

    this.currentY += 10;
  }

  /**
   * Draw customer/supplier information
   */
  private drawPartyInfo(data: InvoiceData) {
    const label = data.type === 'sales' ? 'Bill To:' : 'Supplier:';

    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text(label, this.margin, this.currentY);

    this.currentY += 18;

    // Party details box
    const boxY = this.currentY;
    this.doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .rect(this.margin, boxY, this.pageWidth - 2 * this.margin, 60)
      .stroke();

    this.currentY += 10;

    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(data.customerNameAr || data.customerName, this.margin + 10, this.currentY);

    this.currentY += 16;

    this.doc.fontSize(9).font('Helvetica').fillColor('#64748b');

    if (data.customerAddress) {
      this.doc.text(data.customerAddress, this.margin + 10, this.currentY);
      this.currentY += 14;
    }

    const contactInfo = [
      data.customerPhone,
      data.customerTaxNumber ? `Tax: ${data.customerTaxNumber}` : null,
    ].filter(Boolean).join(' | ');

    if (contactInfo) {
      this.doc.text(contactInfo, this.margin + 10, this.currentY);
    }

    this.currentY = boxY + 70;
  }

  /**
   * Draw items table
   */
  private drawItemsTable(data: InvoiceData) {
    const tableTop = this.currentY;
    const tableLeft = this.margin;
    const tableWidth = this.pageWidth - 2 * this.margin;

    // Column widths
    const colWidths = {
      no: 40,
      description: tableWidth * 0.4,
      quantity: tableWidth * 0.15,
      price: tableWidth * 0.2,
      total: tableWidth * 0.25 - 40,
    };

    // Table header
    this.doc
      .fillColor('#f8fafc')
      .rect(tableLeft, tableTop, tableWidth, 25)
      .fill();

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#475569');

    let x = tableLeft + 5;
    this.doc.text('#', x, tableTop + 8, { width: colWidths.no, align: 'center' });
    
    x += colWidths.no;
    this.doc.text('Description', x, tableTop + 8, { width: colWidths.description });
    
    x += colWidths.description;
    this.doc.text('Qty', x, tableTop + 8, { width: colWidths.quantity, align: 'center' });
    
    x += colWidths.quantity;
    this.doc.text('Price', x, tableTop + 8, { width: colWidths.price, align: 'right' });
    
    x += colWidths.price;
    this.doc.text('Total', x, tableTop + 8, { width: colWidths.total, align: 'right' });

    this.currentY = tableTop + 25;

    // Table border
    this.doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .rect(tableLeft, tableTop, tableWidth, 25)
      .stroke();

    // Table rows
    data.items.forEach((item, index) => {
      const rowY = this.currentY;
      const rowHeight = 30;

      // Alternate row background
      if (index % 2 === 0) {
        this.doc
          .fillColor('#fafafa')
          .rect(tableLeft, rowY, tableWidth, rowHeight)
          .fill();
      }

      this.doc.fontSize(9).font('Helvetica').fillColor('#1e293b');

      x = tableLeft + 5;
      this.doc.text((index + 1).toString(), x, rowY + 10, { width: colWidths.no, align: 'center' });
      
      x += colWidths.no;
      this.doc.text(item.nameAr || item.nameEn || '', x, rowY + 10, { width: colWidths.description });
      
      x += colWidths.description;
      this.doc.text(item.quantity.toString(), x, rowY + 10, { width: colWidths.quantity, align: 'center' });
      
      x += colWidths.quantity;
      this.doc.text(this.formatCurrency(item.price), x, rowY + 10, { width: colWidths.price, align: 'right' });
      
      x += colWidths.price;
      this.doc.text(this.formatCurrency(item.total), x, rowY + 10, { width: colWidths.total, align: 'right' });

      // Row border
      this.doc
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(tableLeft, rowY + rowHeight)
        .lineTo(tableLeft + tableWidth, rowY + rowHeight)
        .stroke();

      this.currentY += rowHeight;
    });

    // Table bottom border
    this.doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .rect(tableLeft, tableTop, tableWidth, this.currentY - tableTop)
      .stroke();

    this.currentY += 20;
  }

  /**
   * Draw totals section
   */
  private drawTotals(data: InvoiceData) {
    const rightX = this.pageWidth - this.margin - 200;
    const labelX = rightX;
    const valueX = rightX + 120;

    this.doc.fontSize(10).font('Helvetica');

    // Subtotal
    this.doc
      .fillColor('#64748b')
      .text('Subtotal:', labelX, this.currentY, { width: 100, align: 'right' });
    this.doc
      .fillColor('#1e293b')
      .text(this.formatCurrency(data.subtotal), valueX, this.currentY, { width: 80, align: 'right' });

    this.currentY += 18;

    // Tax
    if (data.tax && data.tax > 0) {
      const taxLabel = data.taxRate ? `Tax (${data.taxRate}%):` : 'Tax:';
      this.doc
        .fillColor('#64748b')
        .text(taxLabel, labelX, this.currentY, { width: 100, align: 'right' });
      this.doc
        .fillColor('#1e293b')
        .text(this.formatCurrency(data.tax), valueX, this.currentY, { width: 80, align: 'right' });

      this.currentY += 18;
    }

    // Discount
    if (data.discount && data.discount > 0) {
      this.doc
        .fillColor('#64748b')
        .text('Discount:', labelX, this.currentY, { width: 100, align: 'right' });
      this.doc
        .fillColor('#dc2626')
        .text(`-${this.formatCurrency(data.discount)}`, valueX, this.currentY, { width: 80, align: 'right' });

      this.currentY += 18;
    }

    // Horizontal line before grand total
    this.doc
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .moveTo(rightX, this.currentY)
      .lineTo(this.pageWidth - this.margin, this.currentY)
      .stroke();

    this.currentY += 10;

    // Grand Total
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('Grand Total:', labelX, this.currentY, { width: 100, align: 'right' });
    this.doc
      .fillColor('#2563eb')
      .text(this.formatCurrency(data.grandTotal), valueX, this.currentY, { width: 80, align: 'right' });

    this.currentY += 30;

    // Notes
    if (data.notes) {
      this.doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text('Notes:', this.margin, this.currentY);

      this.currentY += 15;

      this.doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(data.notes, this.margin, this.currentY, {
          width: this.pageWidth - 2 * this.margin,
        });

      this.currentY += 30;
    }
  }

  /**
   * Draw footer
   */
  private drawFooter(data: InvoiceData) {
    const footerY = this.pageHeight - this.margin - 30;

    // Horizontal line
    this.doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(this.margin, footerY)
      .lineTo(this.pageWidth - this.margin, footerY)
      .stroke();

    // Footer text
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text(
        'Thank you for your business | Generated by ERP System',
        this.margin,
        footerY + 10,
        {
          align: 'center',
          width: this.pageWidth - 2 * this.margin,
        }
      );
  }

  /**
   * Format date to readable string
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' SAR';
  }
}
