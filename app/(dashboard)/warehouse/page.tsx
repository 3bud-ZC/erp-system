'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import EnhancedTable from '@/components/EnhancedTable';
import MobileTable from '@/components/MobileTable';
import EnhancedModal from '@/components/EnhancedModal';
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function WarehousePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    quantity: 0,
    minQuantity: 0,
    maxQuantity: 1000,
    unit: 'piece',
    location: '',
    category: '',
    price: 0,
    supplier: '',
    lastUpdated: new Date().toISOString(),
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // Mock data for demonstration
    setProducts([
      {
        id: '1',
        code: 'PL-001',
        nameAr: 'أكياس بلاستيك',
        nameEn: 'Plastic Bags',
        quantity: 500,
        minQuantity: 100,
        maxQuantity: 2000,
        unit: 'piece',
        location: 'A-1-1',
        category: 'bags',
        price: 2.50,
        supplier: 'مورد أ',
        lastUpdated: new Date().toISOString(),
        status: 'normal'
      },
      {
        id: '2',
        code: 'PL-002',
        nameAr: 'زجاجات بلاستيك',
        nameEn: 'Plastic Bottles',
        quantity: 80,
        minQuantity: 100,
        maxQuantity: 1500,
        unit: 'piece',
        location: 'B-2-3',
        category: 'bottles',
        price: 1.80,
        supplier: 'مورد ب',
        lastUpdated: new Date().toISOString(),
        status: 'low'
      },
      {
        id: '3',
        code: 'PL-003',
        nameAr: 'صناديق بلاستيك',
        nameEn: 'Plastic Containers',
        quantity: 1200,
        minQuantity: 200,
        maxQuantity: 3000,
        unit: 'piece',
        location: 'C-1-2',
        category: 'containers',
        price: 5.20,
        supplier: 'مورد ج',
        lastUpdated: new Date().toISOString(),
        status: 'normal'
      },
      {
        id: '4',
        code: 'PL-004',
        nameAr: 'أنابيب بلاستيك',
        nameEn: 'Plastic Pipes',
        quantity: 250,
        minQuantity: 100,
        maxQuantity: 800,
        unit: 'meter',
        location: 'D-3-1',
        category: 'pipes',
        price: 12.00,
        supplier: 'مورد أ',
        lastUpdated: new Date().toISOString(),
        status: 'normal'
      },
      {
        id: '5',
        code: 'PL-005',
        nameAr: 'ألواح بلاستيك',
        nameEn: 'Plastic Sheets',
        quantity: 45,
        minQuantity: 50,
        maxQuantity: 500,
        unit: 'sheet',
        location: 'E-2-4',
        category: 'sheets',
        price: 25.00,
        supplier: 'مورد د',
        lastUpdated: new Date().toISOString(),
        status: 'critical'
      }
    ]);
  };

  const filteredProducts = products.filter(product =>
    product.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalProducts: products.length,
    lowStock: products.filter(p => p.status === 'low' || p.status === 'critical').length,
    totalValue: products.reduce((sum, p) => sum + (p.quantity * p.price), 0),
    categories: Array.from(new Set(products.map(p => p.category))).length
  };

  const columns = [
    { key: 'code', label: 'الكود', className: 'font-medium' },
    { key: 'nameAr', label: 'اسم المنتج', className: 'font-medium' },
    { key: 'quantity', label: 'الكمية', render: (value: any, row: any) => (
      <div className="flex items-center gap-2">
        <span className={`font-medium ${
          row.status === 'critical' ? 'text-red-600' : 
          row.status === 'low' ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {value} {row.unit === 'piece' ? 'قطعة' : row.unit === 'meter' ? 'متر' : row.unit === 'sheet' ? 'لوح' : row.unit}
        </span>
        {row.status === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500" />}
        {row.status === 'low' && <Clock className="w-4 h-4 text-yellow-500" />}
        {row.status === 'normal' && <CheckCircle className="w-4 h-4 text-green-500" />}
      </div>
    )},
    { key: 'location', label: 'الموقع' },
    { key: 'category', label: 'الفئة' },
    { key: 'price', label: 'السعر', render: (value: any) => `${value.toFixed(2)} ج.م` },
    { key: 'supplier', label: 'المورد' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      quantity: parseInt(formData.quantity.toString()),
      minQuantity: parseInt(formData.minQuantity.toString()),
      maxQuantity: parseInt(formData.maxQuantity.toString()),
      price: parseFloat(formData.price.toString()),
      lastUpdated: new Date().toISOString(),
    };

    if (selectedProduct) {
      setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, ...data } : p));
    } else {
      setProducts([...products, { ...data, id: Date.now().toString(), status: 'normal' }]);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
      quantity: 0,
      minQuantity: 0,
      maxQuantity: 1000,
      unit: 'piece',
      location: '',
      category: '',
      price: 0,
      supplier: '',
      lastUpdated: new Date().toISOString(),
    });
    setSelectedProduct(null);
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setFormData(product);
    setIsModalOpen(true);
  };

  const handleDelete = (product: any) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== product.id));
    }
  };

  const statsCards = [
    {
      title: 'إجمالي المنتجات',
      value: stats.totalProducts.toString(),
      icon: <Package className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: '5.2%', isPositive: true }
    },
    {
      title: 'تنبيهات المخزون المنخفض',
      value: stats.lowStock.toString(),
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'red' as const,
      trend: { value: '12.3%', isPositive: false }
    },
    {
      title: 'القيمة الإجمالية',
      value: `${stats.totalValue.toFixed(2)} ج.م`,
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: '8.7%', isPositive: true }
    },
    {
      title: 'الفئات',
      value: stats.categories.toString(),
      icon: <Package className="w-6 h-6" />,
      color: 'purple' as const,
      trend: { value: '2.1%', isPositive: true }
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">إدارة المخزن</h1>
            <p className="text-gray-600/80 text-lg">تتبع المخزون وإدارة المنتجات</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20">
              <Filter className="w-4 h-4" />
              <span className="font-medium">تصفية</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20">
              <Download className="w-4 h-4" />
              <span className="font-medium">تصدير</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة منتج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {statsCards.map((card, index) => (
          <div key={index} className="hidden lg:block">
            <EnhancedCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
              trend={card.trend}
            />
          </div>
        ))}
        {/* Mobile Cards */}
        <div className="lg:hidden">
          {statsCards.map((card, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">{card.title}</p>
                  <p className="text-lg font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${
                  card.color === 'blue' ? 'bg-blue-50' :
                  card.color === 'red' ? 'bg-red-50' :
                  card.color === 'green' ? 'bg-green-50' :
                  'bg-purple-50'
                }`}>
                  <div className={`${
                    card.color === 'blue' ? 'text-blue-600' :
                    card.color === 'red' ? 'text-red-600' :
                    card.color === 'green' ? 'text-green-600' :
                    'text-purple-600'
                  }`}>
                    {card.icon}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-all duration-300 group-hover:scale-110" />
            <input
              type="text"
              placeholder="البحث عن المنتجات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 group-hover:bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Products Table Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">قائمة المنتجات</h2>
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={columns} 
              data={filteredProducts} 
              searchable={false}
              onEdit={handleEdit}
              onDelete={handleDelete}
              className="shadow-xl"
            />
          </div>
          <div className="lg:hidden">
            <MobileTable 
              columns={columns} 
              data={filteredProducts} 
              searchable={false}
              onEdit={handleEdit}
              onDelete={handleDelete}
              className="shadow-xl"
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <EnhancedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">كود المنتج</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم العربي</label>
              <input
                type="text"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الإنجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الكمية</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الحد الأدنى</label>
              <input
                type="number"
                value={formData.minQuantity}
                onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الحد الأقصى</label>
              <input
                type="number"
                value={formData.maxQuantity}
                onChange={(e) => setFormData({ ...formData, maxQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الوحدة</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
              >
                <option value="piece">قطعة</option>
                <option value="meter">متر</option>
                <option value="kg">كيلوجرام</option>
                <option value="liter">لتر</option>
                <option value="box">صندوق</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الموقع</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الفئة</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">السعر (ج.م)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المورد</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 backdrop-blur-sm transition-all duration-300"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-white/20">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 bg-white/50 hover:bg-white/70 rounded-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-white/20 font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl font-medium"
            >
              {selectedProduct ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </EnhancedModal>
    </div>
  );
}
