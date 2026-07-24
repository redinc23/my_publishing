import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <Section>
      <Container>
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="mx-auto aspect-[2/3] w-full max-w-sm" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-12 w-48" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
