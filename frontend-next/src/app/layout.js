import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantThemeProvider } from '@/contexts/TenantThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata = {
  title: 'Quadley',
  description: 'Campus community platform for residential colleges',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head suppressHydrationWarning />
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <AuthProvider>
            <TenantThemeProvider>
              {children}
            </TenantThemeProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
