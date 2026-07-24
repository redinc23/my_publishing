/**
 * Feature flag registry (P-057).
 *
 * Flag-off contract: when a flag is off —
 *   - its routes return an HONEST unavailable page
 *   - its nav entries are hidden
 *   - its API routes return 404
 *   - its sitemap entries are dropped
 *
 * Never a broken page, never a dead link.
 *
 * Each flag: owner · default · environments · expiry · rollback
 */

/** Comics catalog and reader. Default OFF until catalog has comic content. */
export const FEATURE_COMICS = process.env.FEATURE_COMICS === 'true';

/** Academic papers catalog and viewer. Default OFF until catalog has paper content. */
export const FEATURE_PAPERS = process.env.FEATURE_PAPERS === 'true';

/** Audiobook catalog and player. Default OFF until catalog has audiobook content. */
export const FEATURE_AUDIO = process.env.FEATURE_AUDIO === 'true';

/**
 * Reviews and ratings. Default OFF — "coming-soon only" per NEXT_GO.md A7.
 * Honest coming-soon state; no silent-failing submit path.
 */
export const FEATURE_REVIEWS = process.env.FEATURE_REVIEWS === 'true';

/** Book clubs and group reading. Default OFF — no hosted clubs exist yet. */
export const FEATURE_BOOK_CLUBS = process.env.FEATURE_BOOK_CLUBS === 'true';

/** Wishlist. Default OFF until library/entitlement is complete (P-018). */
export const FEATURE_WISHLIST = process.env.FEATURE_WISHLIST === 'true';

/**
 * Author follows. Default OFF — follow data layer exists (author_follows table,
 * /api/follows) but there is no destination for what following produces.
 * A follow button with no observable outcome is a MISLEADING surface.
 */
export const FEATURE_FOLLOWS = process.env.FEATURE_FOLLOWS === 'true';
