'use client';

import { useState } from 'react';
import { trpc } from './trpc/client';

export default function Home() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.url);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      alert('Upload failed. See console for details.');
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file || file.size === 0) {
      alert('Please select a file');
      return;
    }

    uploadMutation.mutate(formData);
  };

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">tRPC v11 File Upload</h1>
      
      <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="mb-4">
          <label htmlFor="file" className="block text-sm font-medium mb-2">
            Select an image
          </label>
          <input
            type="file"
            id="file"
            name="file"
            accept="image/*"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {imageUrl && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Uploaded Image:</h2>
          <div className="relative w-full max-w-md aspect-video border rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Uploaded file"
              className="object-contain w-full h-full"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 break-all">
            URL: {imageUrl}
          </p>
        </div>
      )}
    </main>
  );
}
