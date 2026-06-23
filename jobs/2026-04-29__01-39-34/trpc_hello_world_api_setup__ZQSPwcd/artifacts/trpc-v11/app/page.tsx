"use client";

import styles from "./page.module.css";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery("World");

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>tRPC v11 Hello World</h1>
          {isLoading && <p>Loading greeting...</p>}
          {error && <p>Failed to load greeting.</p>}
          {data && <p>{data}</p>}
        </div>
      </main>
    </div>
  );
}
