'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import {
  Package,
  Warehouse,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ClipboardList,
} from 'lucide-react';
import { InventoryLayout } from '@/components/inventory/InventoryLayout';
import { KpiCard } from '@/components/accounting/AccountingLayout';

interface Product {
  id: string;
  name?: string;
  nameAr?: string;
  quantity?: number;
  minQuantity?: number;
  reorderLevel?: number;
  costPrice?: number;
  sellingPrice?: number;
  isActive?: boolean;
}
interface WarehouseItem {
  id: string;
  name?: string;
  nameAr?: string;
  isActive?: boolean;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

/**
 * Inventory hub.
 *
 * Landing page for the `/inventory` (المخازن) section — KPIs over products
 * and warehouses + nav cards into Products / Stock Adjustments / Warehouses.
 */
export default function InventoryHubPage() {
  const productsQ = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => apiGet<Product[]>('/api/products'),
    staleTime: 60_000,
  });
  const warehousesQ = useQuery({
    queryKey: queryKeys.warehouses,
    queryFn: () => apiGet<WarehouseItem[]>('/api/warehouses'),
    staleTime: 60_000,
  });

  const products   = useMemo(() => productsQ.data   ?? [], [productsQ.data]);
  const warehouses = useMemo(() => warehousesQ.data ?? [], [warehousesQ.data]);

  const stats = useMemo(() => {
    let stockValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const p of products) {
      const qty = Number(p.quantity ?? 0);
      const cost = Number(p.costPrice ?? 0);
      stockValue += qty * cost;
      const threshold = Number(p.minQuantity ?? p.reorderLevel ?? 0);
      if (qty <= 0) outOfStock++;
      else if (threshold > 0 && qty <= threshold) lowStock++;
    }
    const activeWarehouses = warehouses.filter(w => w.isActive !== false).length;
    return {
      productsCount: products.length,
      stockValue,
      lowStock,
      outOfStock,
      warehousesCount: warehouses.length,
      activeWarehouses,
    };
  }, [products, warehouses]);

  return (
    <InventoryLayout
      title="المخازن"
      subtitle="إدارة المنتجات وتسويات المخزون والمستودعات"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي المنتجات"
          value={stats.productsCount}
          subtitle={`${stats.warehousesCount} مستودع`}
          icon={Package}
          color="blue"
        />
        <KpiCard
          title="قيمة المخزون"
          value={fmtMoney(stats.stockValue)}
          icon={DollarSign}
          color="green"
        />
        <KpiCard
          title="منتجات منخفضة"
          value={stats.lowStock}
          subtitle="وصلت لحد إعادة الطلب"
          icon={AlertTriangle}
          color="amber"
        />
        <KpiCard
          title="منتجات نفدت"
          value={stats.outOfStock}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NavCard
          href="/inventory/products"
          title="المنتجات"
          description="إدارة كتالوج المنتجات والأسعار وكميات المخزون"
          icon={Package}
          stat={`${stats.productsCount} منتج`}
          accentClass="bg-blue-50 text-blue-600"
        />
        <NavCard
          href="/warehouses"
          title="المستودعات"
          description="إدارة المستودعات وتفعيلها وإيقافها"
          icon={Warehouse}
          stat={`${stats.warehousesCount} مستودع · ${stats.activeWarehouses} نشط`}
          accentClass="bg-purple-50 text-purple-600"
        />
        <NavCard
          href="/inventory/stock-adjustments"
          title="تسوية المخزون"
          description="تعديل أرصدة المخزون دي بسبب تالف، فاقد، أو فارق جرد"
          icon={ClipboardList}
          stat="تسجيل تسوية جديدة"
          accentClass="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Stock health snapshot */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">صحة المخزون</h3>
        <div className="grid grid-cols-3 gap-3">
          <HealthBadge
            label="بحالة جيدة"
            value={stats.productsCount - stats.lowStock - stats.outOfStock}
            icon={CheckCircle}
            tone="green"
          />
          <HealthBadge
            label="منخفض"
            value={stats.lowStock}
            icon={AlertTriangle}
            tone="amber"
          />
          <HealthBadge
            label="نفد"
            value={stats.outOfStock}
            icon={AlertTriangle}
            tone="red"
          />
        </div>
      </div>
    </InventoryLayout>
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

function HealthBadge({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'green' | 'amber' | 'red';
}) {
  const palette: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red:   'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-lg p-4 flex items-center gap-3 ${palette[tone]}`}>
      <Icon className="w-7 h-7" />
      <div>
        <p className="text-xs">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
