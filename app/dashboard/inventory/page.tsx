'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  Warehouse, 
  Plus, 
  Search,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Building2,
  MapPin
} from 'lucide-react';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  price: number;
  stock: number;
  minStock: number;
}

interface WarehouseType {
  id: string;
  code: string;
  nameAr: string;
  location: string;
  capacity: number;
  currentStock: number;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'warehouses'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'products') {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('فشل في تحميل المنتجات');
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        const res = await fetch('/api/warehouses');
        if (!res.ok) throw new Error('فشل في تحميل المخازن');
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
          <p className="text-gray-600 mt-1">إدارة المنتجات والمخازن</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                activeTab === 'products'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="font-medium">المنتجات</span>
            </button>
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                activeTab === 'warehouses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Warehouse className="w-5 h-5" />
              <span className="font-medium">المخازن</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'products' ? (
            <ProductsTab products={products} onReload={loadData} />
          ) : (
            <WarehousesTab warehouses={warehouses} onReload={loadData} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ products, onReload }: { products: Product[]; onReload: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث عن منتج..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          <span>إضافة منتج</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الكود</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">اسم المنتج</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">السعر</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المخزون</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  لا توجد منتجات
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{product.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.nameAr}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.price} ج.م</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{product.stock}</td>
                  <td className="px-4 py-3">
                    {product.stock <= product.minStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                        <AlertCircle className="w-3 h-3" />
                        ناقص
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <CheckCircle className="w-3 h-3" />
                        متوفر
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarehousesTab({ warehouses, onReload }: { warehouses: WarehouseType[]; onReload: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث عن مخزن..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          <span>إضافة مخزن</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            لا توجد مخازن
          </div>
        ) : (
          warehouses.map((warehouse) => (
            <div key={warehouse.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{warehouse.nameAr}</h3>
                    <p className="text-sm text-gray-500">{warehouse.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <MapPin className="w-4 h-4" />
                <span>{warehouse.location}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">السعة:</span>
                  <span className="font-medium text-gray-900">{warehouse.capacity}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">المخزون الحالي:</span>
                  <span className="font-medium text-gray-900">{warehouse.currentStock}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(warehouse.currentStock / warehouse.capacity) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {Math.round((warehouse.currentStock / warehouse.capacity) * 100)}% ممتلئ
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
