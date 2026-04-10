'use client';

import { useState, useEffect } from 'react';
import EnhancedTable from '@/components/EnhancedTable';
import EnhancedModal from '@/components/EnhancedModal';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    notes: '',
  });
  const [items, setItems] = useState([
    { productId: '', quantity: 0, price: 0, total: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [invoicesRes, customersRes, productsRes] = await Promise.all([
      fetch('/api/sales-invoices'),
      fetch('/api/customers'),
      fetch('/api/products'),
    ]);
    setInvoices(await invoicesRes.json());
    setCustomers(await customersRes.json());
    setProducts(await productsRes.json());
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 0, price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'price') {
      newItems[index].total = newItems[index].quantity * newItems[index].price;
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const total = calculateTotal();
    const data = {
      ...formData,
      date: new Date(formData.date),
      total,
      items: items.map(item => ({
        productId: item.productId,
        quantity: parseFloat(item.quantity.toString()),
        price: parseFloat(item.price.toString()),
        total: item.total,
      })),
    };

    await fetch('/api/sales-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    setIsModalOpen(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: '',
    });
    setItems([{ productId: '', quantity: 0, price: 0, total: 0 }]);
  };

  const handleDelete = async (invoice: any) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      await fetch(`/api/sales-invoices?id=${invoice.id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const columns = [
    { key: 'invoiceNumber', label: 'رقم الفاتورة' },
    { key: 'customer', label: 'العميل', render: (val: any) => val?.nameAr || '-' },
    { key: 'date', label: 'التاريخ', render: (val: Date) => new Date(val).toLocaleDateString('ar-EG') },
    { key: 'total', label: 'الإجمالي', render: (val: number) => `${val.toFixed(2)} ج.م` },
    { key: 'status', label: 'الحالة' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">فواتير البيع</h1>
          <p className="text-gray-600 mt-1">إدارة فواتير البيع</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/sales/customers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            العملاء
          </Link>
          <Link
            href="/sales/orders"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            أوامر البيع
          </Link>
          <Link
            href="/inventory"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            المخزون
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            إضافة فاتورة
          </button>
        </div>
      </div>

      <EnhancedTable columns={columns} data={invoices} onDelete={handleDelete} />

      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title="إضافة فاتورة بيع"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الفاتورة</label>
              <input
                type="text"
                required
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العميل</label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر العميل</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nameAr}
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
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">السعر</th>
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
                          min="0"
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
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{item.total.toFixed(2)} ج.م</span>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              حفظ
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
