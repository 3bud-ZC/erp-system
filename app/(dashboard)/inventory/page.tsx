'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, AlertTriangle, Package } from 'lucide-react';
import Link from 'next/link';

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'raw_material',
    unit: 'كجم',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('فشل في تحميل المنتجات');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل المنتجات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct ? { id: editingProduct.id, ...formData } : formData;

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('فشل في حفظ المنتج');

      setIsModalOpen(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ المنتج');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      type: 'raw_material',
      unit: 'كجم',
      price: 0,
      cost: 0,
      stock: 0,
      minStock: 0,
    });
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleDelete = async (product: any) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      fetchProducts();
    }
  };

  const columns = [
    { key: 'code', label: 'كود' },
    { key: 'nameAr', label: 'الاسم العربي' },
    { 
      key: 'type', 
      label: 'النوع',
      render: (val: string) => val === 'raw_material' ? 'خامة' : 'منتج نهائي'
    },
    { key: 'unit', label: 'الوحدة' },
    { key: 'stock', label: 'المخزون', render: (val: number, row: any) => (
      <span className={val <= row.minStock ? 'text-red-600 font-bold' : ''}>
        {val.toFixed(2)}
      </span>
    )},
    { key: 'minStock', label: 'الحد الأدنى' },
    { key: 'price', label: 'سعر البيع', render: (val: number) => <span className="whitespace-nowrap">{`${val.toFixed(2)} ج.م`}</span> },
    { key: 'cost', label: 'التكلفة', render: (val: number) => <span className="whitespace-nowrap">{`${val.toFixed(2)} ج.م`}</span> },
  ];

  const lowStockProducts = products.filter((p: any) => p.stock <= p.minStock);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Package className="w-8 h-8 text-blue-600 mx-auto" />
          </div>
          <p className="text-gray-600">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-300 rounded-lg p-6 max-w-md mx-auto">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-2" />
          <p className="text-red-800 font-medium mb-4">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            إعادة محاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">المخزون</h1>
            <p className="text-gray-600/80 text-lg">إدارة المخزون والمنتجات</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/purchases/invoices"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <span className="font-medium">فواتير الشراء</span>
            </Link>
            <Link
              href="/sales/invoices"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <span className="font-medium">فواتير البيع</span>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة منتج</span>
            </button>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-yellow-900 font-bold text-lg">
              تحذير: يوجد {lowStockProducts.length} منتج أقل من الحد الأدنى للمخزون
            </p>
          </div>
        </div>
      )}

      <EnhancedTable
        columns={columns}
        data={products}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
          resetForm();
        }}
        title={editingProduct ? 'تعديل منتج' : 'إضافة منتج'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كود</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم العربي</label>
              <input
                type="text"
                required
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="raw_material">خامة</option>
                <option value="finished_product">منتج نهائي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
              <input
                type="text"
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المخزون الحالي</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingProduct ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
