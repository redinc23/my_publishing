'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

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

export function Navigation() {
  const pathname = usePathname();

  const isLibraryActive = libraryItems.some((item) => pathname?.startsWith(item.href));

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {/* Library Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'group inline-flex items-center gap-1 text-sm font-medium outline-none transition-colors hover:text-primary',
            isLibraryActive ? 'text-primary' : 'text-foreground'
          )}
        >
          Library
          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          {libraryItems.map((item) => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn('cursor-pointer', isActive ? 'text-primary' : 'text-foreground')}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Direct Nav Links */}
      {navItems.map((item) => {
        const isActive = pathname?.startsWith(item.href) ?? false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive ? 'text-primary' : 'text-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
