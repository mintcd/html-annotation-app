import { ReactNode } from 'react';
import '../styles/global.css';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

export const metadata = {
  title: 'Annotation',
  description: 'Annotation for HTML and PDF documents',
};

export const runtime = 'edge';

export default function RootLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}