'use client';

import { useRouter } from 'next/navigation';
import { StockAdjustmentForm } from '@/components/inventory/StockAdjustmentForm';

export default function NewStockAdjustmentPage() {
  const router = useRouter();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Stock Adjustment</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <StockAdjustmentForm
          onSuccess={() => router.push('/inventory/stock-adjustments')}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
