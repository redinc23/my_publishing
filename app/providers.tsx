'use client';

import { AuthProvider } from '@/components/providers/auth-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { AudioPlayerProvider } from '@/components/audio/AudioContext';
import { MiniPlayer } from '@/components/audio/MiniPlayer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <AudioPlayerProvider>
          {children}
          <MiniPlayer />
        </AudioPlayerProvider>
        <ToastProvider />
      </AuthProvider>
    </ThemeProvider>
  );
}
