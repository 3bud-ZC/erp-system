'use client';

import { useState, useEffect } from 'react';
import { salesApi } from '@/lib/api/sales';
import { inventoryApi } from '@/lib/api/inventory';
import type { Customer } from '@/lib/types/sales';
import type { Product } from '@/lib/types/inventory';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Save } from 'lucide-react';

interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface InvoiceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes] = await Promise.all([
          salesApi.getCustomers(),
          inventoryApi.getProducts(),
        ]);
        setCustomers(customersRes.data);
        setProducts(productsRes.data);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    }
    loadData();
  }, []);

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, price: 0, total: 0 }]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      updatedItems[index] = {
        ...updatedItems[index],
        productId: value,
        productName: product?.nameAr || '',
        price: product?.price || 0,
      };
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
    }
    // Recalculate total
    updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].price;
    setItems(updatedItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const idempotencyKey = `invoice-${Date.now()}`;
      
      await salesApi.createInvoice(
        {
          customerId: selectedCustomer,
          date: invoiceDate,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })),
          total,
          notes,
        },
        idempotencyKey
      );

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Selection */}
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

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Invoice Date *
        </label>
        <input
          type="date"
          required
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Line Items *
          </label>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
        
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <select
                  required
                  value={item.productId}
                  onChange={(e) => updateItem(index, 'productId', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  required
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Qty"
                />
              </div>
              <div className="w-32">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Price"
                />
              </div>
              <div className="w-32 px-3 py-2 text-right font-medium">
                {formatCurrency(item.total)}
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Add notes..."
        />
      </div>

      {/* Total */}
      <div className="flex justify-between items-center p-4 bg-slate-100 rounded-lg">
        <span className="text-lg font-semibold text-slate-900">Total</span>
        <span className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</span>
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
          disabled={loading || items.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}
