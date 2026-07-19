'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Highlighter, StickyNote, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { HighlightColor } from '@/lib/validations/reader-engagement';
import type { HighlightRow } from '@/lib/reading/engagement';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_CLASSES } from './highlight-colors';

interface SelectionState {
  text: string;
  locator?: string;
  /** Viewport coordinates used for fixed positioning. */
  top: number;
  bottom: number;
  left: number;
  placeBelow: boolean;
}

interface HighlightPopoverProps {
  bookId: string;
  /** Text selections inside this element can be highlighted. */
  containerRef: RefObject<HTMLElement>;
  /**
   * Optional locator extractor (e.g. epub CFI from a Range). When omitted the
   * highlight is stored without a position.
   */
  getLocator?: (selection: Selection) => string | undefined;
  /** Called after a highlight is created so the host can refresh state/UI. */
  onCreated?: (highlight: HighlightRow) => void;
  className?: string;
}

const MAX_SELECTION = 8000; // keep in sync with CreateHighlightSchema

/**
 * Floating selection toolbar: select text inside `containerRef` and save it
 * as a color-coded highlight, optionally with a note. Posts to
 * /api/highlights and degrades quietly when signed out (redirect to login)
 * or when the engagement backend is unavailable.
 */
export function HighlightPopover({
  bookId,
  containerRef,
  getLocator,
  onCreated,
  className,
}: HighlightPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [noteMode, setNoteMode] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setSelection(null);
    setNoteMode(false);
    setNote('');
    setColor('yellow');
  }, []);

  // Capture a finished text selection inside the container.
  useEffect(() => {
    const captureSelection = () => {
      const container = containerRef.current;
      if (!container) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

      const text = sel.toString().trim();
      if (!text || text.length > MAX_SELECTION) return;

      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      let locator: string | undefined;
      try {
        locator = getLocator?.(sel);
      } catch {
        locator = undefined;
      }

      setSelection({
        text,
        locator,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left + rect.width / 2,
        placeBelow: rect.top < 90,
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      // Clicks inside the popover must not dismiss it.
      if (popoverRef.current?.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mouseup', captureSelection);
    document.addEventListener('touchend', captureSelection);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mouseup', captureSelection);
      document.removeEventListener('touchend', captureSelection);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, getLocator, close]);

  const save = async (withNote: boolean) => {
    if (!selection || saving) return;
    setSaving(true);

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId,
          selected_text: selection.text,
          position: selection.locator,
          color,
          note: withNote && note.trim() ? note.trim() : undefined,
        }),
      });

      if (res.status === 401) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
        router.push(`/login${next}`);
        return;
      }
      if (res.status === 503) {
        toast.info('Highlights are coming soon.');
        close();
        return;
      }
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(json?.error || 'Could not save highlight.');
        return;
      }

      const json = (await res.json()) as { highlight: HighlightRow };
      toast.success(withNote ? 'Note saved' : 'Highlight saved');
      onCreated?.(json.highlight);
      window.getSelection()?.removeAllRanges();
      close();
    } catch {
      toast.error('Could not save highlight.');
    } finally {
      setSaving(false);
    }
  };

  if (!selection) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Highlight selection"
      className={cn(
        'fixed z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-xl',
        className
      )}
      style={{
        top: selection.placeBelow ? selection.bottom + 12 : selection.top - 12,
        left: Math.min(Math.max(selection.left, 140), window.innerWidth - 140),
        transform: selection.placeBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Highlighter className="h-3.5 w-3.5" />
          Highlight
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 line-clamp-3 max-h-20 overflow-hidden rounded bg-muted p-2 text-xs italic text-muted-foreground">
        &ldquo;{selection.text}&rdquo;
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={HIGHLIGHT_COLOR_CLASSES[c].label}
              aria-label={`Highlight ${HIGHLIGHT_COLOR_CLASSES[c].label}`}
              onClick={() => setColor(c)}
              className={cn(
                'h-6 w-6 rounded-full ring-2 ring-transparent transition-all',
                HIGHLIGHT_COLOR_CLASSES[c].swatch,
                color === c && 'ring-foreground'
              )}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setNoteMode((v) => !v)}
          aria-pressed={noteMode}
          title="Add a note"
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </div>

      {noteMode && (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note to this highlight…"
          rows={3}
          maxLength={5000}
          className="mt-2 text-sm"
          autoFocus
        />
      )}

      <Button
        type="button"
        size="sm"
        className="mt-2 w-full"
        disabled={saving}
        onClick={() => save(noteMode)}
      >
        {saving ? 'Saving…' : noteMode ? 'Save note' : 'Save highlight'}
      </Button>
    </div>
  );
}
