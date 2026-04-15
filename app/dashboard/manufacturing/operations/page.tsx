'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react';
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
  const [products, setProducts] = useState<any[]>([]);  // Finished products only
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);  // Raw materials only
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const headers = getAuthHeadersOnly();
      const [bomRes, productsRes, rawMaterialsRes] = await Promise.all([
        fetch('/api/bom', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/products?type=product', { headers, signal: controller.signal, cache: 'no-store' }),
        fetch('/api/raw-materials', { headers, signal: controller.signal, cache: 'no-store' }),
      ]);
      
      clearTimeout(timeoutId);

      if (bomRes.ok) {
        const data = await bomRes.json();
        setBomItems(Array.isArray(data) ? data : (data.data || []));
      } else {
        setBomItems([]);
      }
      
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : (data.data || []));
      } else {
        setProducts([]);
      }
      
      if (rawMaterialsRes.ok) {
        const data = await rawMaterialsRes.json();
        setRawMaterials(Array.isArray(data) ? data : (data.data || []));
      } else {
        setRawMaterials([]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.name === 'AbortError') {
        setError('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      } else {
        setError('حدث خطأ أثناء تحميل البيانات');
      }
      setBomItems([]);
      setProducts([]);
      setRawMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId || !formData.materialId) {
      alert('يرجى اختيار المنتج النهائي والمادة الخام');
      return;
    }
    
    if (formData.quantity <= 0) {
      alert('الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    
    if (formData.productId === formData.materialId) {
      alert('المنتج لا يمكن أن يكون مادة خام لنفسه');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/bom', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ productId: '', materialId: '', quantity: 1 });
        setShowForm(false);
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (error) {
      console.error('Error saving BOM item:', error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر من BOM؟')) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/bom?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeadersOnly(),
      });

      if (response.ok) {
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Error deleting BOM item:', error);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  if (loading && bomItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل عمليات الإنتاج...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">إدارة المنتجات والمواد الخام (BOM)</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة عنصر BOM
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

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
                  {rawMaterials.map((p) => (
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
              <button 
                type="submit" 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={loading}
                className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
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
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 disabled:text-red-300 text-sm transition-colors"
                      title="حذف"
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
