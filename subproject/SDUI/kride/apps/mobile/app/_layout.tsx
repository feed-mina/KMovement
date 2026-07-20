import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hydrateSession, setSessionStorage } from '@kride/core';
import { secureSessionStorage } from '../src/sessionStorage';
import '../global.css';

// Surface render-time exceptions on screen instead of a silent white screen —
// expo-router only installs its boundary when the root layout exports one.
export { ErrorBoundary } from 'expo-router';

const queryClient = new QueryClient();

// Registered at module scope so the adapter is in place before any screen
// renders and before `hydrateSession` runs.
setSessionStorage(secureSessionStorage);

export default function RootLayout() {
  useEffect(() => {
    void hydrateSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
