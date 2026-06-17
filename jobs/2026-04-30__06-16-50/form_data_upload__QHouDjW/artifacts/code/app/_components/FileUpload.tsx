"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/react";

export function FileUpload() {
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.upload.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadedUrl(data.url);
      setUploadedName(data.originalName);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setUploadedUrl(null);
      setUploadedName(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      setError("Please select a file to upload.");
      return;
    }

    uploadMutation.mutate(formData);
  };

  const handleReset = () => {
    setUploadedUrl(null);
    setUploadedName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Upload a File
        </h2>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="file"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Choose an image file
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="file"
            name="file"
            accept="image/*"
            className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {uploadMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Uploading...
              </span>
            ) : (
              "Upload"
            )}
          </button>

          {uploadedUrl && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Upload Another
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {uploadedUrl && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
              Upload successful! {uploadedName}
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedUrl}
                alt={uploadedName ?? "Uploaded file"}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}