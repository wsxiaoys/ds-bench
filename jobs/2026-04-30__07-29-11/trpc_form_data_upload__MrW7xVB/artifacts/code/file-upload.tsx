"use client";

import Image from "next/image";
import { useState } from "react";
import { trpc } from "@/trpc/react";

export function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const uploadFile = trpc.uploadFile.useMutation({
    onSuccess: (result) => {
      setUploadedUrl(result.url);
      setSelectedFile(null);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    await uploadFile.mutateAsync(formData);
    event.currentTarget.reset();
  };

  return (
    <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          tRPC v11 + Native FormData
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">Upload an image</h1>
        <p className="text-sm leading-6 text-slate-600">
          Select an image file and submit it directly through a tRPC mutation that accepts FormData.
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Image file</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </label>

        <button
          type="submit"
          disabled={!selectedFile || uploadFile.isPending}
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {uploadFile.isPending ? "Uploading..." : "Upload image"}
        </button>

        {uploadFile.error ? (
          <p className="text-sm text-red-600">{uploadFile.error.message}</p>
        ) : null}
      </form>

      {uploadedUrl ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm font-medium text-slate-700">Uploaded preview</p>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <Image
              src={uploadedUrl}
              alt="Uploaded file preview"
              width={1200}
              height={800}
              className="h-auto w-full object-cover"
              unoptimized
            />
          </div>
          <p className="text-sm text-slate-500">Saved to {uploadedUrl}</p>
        </div>
      ) : null}
    </div>
  );
}
