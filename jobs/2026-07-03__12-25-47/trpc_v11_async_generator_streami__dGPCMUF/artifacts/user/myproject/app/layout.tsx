import type { Metadata } from 'next';
import { TRPCProvider } from './_components/TRPCProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'tRPC v11 Streaming',
  description: 'tRPC v11 Async Generator Streaming Demo',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
