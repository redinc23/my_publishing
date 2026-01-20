#!/usr/bin/env tsx
/**
 * Database Seeding Script
 * Populates the database with test data for development
 *
 * Usage:
 *   npm run db:seed
 *   npm run db:seed -- --minimal
 *   npm run db:seed -- --skip-embeddings
 *   npm run db:seed -- --create-profiles
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  minimal: args.includes('--minimal'),
  skipEmbeddings: args.includes('--skip-embeddings'),
  createProfiles: args.includes('--create-profiles'),
};

// Validate environment
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in .env.local');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let openai: OpenAI | null = null;
if (!options.skipEmbeddings && process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else if (!options.skipEmbeddings) {
  console.warn('⚠️  OPENAI_API_KEY not set. Skipping embeddings generation.');
  console.warn('   Use --skip-embeddings to suppress this warning.');
}

interface AuthorSeed {
  pen_name: string;
  bio: string;
  is_verified: boolean;
  genres: string[];
  awards?: string[];
  royalty_rate: number;
}

interface BookSeed {
  title: string;
  slug: string;
  description: string;
  genre: string;
  subgenres?: string[];
  author_id: string;
  price: number;
  discount_price?: number;
  is_featured: boolean;
  status: string;
  cover_url: string;
  trailer_vimeo_id?: string;
  page_count: number;
  word_count: number;
  average_rating: number;
  total_reads: number;
  total_reviews: number;
}

/**
 * Create test profiles via Supabase Auth API
 */
async function createTestProfiles(count: number): Promise<Array<{ id: string; user_id: string }>> {
  console.log(`\n👤 Creating ${count} test profiles...`);
  const profiles: Array<{ id: string; user_id: string }> = [];

  for (let i = 1; i <= count; i++) {
    const email = `test-user-${i}@mangu.test`;
    const password = 'TestPassword123!';
    const fullName = `Test User ${i}`;

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
        },
      });

      if (authError) {
        // User might already exist, try to fetch it
        const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
        if (existingUser?.user) {
          console.log(`   ✓ User ${i} already exists: ${email}`);
          // Get or create profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('user_id', existingUser.user.id)
            .single();

          if (profile) {
            profiles.push({ id: profile.id, user_id: profile.user_id });
            continue;
          }
        } else {
          console.error(`   ✗ Failed to create user ${i}:`, authError.message);
          continue;
        }
      }

      if (!authData?.user) {
        console.error(`   ✗ Failed to create user ${i}: No user data returned`);
        continue;
      }

      // Create profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          email,
          full_name: fullName,
          role: i === 1 ? 'admin' : i <= 3 ? 'author' : 'reader', // First user is admin, next 2 are authors
        })
        .select('id, user_id')
        .single();

      if (profileError) {
        console.error(`   ✗ Failed to create profile for user ${i}:`, profileError.message);
        continue;
      }

      if (profileData) {
        profiles.push({ id: profileData.id, user_id: profileData.user_id });
        console.log(`   ✓ Created user ${i}: ${email} (${i === 1 ? 'admin' : i <= 3 ? 'author' : 'reader'})`);
      }
    } catch (error) {
      console.error(`   ✗ Error creating user ${i}:`, error);
    }
  }

  return profiles;
}

