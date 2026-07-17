import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { reorderPartnerOrder } from '@/lib/actions/partner';
import {
  clampPage,
  formatDate,
  formatMoney,
  getPartnerPortalData,
  PartnerDataUnavailableError,
  titleCase,
} from '../_lib/partner-data';
import { PartnerUnavailable } from '../_lib/partner-unavailable';

interface OrdersPageProps {
  searchParams?: { status?: string; sort?: string; page?: string };
}

const PAGE_SIZE = 5;

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  let portalData;
  try {
    portalData = await getPartnerPortalData();
  } catch (error) {
    const message =
      error instanceof PartnerDataUnavailableError
        ? error.message
        : 'Partner portal data is temporarily unavailable.';
    return <PartnerUnavailable message={message} />;
  }

  const { partner, orders } = portalData;

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

  const status = searchParams?.status ?? 'all';
  const sort = searchParams?.sort ?? 'newest';
  const filteredOrders = orders
    .filter((order) => status === 'all' || order.status === status)
    .sort((a, b) => {
      if (sort === 'total') return Number(b.total_amount ?? 0) - Number(a.total_amount ?? 0);
      if (sort === 'status') return a.status.localeCompare(b.status);
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = clampPage(Number(searchParams?.page ?? '1') || 1, totalPages);
  const pagedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationParams = {
    ...(status !== 'all' ? { status } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  return (
    <Section>
      <Container>
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Orders</h1>
          <p className="mt-2 text-secondary">Institutional purchases for {partner.institution_name}.</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" method="get">
            <select name="status" defaultValue={status} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="newest">Newest</option>
              <option value="total">Highest total</option>
              <option value="status">Status</option>
            </select>
            <Button type="submit" variant="outline">Filter</Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/partner/orders/export">Download CSV</Link>
          </Button>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No orders match the selected filters.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
            {pagedOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>
                      <Link href={`/partner/orders/${order.id}`} className="transition-colors hover:text-primary">
                        Order {order.order_number}
                      </Link>
                    </CardTitle>
                    <p className="mt-2 text-sm text-secondary">Placed {formatDate(order.created_at)}</p>
                  </div>
                  <Badge variant="outline">{titleCase(order.status)}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-4 text-sm md:grid-cols-3">
                    <div>
                      <p className="font-semibold">Total</p>
                      <p className="text-secondary">{formatMoney(Number(order.total_amount))}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Items</p>
                      <p className="text-secondary">{order.items.length}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Books</p>
                      <p className="text-secondary">
                        {order.items.map((item) => item.book?.title ?? 'Untitled book').join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/partner/orders/${order.id}`} className="text-sm text-primary hover:underline">
                      View order details
                    </Link>
                    <form action={reorderPartnerOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <Button type="submit" size="sm" variant="outline">Reorder</Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/partner/orders"
              queryParams={paginationParams}
              className="mt-8"
            />
          </>
        )}
      </Container>
    </Section>
  );
}
