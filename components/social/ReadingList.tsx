/* eslint-disable */
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  BookMarked,
  Clock,
  CheckCircle,
  ChevronRight,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateReadingStatus, type ReadingStatus } from '@/lib/actions/reading-list';
import { toast } from 'sonner';

interface BookItem {
  id: string;
  title: string;
  cover_url?: string;
  author_name: string;
  status?: 'want_to_read' | 'currently_reading' | 'read' | 'dropped';
  added_at?: string;
  started_at?: string;
  finished_at?: string;
  progress_percentage?: number;
}

interface ReadingListProps {
  userId: string;
  books: BookItem[];
  isOwnProfile?: boolean;
  compact?: boolean;
}

export function ReadingList({
  userId,
  books,
  isOwnProfile = false,
  compact = false,
}: ReadingListProps) {
  const [readingList, setReadingList] = useState(books);
  const [activeTab, setActiveTab] = useState<string>('currently_reading');

  const getBooksByStatus = (status: string) => {
    return readingList.filter((book) => book.status === status);
  };

  const handleStatusUpdate = async (bookId: string, newStatus: string) => {
    try {
      await updateReadingStatus(bookId, newStatus as ReadingStatus);

      setReadingList((prev) =>
        prev.map((book) => (book.id === bookId ? { ...book, status: newStatus as any } : book))
      );

      toast.success('Reading list updated');
    } catch (error) {
      toast.error('Failed to update reading status');
    }
  };

  const statusTabs = [
    { id: 'currently_reading', label: 'Reading Now', icon: BookOpen, color: 'text-blue-600' },
    { id: 'want_to_read', label: 'Want to Read', icon: BookMarked, color: 'text-yellow-600' },
    { id: 'read', label: 'Finished', icon: CheckCircle, color: 'text-green-600' },
    { id: 'dropped', label: 'Dropped', icon: Clock, color: 'text-red-600' },
  ];

  const getStatusBadge = (status: string) => {
    const badges = {
      want_to_read: {
        label: 'Want to Read',
        variant: 'outline',
        className: 'border-yellow-200 text-yellow-700',
      },
      currently_reading: {
        label: 'Reading Now',
        variant: 'default',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      read: {
        label: 'Finished',
        variant: 'default',
        className: 'bg-green-100 text-green-700 border-green-200',
      },
      dropped: {
        label: 'Dropped',
        variant: 'default',
        className: 'bg-red-100 text-red-700 border-red-200',
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.want_to_read;

    return (
      <Badge variant="outline" className={`text-xs ${badge.className}`}>
        {badge.label}
      </Badge>
    );
  };

  const renderBookItem = (book: BookItem) => (
    <div
      key={book.id}
      className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
    >
      {/* Book Cover */}
      <Link href={`/books/${book.id}`} className="flex-shrink-0">
        <div className="relative h-16 w-12 overflow-hidden rounded shadow-sm">
          {book.cover_url ? (
            <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
              <BookOpen className="h-6 w-6 text-gray-500" />
            </div>
          )}
        </div>
      </Link>

      {/* Book Info */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/books/${book.id}`}
          className="block transition-colors group-hover:text-blue-600"
        >
          <h4 className="truncate font-medium text-gray-900">{book.title}</h4>
        </Link>
        <p className="truncate text-sm text-gray-600">{book.author_name}</p>

        {book.status === 'currently_reading' && book.progress_percentage && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{book.progress_percentage}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${book.progress_percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-2">
        {getStatusBadge(book.status || 'want_to_read')}

        {isOwnProfile && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() =>
              handleStatusUpdate(
                book.id,
                book.status === 'currently_reading' ? 'read' : 'currently_reading'
              )
            }
          >
            {book.status === 'currently_reading' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );

  if (compact) {
    const currentBooks = getBooksByStatus('currently_reading').slice(0, 3);

    return (
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Reading List
          </h3>
          <Link
            href={`/users/${userId}/reading-list`}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {currentBooks.length > 0 ? (
          <div className="space-y-3">{currentBooks.map(renderBookItem)}</div>
        ) : (
          <div className="py-6 text-center">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No books in reading list</p>
          </div>
        )}

        {isOwnProfile && (
          <div className="mt-4 border-t pt-4">
            <Link href="/dashboard/reading-list">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Books
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reading List</h2>
        {isOwnProfile && (
          <Link href="/dashboard/reading-list">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Manage List
            </Button>
          </Link>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-4">
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              <tab.icon className={`h-4 w-4 ${tab.color}`} />
              {tab.label}
              <Badge variant="secondary" className="ml-1">
                {getBooksByStatus(tab.id).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {statusTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-3">
            {getBooksByStatus(tab.id).length > 0 ? (
              getBooksByStatus(tab.id).map(renderBookItem)
            ) : (
              <div className="py-12 text-center">
                <tab.icon className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">No books in this category</p>
                {isOwnProfile && tab.id === 'want_to_read' && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      /* Open book search */
                    }}
                  >
                    Add Books to Read
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
