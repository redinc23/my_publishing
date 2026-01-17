import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DiscoverPage() {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Discover</h1>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Get personalized book recommendations based on your reading history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/discover/recommendations">Get Recommendations</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Book Clubs</CardTitle>
              <CardDescription>Join book clubs and discuss your favorite reads</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/discover/book-clubs">Browse Clubs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
