'use client';

import { useState, useEffect } from 'react';
import { inventoryApi } from '@/lib/api/inventory';
import type { Product } from '@/lib/types/inventory';
import { formatCurrency } from '@/lib/utils';
import { Save, AlertTriangle } from 'lucide-react';

interface StockAdjustmentFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StockAdjustmentForm({ onSuccess, onCancel }: StockAdjustmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [reason, setReason] = useState('');
  const [stockError, setStockError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await inventoryApi.getProducts();
        setProducts(response.data);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    }
    loadProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStockError('');

    try {
      const idempotencyKey = `adjustment-${Date.now()}`;
      
      await inventoryApi.createStockAdjustment(
        {
          productId: selectedProduct,
          quantity: adjustmentType === 'IN' ? Math.abs(quantity) : -Math.abs(quantity),
          type: 'ADJUSTMENT',
          reason,
        },
        idempotencyKey
      );

      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to create stock adjustment:', error);
      if (error.message?.includes('negative stock')) {
        setStockError('Insufficient stock for this adjustment');
      } else {
        alert('Failed to create stock adjustment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProductData = products.find(p => p.id === selectedProduct);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Product *
        </label>
        <select
          required
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.code} - {product.nameAr} (Stock: {product.stock})
            </option>
          ))}
        </select>
        {selectedProductData && (
          <div className="mt-2 text-sm text-slate-600">
            Current Stock: {selectedProductData.stock} | Cost: {formatCurrency(selectedProductData.cost)}
          </div>
        )}
      </div>

      {/* Adjustment Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Adjustment Type *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="IN"
              checked={adjustmentType === 'IN'}
              onChange={(e) => setAdjustmentType(e.target.value as 'IN' | 'OUT')}
              className="w-4 h-4 text-blue-600"
            />
            <span>Add Stock (IN)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="OUT"
              checked={adjustmentType === 'OUT'}
              onChange={(e) => setAdjustmentType(e.target.value as 'IN' | 'OUT')}
              className="w-4 h-4 text-blue-600"
            />
            <span>Remove Stock (OUT)</span>
          </label>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Quantity *
        </label>
        <input
          type="number"
          required
          min="1"
          value={Math.abs(quantity)}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {stockError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {stockError}
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Reason *
        </label>
        <textarea
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Explain the reason for this adjustment..."
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
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Creating...' : 'Create Adjustment'}
        </button>
      </div>
    </form>
  );
}
