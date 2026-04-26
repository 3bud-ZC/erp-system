'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import {
  ListTree,
  Plus,
  X,
  Search,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AccountingLayout, KpiCard } from '@/components/accounting/AccountingLayout';

interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
  subType?: string | null;
  balance: number | string;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'الأصول',
  liability: 'الالتزامات',
  equity: 'حقوق الملكية',
  revenue: 'الإيرادات',
  expense: 'المصروفات',
  ASSET: 'الأصول',
  LIABILITY: 'الالتزامات',
  EQUITY: 'حقوق الملكية',
  REVENUE: 'الإيرادات',
  EXPENSE: 'المصروفات',
};
const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-amber-50 text-amber-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700',
  expense: 'bg-red-50 text-red-700',
  ASSET: 'bg-blue-50 text-blue-700',
  LIABILITY: 'bg-amber-50 text-amber-700',
  EQUITY: 'bg-purple-50 text-purple-700',
  REVENUE: 'bg-green-50 text-green-700',
  EXPENSE: 'bg-red-50 text-red-700',
};

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

/**
 * Chart of Accounts page.
 *
 * Lists every Account row for the current tenant grouped by type, with
 * a search bar, a quick-add modal, and per-type KPIs. Wired to
 * GET / POST `/api/accounting/accounts`.
 */
export default function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const accountsQ = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => apiGet<Account[]>('/api/accounting/accounts'),
    staleTime: 60_000,
  });
  // Stable reference (avoids re-running the useMemo hooks on every render).
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const loading  = accountsQ.isLoading;
  const errMsg   = accountsQ.error ? (accountsQ.error as Error).message : null;

  // Filter + group by type
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.nameAr.toLowerCase().includes(q) ||
      (a.nameEn ?? '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const a of filtered) {
      const k = a.type || 'other';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // KPIs by type
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of accounts) {
      const k = (a.type || '').toLowerCase();
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }, [accounts]);

  return (
    <AccountingLayout
      title="دليل الحسابات"
      subtitle={loading ? 'جاري التحميل…' : `${accounts.length} حساب`}
      toolbar={
        <>
          <button
            onClick={() => accountsQ.refetch()}
            disabled={loading || accountsQ.isFetching}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${accountsQ.isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            حساب جديد
          </button>
        </>
      }
    >
      {errMsg && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* KPIs by type */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="الأصول"        value={counts.asset     || 0} icon={ListTree} color="blue"   />
        <KpiCard title="الالتزامات"    value={counts.liability || 0} icon={ListTree} color="amber"  />
        <KpiCard title="حقوق الملكية"  value={counts.equity    || 0} icon={ListTree} color="purple" />
        <KpiCard title="الإيرادات"      value={counts.revenue   || 0} icon={ListTree} color="green"  />
        <KpiCard title="المصروفات"      value={counts.expense   || 0} icon={ListTree} color="red"    />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث برقم الحساب أو الاسم…"
          className="w-full bg-white border border-slate-200 rounded-lg pr-10 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Accounts grouped by type */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400 text-sm">
          جاري التحميل…
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <ListTree className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">لا توجد حسابات بعد</p>
          <p className="text-sm text-slate-400 mt-1">ابدأ بإضافة الحسابات الأساسية لشركتك</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400 text-sm">
          لا توجد نتائج مطابقة
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([type, list]) => (
            <div key={type} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-700'}`}>
                    {TYPE_LABELS[type] ?? type}
                  </span>
                  <span className="text-xs text-slate-500">{list.length} حساب</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-slate-500 w-32">رمز الحساب</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-slate-500">الاسم</th>
                    <th className="px-5 py-2 text-right text-xs font-semibold text-slate-500 w-40">النوع الفرعي</th>
                    <th className="px-5 py-2 text-left text-xs font-semibold text-slate-500 w-40">الرصيد</th>
                    <th className="px-5 py-2 text-center text-xs font-semibold text-slate-500 w-24">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{a.code}</td>
                      <td className="px-5 py-2.5">
                        <div className="text-slate-900 font-medium">{a.nameAr}</div>
                        {a.nameEn && <div className="text-xs text-slate-500">{a.nameEn}</div>}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600 text-xs">{a.subType ?? '—'}</td>
                      <td className="px-5 py-2.5 text-left tabular-nums text-slate-700">
                        {fmtMoney(Number(a.balance ?? 0))}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {a.isActive ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">نشط</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">معطّل</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['accounting', 'accounts'] });
            setShowCreate(false);
          }}
        />
      )}
    </AccountingLayout>
  );
}

function CreateAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [type, setType] = useState('asset');
  const [subType, setSubType] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!code.trim() || !nameAr.trim() || !type) {
      setErr('رمز الحساب والاسم العربي والنوع كلها مطلوبة');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), nameAr, nameEn, type, subType }),
      });
      const j = await res.json();
      if (j.success) onSaved();
      else setErr(j.message || j.error || 'فشل الحفظ');
    } catch {
      setErr('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">حساب جديد</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {err && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رمز الحساب *</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="1001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالعربية *</label>
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="مثال: الصندوق" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالإنجليزية</label>
            <input value={nameEn} onChange={(e) => setNameEn(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Cash" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">النوع *</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="asset">الأصول</option>
              <option value="liability">الالتزامات</option>
              <option value="equity">حقوق الملكية</option>
              <option value="revenue">الإيرادات</option>
              <option value="expense">المصروفات</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">النوع الفرعي</label>
            <input value={subType} onChange={(e) => setSubType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="مثال: نقدية" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
