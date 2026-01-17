import Link from 'next/link';
import { Container } from '@/components/layout/Container';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted">
      <Container>
        <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold text-primary mb-4">MANGU</h3>
            <p className="text-sm text-secondary">
              Your digital publishing platform for discovering and reading great books.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">For Readers</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/books" className="hover:text-primary transition-colors">
                  Browse Books
                </Link>
              </li>
              <li>
                <Link href="/genres" className="hover:text-primary transition-colors">
                  Genres
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-primary transition-colors">
                  Discover
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">For Authors</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/author/submit" className="hover:text-primary transition-colors">
                  Submit Manuscript
                </Link>
              </li>
              <li>
                <Link href="/author/dashboard" className="hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
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
