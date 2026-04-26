'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Users, Building2, ArrowLeft, FileText, ShoppingCart } from 'lucide-react';
import { ServicesLayout } from '@/components/services/ServicesLayout';
import { KpiCard } from '@/components/accounting/AccountingLayout';

interface Customer {
  id: string;
  balance?: number;
  creditLimit?: number;
}
interface Supplier {
  id: string;
  balance?: number;
}
interface SalesInvoice  { customerId: string; total?: number; grandTotal?: number }
interface PurchaseInvoice { supplierId: string; total?: number; grandTotal?: number }

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

/**
 * Services hub.
 *
 * Landing page for the `/services` section — totals + nav cards for the
 * Customers and Suppliers sub-pages.
 */
export default function ServicesHubPage() {
  const customersQ = useQuery({
    queryKey: queryKeys.customers,
    queryFn: () => apiGet<Customer[]>('/api/customers'),
    staleTime: 60_000,
  });
  const suppliersQ = useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => apiGet<Supplier[]>('/api/suppliers'),
    staleTime: 60_000,
  });
  const salesQ = useQuery({
    queryKey: ['services', 'sales-summary'],
    queryFn: () => apiGet<SalesInvoice[]>('/api/sales-invoices'),
    staleTime: 60_000,
  });
  const purchasesQ = useQuery({
    queryKey: ['services', 'purchases-summary'],
    queryFn: () => apiGet<PurchaseInvoice[]>('/api/purchase-invoices'),
    staleTime: 60_000,
  });

  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);
  const suppliers = useMemo(() => suppliersQ.data ?? [], [suppliersQ.data]);
  const sales     = useMemo(() => salesQ.data     ?? [], [salesQ.data]);
  const purchases = useMemo(() => purchasesQ.data ?? [], [purchasesQ.data]);

  const stats = useMemo(() => {
    // Active customers = those with at least one sales invoice.
    const activeCustomers = new Set(sales.map(s => s.customerId).filter(Boolean));
    const activeSuppliers = new Set(purchases.map(p => p.supplierId).filter(Boolean));

    const totalCustomerBalance = customers.reduce(
      (s, c) => s + Number(c.balance ?? 0),
      0,
    );
    const totalSupplierBalance = suppliers.reduce(
      (s, p) => s + Number(p.balance ?? 0),
      0,
    );

    return {
      customers: customers.length,
      suppliers: suppliers.length,
      activeCustomers: activeCustomers.size,
      activeSuppliers: activeSuppliers.size,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      customerBalance: totalCustomerBalance,
      supplierBalance: totalSupplierBalance,
    };
  }, [customers, suppliers, sales, purchases]);

  return (
    <ServicesLayout
      title="الخدمات"
      subtitle="إدارة العملاء والموردين في مكان واحد"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="العملاء"
          value={stats.customers}
          subtitle={`${stats.activeCustomers} نشط`}
          icon={Users}
          color="blue"
        />
        <KpiCard
          title="الموردون"
          value={stats.suppliers}
          subtitle={`${stats.activeSuppliers} نشط`}
          icon={Building2}
          color="purple"
        />
        <KpiCard
          title="فواتير المبيعات"
          value={stats.salesCount}
          icon={FileText}
          color="green"
        />
        <KpiCard
          title="فواتير المشتريات"
          value={stats.purchasesCount}
          icon={ShoppingCart}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NavCard
          href="/customers"
          title="العملاء"
          description="إدارة بيانات العملاء، الحدود الائتمانية، وأرصدتهم الجارية"
          icon={Users}
          stat={`${stats.customers} عميل · ${fmtMoney(stats.customerBalance)} رصيد إجمالي`}
          accentClass="bg-blue-50 text-blue-600"
        />
        <NavCard
          href="/suppliers"
          title="الموردون"
          description="إدارة بيانات الموردين وأرصدة الذمم الدائنة"
          icon={Building2}
          stat={`${stats.suppliers} مورد · ${fmtMoney(stats.supplierBalance)} رصيد إجمالي`}
          accentClass="bg-purple-50 text-purple-600"
        />
      </div>
    </ServicesLayout>
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
