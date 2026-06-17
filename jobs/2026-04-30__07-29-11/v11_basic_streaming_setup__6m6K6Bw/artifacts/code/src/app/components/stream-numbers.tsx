"use client";

import { useEffect, useState } from "react";

import { trpcClient } from "@/lib/trpc-client";

export function StreamNumbers() {
  const [numbers, setNumbers] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    const stream = async () => {
      const iterable = await trpcClient.streamNumbers.query();

      for await (const value of iterable) {
        if (cancelled) {
          break;
        }

        setNumbers((current) => [...current, value]);
      }
    };

    void stream();

    return () => {
      cancelled = true;
    };
  }, []);

  return <div id="stream-output">{numbers.join(", ")}</div>;
}
