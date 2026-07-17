import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hydrateSession, setSessionStorage, useSessionStore } from '@kride/core';
import { secureSessionStorage } from '../src/sessionStorage';
import '../global.css';

const queryClient = new QueryClient();

// Registered at module scope so the adapter is in place before any screen
// renders and before `hydrateSession` runs.
setSessionStorage(secureSessionStorage);

export default function RootLayout() {
  const isHydrated = useSessionStore((state) => state.isHydrated);

  useEffect(() => {
    void hydrateSession();
  }, []);

  // Hold the first frame until the stored session is read, otherwise a
  // logged-in user briefly renders as logged out.
  if (!isHydrated) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
