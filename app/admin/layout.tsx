/* eslint-disable */
import { requireAdmin } from '@/lib/middleware/auth';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/Sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    // This will redirect to login if not authenticated, or to home if not admin
    const { user, profile } = await requireAdmin();

    // Double-check admin role (defense in depth)
    if (profile.role !== 'admin') {
      redirect('/');
    }

    return (
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    );
  } catch (error) {
    console.error('Error in admin layout:', error);
    redirect('/');
  }
}
