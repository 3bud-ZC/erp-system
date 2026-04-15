'use client';

import { useState, useEffect } from 'react';
import { getAuthHeaders, getAuthHeadersOnly } from '@/lib/api-client';
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
  RefreshCw,
  X,
  Phone,
  User,
} from 'lucide-react';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  warehouseId?: string;
  warehouse?: { nameAr: string };
}

interface WarehouseType {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  manager?: string;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'warehouses'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ code: '', nameAr: '', nameEn: '', type: 'raw', unit: 'قطعة', price: 0, cost: 0, stock: 0, minStock: 0, warehouseId: '' });

  // Warehouse modal
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({ code: '', nameAr: '', nameEn: '', address: '', phone: '', manager: '' });

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Try to load products with better error handling
      let productsData = [];
      let warehousesData = [];
      
      // Load data in parallel with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      try {
        const [prodRes, whRes] = await Promise.all([
          fetch('/api/products', { 
            signal: controller.signal, 
            cache: 'no-store',
            headers: getAuthHeadersOnly()
          }),
          fetch('/api/warehouses', { 
            signal: controller.signal, 
            cache: 'no-store',
            headers: getAuthHeadersOnly()
          })
        ]);
        
        clearTimeout(timeoutId);
        
        if (prodRes.ok) {
          const result = await prodRes.json();
          productsData = result.data || result;
        }
        
        if (whRes.ok) {
          const result = await whRes.json();
          warehousesData = result.data || result;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
          setError('انتهت مهلة التحميل. يرجى المحاولة مرة أخرى.');
          return;
        }
        console.warn('API error:', err);
      }
      
      // Set data even if partial
      setProducts(productsData);
      setWarehouses(warehousesData);
      
      // Only show error if both failed
      if (productsData.length === 0 && warehousesData.length === 0) {
        setError('Unable to load data. Please check your connection.');
      }
    } catch (err) {
      console.error('Load data error:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Product CRUD ----
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ code: '', nameAr: '', nameEn: '', type: 'raw', unit: 'قطعة', price: 0, cost: 0, stock: 0, minStock: 0, warehouseId: '' });
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({ code: p.code, nameAr: p.nameAr, nameEn: p.nameEn || '', type: p.type, unit: p.unit, price: p.price, cost: p.cost, stock: p.stock, minStock: p.minStock, warehouseId: p.warehouseId || '' });
    setShowProductModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!productForm.code.trim() || !productForm.nameAr.trim()) {
        alert('Please fill in required fields (Code and Arabic Name)');
        return;
      }

      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct ? { id: editingProduct.id, ...productForm } : productForm;
      
      // Prepare data with proper number conversion
      const productData: any = {
        ...body,
        price: Number(body.price) || 0,
        cost: Number(body.cost) || 0,
        minStock: Number(body.minStock) || 0,
        warehouseId: body.warehouseId || null,
        nameEn: body.nameEn || null,
      };
      
      // Only include stock for new products (POST), not for updates (PUT)
      // API rejects stock changes directly for security - must use inventory operations
      if (!editingProduct) {
        productData.stock = Number(body.stock) || 0;
      }

      console.log('Saving product:', productData);
      
      const res = await fetch('/api/products', {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(productData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Save product error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to save product');
      }
      
      const result = await res.json();
      console.log('Product saved successfully:', result);
      
      setShowProductModal(false);
      loadData();
    } catch (err) {
      console.error('Save product error:', err);
      const message = err instanceof Error ? err.message : 'Error saving product';
      alert(message);
    }
  };

  const deleteProduct = async (p: Product) => {
    if (!confirm(`Are you sure you want to delete "${p.nameAr}"?`)) return;
    try {
      const res = await fetch(`/api/products?id=${p.id}`, { 
        method: 'DELETE', 
        headers: getAuthHeadersOnly()
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Delete product error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to delete product');
      }
      
      console.log('Product deleted successfully');
      loadData();
    } catch (err) {
      console.error('Delete product error:', err);
      const message = err instanceof Error ? err.message : 'Error deleting product';
      alert(message);
    }
  };

  // ---- Warehouse CRUD ----
  const openAddWarehouse = () => {
    setEditingWarehouse(null);
    setWarehouseForm({ code: '', nameAr: '', nameEn: '', address: '', phone: '', manager: '' });
    setShowWarehouseModal(true);
  };

  const openEditWarehouse = (w: WarehouseType) => {
    setEditingWarehouse(w);
    setWarehouseForm({ code: w.code, nameAr: w.nameAr, nameEn: w.nameEn || '', address: w.address || '', phone: w.phone || '', manager: w.manager || '' });
    setShowWarehouseModal(true);
  };

  const saveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingWarehouse ? 'PUT' : 'POST';
      const body = editingWarehouse ? { id: editingWarehouse.id, ...warehouseForm } : warehouseForm;
      const res = await fetch('/api/warehouses', {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'فشل في حفظ المخزن');
      }
      alert('تم حفظ المخزن بنجاح');
      setShowWarehouseModal(false);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'خطأ في حفظ المخزن');
    }
  };

  const deleteWarehouse = async (w: WarehouseType) => {
    if (!confirm(`هل أنت متأكد من حذف "${w.nameAr}"؟`)) return;
    try {
      const res = await fetch(`/api/warehouses?id=${w.id}`, { method: 'DELETE', headers: getAuthHeadersOnly() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'فشل في حذف المخزن');
      }
      alert('تم حذف المخزن بنجاح');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'خطأ في حذف المخزن');
    }
  };

  // ---- Filter ----
  const filteredProducts = products.filter(p =>
    p.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWarehouses = warehouses.filter(w =>
    w.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
          <p className="text-gray-500 text-sm mt-1">إدارة المنتجات والمخازن</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs">إجمالي المنتجات</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs">مخزون منخفض</p>
          <p className="text-2xl font-bold text-red-600">{products.filter(p => p.stock <= p.minStock).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs">إجمالي المخازن</p>
          <p className="text-2xl font-bold text-gray-900">{warehouses.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs">قيمة المخزون</p>
          <p className="text-2xl font-bold text-green-600">{products.reduce((s, p) => s + p.stock * p.cost, 0).toLocaleString('ar-EG')} ج.م</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => { setActiveTab('products'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Package className="w-4 h-4" />
            المنتجات ({products.length})
          </button>
          <button
            onClick={() => { setActiveTab('warehouses'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'warehouses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Warehouse className="w-4 h-4" />
            المخازن ({warehouses.length})
          </button>
        </div>

        <div className="p-4">
          {/* Search + Add */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'products' ? 'بحث عن منتج...' : 'بحث عن مخزن...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <button
              onClick={activeTab === 'products' ? openAddProduct : openAddWarehouse}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'products' ? 'إضافة منتج' : 'إضافة مخزن'}
            </button>
          </div>

          {/* Products Table */}
          {activeTab === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">الكود</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">اسم المنتج</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">النوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">السعر</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">التكلفة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">المخزون</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الحالة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">لا توجد منتجات</td></tr>
                  ) : filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.nameAr}</p>
                        {p.warehouse && <p className="text-xs text-gray-400">{p.warehouse.nameAr}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.type === 'raw' ? 'bg-orange-100 text-orange-700' : p.type === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {p.type === 'raw' ? 'خام' : p.type === 'finished' ? 'تام' : p.type === 'packaging' ? 'تعبئة' : p.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{p.price.toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3">{p.cost.toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3 font-medium">{p.stock}</td>
                      <td className="px-4 py-3">
                        {p.stock <= p.minStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs"><AlertCircle className="w-3 h-3" />منخفض</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs"><CheckCircle className="w-3 h-3" />متوفر</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditProduct(p)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => deleteProduct(p)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Warehouses Cards */}
          {activeTab === 'warehouses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWarehouses.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">لا توجد مخازن</div>
              ) : filteredWarehouses.map(w => (
                <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{w.nameAr}</h3>
                        <p className="text-xs text-gray-500">{w.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditWarehouse(w)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteWarehouse(w)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {w.address && <p className="text-sm text-gray-600 mb-1">{w.address}</p>}
                  {w.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{w.phone}</p>}
                  {w.manager && <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><User className="w-3 h-3" />{w.manager}</p>}
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    {products.filter(p => p.warehouseId === w.id).length} منتج مرتبط
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
              <button onClick={() => setShowProductModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveProduct} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
                  <input type="text" required value={productForm.code} onChange={e => setProductForm({ ...productForm, code: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم العربي *</label>
                  <input type="text" required value={productForm.nameAr} onChange={e => setProductForm({ ...productForm, nameAr: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الإنجليزي</label>
                  <input type="text" value={productForm.nameEn} onChange={e => setProductForm({ ...productForm, nameEn: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">النوع *</label>
                  <select required value={productForm.type} onChange={e => setProductForm({ ...productForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="raw">خام</option>
                    <option value="finished">تام الصنع</option>
                    <option value="packaging">تعبئة وتغليف</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة *</label>
                  <input type="text" required value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المخزن</label>
                  <select value={productForm.warehouseId} onChange={e => setProductForm({ ...productForm, warehouseId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">بدون</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر</label>
                  <input type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة</label>
                  <input type="number" min="0" step="0.01" value={productForm.cost} onChange={e => setProductForm({ ...productForm, cost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المخزون</label>
                  <input type="number" min="0" step="0.01" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                  <input type="number" min="0" step="0.01" value={productForm.minStock} onChange={e => setProductForm({ ...productForm, minStock: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{editingProduct ? 'تحديث' : 'إضافة'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warehouse Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editingWarehouse ? 'تعديل مخزن' : 'إضافة مخزن جديد'}</h2>
              <button onClick={() => setShowWarehouseModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveWarehouse} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
                  <input type="text" required value={warehouseForm.code} onChange={e => setWarehouseForm({ ...warehouseForm, code: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم العربي *</label>
                  <input type="text" required value={warehouseForm.nameAr} onChange={e => setWarehouseForm({ ...warehouseForm, nameAr: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الإنجليزي</label>
                  <input type="text" value={warehouseForm.nameEn} onChange={e => setWarehouseForm({ ...warehouseForm, nameEn: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
                  <input type="tel" value={warehouseForm.phone} onChange={e => setWarehouseForm({ ...warehouseForm, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المسؤول</label>
                  <input type="text" value={warehouseForm.manager} onChange={e => setWarehouseForm({ ...warehouseForm, manager: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <textarea rows={2} value={warehouseForm.address} onChange={e => setWarehouseForm({ ...warehouseForm, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{editingWarehouse ? 'تحديث' : 'إضافة'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
