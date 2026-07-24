import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Cinematic empty state for a library with no purchases.
 * Honest UI: no fake stats, no fabricated content — just the way forward.
 */
export function EmptyLibrary() {
  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden">
      {/* CSS-only backdrop: warm gradient + giant book watermark. */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1714] via-[#12100e] to-[#12100e]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="h-72 w-72 text-white/5" strokeWidth={1} />
        </div>
      </div>

      <div className="relative z-10 max-w-md px-6 py-24 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-amber-400/80" strokeWidth={1.5} />
        <h2 className="mt-4 text-4xl font-bold text-[#f5f1ea] md:text-5xl">
          Your shelf is waiting
        </h2>
        <p className="mt-4 text-stone-400">
          Books you purchase will appear here, ready to pick up right where you left off — on any
          device, any time.
        </p>
        <Button
          asChild
          className="mt-8 rounded-full bg-[#e5484d] px-8 text-white hover:bg-[#f2555a]"
        >
          <Link href="/books">Browse the catalog</Link>
        </Button>
      </div>
    </div>
  );
}
