'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier?: { nameAr: string };
  date: string;
  status: string;
  total: number;
  notes?: string;
  items?: any[];
}

interface FormItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    orderNumber: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  });
  
  const [items, setItems] = useState<FormItem[]>([
    { productId: '', quantity: 0, unitPrice: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/suppliers'),
        fetch('/api/products'),
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 0, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId) {
      setError('يرجى اختيار مورد');
      return;
    }

    if (items.some(item => !item.productId || item.quantity <= 0)) {
      setError('يرجى ملء جميع بيانات الأصناف');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: new Date(formData.date).toISOString(),
          items: items.map(item => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create purchase order');
      }

      setIsModalOpen(false);
      resetForm();
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      supplierId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', quantity: 0, unitPrice: 0 }]);
    setError(null);
  };

  const columns = [
    { key: 'orderNumber', label: 'رقم الأمر', className: 'font-medium' },
    {
      key: 'supplier',
      label: 'المورد',
      render: (value: any) => value?.nameAr || 'N/A',
    },
    {
      key: 'date',
      label: 'التاريخ',
      render: (value: string) => new Date(value).toLocaleDateString('ar-EG'),
    },
    {
      key: 'total',
      label: 'الإجمالي',
      render: (value: number) => `${value.toFixed(2)} ج.م`,
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          value === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          value === 'confirmed' ? 'bg-blue-100 text-blue-800' :
          value === 'received' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value === 'pending' ? 'قيد الانتظار' :
           value === 'confirmed' ? 'مؤكد' :
           value === 'received' ? 'تم الاستلام' : value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أوامر الشراء</h1>
          <p className="text-gray-600 mt-1">إدارة أوامر الشراء (لا تؤثر على المخزون - يتم التأثير عند استقبال الفاتورة)</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/purchases/suppliers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            الموردين
          </Link>
          <Link
            href="/purchases/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            فواتير الشراء
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            إضافة أمر شراء
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">لا توجد أوامر شراء</p>
        </div>
      ) : (
        <EnhancedTable columns={columns} data={orders} />
      )}

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="إضافة أمر شراء جديد"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الأمر</label>
              <input
                type="text"
                required
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                placeholder="مثال: PO-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
              <select
                required
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر المورد</option>
                {suppliers.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">الأصناف</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                إضافة صنف
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">المنتج</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">الكمية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">سعر الوحدة</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">الإجمالي</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-2">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">اختر المنتج</option>
                          {products.map((product: any) => (
                            <option key={product.id} value={product.id}>
                              {product.nameAr}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{(item.quantity * item.unitPrice).toFixed(2)} ج.م</span>
                      </td>
                      <td className="px-4 py-2">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-gray-50 px-6 py-3 rounded-lg">
                <span className="text-sm text-gray-600 ml-4">الإجمالي:</span>
                <span className="text-xl font-bold text-gray-900">{calculateTotal().toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
