"use client";
import { ThemeProvider } from '../components/theme-provider';
import { AuthOverlayProvider } from '../components/auth-overlay';
import { Suspense } from 'react';

interface ProvidersProps { children: React.ReactNode }

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <AuthOverlayProvider>
          {children}
        </AuthOverlayProvider>
      </Suspense>
    </ThemeProvider>
  );
}
