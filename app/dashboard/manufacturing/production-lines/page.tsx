'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Factory, AlertCircle, Play, Pause, Wrench } from 'lucide-react';
import { getAuthHeadersOnly, getAuthHeaders } from '@/lib/api-client';

interface ProductionLine {
  id: string;
  code: string;
  name: string;
  capacityPerHour: number;
  description?: string;
  status: 'active' | 'maintenance' | 'inactive';
  assignments: any[];
  productionOrders: any[];
  createdAt: string;
}

export default function ProductionLinesPage() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    capacityPerHour: 0,
    description: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeadersOnly();
      const response = await fetch('/api/production-lines', {
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        setLines(Array.isArray(data) ? data : (data.data || []));
      } else {
        setLines([]);
      }
    } catch (error) {
      console.error('Error loading production lines:', error);
      setError('حدث خطأ أثناء تحميل البيانات');
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      alert('كود واسم خط الإنتاج مطلوبان');
      return;
    }

    try {
      setLoading(true);
      const url = '/api/production-lines';
      const method = editingLine ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...(editingLine && { id: editingLine.id }),
          ...formData,
        }),
      });

      if (response.ok) {
        setFormData({ code: '', name: '', capacityPerHour: 0, description: '', status: 'active' });
        setShowForm(false);
        setEditingLine(null);
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (error) {
      console.error('Error saving production line:', error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف خط الإنتاج؟')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/production-lines?id=${id}`, {
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
      console.error('Error deleting production line:', error);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (line: ProductionLine) => {
    setEditingLine(line);
    setFormData({
      code: line.code,
      name: line.name,
      capacityPerHour: line.capacityPerHour,
      description: line.description || '',
      status: line.status,
    });
    setShowForm(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            <Play className="w-3 h-3" />
            نشط
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
            <Wrench className="w-3 h-3" />
            صيانة
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
            <Pause className="w-3 h-3" />
            متوقف
          </span>
        );
      default:
        return null;
    }
  };

  if (loading && lines.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل خطوط الإنتاج...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Factory className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">إدارة خطوط الإنتاج</h1>
        </div>
        <button
          onClick={() => {
            setEditingLine(null);
            setFormData({ code: '', name: '', capacityPerHour: 0, description: '', status: 'active' });
            setShowForm(!showForm);
          }}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة خط إنتاج
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
          <h2 className="text-xl font-bold mb-4">
            {editingLine ? 'تعديل خط الإنتاج' : 'إضافة خط إنتاج جديد'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">كود الخط *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                  disabled={!!editingLine}
                  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
                  placeholder="مثال: LINE-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">اسم الخط *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="مثال: خط الإنتاج الأول"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الإنتاجية (وحدة/ساعة)</label>
                <input
                  type="number"
                  value={formData.capacityPerHour}
                  onChange={(e) => setFormData({ ...formData, capacityPerHour: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الحالة</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="active">نشط</option>
                  <option value="maintenance">صيانة</option>
                  <option value="inactive">متوقف</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="وصف خط الإنتاج..."
              />
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
                onClick={() => {
                  setShowForm(false);
                  setEditingLine(null);
                }}
                disabled={loading}
                className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Factory className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">لا توجد خطوط إنتاج</p>
          <p className="text-gray-500 text-sm mt-1">قم بإضافة خط إنتاج جديد للبدء</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-right font-bold">الكود</th>
                <th className="px-6 py-3 text-right font-bold">الاسم</th>
                <th className="px-6 py-3 text-right font-bold">الإنتاجية/ساعة</th>
                <th className="px-6 py-3 text-right font-bold">الحالة</th>
                <th className="px-6 py-3 text-right font-bold">المنتجات المخصصة</th>
                <th className="px-6 py-3 text-right font-bold">أوامر الإنتاج</th>
                <th className="px-6 py-3 text-right font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-sm">{line.code}</td>
                  <td className="px-6 py-3">{line.name}</td>
                  <td className="px-6 py-3">{line.capacityPerHour}</td>
                  <td className="px-6 py-3">{getStatusBadge(line.status)}</td>
                  <td className="px-6 py-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                      {line.assignments?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm">
                      {line.productionOrders?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(line)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-800 disabled:text-blue-300 transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(line.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 disabled:text-red-300 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
