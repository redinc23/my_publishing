'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

interface ReviewFiltersProps {
  sortBy: 'recent' | 'helpful' | 'highest' | 'lowest';
  onSortChange: (sort: 'recent' | 'helpful' | 'highest' | 'lowest') => void;
  filterSpoilers?: boolean;
  onFilterSpoilersChange?: (filter: boolean) => void;
  className?: string;
}

export function ReviewFilters({
  sortBy,
  onSortChange,
  filterSpoilers = true,
  onFilterSpoilersChange,
  className
}: ReviewFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort reviews" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
            </SelectContent>
          </Select>

          {onFilterSpoilersChange && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {showFilters && <X className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>
      </div>

      {showFilters && onFilterSpoilersChange && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filterSpoilers}
              onChange={(e) => onFilterSpoilersChange(e.target.checked)}
              className="rounded border-gray-300"
            />
            Hide spoiler reviews
          </label>
        </div>
      )}
    </div>
  );
}