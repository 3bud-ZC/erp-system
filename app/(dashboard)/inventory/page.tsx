'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  AlertTriangle,
  Package,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Edit,
  Trash2,
  RefreshCw,
  Boxes,
  TrendingDown,
  DollarSign,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calculator,
  CreditCard,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  branch?: string;
  accountNumber?: string;
  costOfSales?: number;
  inventoryDepreciation?: number;
  inventoryAdjustment?: number;
  cardByRoute?: string;
}

// Toolbar Button Component
function ToolbarButton({ label, shortcut, icon: Icon, color, onClick }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-emerald-500 hover:bg-emerald-600',
    red: 'bg-red-500 hover:bg-red-600',
    gray: 'bg-gray-500 hover:bg-gray-600',
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{label}</span>
      {shortcut && <span className="text-xs opacity-75">{shortcut}</span>}
    </button>
  );
}

// Navigation Button
function NavButton({ icon: Icon, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Stats Card Component
function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'raw' | 'finished' | 'packaging'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);

  // Form states - redesigned to match image
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'raw',
    branch: '',
    unit: 'كجم',
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 0,
    accountNumber: '',
    costOfSales: 0,
    inventoryDepreciation: 0,
    inventoryAdjustment: 0,
    cardByRoute: '',
  });

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

  const handleSort = (key: keyof Product) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProducts = products
    .filter((p) => {
      const matchesSearch =
        p.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || p.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.cost, 0);

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

      setIsFormOpen(false);
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
      type: 'raw',
      branch: '',
      unit: 'كجم',
      price: 0,
      cost: 0,
      stock: 0,
      minStock: 0,
      accountNumber: '',
      costOfSales: 0,
      inventoryDepreciation: 0,
      inventoryAdjustment: 0,
      cardByRoute: '',
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      nameAr: product.nameAr,
      nameEn: product.nameEn || '',
      type: product.type,
      branch: product.branch || '',
      unit: product.unit,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      minStock: product.minStock,
      accountNumber: product.accountNumber || '',
      costOfSales: product.costOfSales || 0,
      inventoryDepreciation: product.inventoryDepreciation || 0,
      inventoryAdjustment: product.inventoryAdjustment || 0,
      cardByRoute: product.cardByRoute || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      fetchProducts();
    }
  };

  const handleNew = () => {
    resetForm();
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleSave = () => {
    // Trigger form submission
    const form = document.getElementById('product-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleCopy = () => {
    if (editingProduct) {
      setFormData({ ...formData, code: '', nameAr: formData.nameAr + ' (نسخة)' });
      setEditingProduct(null);
    }
  };

  const handleDeleteCurrent = () => {
    if (editingProduct && confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      handleDelete(editingProduct);
      setIsFormOpen(false);
    }
  };

  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (filteredProducts.length === 0) return;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(filteredProducts.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = filteredProducts.length - 1;
        break;
    }
    
    setCurrentIndex(newIndex);
    handleEdit(filteredProducts[newIndex]);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      raw: 'خامة',
      finished: 'منتج نهائي',
      packaging: 'تعبئة',
      raw_material: 'خامة',
      finished_product: 'منتج نهائي',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      raw: 'bg-blue-100 text-blue-700',
      finished: 'bg-green-100 text-green-700',
      packaging: 'bg-orange-100 text-orange-700',
      raw_material: 'bg-blue-100 text-blue-700',
      finished_product: 'bg-green-100 text-green-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFormOpen) return;
      
      if (e.key === 'F7') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleCopy();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleDeleteCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, editingProduct, formData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isFormOpen ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">المخازن</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة المنتجات والمخزون</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                إضافة منتج
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي المنتجات"
              value={products.length}
              subtitle="منتج في النظام"
              icon={Boxes}
              color="bg-blue-500"
            />
            <StatCard
              title="الخامات"
              value={products.filter((p) => p.type === 'raw' || p.type === 'raw_material').length}
              subtitle="مادة خام"
              icon={Package}
              color="bg-indigo-500"
            />
            <StatCard
              title="المنتجات النهائية"
              value={products.filter((p) => p.type === 'finished' || p.type === 'finished_product').length}
              subtitle="منتج جاهز"
              icon={Package}
              color="bg-green-500"
            />
            <StatCard
              title="قيمة المخزون"
              value={formatCurrency(totalValue)}
              subtitle="التكلفة الإجمالية"
              icon={DollarSign}
              color="bg-emerald-500"
            />
          </div>

          {/* Low Stock Alert */}
          {lowStockCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <p className="text-red-700 font-medium text-sm">
                تنبيه: {lowStockCount} منتج أقل من الحد الأدنى للمخزون
              </p>
              <Link href="/warehouse" className="mr-auto text-red-600 text-sm hover:underline">
                عرض المخزن
              </Link>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث في المنتجات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="all">جميع الأنواع</option>
                  <option value="raw">خامات</option>
                  <option value="finished">منتجات نهائية</option>
                  <option value="packaging">تعبئة</option>
                </select>
              </div>

              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-600">
                <Download className="w-4 h-4" />
                تصدير
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center gap-1">
                        الكود
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('nameAr')}
                    >
                      <div className="flex items-center gap-1">
                        الاسم
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">النوع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الوحدة</th>
                    <th
                      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center gap-1">
                        المخزون
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الحد الأدنى</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">التكلفة</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">سعر البيع</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        لا توجد منتجات مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{product.code}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{product.nameAr}</p>
                            {product.nameEn && <p className="text-xs text-gray-500">{product.nameEn}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(product.type)}`}>
                            {getTypeLabel(product.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{product.unit}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              product.stock <= product.minStock ? 'text-red-600' : 'text-gray-900'
                            }`}
                          >
                            {product.stock.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{product.minStock}</td>
                        <td className="px-4 py-3 text-gray-600">{formatCurrency(product.cost)}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{formatCurrency(product.price)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(product)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Form Header with Toolbar - Matching the image design */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ToolbarButton label="حفظ" shortcut="F7" icon={Save} color="blue" onClick={handleSave} />
                <ToolbarButton label="نسخ" shortcut="F8" icon={Copy} color="green" onClick={handleCopy} />
                <ToolbarButton label="حذف" shortcut="F9" icon={Trash} color="red" onClick={handleDeleteCurrent} />
              </div>
              <div className="flex items-center gap-2">
                <NavButton icon={ChevronsLeft} onClick={() => handleNavigate('first')} disabled={currentIndex === 0} />
                <NavButton icon={ChevronLeft} onClick={() => handleNavigate('prev')} disabled={currentIndex === 0} />
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= filteredProducts.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= filteredProducts.length - 1} />
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="mr-4 text-white hover:text-gray-200"
              >
                <span className="text-lg">المخازن</span>
              </button>
            </div>
          </div>

          {/* Form Content - Matching image layout */}
          <form id="product-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* First Row */}
            <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">م</label>
                <input
                  type="text"
                  disabled
                  value={editingProduct ? currentIndex + 1 : 0}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-center text-sm"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">كود</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-center"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الفرع</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="">الفرع الرئيسي</option>
                  <option value="branch1">فرع 1</option>
                  <option value="branch2">فرع 2</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">نوع المخزن</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="raw">خامة</option>
                  <option value="finished">منتج نهائي</option>
                  <option value="packaging">تعبئة</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاسم العربي</label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Second Row - Names */}
            <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاسم العربي</label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاسم الانجليزي</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Accounting Section Header */}
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500"></div>
              <span className="font-bold text-gray-700">الحسابات</span>
              <Calculator className="w-4 h-4 text-blue-500 mr-auto" />
            </div>

            {/* Accounting Fields */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">رقم الحساب</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">تكلفة المبيعات</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.costOfSales}
                  onChange={(e) => setFormData({ ...formData, costOfSales: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">اهلاك مخزني</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.inventoryDepreciation}
                  onChange={(e) => setFormData({ ...formData, inventoryDepreciation: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">تسوية المخزون</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.inventoryAdjustment}
                  onChange={(e) => setFormData({ ...formData, inventoryAdjustment: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* More Info */}
            <div className="grid grid-cols-3 gap-4 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">بطاقه بالطريق</label>
                <input
                  type="text"
                  value={formData.cardByRoute}
                  onChange={(e) => setFormData({ ...formData, cardByRoute: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الوحدة</label>
                <input
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">السعر</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Hidden submit button */}
            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
