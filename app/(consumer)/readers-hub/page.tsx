import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReadersHubPage() {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Readers Hub</h1>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>My Library</CardTitle>
              <CardDescription>View all your purchased and reading books</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-secondary">Feature coming soon</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reading History</CardTitle>
              <CardDescription>Track your reading progress and history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-secondary">Feature coming soon</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Wishlist</CardTitle>
              <CardDescription>Save books you want to read later</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-secondary">Feature coming soon</p>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
