import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

export default function PortalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
