import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

export default function DynamicViewLayout({ children }: { children: React.ReactNode }) { return children; }
