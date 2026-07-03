import type { Metadata } from "next";
import "./globals.css";

import { TRPCProvider } from "./_trpc/Provider";

export const metadata: Metadata = {
  title: "tRPC Streaming Demo",
  description: "Streaming tRPC v11 demo with Next.js",
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