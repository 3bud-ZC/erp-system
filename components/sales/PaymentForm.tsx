'use client';

import { useState, useEffect } from 'react';
import { salesApi } from '@/lib/api/sales';
import type { Customer } from '@/lib/types/sales';
import type { SalesInvoice } from '@/lib/types/sales';
import { formatCurrency } from '@/lib/utils';
import { Save } from 'lucide-react';

interface PaymentFormProps {
  customerId?: string;
  invoiceId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ customerId, invoiceId, onSuccess, onCancel }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || '');
  const [selectedInvoice, setSelectedInvoice] = useState(invoiceId || '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CARD'>('CASH');
  const [reference, setReference] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        if (!customerId) {
          const customersRes = await salesApi.getCustomers();
          setCustomers(customersRes.data);
        }
        if (!invoiceId && selectedCustomer) {
          const invoicesRes = await salesApi.getInvoices();
          setInvoices(invoicesRes.data.filter((inv: SalesInvoice) => 
            inv.customerId === selectedCustomer && inv.status !== 'PAID'
          ));
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
    loadData();
  }, [customerId, selectedCustomer, invoiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const idempotencyKey = `payment-${Date.now()}`;
      
      await salesApi.createPayment(
        {
          customerId: selectedCustomer,
          invoiceId: selectedInvoice,
          amount,
          date,
          method,
          reference,
        },
        idempotencyKey
      );

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create payment:', error);
      alert('Failed to create payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoiceData = invoices.find(inv => inv.id === selectedInvoice);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Selection */}
      {!customerId && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Customer *
          </label>
          <select
            required
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Invoice Selection */}
      {!invoiceId && selectedCustomer && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Invoice (Optional)
          </label>
          <select
            value={selectedInvoice}
            onChange={(e) => {
              setSelectedInvoice(e.target.value);
              const invoice = invoices.find(inv => inv.id === e.target.value);
              if (invoice) setAmount(invoice.total);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an invoice (optional)</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} - {formatCurrency(invoice.total)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
        {selectedInvoiceData && (
          <p className="mt-1 text-sm text-slate-600">
            Invoice total: {formatCurrency(selectedInvoiceData.total)}
          </p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Payment Date *
        </label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Payment Method *
        </label>
        <select
          required
          value={method}
          onChange={(e) => setMethod(e.target.value as 'CASH' | 'BANK_TRANSFER' | 'CARD')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="CASH">Cash</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CARD">Card</option>
        </select>
      </div>

      {/* Reference */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Reference Number
        </label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Check #1234"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading || amount <= 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}
