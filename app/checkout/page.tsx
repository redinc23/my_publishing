import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';

interface CheckoutSearchParams {
  book_id?: string;
  slug?: string;
}

interface BookCheckoutSummary {
  id: string;
  slug: string | null;
  title: string;
  cover_url: string | null;
  price: number;
  discount_price: number | null;
  author: {
    pen_name: string | null;
    profile: {
      full_name: string | null;
    } | null;
  };
}

async function getBookSummary({ book_id, slug }: CheckoutSearchParams) {
  if (!book_id && !slug) {
    return null;
  }

  const supabase = await createClient();
  let query = supabase
    .from('books')
    .select('id, slug, title, cover_url, price, discount_price, author:authors!inner(pen_name, profile:profiles!inner(full_name))')
    .eq('status', 'published');

  if (book_id) {
    query = query.eq('id', book_id);
  } else if (slug) {
    query = query.eq('slug', slug);
  }

  const { data } = await query.single();

  return data as BookCheckoutSummary | null;
}

async function startCheckout(formData: FormData) {
  'use server';

  const bookId = formData.get('book_id')?.toString() ?? '';
  const bookSlug = formData.get('book_slug')?.toString() ?? '';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (!bookId && !bookSlug) {
    throw new Error('book_id or book_slug is required');
  }

  // Get book details
  let bookQuery = supabase.from('books').select('*');

  if (bookId) {
    bookQuery = bookQuery.eq('id', bookId);
  } else if (bookSlug) {
    bookQuery = bookQuery.eq('slug', bookSlug);
  }

  const { data: book, error: bookError } = await bookQuery.single();

  if (bookError || !book) {
    throw new Error('Book not found');
  }

  // Create Stripe checkout session directly
  const session = await createCheckoutSession({
    bookId: book.id,
    bookSlug: book.slug,
    userId: user.id,
    bookTitle: book.title,
    price: book.discount_price ?? book.price,
  });

  if (session.url) {
    redirect(session.url);
  }

  throw new Error('Checkout session missing redirect URL.');
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: CheckoutSearchParams;
}) {
  const book = await getBookSummary(searchParams);

  if (!book) {
    notFound();
  }

  const authorName = book.author.profile?.full_name || book.author.pen_name || 'Unknown Author';

  return (
    <Section>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-lg border bg-background p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="mt-2 text-secondary">
              Review your order before proceeding to secure payment.
            </p>
            <div className="mt-6 flex flex-col gap-6 sm:flex-row">
              <div className="relative h-56 w-40 overflow-hidden rounded-md bg-muted">
                {book.cover_url && (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">{book.title}</h2>
                <p className="mt-1 text-secondary">by {authorName}</p>
                <div className="mt-4 text-xl font-semibold">
                  {book.discount_price != null ? (
                    <>
                      <span className="text-secondary line-through mr-2">${book.price}</span>
                      <span className="text-primary">${book.discount_price}</span>
                    </>
                  ) : (
                    <span>${book.price}</span>
                  )}
                </div>
                <div className="mt-4 text-sm text-secondary">
                  Need to make changes?{' '}
                  <Link href={`/books/${book.slug ?? book.id}`} className="text-primary underline">
                    View the book
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Order summary</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-secondary">
              <span>Subtotal</span>
              <span>${book.discount_price ?? book.price}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-secondary">
              <span>Taxes</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="mt-6 border-t pt-4 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>${book.discount_price ?? book.price}</span>
            </div>
            <form action={startCheckout} className="mt-6 space-y-2">
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="book_slug" value={book.slug ?? ''} />
              <Button type="submit" className="w-full">
                Continue to payment
              </Button>
            </form>
          </div>
        </div>
      </Container>
    </Section>
  );
}
