import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to login page for authentication
  redirect('/login');
}
