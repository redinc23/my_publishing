import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getPartnerForUser } from '@/lib/supabase/portal-queries';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001')
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'partner') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const partner = await getPartnerForUser(user.id);

  if (!partner) {
    return new NextResponse('Partner profile not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: orders, error } = await admin
    .from('orders')
    .select(
      'order_number, status, total_amount, created_at, items:order_items(unit_price, book:books(title))'
    )
    .eq('user_id', partner.profile_id)
    .order('created_at', { ascending: false });

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  const rows = [
    ['Order Number', 'Status', 'Total', 'Items', 'Created At'],
    ...(orders ?? []).map((order) => [
      order.order_number,
      order.status,
      order.total_amount,
      (order.items ?? [])
        .map((item) => {
          const book = item.book as { title?: string } | Array<{ title?: string }> | null;
          return Array.isArray(book) ? book[0]?.title : book?.title;
        })
        .filter(Boolean)
        .join('; '),
      order.created_at,
    ]),
  ];

  return new NextResponse(rows.map((row) => row.map(csvCell).join(',')).join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="partner-orders.csv"',
    },
  });
}
