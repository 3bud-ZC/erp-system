import { redirect } from 'next/navigation';
// Legacy ERP route — permanently migrated to canonical path
// next.config.js handles the redirect before this component loads
export default function LegacyPage() { redirect('/dashboard'); }
