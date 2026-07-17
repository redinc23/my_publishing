/* eslint-disable */
import { createClient } from '@/lib/supabase/admin';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { updateManuscriptStatusAction } from '../actions';
import { AdminQueryError } from '../_lib/query-error';

export default async function AdminManuscriptsPage() {
  const supabase = createClient();

  const { data: manuscripts, error } = await supabase
    .from('manuscripts')
    .select('id, title, status, genre, created_at, author:authors(pen_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[admin/manuscripts] query failed:', error);
    return (
      <Section>
        <Container>
          <AdminQueryError title="Manuscripts Management" />
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-3xl font-bold">Manuscripts Management</h1>

        <div className="space-y-4">
          {manuscripts && manuscripts.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Author</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Genre</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manuscripts.map((manuscript: any) => (
                    <tr key={manuscript.id} className="border-t border-border">
                      <td className="px-4 py-3">{manuscript.title}</td>
                      <td className="px-4 py-3">{manuscript.author?.pen_name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            manuscript.status === 'accepted'
                              ? 'bg-green-500/20 text-green-500'
                              : manuscript.status === 'rejected'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {manuscript.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{manuscript.genre}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <form action={updateManuscriptStatusAction}>
                            <input type="hidden" name="manuscriptId" value={manuscript.id} />
                            <input type="hidden" name="status" value="accepted" />
                            <Button
                              variant="outline"
                              size="sm"
                              type="submit"
                              disabled={manuscript.status === 'accepted'}
                            >
                              Approve
                            </Button>
                          </form>
                          <form action={updateManuscriptStatusAction}>
                            <input type="hidden" name="manuscriptId" value={manuscript.id} />
                            <input type="hidden" name="status" value="rejected" />
                            <Button
                              variant="outline"
                              size="sm"
                              type="submit"
                              disabled={manuscript.status === 'rejected'}
                            >
                              Reject
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary">No manuscripts found</p>
          )}
        </div>
      </Container>
    </Section>
  );
}
