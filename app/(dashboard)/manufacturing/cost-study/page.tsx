'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';

interface CostAnalysis {
  productCode: string;
  productName: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
}

export default function CostStudyPage() {
  const [products, setProducts] = useState<CostAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      const response = await fetch('/api/reports?type=inventory');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.inventory.items);
      }
    } catch (error) {
      console.error('Error loading inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalInventoryValue = products.reduce((sum, p) => sum + p.totalValue, 0);
  const averageUnitCost = products.length > 0 ? totalInventoryValue / products.reduce((sum, p) => sum + p.quantity, 0) : 0;

  if (loading) {
    return <div className="p-6 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">دراسة التكاليف والمخزون</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي قيمة المخزون</p>
              <p className="text-3xl font-bold mt-2">{totalInventoryValue.toFixed(2)} ريال</p>
            </div>
            <BarChart3 className="w-12 h-12 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">عدد المنتجات</p>
              <p className="text-3xl font-bold mt-2">{products.length}</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">متوسط تكلفة الوحدة</p>
              <p className="text-3xl font-bold mt-2">{averageUnitCost.toFixed(2)} ريال</p>
            </div>
            <BarChart3 className="w-12 h-12 opacity-50" />
          </div>
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-100 border-b px-6 py-4">
          <h2 className="font-bold text-lg">تفصيل التكاليف والمخزون</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-right font-bold">كود المنتج</th>
              <th className="px-6 py-3 text-right font-bold">اسم المنتج</th>
              <th className="px-6 py-3 text-right font-bold">الكمية</th>
              <th className="px-6 py-3 text-right font-bold">تكلفة الوحدة</th>
              <th className="px-6 py-3 text-right font-bold">القيمة الإجمالية</th>
              <th className="px-6 py-3 text-right font-bold">النسبة من المخزون</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const percentage = totalInventoryValue > 0 ? (product.totalValue / totalInventoryValue) * 100 : 0;
              return (
                <tr
                  key={product.productCode}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedProduct(selectedProduct === product.productCode ? null : product.productCode)}
                >
                  <td className="px-6 py-3">{product.productCode}</td>
                  <td className="px-6 py-3">{product.productName}</td>
                  <td className="px-6 py-3">{product.quantity}</td>
                  <td className="px-6 py-3">{product.unitCost.toFixed(2)} ريال</td>
                  <td className="px-6 py-3 font-bold">{product.totalValue.toFixed(2)} ريال</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm">{percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 font-bold border-t">
            <tr>
              <td colSpan={3} className="px-6 py-3">
                الإجمالي
              </td>
              <td className="px-6 py-3">-</td>
              <td className="px-6 py-3">{totalInventoryValue.toFixed(2)} ريال</td>
              <td className="px-6 py-3">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Top Products by Value */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg mb-4">أعلى المنتجات قيمة</h2>
        <div className="space-y-3">
          {products
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 5)
            .map((product) => (
              <div key={product.productCode} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{product.productName}</p>
                  <p className="text-sm text-gray-600">كود: {product.productCode}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{product.totalValue.toFixed(2)} ريال</p>
                  <p className="text-sm text-gray-600">{product.quantity} وحدة</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
