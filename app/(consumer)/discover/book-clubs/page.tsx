import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-8">Book Clubs</h1>
        <div className="text-center py-12">
          <p className="text-secondary">Book clubs feature coming soon!</p>
        </div>
      </Container>
    </Section>
  );
}
