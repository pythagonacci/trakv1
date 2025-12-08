'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { makeQueryClient } from './query-client';

/**
 * React Query provider for Trak
 * Wraps the app to enable data caching and synchronization
 */
export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // Create a stable QueryClient instance per component mount
  // This ensures SSR hydration works correctly
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}