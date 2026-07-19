import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LibraryExperience } from '@/components/library/LibraryExperience';
import { libraryFixtures } from '@/components/library/fixtures';

export const metadata: Metadata = {
  title: 'Library Preview (Dev)',
  robots: { index: false, follow: false },
};

/**
 * Dev-only visual verification of the Cinema Library without Supabase.
 * Ships in the branch intentionally as a dev tool; 404s in production.
 */
export default function LibraryPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#12100e]">
      <LibraryExperience items={libraryFixtures} />
    </div>
  );
}
