import { ReactNode } from 'react';
import '../components/design-system/styles/tokens.css';
import '../components/styles/global.css';

import { SyncEngineProvider } from '../core/persistence';

export const metadata = {
  title: 'Annotation',
  description: 'Annotation for HTML documents',
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
