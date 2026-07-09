'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const libraryItems = [
  { href: '/books', label: 'Books' },
  { href: '/comics', label: 'Comic Books' },
  { href: '/papers', label: 'Papers' },
];

const navItems = [
  { href: '/authors', label: 'Authors' },
  { href: '/audio', label: 'Audio' },
  { href: '/discover', label: 'Discover' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-6 py-4 text-left">
          <SheetTitle className="text-2xl font-bold text-primary">MANGU</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-secondary">
            Library
          </p>
          {libraryItems.map((item) => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  'flex min-h-[44px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive ? 'text-primary' : 'text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="my-2 h-px bg-border" aria-hidden="true" />

          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  'flex min-h-[44px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive ? 'text-primary' : 'text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
