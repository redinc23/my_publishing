import { cn } from '@/lib/utils/cn';

interface HeroProps {
  children: React.ReactNode;
  className?: string;
  background?: 'dark' | 'gradient';
}

export function Hero({ children, className, background = 'dark' }: HeroProps) {
  const backgroundClasses = {
    dark: 'bg-background',
    gradient: 'bg-gradient-to-b from-background via-muted to-background',
  };

  return (
    <div className={cn('relative min-h-[60vh] flex items-center', backgroundClasses[background], className)}>
      {children}
    </div>
  );
}
