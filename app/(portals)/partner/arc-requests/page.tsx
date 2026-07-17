import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { createArcRequest } from '@/lib/actions/partner';
import {
  clampPage,
  formatDate,
  getPartnerPortalData,
  normalizeArcStatusFilter,
  PartnerDataUnavailableError,
  titleCase,
} from '../_lib/partner-data';
import { PartnerUnavailable } from '../_lib/partner-unavailable';

interface ArcRequestsPageProps {
  searchParams?: { status?: string; sort?: string; page?: string };
}

const PAGE_SIZE = 5;

export default async function ArcRequestsPage({ searchParams }: ArcRequestsPageProps) {
  let portalData;
  try {
    portalData = await getPartnerPortalData();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    const message =
      error instanceof PartnerDataUnavailableError
        ? error.message
        : 'Partner portal data is temporarily unavailable.';
    return <PartnerUnavailable message={message} />;
  }

  const { partner, arcRequests, catalogBooks } = portalData;

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

  const status = normalizeArcStatusFilter(searchParams?.status);
  const sort = searchParams?.sort ?? 'newest';
  const requestedBookIds = new Set(arcRequests.map((request) => request.book_id));
  const availableBooks = catalogBooks.filter((book) => !requestedBookIds.has(book.id));
  const filteredRequests = arcRequests
    .filter((request) => status === 'all' || request.status === status)
    .sort((a, b) => {
      if (sort === 'quantity') return b.quantity - a.quantity;
      if (sort === 'status') return a.status.localeCompare(b.status);
      return new Date(b.requested_at ?? 0).getTime() - new Date(a.requested_at ?? 0).getTime();
    });
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = clampPage(Number(searchParams?.page ?? '1') || 1, totalPages);
  const pagedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationParams = {
    ...(status !== 'all' ? { status } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  return (
    <Section>
      <Container>
        <div className="mb-8">
          <h1 className="text-4xl font-bold">ARC Requests</h1>
          <p className="mt-2 text-secondary">Advance reader copy activity for {partner.institution_name}.</p>
        </div>

        <div className="mb-6 grid gap-4 rounded-lg border border-border p-4 lg:grid-cols-[2fr_1fr]">
          <form action={createArcRequest} className="grid gap-3 md:grid-cols-[1fr_8rem_auto]">
            <select
              name="bookId"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select a catalog book
              </option>
              {availableBooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
            <Input name="quantity" type="number" min="1" max="500" defaultValue="1" aria-label="ARC request quantity" />
            <Button type="submit" disabled={availableBooks.length === 0}>
              Request ARC
            </Button>
          </form>

          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" method="get">
            <select name="status" defaultValue={status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="fulfilled">Fulfilled</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="newest">Newest</option>
              <option value="status">Status</option>
              <option value="quantity">Quantity</option>
            </select>
            <Button type="submit" variant="outline">Filter</Button>
          </form>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No ARC requests match the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
            {pagedRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>{request.book?.title ?? 'Untitled book'}</CardTitle>
                    <p className="mt-2 text-sm text-secondary">{request.book?.genre ?? 'Uncategorized'}</p>
                  </div>
                  <Badge variant="outline">{titleCase(request.status)}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="font-semibold">Quantity</p>
                      <p className="text-secondary">{request.quantity}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Requested</p>
                      <p className="text-secondary">{formatDate(request.requested_at)}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Fulfilled</p>
                      <p className="text-secondary">{formatDate(request.fulfilled_at)}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Book</p>
                      {request.book ? (
                        <Link href={`/books/${request.book.slug}`} className="text-primary hover:underline">
                          View catalog page
                        </Link>
                      ) : (
                        <p className="text-secondary">Unavailable</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/partner/arc-requests"
              queryParams={paginationParams}
              className="mt-8"
            />
          </>
        )}
      </Container>
    </Section>
  );
}
