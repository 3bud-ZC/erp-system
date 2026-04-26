import { redirect } from 'next/navigation';

/**
 * `/finance` was consolidated into the unified `/accounting/*` section.
 * This stub keeps any old links / bookmarks working by forwarding to the
 * new home of the page (`/accounting/finance`).
 */
export default function FinanceRedirect() {
  redirect('/accounting/finance');
}
