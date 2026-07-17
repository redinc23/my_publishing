import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { reorderPartnerOrder } from '@/lib/actions/partner';
import { formatDate, formatMoney, getPartnerOrder, titleCase } from '../../_lib/partner-data';

interface OrderDetailPageProps {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { partner, order } = await getPartnerOrder(params.id);

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

  if (!order) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Order {order.order_number}</h1>
            <p className="mt-2 text-secondary">
              {partner.institution_name} · {formatDate(order.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{titleCase(order.status)}</Badge>
            <form action={reorderPartnerOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit" variant="outline">
                Reorder
              </Button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{item.book?.title ?? 'Untitled book'}</p>
                      <p className="text-sm text-secondary">
                        {item.book?.genre ?? 'Uncategorized'}
                      </p>
                      {item.book ? (
                        <Link
                          href={`/books/${item.book.slug}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View book
                        </Link>
                      ) : null}
                    </div>
                    <p className="font-semibold">{formatMoney(Number(item.unit_price))}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-secondary">Total</span>
                <span className="font-semibold">{formatMoney(Number(order.total_amount))}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-secondary">Items</span>
                <span>{order.items.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-secondary">Updated</span>
                <span>{formatDate(order.updated_at)}</span>
              </div>
              <Link
                href="/partner/orders"
                className="inline-flex pt-2 text-primary hover:underline"
              >
                Back to orders
              </Link>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
