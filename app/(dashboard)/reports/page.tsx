import { redirect } from 'next/navigation';

/**
 * /reports → /reports/sales
 *
 * Reports were restructured into four focused sub-pages
 * (sales / purchases / customers / inventory) each with its own URL.
 * This stub keeps the old /reports route working by redirecting to
 * the sales report (the historical default tab).
 */
export default function ReportsIndexPage() {
  redirect('/reports/sales');
}
