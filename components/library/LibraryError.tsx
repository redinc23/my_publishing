'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LibraryErrorProps {
  /** The real error message — shown to the user, never swallowed. */
  message: string;
}

/**
 * Warm, honest error state for the library: the real message plus a
 * "Try again" action that reloads the page (re-running the server queries).
 */
export function LibraryError({ message }: LibraryErrorProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6 py-24">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#1a1714] p-8 text-center md:p-10">
        <AlertTriangle className="mx-auto h-10 w-10 text-[#f5b942]" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-semibold text-[#f5f1ea] md:text-2xl">
          We couldn&apos;t load your library
        </h2>
        <p role="alert" className="mt-3 text-sm text-stone-400">
          {message}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-[#e5484d] px-8 text-white hover:bg-[#f2555a]"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
