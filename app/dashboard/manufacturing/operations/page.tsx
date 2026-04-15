'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Package } from 'lucide-react';
import { getAuthHeadersOnly, getAuthHeaders } from '@/lib/api-client';

interface BOMItem {
  id: string;
  productId: string;
  materialId: string;
  quantity: number;
  product: { nameAr: string; code: string };
  material: { nameAr: string; code: string };
}

export default function ManufacturingOperationsPage() {
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    materialId: '',
    quantity: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = getAuthHeadersOnly();
      const [bomRes, productsRes] = await Promise.all([
        fetch('/api/bom', { headers }),
        fetch('/api/products', { headers }),
      ]);

      if (bomRes.ok) {
        const data = await bomRes.json();
        setBomItems(data.data || data);
      }
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/bom', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ productId: '', materialId: '', quantity: 1 });
        setShowForm(false);
        loadData();
      }
    } catch (error) {
      console.error('Error saving BOM item:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا العنصر من BOM؟')) return;
    try {
      const response = await fetch(`/api/bom?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error deleting BOM item:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">إدارة المنتجات والمواد الخام (BOM)</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          إضافة عنصر BOM
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">إضافة عنصر BOM جديد</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المنتج النهائي</label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">اختر منتج</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المادة الخام</label>
                <select
                  value={formData.materialId}
                  onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">اختر مادة خام</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الكمية المطلوبة</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  step="0.01"
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg">
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {bomItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">لا توجد عناصر BOM محددة</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-right font-bold">المنتج النهائي</th>
                <th className="px-6 py-3 text-right font-bold">المادة الخام</th>
                <th className="px-6 py-3 text-right font-bold">الكمية المطلوبة</th>
                <th className="px-6 py-3 text-right font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {bomItems.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3">{item.product.nameAr}</td>
                  <td className="px-6 py-3">{item.material.nameAr}</td>
                  <td className="px-6 py-3">{item.quantity}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
