import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { EmptyLibrary } from '@/components/library/EmptyLibrary';

export const metadata: Metadata = {
  title: 'Library Preview — Empty (Dev)',
  robots: { index: false, follow: false },
};

/** Dev-only preview of the library empty state on the cinematic canvas. */
export default function EmptyLibraryPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#12100e] text-[#f5f1ea]">
      <h1 className="sr-only">Your Library</h1>
      <EmptyLibrary />
    </div>
  );
}
