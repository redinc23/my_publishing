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
  MoreHorizontal
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

export function ReadingList({ userId, books, isOwnProfile = false, compact = false }: ReadingListProps) {
  const [readingList, setReadingList] = useState(books);
  const [activeTab, setActiveTab] = useState<string>('currently_reading');

  const getBooksByStatus = (status: string) => {
    return readingList.filter(book => book.status === status);
  };

  const handleStatusUpdate = async (bookId: string, newStatus: string) => {
    try {
      await updateReadingStatus(bookId, newStatus as ReadingStatus);
      
      setReadingList(prev => 
        prev.map(book => 
          book.id === bookId 
            ? { ...book, status: newStatus as any }
            : book
        )
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
      want_to_read: { label: 'Want to Read', variant: 'outline', className: 'border-yellow-200 text-yellow-700' },
      currently_reading: { label: 'Reading Now', variant: 'default', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      read: { label: 'Finished', variant: 'default', className: 'bg-green-100 text-green-700 border-green-200' },
      dropped: { label: 'Dropped', variant: 'default', className: 'bg-red-100 text-red-700 border-red-200' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.want_to_read;
    
    return (
      <Badge variant="outline" className={`text-xs ${badge.className}`}>
        {badge.label}
      </Badge>
    );
  };

  const renderBookItem = (book: BookItem) => (
    <div key={book.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
      {/* Book Cover */}
      <Link href={`/books/${book.id}`} className="flex-shrink-0">
        <div className="relative w-12 h-16 rounded overflow-hidden shadow-sm">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-gray-500" />
            </div>
          )}
        </div>
      </Link>

      {/* Book Info */}
      <div className="flex-1 min-w-0">
        <Link 
          href={`/books/${book.id}`}
          className="block group-hover:text-blue-600 transition-colors"
        >
          <h4 className="font-medium text-gray-900 truncate">
            {book.title}
          </h4>
        </Link>
        <p className="text-sm text-gray-600 truncate">
          {book.author_name}
        </p>
        
        {book.status === 'currently_reading' && book.progress_percentage && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{book.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
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
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleStatusUpdate(book.id, 
              book.status === 'currently_reading' ? 'read' : 'currently_reading'
            )}
          >
            {book.status === 'currently_reading' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );

  if (compact) {
    const currentBooks = getBooksByStatus('currently_reading').slice(0, 3);
    
    return (
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Reading List
          </h3>
          <Link 
            href={`/users/${userId}/reading-list`}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {currentBooks.length > 0 ? (
          <div className="space-y-3">
            {currentBooks.map(renderBookItem)}
          </div>
        ) : (
          <div className="text-center py-6">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No books in reading list</p>
          </div>
        )}
        
        {isOwnProfile && (
          <div className="mt-4 pt-4 border-t">
            <Link href="/dashboard/reading-list">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Books
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Reading List</h2>
        {isOwnProfile && (
          <Link href="/dashboard/reading-list">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Manage List
            </Button>
          </Link>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          {statusTabs.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="flex items-center gap-2"
            >
              <tab.icon className={`w-4 h-4 ${tab.color}`} />
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
              <div className="text-center py-12">
                <tab.icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No books in this category</p>
                {isOwnProfile && tab.id === 'want_to_read' && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {/* Open book search */}}
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
