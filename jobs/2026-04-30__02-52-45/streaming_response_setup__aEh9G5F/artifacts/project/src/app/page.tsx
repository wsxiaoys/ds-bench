"use client";

import { trpc } from "@/trpc/provider";

export default function Home() {
  const { data = [] } = trpc.streamWords.useQuery();

  return (
    <main style={{ padding: "2rem", fontSize: "1.5rem" }}>
      <p>{data.join(" ")}</p>
    </main>
  );
}
