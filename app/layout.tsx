import { ReactNode } from 'react';
import '../components/design-system/styles/tokens.css';
import '../components/styles/global.css';

import { SyncEngineProvider } from '../core/persistence';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HTML Annotation App',
  description: 'Offline-capable HTML annotation tool',
  manifest: '/manifest.json',
  themeColor: '#000000',
};

export const runtime = 'edge';

export default function RootLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SyncEngineProvider>
          {children}
        </SyncEngineProvider>
      </body>
    </html>
  );
}
