import Link from 'next/link';
import { Container } from '@/components/layout/Container';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted">
      <Container>
        <div className="grid grid-cols-1 gap-8 py-12 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-xl font-bold text-primary">MANGU</h3>
            <p className="text-sm text-secondary">
              Your digital publishing platform for discovering and reading great books.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">For Readers</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/books" className="transition-colors hover:text-primary">
                  Browse Books
                </Link>
              </li>
              <li>
                <Link href="/genres" className="transition-colors hover:text-primary">
                  Genres
                </Link>
              </li>
              <li>
                <Link href="/discover" className="transition-colors hover:text-primary">
                  Discover
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">For Authors</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/author/submit" className="transition-colors hover:text-primary">
                  Submit Manuscript
                </Link>
              </li>
              <li>
                <Link href="/author/dashboard" className="transition-colors hover:text-primary">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/about" className="transition-colors hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-primary">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-6 text-center text-sm text-secondary">
          <p>&copy; {new Date().getFullYear()} MANGU Platform. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
