/* eslint-disable */
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export default async function AdminManuscriptsPage() {
  const supabase = await createClient();

  const { data: manuscripts } = await supabase
    .from('manuscripts')
    .select('*, author:authors(*)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <Section>
      <Container>
        <h1 className="text-3xl font-bold mb-8">Manuscripts Management</h1>

        <div className="space-y-4">
          {manuscripts && manuscripts.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden">
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
                      <td className="px-4 py-3">
                        {manuscript.author?.pen_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
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
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
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
