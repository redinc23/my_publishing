import Link from 'next/link';
import { Manuscript } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

interface ManuscriptCardProps {
  manuscript: Manuscript;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  revisions_requested: 'bg-orange-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  published: 'bg-primary',
};

export function ManuscriptCard({ manuscript }: ManuscriptCardProps) {
  return (
    <Link href={`/author/projects/${manuscript.id}`}>
      <Card className="transition-transform duration-300 hover:scale-[1.02]">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-2">{manuscript.title}</CardTitle>
            <Badge className={cn('text-white', statusColors[manuscript.status] || 'bg-gray-500')}>
              {manuscript.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary mb-2 line-clamp-2">{manuscript.synopsis}</p>
          <div className="flex items-center gap-4 text-xs text-secondary">
            <span>{manuscript.genre}</span>
            {manuscript.word_count && <span>{manuscript.word_count.toLocaleString()} words</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
