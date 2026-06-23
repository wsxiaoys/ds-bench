import type { ReactNode } from 'react';
import Provider from './Provider';

export const metadata = {
  title: 'tRPC Hello World',
  description: 'tRPC v11 Hello World API with Next.js App Router',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
