"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { trpc } from "@/trpc/client";

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.url);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    uploadFile.mutate(formData);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.header}>
          <h1>Upload an image with tRPC v11</h1>
          <p>Choose a file and send it as FormData directly to the mutation.</p>
        </section>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Select an image
            <input
              name="file"
              type="file"
              accept="image/*"
              required
              className={styles.input}
            />
          </label>
          <button
            type="submit"
            className={styles.button}
            disabled={uploadFile.isPending}
          >
            {uploadFile.isPending ? "Uploading..." : "Upload"}
          </button>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}

        {imageUrl ? (
          <div className={styles.preview}>
            <p>Uploaded image preview:</p>
            <Image
              src={imageUrl}
              alt="Uploaded file preview"
              width={480}
              height={360}
              className={styles.previewImage}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
