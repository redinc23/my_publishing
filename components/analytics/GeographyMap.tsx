'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import type { GeographyData } from '@/types/analytics';

interface GeographyMapProps {
  data: GeographyData[];
}

export function GeographyMap({ data }: GeographyMapProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <CardTitle>Geographic Distribution</CardTitle>
        </div>
        <CardDescription>Readers by country</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-2">
            {data.slice(0, 10).map((item) => (
              <div key={item.country_code} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCountryFlag(item.country_code)}</span>
                  <div>
                    <div className="font-medium">{item.country_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.readers} readers • {item.sessions} sessions
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {item.avg_engagement.toFixed(0)}% engagement
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No geographic data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCountryFlag(countryCode: string): string {
  // Simple emoji flag mapping (in production, use a proper library)
  const flags: Record<string, string> = {
    US: '🇺🇸',
    GB: '🇬🇧',
    CA: '🇨🇦',
    AU: '🇦🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    ES: '🇪🇸',
    IT: '🇮🇹',
    BR: '🇧🇷',
    IN: '🇮🇳',
  };
  return flags[countryCode.toUpperCase()] || '🌍';
}