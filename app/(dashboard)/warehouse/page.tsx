'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import EnhancedTable from '@/components/EnhancedTable';
import MobileTable from '@/components/MobileTable';
import { 
  Package, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Filter,
  Download,
} from 'lucide-react';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export default function WarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Determine stock status based on minStock
  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= 0) return 'critical';
    if (stock <= minStock) return 'low';
    return 'normal';
  };

  const filteredProducts = products.filter(product =>
    product.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalProducts: products.length,
    lowStock: products.filter(p => getStockStatus(p.stock, p.minStock) !== 'normal').length,
    criticalStock: products.filter(p => getStockStatus(p.stock, p.minStock) === 'critical').length,
    totalValue: products.reduce((sum, p) => sum + (p.stock * p.cost), 0),
  };

  const columns = [
    { key: 'code', label: 'كود المنتج', className: 'font-medium' },
    { key: 'nameAr', label: 'اسم المنتج', className: 'font-medium' },
    { key: 'unit', label: 'الوحدة' },
    { 
      key: 'stock', 
      label: 'المخزون',
      render: (value: number, row: Product) => {
        const status = getStockStatus(value, row.minStock);
        return (
          <div className="flex items-center gap-2">
            <span className={`font-medium ${
              status === 'critical' ? 'text-red-600' : 
              status === 'low' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {value}
            </span>
            {status === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500" />}
            {status === 'low' && <Clock className="w-4 h-4 text-yellow-500" />}
            {status === 'normal' && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>
        );
      }
    },
    { key: 'minStock', label: 'الحد الأدنى' },
    { key: 'price', label: 'سعر البيع', render: (value: number) => `${value.toFixed(2)} ج.م` },
    { key: 'cost', label: 'التكلفة', render: (value: number) => `${value.toFixed(2)} ج.م` },
  ];

  const statsCards = [
    {
      title: 'إجمالي المنتجات',
      value: stats.totalProducts.toString(),
      icon: <Package className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: `${stats.totalProducts}`, isPositive: true }
    },
    {
      title: 'تنبيهات المخزون المنخفض',
      value: stats.lowStock.toString(),
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'red' as const,
      trend: { value: stats.criticalStock.toString(), isPositive: false }
    },
    {
      title: 'القيمة الإجمالية للمخزون',
      value: `${stats.totalValue.toFixed(2)} ج.م`,
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: 'بالتكلفة', isPositive: true }
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-gray-600">جاري تحميل بيانات المخزن...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">إدارة المخزن</h1>
            <p className="text-gray-600/80 text-lg">حالة المخزون والمنتجات</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchProducts}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Filter className="w-4 h-4" />
              <span className="font-medium">تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">
          <p className="font-medium">خطأ: {error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {statsCards.map((card, index) => (
          <div key={index} className="hidden lg:block">
            <EnhancedCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
              trend={card.trend}
            />
          </div>
        ))}
        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {statsCards.map((card, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">{card.title}</p>
                  <p className="text-lg font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${
                  card.color === 'blue' ? 'bg-blue-50' :
                  card.color === 'red' ? 'bg-red-50' :
                  'bg-green-50'
                }`}>
                  <div className={`${
                    card.color === 'blue' ? 'text-blue-600' :
                    card.color === 'red' ? 'text-red-600' :
                    'text-green-600'
                  }`}>
                    {card.icon}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="البحث عن المنتجات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Products Table Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            حالة المنتجات ({filteredProducts.length})
          </h2>
          
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">لا توجد منتجات للعرض</p>
            </div>
          ) : (
            <>
              <div className="hidden lg:block">
                <EnhancedTable 
                  columns={columns} 
                  data={filteredProducts} 
                  searchable={false}
                  className="shadow-xl"
                />
              </div>
              <div className="lg:hidden">
                <MobileTable 
                  columns={columns} 
                  data={filteredProducts} 
                  searchable={false}
                  className="shadow-xl"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
