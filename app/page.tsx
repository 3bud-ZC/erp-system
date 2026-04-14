import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect directly to dashboard (no auth required)
  redirect('/dashboard');
}
