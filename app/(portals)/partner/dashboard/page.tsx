import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  formatMoney,
  getPartnerPortalData,
  PartnerDataUnavailableError,
  titleCase,
} from '../_lib/partner-data';
import { PartnerUnavailable } from '../_lib/partner-unavailable';

export default async function PartnerDashboardPage() {
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

  const { partner, catalogBooks, arcRequests, orders } = portalData;

  if (!partner) {
    return (
      <Section>
        <Container>
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Partner profile not found</h1>
            <p className="mb-4 text-secondary">Please complete your partner profile setup.</p>
          </div>
        </Container>
      </Section>
    );
  }

  const fulfilledArcs = arcRequests.filter((request) => request.status === 'fulfilled').length;
  const totalOrderValue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  return (
    <Section>
      <Container>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Partner Dashboard</h1>
            <p className="mt-2 text-secondary">
              {partner.institution_name} · {titleCase(partner.subscription_plan)} plan
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/partner/catalogs">Browse Catalog</Link>
            </Button>
            <Button asChild>
              <Link href="/partner/arc-requests">View ARC Requests</Link>
            </Button>
          </div>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Catalog Books</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{catalogBooks.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ARC Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{arcRequests.length}</p>
              <p className="text-sm text-secondary">{fulfilledArcs} fulfilled</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Order Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatMoney(totalOrderValue)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent ARC Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {arcRequests.length === 0 ? (
                <p className="text-secondary">No ARC requests yet.</p>
              ) : (
                <ul className="space-y-4">
                  {arcRequests.slice(0, 5).map((request) => (
                    <li
                      key={request.id}
                      className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <Link
                          href="/partner/arc-requests"
                          className="font-medium transition-colors hover:text-primary"
                        >
                          {request.book?.title ?? 'Untitled book'}
                        </Link>
                        <p className="text-sm text-secondary">
                          {request.quantity} copies requested {formatDate(request.requested_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{titleCase(request.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-secondary">No partner orders yet.</p>
              ) : (
                <ul className="space-y-4">
                  {orders.slice(0, 5).map((order) => (
                    <li
                      key={order.id}
                      className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <Link
                          href={`/partner/orders/${order.id}`}
                          className="font-medium transition-colors hover:text-primary"
                        >
                          Order {order.order_number}
                        </Link>
                        <p className="text-sm text-secondary">
                          {order.items.length} items · {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(Number(order.total_amount))}</p>
                        <Badge variant="outline">{titleCase(order.status)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
