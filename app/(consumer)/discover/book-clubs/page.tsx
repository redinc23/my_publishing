import type { Metadata } from 'next';
/* eslint-disable */
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
export const metadata: Metadata = {
  title: 'Book Clubs',
  description: 'Join MANGU book clubs and connect with readers discussing favorite stories.',
};

export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Book Clubs</h1>
        <div className="py-12 text-center">
          <p className="text-secondary">Book clubs feature coming soon!</p>
        </div>
      </Container>
    </Section>
  );
}
