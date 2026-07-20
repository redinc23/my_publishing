import { redirect } from 'next/navigation';

/**
 * Legacy discover URL — canonical honest surface is `/book-clubs` (E-001).
 * Keep this route so old links and sitemap entries do not show a hollow stub.
 */
export default function DiscoverBookClubsRedirect() {
  redirect('/book-clubs');
}
