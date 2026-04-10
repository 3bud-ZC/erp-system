'use client';

import { useState, useEffect } from 'react';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import { Plus, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingProduct ? 'PUT' : 'POST';
    const body = editingProduct ? { id: editingProduct.id, ...formData } : formData;

    await fetch('/api/products', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setIsModalOpen(false);
    setEditingProduct(null);
    resetForm();
    fetchProducts();
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
    { key: 'price', label: 'سعر البيع', render: (val: number) => `${val.toFixed(2)} ج.م` },
    { key: 'cost', label: 'التكلفة', render: (val: number) => `${val.toFixed(2)} ج.م` },
  ];

  const lowStockProducts = products.filter((p: any) => p.stock <= p.minStock);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المخزون</h1>
          <p className="text-gray-600 mt-1">إدارة المخزون والمنتجات</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/purchases/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            فواتير الشراء
          </Link>
          <Link
            href="/sales/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            فواتير البيع
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            إضافة منتج
          </button>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800 font-medium">
              تحذير: يوجد {lowStockProducts.length} منتج أقل من الحد الأدنى للمخزون
            </p>
          </div>
        </div>
      )}

      <Table
        columns={columns}
        data={products}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
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
      </Modal>
    </div>
  );
}
