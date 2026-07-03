import { TRPCProvider } from '@/trpc/Provider';

export const metadata = {
  title: 'tRPC Streaming',
  description: 'tRPC v11 streaming example',
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
