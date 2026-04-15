'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2, Package, AlertTriangle, Edit } from 'lucide-react';
import Link from 'next/link';
import { fetchApi, getAuthHeadersOnly } from '@/lib/api-client';

interface RawMaterial {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  unit: string;
  cost: number;
  stock: number;
  minStock: number;
}

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    unit: 'كجم',
    cost: 0,
    stock: 0,
    minStock: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeadersOnly();
      const res = await fetch('/api/raw-materials', { headers });

      if (res.ok) {
        const data = await res.json();
        setMaterials(data.data || data);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameAr || !formData.code) {
      setError('يرجى ملء الحقول المطلوبة');
      return;
    }

    try {
      setLoading(true);
      const method = editingMaterial ? 'PUT' : 'POST';
      const body = {
        ...(editingMaterial ? { id: editingMaterial.id } : {}),
        ...formData,
        cost: Number(formData.cost),
        stock: Number(formData.stock),
        minStock: Number(formData.minStock),
      };
      
      await fetchApi('/api/raw-materials', {
        method,
        body: JSON.stringify(body),
      });

      setIsModalOpen(false);
      resetForm();
      setEditingMaterial(null);
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save raw material');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setFormData({
      code: material.code,
      nameAr: material.nameAr,
      nameEn: material.nameEn || '',
      unit: material.unit,
      cost: material.cost,
      stock: material.stock,
      minStock: material.minStock,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (material: RawMaterial) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة الخام؟')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/raw-materials?id=${material.id}`, { 
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل حذف المادة الخام');
      }
      await fetchData();
    } catch (err) {
      console.error('Error deleting material:', err);
      setError(err instanceof Error ? err.message : 'فشل حذف المادة الخام');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      unit: 'كجم',
      cost: 0,
      stock: 0,
      minStock: 0,
    });
    setError(null);
  };

  const columns = [
    { key: 'code', label: 'الكود', className: 'font-medium' },
    { key: 'nameAr', label: 'الاسم بالعربي', className: 'font-medium' },
    { key: 'nameEn', label: 'الاسم بالإنجليزي' },
    { key: 'unit', label: 'الوحدة' },
    {
      key: 'cost',
      label: 'التكلفة',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'stock',
      label: 'المخزون',
      render: (value: number, row: RawMaterial) => (
        <span className={value <= row.minStock ? 'text-red-600 font-bold' : 'text-green-600'}>
          {value.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'minStock',
      label: 'الحد الأدنى',
      render: (value: number) => value.toFixed(2),
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: RawMaterial) => (
        <div className="flex gap-2 items-center">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
            title="تعديل"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 transition-colors"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const lowStockMaterials = materials.filter(m => m.stock <= m.minStock);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المواد الخام</h1>
          <p className="text-gray-600 mt-1">إدارة المواد الخام المستخدمة في الإنتاج</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/inventory"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            المنتجات
          </Link>
          <Link
            href="/dashboard/inventory/warehouses"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            المخازن
          </Link>
          <button
            onClick={() => {
              resetForm();
              setEditingMaterial(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            مادة خام جديدة
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockMaterials.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <p className="text-red-800 font-medium">تحذير: مواد خام منخفضة المخزون</p>
            <p className="text-red-600 text-sm">
              {lowStockMaterials.length} مادة خام تحتاج إلى إعادة طلب
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-sm">إجمالي المواد</p>
          <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">مخزون منخفض</p>
          <p className="text-2xl font-bold text-red-800">{lowStockMaterials.length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-700 text-sm">إجمالي التكلفة</p>
          <p className="text-2xl font-bold text-blue-800">
            {materials.reduce((sum, m) => sum + (m.cost * m.stock), 0).toFixed(2)} ج.م
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 text-sm">مخزون جيد</p>
          <p className="text-2xl font-bold text-green-800">
            {materials.filter(m => m.stock > m.minStock).length}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {materials.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد مواد خام</p>
          <p className="text-sm text-gray-400 mt-1">أضف مادة خام جديدة للبدء</p>
        </div>
      ) : (
        <EnhancedTable columns={columns} data={materials} />
      )}

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
          setEditingMaterial(null);
        }}
        title={editingMaterial ? 'تعديل مادة خام' : 'إضافة مادة خام جديدة'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="مثال: RM-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم بالعربي *</label>
              <input
                type="text"
                required
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder="مثال: دقيق"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم بالإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="Flour"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة *</label>
              <select
                required
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="كجم">كجم</option>
                <option value="جرام">جرام</option>
                <option value="لتر">لتر</option>
                <option value="متر">متر</option>
                <option value="قطعة">قطعة</option>
                <option value="علبة">علبة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة (للوحدة) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المخزون الحالي</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للمخزون</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
                setEditingMaterial(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
