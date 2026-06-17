"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => {
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
    }
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
