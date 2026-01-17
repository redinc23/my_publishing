import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-primary">404</h1>
        <h2 className="mb-4 text-2xl font-bold">Page Not Found</h2>
        <p className="mb-8 text-lg text-secondary">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild variant="default">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