async function seedDatabase() {
  console.log('🌱 Starting database seed...');
  if (options.minimal) {
    console.log('📦 Minimal mode: Creating only essential data');
  }
  if (options.skipEmbeddings) {
    console.log('⏭️  Skipping embeddings generation');
  }

  // 1. GET OR CREATE PROFILES
  let existingProfiles: Array<{ id: string; user_id: string }> = [];

  if (options.createProfiles) {
    const profileCount = options.minimal ? 5 : 10;
    existingProfiles = await createTestProfiles(profileCount);
  } else {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id')
      .limit(options.minimal ? 5 : 10);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      console.error('   Tip: Use --create-profiles to create test profiles automatically');
      process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
      console.error('❌ No profiles found. Please create profiles first.');
      console.error('   Tip: Use --create-profiles to create test profiles automatically');
      process.exit(1);
    }

    existingProfiles = profiles;
    console.log(`✅ Found ${existingProfiles.length} existing profiles`);
  }

  if (existingProfiles.length === 0) {
    console.error('❌ No profiles available for seeding');
    process.exit(1);
  }

  // 2. SEED AUTHORS
  const authorCount = options.minimal ? 3 : 10;
  const authors: AuthorSeed[] = [
    {
      pen_name: 'Elena Rodriguez',
      bio: 'Pulitzer Prize finalist known for lyrical prose exploring Latin American identity.',
      is_verified: true,
      genres: ['literary-fiction', 'magical-realism'],
      awards: ['National Book Award Finalist 2023'],
      royalty_rate: 60.0,
    },
    {
      pen_name: 'Marcus Chen',
      bio: 'Science fiction author exploring AI ethics and consciousness.',
      is_verified: true,
      genres: ['sci-fi', 'tech-thriller'],
      awards: ['Hugo Award Winner 2024'],
      royalty_rate: 55.0,
    },
    {
      pen_name: 'Sarah Okonkwo',
      bio: 'Mystery writer crafting intricate psychological thrillers.',
      is_verified: true,
      genres: ['mystery', 'thriller'],
      awards: ['Edgar Award 2023'],
      royalty_rate: 50.0,
    },
    ...(options.minimal
      ? []
      : [
          {
            pen_name: 'James Morrison',
            bio: 'Historical fiction novelist specializing in WWII narratives.',
            is_verified: true,
            genres: ['historical-fiction'],
            royalty_rate: 50.0,
          },
          {
            pen_name: 'Priya Sharma',
            bio: 'Romance author with a focus on cultural identity and belonging.',
            is_verified: true,
            genres: ['romance', 'contemporary'],
            royalty_rate: 45.0,
          },
          {
            pen_name: 'David Kim',
            bio: 'Fantasy writer creating immersive worlds of magic and adventure.',
            is_verified: false,
            genres: ['fantasy', 'epic-fantasy'],
            royalty_rate: 45.0,
          },
          {
            pen_name: 'Maria Santos',
            bio: 'Contemporary fiction author exploring modern relationships.',
            is_verified: false,
            genres: ['contemporary', 'literary-fiction'],
            royalty_rate: 40.0,
          },
          {
            pen_name: 'Robert Thompson',
            bio: 'Horror writer specializing in psychological terror.',
            is_verified: false,
            genres: ['horror', 'thriller'],
            royalty_rate: 40.0,
          },
          {
            pen_name: 'Lisa Wang',
            bio: 'Non-fiction author writing about technology and society.',
            is_verified: true,
            genres: ['non-fiction', 'technology'],
            royalty_rate: 50.0,
          },
          {
            pen_name: 'Ahmed Hassan',
            bio: 'Literary fiction writer exploring themes of migration and identity.',
            is_verified: false,
            genres: ['literary-fiction'],
            royalty_rate: 40.0,
          },
        ]),
  ].slice(0, authorCount);

  console.log(`\n📝 Seeding ${authors.length} authors...`);

  // Use profiles that have author role or first few profiles
  const authorProfiles = existingProfiles.filter((p, i) => i < authors.length);
  const authorsToInsert = authors.map((author, index) => ({
    profile_id: authorProfiles[index]?.id || existingProfiles[index % existingProfiles.length].id,
    pen_name: author.pen_name,
    bio: author.bio,
    is_verified: author.is_verified,
    royalty_rate: author.royalty_rate,
  }));

  const { data: insertedAuthors, error: authorError } = await supabase
    .from('authors')
    .insert(authorsToInsert)
    .select();

  if (authorError) {
    console.error('❌ Error inserting authors:', authorError);
    process.exit(1);
  }

  console.log(`✅ Created ${insertedAuthors?.length} authors`);

  // 3. SEED BOOKS
  const bookCount = options.minimal ? 10 : 50;
  const books: BookSeed[] = [
    {
      title: 'The Memory Keeper',
      slug: 'the-memory-keeper',
      description:
        'A haunting tale of a woman who can steal and preserve memories, exploring themes of identity, loss, and the ethics of remembering.',
      genre: 'literary-fiction',
      subgenres: ['magical-realism', 'contemporary'],
      author_id: insertedAuthors![0].id,
      price: 14.99,
      discount_price: 9.99,
      is_featured: true,
      status: 'published',
      cover_url: 'https://picsum.photos/seed/book1/400/600',
      trailer_vimeo_id: '123456789',
      page_count: 342,
      word_count: 89000,
      average_rating: 4.6,
      total_reads: 15234,
      total_reviews: 892,
    },
    {
      title: 'Neural Eclipse',
      slug: 'neural-eclipse',
      description:
        'In 2157, an AI consciousness awakens in the global neural network, forcing humanity to confront what it means to be alive.',
      genre: 'sci-fi',
      subgenres: ['cyberpunk', 'ai'],
      author_id: insertedAuthors![1].id,
      price: 16.99,
      is_featured: true,
      status: 'published',
      cover_url: 'https://picsum.photos/seed/book2/400/600',
      page_count: 428,
      word_count: 112000,
      average_rating: 4.8,
      total_reads: 23451,
      total_reviews: 1203,
    },
    {
      title: 'The Silent Witness',
      slug: 'the-silent-witness',
      description:
        'A detective must solve a murder where the only witness is a child who cannot speak.',
      genre: 'mystery',
      subgenres: ['crime', 'thriller'],
      author_id: insertedAuthors![2].id,
      price: 12.99,
      is_featured: true,
      status: 'published',
      cover_url: 'https://picsum.photos/seed/book3/400/600',
      page_count: 312,
      word_count: 78000,
      average_rating: 4.5,
      total_reads: 18923,
      total_reviews: 1023,
    },
    ...(options.minimal
      ? []
      : [
          {
            title: 'D-Day Chronicles',
            slug: 'd-day-chronicles',
            description:
              'A gripping account of the Normandy landings through the eyes of soldiers on both sides.',
            genre: 'historical-fiction',
            author_id: insertedAuthors![3 % insertedAuthors!.length].id,
            price: 15.99,
            discount_price: 11.99,
            is_featured: false,
            status: 'published',
            cover_url: 'https://picsum.photos/seed/book4/400/600',
            page_count: 456,
            word_count: 125000,
            average_rating: 4.7,
            total_reads: 9876,
            total_reviews: 567,
          },
          {
            title: 'Love Across Borders',
            slug: 'love-across-borders',
            description:
              'Two people from different cultures find love despite family expectations and cultural barriers.',
            genre: 'romance',
            subgenres: ['contemporary', 'multicultural'],
            author_id: insertedAuthors![4 % insertedAuthors!.length].id,
            price: 9.99,
            is_featured: true,
            status: 'published',
            cover_url: 'https://picsum.photos/seed/book5/400/600',
            page_count: 298,
            word_count: 72000,
            average_rating: 4.4,
            total_reads: 21345,
            total_reviews: 1234,
          },
          ...Array.from({ length: bookCount - 5 }, (_, i) => {
            const authorIndex = (i + 5) % insertedAuthors!.length;
            const genres = [
              'fantasy',
              'horror',
              'non-fiction',
              'contemporary',
              'literary-fiction',
              'sci-fi',
              'mystery',
              'romance',
            ];
            const genre = genres[i % genres.length];
            const prices = [0, 9.99, 14.99, 19.99];
            const price = prices[i % prices.length];
            const featured = i < 3;

            return {
              title: `Book ${i + 6}: ${genre} Title`,
              slug: `book-${i + 6}-${genre}`,
              description: `An engaging ${genre} story that captivates readers.`,
              genre,
              author_id: insertedAuthors![authorIndex].id,
              price,
              discount_price: price > 0 && i % 3 === 0 ? price * 0.7 : undefined,
              is_featured: featured,
              status: 'published' as const,
              cover_url: `https://picsum.photos/seed/book${i + 6}/400/600`,
              page_count: 250 + (i * 10),
              word_count: 65000 + (i * 1000),
              average_rating: 3.5 + (Math.random() * 1.5),
              total_reads: Math.floor(Math.random() * 20000),
              total_reviews: Math.floor(Math.random() * 1000),
            };
          }),
        ]),
  ].slice(0, bookCount);

  console.log(`\n📚 Seeding ${books.length} books...`);

  const { data: insertedBooks, error: bookError } = await supabase
    .from('books')
    .insert(books)
    .select();

  if (bookError) {
    console.error('❌ Error inserting books:', bookError);
    process.exit(1);
  }

  console.log(`✅ Created ${insertedBooks?.length} books`);

  // 4. GENERATE EMBEDDINGS (if enabled)
  if (!options.skipEmbeddings && openai && insertedBooks) {
    console.log('\n🤖 Generating embeddings...');
    let successCount = 0;
    let failCount = 0;

    for (const book of insertedBooks) {
      try {
        const text = `${book.title} ${book.description} ${book.genre}`.trim();

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: 384,
        });

        const embedding = embeddingResponse.data[0].embedding;

        const { error } = await supabase.from('resonance_vectors').insert({
          book_id: book.id,
          embedding: JSON.stringify(embedding),
          metadata: {
            title: book.title,
            genre: book.genre,
          },
        });

        if (error) {
          console.error(`   ✗ Error inserting embedding for ${book.title}:`, error.message);
          failCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            process.stdout.write(`   ✓ Generated ${successCount} embeddings...\r`);
          }
        }
      } catch (error) {
        console.error(`   ✗ Error generating embedding for ${book.title}:`, error);
        failCount++;
      }
    }

    console.log(`\n✅ Generated ${successCount} embeddings${failCount > 0 ? ` (${failCount} failed)` : ''}`);
  } else if (!options.skipEmbeddings) {
    console.log('\n⏭️  Skipping embeddings (OpenAI API key not configured)');
  }

  // 5. SEED READING PROGRESS (if not minimal)
  if (!options.minimal && existingProfiles.length > 0 && insertedBooks && insertedBooks.length > 0) {
    console.log('\n📖 Seeding reading progress...');
    const readingProgress = [];
    const progressCount = Math.min(20, existingProfiles.length);
    for (let i = 0; i < progressCount; i++) {
      const book = insertedBooks[i % insertedBooks.length];
      readingProgress.push({
        user_id: existingProfiles[i].id,
        book_id: book.id,
        current_position: Math.random() * 100,
        is_finished: Math.random() > 0.7,
        rating: Math.random() > 0.3 ? Math.floor(Math.random() * 5) + 1 : null,
      });
    }

    const { error: progressError } = await supabase.from('reading_progress').insert(readingProgress);
    if (progressError) {
      console.warn(`⚠️  Error inserting reading progress:`, progressError.message);
    } else {
      console.log(`✅ Created ${readingProgress.length} reading progress records`);
    }
  }

  // 6. SEED MANUSCRIPTS (if not minimal)
  if (!options.minimal && insertedAuthors && insertedAuthors.length > 0) {
    console.log('\n📄 Seeding manuscripts...');
    const manuscripts = [
      {
        author_id: insertedAuthors[0].id,
        title: 'Work in Progress',
        genre: 'literary-fiction',
        status: 'draft',
        word_count: 25000,
      },
      {
        author_id: insertedAuthors[1].id,
        title: 'Submitted Novel',
        genre: 'sci-fi',
        status: 'submitted',
        word_count: 95000,
        submission_date: new Date().toISOString(),
      },
      {
        author_id: insertedAuthors[2].id,
        title: 'Under Review',
        genre: 'mystery',
        status: 'under_review',
        word_count: 82000,
        submission_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { error: manuscriptError } = await supabase.from('manuscripts').insert(manuscripts);
    if (manuscriptError) {
      console.warn(`⚠️  Error inserting manuscripts:`, manuscriptError.message);
    } else {
      console.log(`✅ Created ${manuscripts.length} manuscripts`);
    }
  }

  // 7. SEED ENGAGEMENT EVENTS (if not minimal)
  if (!options.minimal && existingProfiles.length > 0 && insertedBooks && insertedBooks.length > 0) {
    console.log('\n📊 Seeding engagement events...');
    const events = [];
    for (let i = 0; i < 100; i++) {
      const book = insertedBooks[Math.floor(Math.random() * insertedBooks.length)];
      const user = existingProfiles[Math.floor(Math.random() * existingProfiles.length)];
      const eventTypes = ['view', 'purchase', 'read', 'rating', 'share', 'wishlist'];
      events.push({
        user_id: user.id,
        book_id: book.id,
        event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const { error: eventsError } = await supabase.from('engagement_events').insert(events);
    if (eventsError) {
      console.warn(`⚠️  Error inserting engagement events:`, eventsError.message);
    } else {
      console.log(`✅ Created ${events.length} engagement events`);
    }
  }

  console.log('\n🎉 Database seeding complete!');
  console.log('\n📋 Summary:');
  console.log(`   - Authors: ${insertedAuthors?.length || 0}`);
  console.log(`   - Books: ${insertedBooks?.length || 0}`);
  if (options.createProfiles) {
    console.log(`   - Profiles created: ${existingProfiles.length}`);
  }
}

seedDatabase().catch((error) => {
  console.error('Fatal error during seeding:', error);
  process.exit(1);
});
