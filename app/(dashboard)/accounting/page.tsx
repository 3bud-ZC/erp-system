'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import {
  BookOpen,
  Wallet,
  ListTree,
  Scale,
  TrendingDown,
  CheckCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { AccountingLayout, KpiCard } from '@/components/accounting/AccountingLayout';

interface JournalEntry {
  id: string;
  isPosted?: boolean;
  status?: 'DRAFT' | 'POSTED';
  totalDebit?: number;
  totalCredit?: number;
}
interface Expense {
  id: string;
  amount?: number;
  date?: string;
}
interface Account {
  id: string;
  isActive?: boolean;
}
interface TrialBalanceRow {
  debit: number;
  credit: number;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

/**
 * Accounting hub.
 *
 * Acts as the landing page for the unified `/accounting/*` section. Shows
 * top-line KPIs sourced from the journal-entries / expenses / accounts /
 * trial-balance APIs, and surfaces every sub-page as a clickable card.
 */
export default function AccountingHubPage() {
  const journalQ = useQuery({
    queryKey: queryKeys.journalEntries,
    queryFn: () => apiGet<JournalEntry[] | { entries: JournalEntry[] }>('/api/journal-entries'),
    staleTime: 60_000,
  });
  const expensesQ = useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => apiGet<Expense[]>('/api/expenses'),
    staleTime: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => apiGet<Account[]>('/api/accounting/accounts'),
    staleTime: 60_000,
    retry: false,
  });
  const trialQ = useQuery({
    queryKey: ['accounting', 'trial-balance'],
    queryFn: () => apiGet<TrialBalanceRow[]>('/api/accounting/trial-balance'),
    staleTime: 60_000,
    retry: false,
  });

  // Normalize JE response (server may wrap or return plain array).
  const entries = useMemo<JournalEntry[]>(() => {
    const raw = journalQ.data;
    if (Array.isArray(raw)) return raw;
    return raw?.entries ?? [];
  }, [journalQ.data]);

  const stats = useMemo(() => {
    let posted = 0, draft = 0;
    for (const e of entries) {
      const isPosted = typeof e.isPosted === 'boolean' ? e.isPosted : e.status === 'POSTED';
      if (isPosted) posted++; else draft++;
    }
    const expenses = expensesQ.data ?? [];
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);

    const monthStart = (() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    })();
    const monthExpenses = expenses
      .filter(e => e.date && new Date(e.date).getTime() >= monthStart)
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);

    const accounts = accountsQ.data ?? [];
    const activeAccounts = accounts.filter(a => a.isActive !== false).length;

    const trial = trialQ.data ?? [];
    const totalDebit = trial.reduce((s, r) => s + Number(r.debit ?? 0), 0);
    const totalCredit = trial.reduce((s, r) => s + Number(r.credit ?? 0), 0);
    const isBalanced = trial.length === 0 || Math.abs(totalDebit - totalCredit) < 0.01;

    return {
      totalEntries: entries.length,
      posted,
      draft,
      totalExpenses,
      monthExpenses,
      accountsCount: accounts.length,
      activeAccounts,
      totalDebit,
      totalCredit,
      isBalanced,
    };
  }, [entries, expensesQ.data, accountsQ.data, trialQ.data]);

  return (
    <AccountingLayout
      title="المحاسبة"
      subtitle="نظرة شاملة على القيود والمالية ودليل الحسابات وميزان المراجعة"
    >
      {/* Top-line KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="القيود المحاسبية"
          value={stats.totalEntries}
          subtitle={`${stats.posted} مرحّل · ${stats.draft} مسودة`}
          icon={BookOpen}
          color="blue"
        />
        <KpiCard
          title="مصروفات الشهر"
          value={fmtMoney(stats.monthExpenses)}
          subtitle={`الإجمالي: ${fmtMoney(stats.totalExpenses)}`}
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          title="دليل الحسابات"
          value={stats.accountsCount}
          subtitle={`${stats.activeAccounts} حساب نشط`}
          icon={ListTree}
          color="purple"
        />
        <KpiCard
          title="ميزان المراجعة"
          value={stats.isBalanced ? 'متوازن' : 'غير متوازن'}
          subtitle={`مدين ${fmtMoney(stats.totalDebit)} · دائن ${fmtMoney(stats.totalCredit)}`}
          icon={Scale}
          color={stats.isBalanced ? 'green' : 'amber'}
        />
      </div>

      {/* Sub-page navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NavCard
          href="/accounting/journal-entries"
          title="القيود المحاسبية"
          description="إنشاء وعرض القيود اليومية، الترحيل، العكس، وحذف المسودات"
          icon={BookOpen}
          stat={`${stats.totalEntries} قيد`}
          accentClass="bg-blue-50 text-blue-600"
        />
        <NavCard
          href="/accounting/finance"
          title="المالية والمصروفات"
          description="إدارة المصروفات والإيرادات والتصنيفات وطرق الدفع"
          icon={Wallet}
          stat={fmtMoney(stats.monthExpenses) + ' هذا الشهر'}
          accentClass="bg-red-50 text-red-600"
        />
        <NavCard
          href="/accounting/chart-of-accounts"
          title="دليل الحسابات"
          description="هيكل الحسابات الرئيسية والفرعية المستخدمة في القيود المحاسبية"
          icon={ListTree}
          stat={`${stats.accountsCount} حساب`}
          accentClass="bg-purple-50 text-purple-600"
        />
        <NavCard
          href="/accounting/trial-balance"
          title="ميزان المراجعة"
          description="إجمالي الأرصدة المدينة والدائنة لكل الحسابات في فترة محددة"
          icon={Scale}
          stat={stats.isBalanced ? 'متوازن ✓' : 'غير متوازن ⚠'}
          accentClass={stats.isBalanced ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}
        />
      </div>

      {/* Recent activity panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">حالة القيود</h3>
            <Link href="/accounting/journal-entries"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-green-700">مرحّلة</p>
                <p className="text-2xl font-bold text-green-700 tabular-nums">{stats.posted}</p>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-xs text-amber-700">مسودات</p>
                <p className="text-2xl font-bold text-amber-700 tabular-nums">{stats.draft}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">ملخص ميزان المراجعة</h3>
            <Link href="/accounting/trial-balance"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              عرض التفاصيل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 text-slate-600">إجمالي المدين</td>
                <td className="py-2 text-left font-semibold tabular-nums text-slate-900">
                  {fmtMoney(stats.totalDebit)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">إجمالي الدائن</td>
                <td className="py-2 text-left font-semibold tabular-nums text-slate-900">
                  {fmtMoney(stats.totalCredit)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">الفرق</td>
                <td className={`py-2 text-left font-semibold tabular-nums ${stats.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtMoney(Math.abs(stats.totalDebit - stats.totalCredit))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AccountingLayout>
  );
}

function NavCard({
  href,
  title,
  description,
  icon: Icon,
  stat,
  accentClass,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  stat: string;
  accentClass: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${accentClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          <p className="text-xs font-medium text-slate-700 mt-2">{stat}</p>
        </div>
        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all flex-shrink-0" />
      </div>
    </Link>
  );
}
