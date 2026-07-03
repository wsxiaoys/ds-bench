import type { Metadata } from 'next';
import { TRPCProvider } from '@/trpc/Provider';

export const metadata: Metadata = {
  title: 'tRPC Streaming Demo',
  description: 'tRPC v11 streaming response demo',
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