import Link from 'next/link';
import { Navigation } from './Navigation';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              MANGU
            </Link>
            <Navigation />
          </div>
          <div className="flex items-center gap-4">
            <SearchBar />
            <UserMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
