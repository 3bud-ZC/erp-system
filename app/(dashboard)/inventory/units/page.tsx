'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Save,
  Copy,
  Trash,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

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

interface Unit {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [formData, setFormData] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      setError(null);
      // For now, use local data or fetch from API
      const res = await fetch('/api/units').catch(() => ({ ok: true, json: async () => [] }));
      if (res.ok) {
        const data = await res.json();
        setUnits(Array.isArray(data) ? data : []);
      } else {
        setUnits([]);
      }
    } catch (err) {
      console.error('Error fetching units:', err);
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = units.filter((u) =>
    u.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingUnit ? 'PUT' : 'POST';
      const body = editingUnit ? { id: editingUnit.id, ...formData } : formData;

      const res = await fetch('/api/units', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => ({ ok: true }));

      if (!res.ok) throw new Error('فشل في حفظ الوحدة');

      resetForm();
      setIsFormOpen(false);
      setEditingUnit(null);
      fetchUnits();
    } catch (err) {
      console.error('Error saving unit:', err);
      alert(err instanceof Error ? err.message : 'خطأ في حفظ الوحدة');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      nameAr: '',
      nameEn: '',
    });
  };

  const handleNew = () => {
    resetForm();
    setEditingUnit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      code: unit.code,
      nameAr: unit.nameAr,
      nameEn: unit.nameEn || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (unit: Unit) => {
    if (confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
      await fetch(`/api/units?id=${unit.id}`, { method: 'DELETE' }).catch(() => ({ ok: true }));
      fetchUnits();
    }
  };

  const handleSave = () => {
    const form = document.getElementById('unit-form') as HTMLFormElement;
    if (form) form.requestSubmit();
  };

  const handleCopy = () => {
    if (editingUnit) {
      setFormData({ ...formData, code: '' });
      setEditingUnit(null);
    }
  };

  const handleDeleteCurrent = () => {
    if (editingUnit && confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
      handleDelete(editingUnit);
      setIsFormOpen(false);
    }
  };

  const handleNavigate = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (filteredUnits.length === 0) return;

    let newIndex = currentIndex;
    switch (direction) {
      case 'first':
        newIndex = 0;
        break;
      case 'prev':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'next':
        newIndex = Math.min(filteredUnits.length - 1, currentIndex + 1);
        break;
      case 'last':
        newIndex = filteredUnits.length - 1;
        break;
    }

    setCurrentIndex(newIndex);
    handleEdit(filteredUnits[newIndex]);
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
  }, [isFormOpen, editingUnit, formData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل الوحدات...</p>
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
            onClick={fetchUnits}
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
              <h1 className="text-2xl font-bold text-gray-900">الوحدات</h1>
              <p className="text-gray-500 text-sm mt-1">إدارة وحدات القياس</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                وحدة جديدة
              </button>
            </div>
          </div>

          {/* Search & Table */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">م</th>
                    <th className="px-4 py-3 font-semibold">كود</th>
                    <th className="px-4 py-3 font-semibold">الاسم العربي</th>
                    <th className="px-4 py-3 font-semibold">الاسم الانجليزي</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUnits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        لا توجد وحدات
                      </td>
                    </tr>
                  ) : (
                    filteredUnits.map((unit, index) => (
                      <tr key={unit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{unit.code}</td>
                        <td className="px-4 py-3">{unit.nameAr}</td>
                        <td className="px-4 py-3 text-gray-600">{unit.nameEn || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEdit(unit)}
                            className="text-blue-600 hover:text-blue-800 mr-2"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(unit)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
          {/* Form Header with Toolbar */}
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
                <NavButton icon={ChevronRight} onClick={() => handleNavigate('next')} disabled={currentIndex >= filteredUnits.length - 1} />
                <NavButton icon={ChevronsRight} onClick={() => handleNavigate('last')} disabled={currentIndex >= filteredUnits.length - 1} />
              </div>
              <button onClick={() => setIsFormOpen(false)} className="mr-4 text-lg">
                الوحدات
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="unit-form" onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden p-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">م</label>
                <input
                  type="text"
                  disabled
                  value={editingUnit ? currentIndex + 1 : 0}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-center text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">كود</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاسم العربي</label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-center">الاسم الانجليزي</label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <button type="submit" className="hidden">Submit</button>
          </form>
        </>
      )}
    </div>
  );
}
