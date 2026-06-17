import type { Metadata } from 'next';
import './globals.css';
import { TRPCProvider } from '@/client/provider';

export const metadata: Metadata = {
  title: 'tRPC File Upload',
  description: 'File upload with tRPC v11 and native FormData',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}