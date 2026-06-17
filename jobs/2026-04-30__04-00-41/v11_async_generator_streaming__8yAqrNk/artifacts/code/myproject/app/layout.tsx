import type { Metadata } from 'next';
import TrpcProvider from './_trpc/Provider';

export const metadata: Metadata = {
  title: 'tRPC v11 Streaming Demo',
  description: 'AsyncGenerator streaming via httpBatchStreamLink',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: 0,
          background: '#0b0d12',
          color: '#e6e8ee',
        }}
      >
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
