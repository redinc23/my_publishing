/* eslint-disable */
import { createClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminQueryError, firstQueryError } from '../_lib/query-error';

export default async function AdminDashboard() {
  const supabase = createClient();

  const [usersResult, booksResult, ordersResult, activityResult] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase
      .from('engagement_events')
      .select('*, book:books(title)')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const queryError = firstQueryError([usersResult, booksResult, ordersResult, activityResult]);
  if (queryError) {
    return <AdminQueryError title="Admin Dashboard" />;
  }

  const totalUsers = usersResult.count;
  const totalBooks = booksResult.count;
  const totalOrders = ordersResult.count;
  const recentActivity = activityResult.data;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalUsers || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Books</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalBooks || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalOrders || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity: any) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-border p-2"
                >
                  <div>
                    <p className="font-medium">{activity.event_type}</p>
                    <p className="text-sm text-secondary">
                      {activity.book?.title || 'Unknown book'}
                    </p>
                  </div>
                  <p className="text-sm text-secondary">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
