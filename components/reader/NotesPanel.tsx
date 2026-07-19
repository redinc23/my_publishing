'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Highlighter, MapPin, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import type { HighlightColor } from '@/lib/validations/reader-engagement';
import type { HighlightRow } from '@/lib/reading/engagement';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_CLASSES } from './highlight-colors';

interface NotesPanelProps {
  bookId: string;
  /** Jump the reader to a highlight's stored locator. */
  onJumpTo?: (position: string) => void;
  /** Bump to force a refetch (e.g. after HighlightPopover creates a row). */
  refreshToken?: number;
  className?: string;
}

type LoadState = 'loading' | 'ready' | 'signed-out' | 'unavailable' | 'error';

/**
 * Per-book highlights + notes manager: list, jump-to, edit (color + note),
 * delete. Talks to /api/highlights and renders graceful states when signed
 * out or when the engagement backend is unavailable.
 */
export function NotesPanel({ bookId, onJumpTo, refreshToken, className }: NotesPanelProps) {
  const [items, setItems] = useState<HighlightRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftColor, setDraftColor] = useState<HighlightColor>('yellow');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`/api/highlights?book_id=${encodeURIComponent(bookId)}`);
      if (res.status === 401) {
        setState('signed-out');
        return;
      }
      if (res.status === 503) {
        setState('unavailable');
        return;
      }
      if (!res.ok) {
        setState('error');
        return;
      }
      const json = (await res.json()) as { highlights?: HighlightRow[] };
      setItems(json.highlights ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const notes = useMemo(() => items.filter((h) => h.note && h.note.trim().length > 0), [items]);

  const startEdit = (highlight: HighlightRow) => {
    setEditingId(highlight.id);
    setDraftNote(highlight.note ?? '');
    setDraftColor(highlight.color);
  };

  const saveEdit = async (highlight: HighlightRow) => {
    if (busyId) return;
    setBusyId(highlight.id);
    const patch = {
      id: highlight.id,
      color: draftColor,
      note: draftNote.trim() ? draftNote.trim() : null,
    };
    try {
      const res = await fetch('/api/highlights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error || 'Could not update highlight.');
        return;
      }
      const json = (await res.json()) as { highlight: HighlightRow };
      setItems((prev) => prev.map((h) => (h.id === highlight.id ? json.highlight : h)));
      setEditingId(null);
      toast.success('Updated');
    } catch {
      toast.error('Could not update highlight.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (highlight: HighlightRow) => {
    if (busyId) return;
    const previous = items;
    setBusyId(highlight.id);
    setItems((prev) => prev.filter((h) => h.id !== highlight.id)); // optimistic
    try {
      const res = await fetch('/api/highlights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: highlight.id }),
      });
      if (!res.ok) {
        setItems(previous);
        toast.error('Could not delete highlight.');
        return;
      }
      toast.success('Deleted');
    } catch {
      setItems(previous);
      toast.error('Could not delete highlight.');
    } finally {
      setBusyId(null);
    }
  };

  if (state === 'loading') {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (state === 'signed-out') {
    return (
      <div className={cn('rounded-lg border border-border p-6 text-center', className)}>
        <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">
          Sign in to save highlights and notes while you read.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className={cn('rounded-lg border border-border p-6 text-center', className)}>
        <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Highlights and notes are coming soon.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={cn('rounded-lg border border-border p-6 text-center', className)}>
        <p className="mb-3 text-sm text-muted-foreground">Could not load your notes.</p>
        <Button variant="outline" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  const renderItem = (highlight: HighlightRow) => {
    const editing = editingId === highlight.id;
    const colors = HIGHLIGHT_COLOR_CLASSES[highlight.color] ?? HIGHLIGHT_COLOR_CLASSES.yellow;

    return (
      <li
        key={highlight.id}
        className="rounded-lg border border-border bg-card p-3 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn('mt-1 h-3 w-3 flex-shrink-0 rounded-full', colors.dot)}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className={cn('rounded px-1 text-sm leading-relaxed', colors.mark)}>
              &ldquo;{highlight.selected_text}&rdquo;
            </p>

            {editing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={3}
                  maxLength={5000}
                  className="text-sm"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={HIGHLIGHT_COLOR_CLASSES[c].label}
                        aria-label={`Set color ${HIGHLIGHT_COLOR_CLASSES[c].label}`}
                        onClick={() => setDraftColor(c)}
                        className={cn(
                          'h-5 w-5 rounded-full ring-2 ring-transparent transition-all',
                          HIGHLIGHT_COLOR_CLASSES[c].swatch,
                          draftColor === c && 'ring-foreground'
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={busyId === highlight.id}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(highlight)}
                      disabled={busyId === highlight.id}
                    >
                      {busyId === highlight.id ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {highlight.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {highlight.note}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1">
                  {onJumpTo && highlight.position && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onJumpTo(highlight.position as string)}
                      title="Jump to this passage"
                    >
                      <MapPin className="mr-1 h-3.5 w-3.5" />
                      Jump
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(highlight)}
                    title={highlight.note ? 'Edit note' : 'Add note'}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {highlight.note ? 'Edit' : 'Add note'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(highlight)}
                    disabled={busyId === highlight.id}
                    title="Delete highlight"
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  const emptyState = (kind: 'highlights' | 'notes') => (
    <div className="py-10 text-center">
      {kind === 'highlights' ? (
        <Highlighter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      ) : (
        <StickyNote className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground">
        {kind === 'highlights'
          ? 'No highlights yet — select text while reading to save one.'
          : 'No notes yet — add a note to any highlight.'}
      </p>
    </div>
  );

  return (
    <div className={className}>
      <Tabs defaultValue="highlights">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="highlights">Highlights ({items.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="highlights">
          {items.length > 0 ? (
            <ul className="space-y-3">{items.map(renderItem)}</ul>
          ) : (
            emptyState('highlights')
          )}
        </TabsContent>
        <TabsContent value="notes">
          {notes.length > 0 ? (
            <ul className="space-y-3">{notes.map(renderItem)}</ul>
          ) : (
            emptyState('notes')
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
