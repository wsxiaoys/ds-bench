import './globals.css';
import { TRPCProvider } from './_components/TRPCProvider';

export const metadata = {
  title: 'tRPC File Upload',
  description: 'tRPC v11 file upload demo with native FormData support',
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
