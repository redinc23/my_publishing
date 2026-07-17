import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
export const metadata: Metadata = {
  title: 'Readers Hub',
  description: 'Manage reading activity, wishlists, and community features in the MANGU Readers Hub.',
};

export default function ReadersHubPage() {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Readers Hub</h1>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>My Library</CardTitle>
              <CardDescription>View all your purchased and reading books</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/library">Open library</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reading History</CardTitle>
              <CardDescription>Track your reading progress and history</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/books">Find books to read</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Wishlist</CardTitle>
              <CardDescription>Save books you want to read later</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/genres">Browse genres</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
