'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  Search,
  PieChart,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface CostAnalysis {
  productCode: string;
  productName: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
  type: string;
}

// Stats Card Component
function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function CostStudyPage() {
  const [products, setProducts] = useState<CostAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CostAnalysis; direction: 'asc' | 'desc' } | null>({
    key: 'totalValue',
    direction: 'desc',
  });

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Fetch both finished products and raw materials
      const [productsRes, rawMaterialsRes] = await Promise.all([
        fetch('/api/products', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/raw-materials', { headers, signal: controller.signal, cache: 'no-store' }),
      ]);
      
      clearTimeout(timeoutId);

      if (!productsRes.ok && !rawMaterialsRes.ok) {
        throw new Error('فشل في تحميل البيانات');
      }

      const allItems: CostAnalysis[] = [];

      // Process finished products
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        const productsList = Array.isArray(productsData) ? productsData : (productsData.data || []);
        
        productsList.forEach((p: any) => {
          if (p.type !== 'raw_material') {
            allItems.push({
              productCode: p.code,
              productName: p.nameAr,
              unitCost: p.cost || 0,
              quantity: p.stock || 0,
              totalValue: (p.cost || 0) * (p.stock || 0),
              type: 'منتج نهائي',
            });
          }
        });
      }

      // Process raw materials
      if (rawMaterialsRes.ok) {
        const rawMaterialsData = await rawMaterialsRes.json();
        const rawMaterialsList = Array.isArray(rawMaterialsData) ? rawMaterialsData : (rawMaterialsData.data || []);
        
        rawMaterialsList.forEach((m: any) => {
          allItems.push({
            productCode: m.code,
            productName: m.nameAr,
            unitCost: m.cost || 0,
            quantity: m.stock || 0,
            totalValue: (m.cost || 0) * (m.stock || 0),
            type: 'مادة خام',
          });
        });
      }

      setProducts(allItems);
    } catch (error: any) {
      console.error('Error loading inventory data:', error);
      if (error.name === 'AbortError') {
        setError('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      } else {
        setError(error.message || 'فشل في تحميل البيانات');
      }
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof CostAnalysis) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProducts = products
    .filter(
      (p) =>
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const totalInventoryValue = products.reduce((sum, p) => sum + p.totalValue, 0);
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const averageUnitCost = totalQuantity > 0 ? totalInventoryValue / totalQuantity : 0;

  // Calculate top products
  const topProducts = [...products].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل بيانات التكاليف...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadInventoryData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دراسة التكاليف والمخزون</h1>
          <p className="text-gray-500 text-sm mt-1">تحليل تكاليف المنتجات وقيمة المخزون</p>
        </div>
        <button
          onClick={loadInventoryData}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-purple-500 text-white p-2 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-purple-900 mb-2">📊 فهم دراسة التكاليف</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-purple-800">
              <div>
                <span className="font-semibold">• تكلفة الوحدة:</span> سعر شراء أو إنتاج الوحدة الواحدة
              </div>
              <div>
                <span className="font-semibold">• القيمة الإجمالية:</span> الكمية × تكلفة الوحدة
              </div>
              <div>
                <span className="font-semibold">• النسبة:</span> نسبة قيمة المنتج من إجمالي المخزون
              </div>
              <div>
                <span className="font-semibold">• متوسط التكلفة:</span> إجمالي القيمة ÷ إجمالي الكمية
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-3 font-medium">💡 استخدم هذا التقرير لتحديد المنتجات الأكثر قيمة وتحسين إدارة المخزون</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي قيمة المخزون"
          value={formatCurrency(totalInventoryValue)}
          subtitle="جميع المنتجات"
          icon={DollarSign}
          color="bg-blue-500"
        />
        <StatCard
          title="عدد المنتجات"
          value={products.length}
          subtitle="صنف مخزون"
          icon={Package}
          color="bg-green-500"
        />
        <StatCard
          title="إجمالي الكمية"
          value={totalQuantity.toLocaleString('ar-EG')}
          subtitle="وحدة"
          icon={BarChart3}
          color="bg-purple-500"
        />
        <StatCard
          title="متوسط تكلفة الوحدة"
          value={formatCurrency(averageUnitCost)}
          subtitle="لكل وحدة"
          icon={TrendingUp}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="البحث في المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('productCode')}
                  >
                    <div className="flex items-center gap-1">
                      الكود
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('productName')}
                  >
                    <div className="flex items-center gap-1">
                      اسم المنتج
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center gap-1">
                      الكمية
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700">تكلفة الوحدة</th>
                  <th
                    className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalValue')}
                  >
                    <div className="flex items-center gap-1">
                      القيمة الإجمالية
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700">النوع</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">النسبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      لا توجد منتجات مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const percentage =
                      totalInventoryValue > 0 ? (product.totalValue / totalInventoryValue) * 100 : 0;
                    return (
                      <tr key={product.productCode} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{product.productCode}</td>
                        <td className="px-4 py-3">{product.productName}</td>
                        <td className="px-4 py-3 text-gray-600">{product.quantity.toLocaleString('ar-EG')}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatCurrency(product.unitCost)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatCurrency(product.totalValue)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.type === 'منتج نهائي' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {product.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3">
                    الإجمالي
                  </td>
                  <td className="px-4 py-3">{totalQuantity.toLocaleString('ar-EG')}</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3 text-blue-700">{formatCurrency(totalInventoryValue)}</td>
                  <td className="px-4 py-3">-</td>
                  <td className="px-4 py-3">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-gray-900">أعلى المنتجات قيمة</h2>
          </div>

          <div className="space-y-4">
            {topProducts.map((product, index) => {
              const percentage =
                totalInventoryValue > 0 ? (product.totalValue / totalInventoryValue) * 100 : 0;
              return (
                <div key={product.productCode} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{product.productName}</p>
                    <p className="text-xs text-gray-500">
                      {product.quantity} وحدة × {formatCurrency(product.unitCost)}
                    </p>
                  </div>                  <div className="text-left">
                    <p className="font-bold text-gray-900">{formatCurrency(product.totalValue)}</p>
                    <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">ملخص التوزيع</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">أعلى 5 منتجات</span>
                <span className="font-medium">
                  {formatCurrency(topProducts.reduce((sum, p) => sum + p.totalValue, 0))}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">نسبتها من المخزون</span>
                <span className="font-medium text-purple-600">
                  {totalInventoryValue > 0
                    ? (
                        (topProducts.reduce((sum, p) => sum + p.totalValue, 0) / totalInventoryValue) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
