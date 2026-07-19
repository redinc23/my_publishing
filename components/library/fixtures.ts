import type { BookWithAuthor } from '@/types';
import type { LibraryItem } from './types';

/**
 * DEV-ONLY fixtures for the Cinema Library preview route
 * (app/dev/library-preview — 404s in production). Never imported by
 * production pages; used purely for local visual verification.
 *
 * Progress values below use the 0..1 fraction convention; production
 * currently writes 0..100 — the UI (toProgressPercent) tolerates both.
 */

function fixtureBook(
  n: number,
  title: string,
  authorName: string,
  genre: string,
  description: string
): BookWithAuthor {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return {
    id: `dev-book-${n}`,
    title,
    slug,
    description,
    cover_url: `https://picsum.photos/seed/${n}/400/600`,
    author_id: `dev-author-${n}`,
    status: 'published',
    visibility: 'public',
    price: 12.99,
    currency: 'USD',
    genre,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    author: {
      id: `dev-author-${n}`,
      pen_name: authorName,
      profile: { full_name: authorName },
    },
  };
}

function fixtureItem(
  n: number,
  title: string,
  authorName: string,
  genre: string,
  description: string,
  purchasedAt: string,
  progress?: LibraryItem['progress']
): LibraryItem {
  return {
    book: fixtureBook(n, title, authorName, genre, description),
    orderNumber: `MNG-DEV-${1000 + n}`,
    purchasedAt,
    ...(progress ? { progress } : {}),
  };
}

/** 10 purchased books, latest purchase first: 3 in-progress, 2 finished. */
export const libraryFixtures: LibraryItem[] = [
  fixtureItem(
    1,
    'The Salt Road',
    'Amara Okonkwo',
    'Literary Fiction',
    'Two estranged sisters retrace their grandmother’s journey across the Harmattan trade routes.',
    '2024-05-02T10:15:00.000Z',
    { currentPosition: 0.47, isFinished: false, lastAccessed: '2024-05-18T19:42:00.000Z' }
  ),
  fixtureItem(
    2,
    'Terraforming Tuesday',
    'Ada Reyes',
    'Science Fiction',
    'A municipal gardener on Mars discovers the planet’s first unlicensed forest.',
    '2024-04-27T14:03:00.000Z',
    { currentPosition: 0.81, isFinished: false, lastAccessed: '2024-05-12T22:03:00.000Z' }
  ),
  fixtureItem(
    3,
    'Bone Orchid',
    'Margot Vance',
    'Horror',
    'A botanical illustrator inherits a greenhouse where the flowers grow toward voices.',
    '2024-04-19T09:30:00.000Z',
    { currentPosition: 0.12, isFinished: false, lastAccessed: '2024-05-15T08:10:00.000Z' }
  ),
  fixtureItem(
    4,
    "The Archivist's Daughter",
    'Ingrid Halvorsen',
    'Historical Fiction',
    'Oslo, 1943. A forger’s apprentice hides the town’s memory one document at a time.',
    '2024-03-28T16:45:00.000Z',
    { currentPosition: 1, isFinished: true, lastAccessed: '2024-04-30T21:12:00.000Z' }
  ),
  fixtureItem(
    5,
    'Midnight at the Print Shop',
    'Sam Delacroix',
    'Mystery',
    'A night-shift typesetter finds a chapter of tomorrow’s newspaper already set in lead.',
    '2024-03-11T11:20:00.000Z',
    { currentPosition: 1, isFinished: true, lastAccessed: '2024-04-02T23:58:00.000Z' }
  ),
  fixtureItem(
    6,
    'A Field Guide to Falling',
    'Theo Marchetti',
    'Romance',
    'A storm chaser and a lighthouse keeper map every way two people can collide.',
    '2024-02-22T08:05:00.000Z'
  ),
  fixtureItem(
    7,
    'Cartography of Ghosts',
    'Ellis Watanabe',
    'Fantasy',
    'The last mapmaker of a sinking archipelago charts islands that only appear in memories.',
    '2024-02-10T19:55:00.000Z'
  ),
  fixtureItem(
    8,
    'The Long Table',
    'Priya Raman',
    'Memoir',
    'Four generations of recipes, arguments, and reconciliations around one family table.',
    '2024-01-25T13:40:00.000Z'
  ),
  fixtureItem(
    9,
    'Static Bloom',
    'Riley Chen',
    'Science Fiction',
    'A late-night radio host receives broadcasts from a town that burned down years ago.',
    '2024-01-12T07:25:00.000Z'
  ),
  fixtureItem(
    10,
    'Notes on a Vanishing Coast',
    'Daniel Osei',
    'Nature Writing',
    'A year walking the eroding shoreline, recording what the tide takes and what it leaves.',
    '2023-12-30T18:10:00.000Z'
  ),
];
