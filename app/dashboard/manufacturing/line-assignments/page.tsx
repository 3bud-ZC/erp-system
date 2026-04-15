'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Link2, Factory, Package, AlertCircle, Star } from 'lucide-react';
import { getAuthHeadersOnly, getAuthHeaders } from '@/lib/api-client';

interface ProductionLine {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface Product {
  id: string;
  nameAr: string;
  code: string;
}

interface Assignment {
  id: string;
  productionLineId: string;
  productId: string;
  priority: number;
  notes?: string;
  productionLine: ProductionLine;
  product: Product;
}

export default function LineAssignmentsPage() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [formData, setFormData] = useState({
    productionLineId: '',
    productId: '',
    priority: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeadersOnly();

      const [linesRes, productsRes, assignmentsRes] = await Promise.all([
        fetch('/api/production-lines', { headers, cache: 'no-store' }),
        fetch('/api/products?type=product', { headers, cache: 'no-store' }),
        fetch('/api/production-lines/assignments', { headers, cache: 'no-store' }),
      ]);

      if (linesRes.ok) {
        const data = await linesRes.json();
        setLines(Array.isArray(data) ? data : (data.data || []));
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(Array.isArray(data) ? data : (data.data || []));
      }

      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(Array.isArray(data) ? data : (data.data || []));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productionLineId || !formData.productId) {
      alert('يرجى اختيار خط الإنتاج والمنتج');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/production-lines/assignments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ productionLineId: '', productId: '', priority: 0, notes: '' });
        setShowForm(false);
        loadData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء تخصيص هذا المنتج؟')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/production-lines/assignments?id=${id}`, {
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
      console.error('Error deleting assignment:', error);
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  const getLineName = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    return line ? `${line.code} - ${line.name}` : lineId;
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product ? `${product.code} - ${product.nameAr}` : productId;
  };

  const filteredAssignments = selectedLine
    ? assignments.filter((a) => a.productionLineId === selectedLine)
    : assignments;

  // Group by line for display
  const groupedByLine = filteredAssignments.reduce((acc, assignment) => {
    const lineId = assignment.productionLineId;
    if (!acc[lineId]) {
      acc[lineId] = [];
    }
    acc[lineId].push(assignment);
    return acc;
  }, {} as Record<string, Assignment[]>);

  if (loading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link2 className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">تخصيص المنتجات لخطوط الإنتاج</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          تخصيص منتج جديد
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium mb-2">تصفية حسب خط الإنتاج</label>
        <select
          value={selectedLine}
          onChange={(e) => setSelectedLine(e.target.value)}
          className="w-full md:w-80 border rounded-lg px-3 py-2"
        >
          <option value="">جميع خطوط الإنتاج</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.code} - {line.name}
            </option>
          ))}
        </select>
      </div>

      {/* Assignment Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Factory className="w-5 h-5" />
            تخصيص منتج لخط إنتاج
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">خط الإنتاج *</label>
                <select
                  value={formData.productionLineId}
                  onChange={(e) => setFormData({ ...formData, productionLineId: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">اختر خط الإنتاج</option>
                  {lines
                    .filter((l) => l.status === 'active')
                    .map((line) => (
                      <option key={line.id} value={line.id}>
                        {line.code} - {line.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المنتج *</label>
                <select
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">اختر المنتج</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الأولوية (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="ملاحظات اختيارية..."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ التخصيص'}
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

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">لا توجد تخصيصات</p>
          <p className="text-gray-500 text-sm mt-1">قم بتخصيص منتجات لخطوط الإنتاج</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByLine).map(([lineId, lineAssignments]) => (
            <div key={lineId} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-blue-50 px-6 py-3 border-b flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg">{getLineName(lineId)}</h3>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm mr-auto">
                  {lineAssignments.length} منتج
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-2 text-right font-medium text-sm">المنتج</th>
                    <th className="px-6 py-2 text-right font-medium text-sm">الأولوية</th>
                    <th className="px-6 py-2 text-right font-medium text-sm">ملاحظات</th>
                    <th className="px-6 py-2 text-right font-medium text-sm">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {lineAssignments
                    .sort((a, b) => b.priority - a.priority)
                    .map((assignment) => (
                      <tr key={assignment.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
                            <span>{getProductName(assignment.productId)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < assignment.priority / 2
                                    ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                            <span className="text-sm text-gray-600 mr-2">({assignment.priority})</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-600">
                          {assignment.notes || '-'}
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => handleDelete(assignment.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 disabled:text-red-300 transition-colors"
                            title="إلغاء التخصيص"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
