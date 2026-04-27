'use client';

import Link from 'next/link';
import {
  TrendingUp, ShoppingCart, Package, BookOpen, Users, Truck,
  Clock, Receipt, Factory, ChevronLeft, BarChart3,
} from 'lucide-react';
import { ReportsLayout } from '@/components/reports/ReportsLayout';

const REPORTS = [
  {
    href: '/reports/sales', title: 'تقرير المبيعات',
    description: 'فواتير المبيعات حسب الفترة والعميل والمنتج',
    icon: TrendingUp, accent: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/reports/purchases', title: 'تقرير المشتريات',
    description: 'فواتير المشتريات حسب الفترة والمورد',
    icon: ShoppingCart, accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    href: '/reports/inventory', title: 'تقرير المخازن',
    description: 'أرصدة المخزون وقيمته وحدود إعادة الطلب',
    icon: Package, accent: 'bg-amber-50 text-amber-600',
  },
  {
    href: '/reports/expenses', title: 'تقرير المصروفات',
    description: 'المصروفات حسب الفترة والتصنيف وطريقة الدفع',
    icon: Receipt, accent: 'bg-red-50 text-red-600',
  },
  {
    href: '/reports/customer-statement', title: 'كشف حساب عميل',
    description: 'فواتير ومدفوعات ورصيد عميل محدد',
    icon: Users, accent: 'bg-indigo-50 text-indigo-600',
  },
  {
    href: '/reports/supplier-statement', title: 'كشف حساب مورد',
    description: 'فواتير ومدفوعات ورصيد مورد محدد',
    icon: Truck, accent: 'bg-purple-50 text-purple-600',
  },
  {
    href: '/reports/aging', title: 'تقرير الأعمار',
    description: 'تحليل الذمم حسب فترات الاستحقاق',
    icon: Clock, accent: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/reports/profit-loss', title: 'قائمة الدخل',
    description: 'الإيرادات والمصروفات وصافي الربح للفترة',
    icon: BookOpen, accent: 'bg-cyan-50 text-cyan-600',
  },
  {
    href: '/reports/balance-sheet', title: 'الميزانية العمومية',
    description: 'الأصول والخصوم وحقوق الملكية في تاريخ معين',
    icon: BarChart3, accent: 'bg-teal-50 text-teal-600',
  },
  {
    href: '/reports/manufacturing', title: 'تقرير التصنيع',
    description: 'أوامر الإنتاج، الفاقد، والتكاليف الصناعية',
    icon: Factory, accent: 'bg-pink-50 text-pink-600',
  },
];

export default function ReportsHubPage() {
  return (
    <ReportsLayout
      title="التقارير"
      subtitle="اختر التقرير المناسب لاستعراضه أو طباعته"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map(r => (
          <Link key={r.href} href={r.href}
            className="group bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all p-5 flex items-start gap-4"
          >
            <div className={`w-11 h-11 rounded-xl ${r.accent} flex items-center justify-center flex-shrink-0`}>
              <r.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{r.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.description}</p>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0 mt-2" />
          </Link>
        ))}
      </div>
    </ReportsLayout>
  );
}
