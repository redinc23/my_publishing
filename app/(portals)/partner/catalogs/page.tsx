import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { createArcRequest } from '@/lib/actions/partner';
import { formatDate, formatMoney, getPartnerPortalData, titleCase } from '../_lib/partner-data';

interface CatalogsPageProps {
  searchParams?: { q?: string; genre?: string; sort?: string; page?: string };
}

const PAGE_SIZE = 2;

export default async function CatalogsPage({ searchParams }: CatalogsPageProps) {
  const { partner, catalogBooks, arcRequests } = await getPartnerPortalData();

  if (!partner) {
    return (
      <Section>
        <Container>
          <h1 className="mb-4 text-2xl font-bold">Partner profile not found</h1>
          <p className="text-secondary">Please complete your partner profile setup.</p>
        </Container>
      </Section>
    );
  }

  const requestByBook = new Map(arcRequests.map((request) => [request.book_id, request]));
  const query = searchParams?.q?.trim().toLowerCase() ?? '';
  const genre = searchParams?.genre ?? 'all';
  const sort = searchParams?.sort ?? 'newest';
  const currentPage = Math.max(Number(searchParams?.page ?? '1') || 1, 1);
  const genres = Array.from(new Set(catalogBooks.map((book) => book.genre).filter(Boolean))).sort();
  const filteredBooks = catalogBooks
    .filter((book) => {
      const matchesQuery =
        !query ||
        book.title.toLowerCase().includes(query) ||
        (book.description ?? '').toLowerCase().includes(query);
      const matchesGenre = genre === 'all' || book.genre === genre;
      return matchesQuery && matchesGenre;
    })
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'price')
        return Number(a.discount_price ?? a.price ?? 0) - Number(b.discount_price ?? b.price ?? 0);
      return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
    });
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const pagedBooks = filteredBooks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationParams = {
    ...(query ? { q: searchParams?.q ?? '' } : {}),
    ...(genre !== 'all' ? { genre } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  return (
    <Section>
      <Container>
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Catalogs</h1>
          <p className="mt-2 text-secondary">
            Published public books available to {partner.institution_name}.
          </p>
        </div>

        <form
          className="mb-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_auto_auto_auto]"
          method="get"
        >
          <Input name="q" placeholder="Search catalogs" defaultValue={searchParams?.q ?? ''} />
          <select
            name="genre"
            defaultValue={genre}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All genres</option>
            {genres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="title">Title</option>
            <option value="price">Lowest price</option>
          </select>
          <Button type="submit">Apply</Button>
        </form>

        {filteredBooks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No published books match the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pagedBooks.map((book) => {
                const request = requestByBook.get(book.id);
                return (
                  <Card key={book.id} className="flex flex-col">
                    <CardHeader>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <Badge variant="secondary">{book.genre}</Badge>
                        {request ? (
                          <Badge variant="outline">ARC {titleCase(request.status)}</Badge>
                        ) : null}
                      </div>
                      <CardTitle>{book.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <p className="line-clamp-4 text-sm text-secondary">
                        {book.description || 'No description available.'}
                      </p>
                      <div className="mt-auto space-y-2 text-sm">
                        <p>
                          <span className="font-semibold">Price:</span>{' '}
                          {formatMoney(Number(book.discount_price ?? book.price ?? 0))}
                        </p>
                        <p>
                          <span className="font-semibold">Published:</span>{' '}
                          {formatDate(book.published_at)}
                        </p>
                        <Link
                          href={`/books/${book.slug}`}
                          className="inline-flex text-primary hover:underline"
                        >
                          View book details
                        </Link>
                        {request ? (
                          <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href={`/partner/arc-requests?status=${request.status}`}>
                              View ARC request
                            </Link>
                          </Button>
                        ) : (
                          <form action={createArcRequest} className="flex gap-2">
                            <input type="hidden" name="bookId" value={book.id} />
                            <Input
                              className="w-24"
                              name="quantity"
                              type="number"
                              min="1"
                              max="500"
                              defaultValue="1"
                              aria-label={`ARC quantity for ${book.title}`}
                            />
                            <Button type="submit" size="sm">
                              Request ARC
                            </Button>
                          </form>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Pagination
              currentPage={Math.min(currentPage, totalPages)}
              totalPages={totalPages}
              basePath="/partner/catalogs"
              queryParams={paginationParams}
              className="mt-8"
            />
          </>
        )}
      </Container>
    </Section>
  );
}
