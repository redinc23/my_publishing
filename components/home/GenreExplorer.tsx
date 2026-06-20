'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/layout/Container';

const genres = [
  { name: 'Fiction', emoji: '📖', color: 'from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30' },
  { name: 'Mystery', emoji: '🔍', color: 'from-slate-500/20 to-slate-600/20 hover:from-slate-500/30 hover:to-slate-600/30' },
  { name: 'Romance', emoji: '💕', color: 'from-pink-500/20 to-rose-600/20 hover:from-pink-500/30 hover:to-rose-600/30' },
  { name: 'Science Fiction', emoji: '🚀', color: 'from-violet-500/20 to-purple-600/20 hover:from-violet-500/30 hover:to-purple-600/30' },
  { name: 'Fantasy', emoji: '🧙', color: 'from-amber-500/20 to-yellow-600/20 hover:from-amber-500/30 hover:to-yellow-600/30' },
  { name: 'Thriller', emoji: '⚡', color: 'from-red-500/20 to-orange-600/20 hover:from-red-500/30 hover:to-orange-600/30' },
  { name: 'Non-Fiction', emoji: '📚', color: 'from-green-500/20 to-emerald-600/20 hover:from-green-500/30 hover:to-emerald-600/30' },
  { name: 'Biography', emoji: '🏆', color: 'from-cyan-500/20 to-teal-600/20 hover:from-cyan-500/30 hover:to-teal-600/30' },
];

export function GenreExplorer() {
  return (
    <section className="py-16 bg-background">
      <Container>
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-medium tracking-widest uppercase text-primary mb-2">
              Browse by Category
            </p>
            <h2 className="text-3xl font-bold">Explore Genres</h2>
          </div>
          <Link
            href="/genres"
            className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All genres <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {genres.map(({ name, emoji, color }) => (
            <Link
              key={name}
              href={`/genres/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}`}
              className={`group flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br ${color} border border-border/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-md`}
            >
              <span className="text-2xl" role="img" aria-label={name}>
                {emoji}
              </span>
              <span className="text-xs font-medium text-center leading-tight">{name}</span>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex justify-center sm:hidden">
          <Link
            href="/genres"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all genres <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
