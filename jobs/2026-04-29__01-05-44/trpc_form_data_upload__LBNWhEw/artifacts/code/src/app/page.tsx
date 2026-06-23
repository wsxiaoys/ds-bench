'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  
  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      setUploadUrl(data.url);
      setFile(null);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadMutation.mutate(formData);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8 text-gray-900 text-center">tRPC v11 File Upload</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 items-center">
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select an image to upload
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
          </div>
          <button
            type="submit"
            disabled={!file || uploadMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white font-bold rounded-md disabled:bg-gray-400 hover:bg-blue-700 transition-colors shadow-sm"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Image'}
          </button>
        </form>

        {uploadMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
            Error: {uploadMutation.error.message}
          </div>
        )}
      </div>

      {uploadUrl && (
        <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <p className="mb-4 text-green-600 font-bold text-lg">Upload successful!</p>
          <div className="flex flex-col items-center">
            <img 
              src={uploadUrl} 
              alt="Uploaded" 
              className="max-w-md rounded-lg shadow-2xl border-4 border-white" 
            />
            <div className="mt-4 p-3 bg-white rounded-md border border-gray-200 text-xs text-gray-500 break-all max-w-md shadow-sm">
              <span className="font-semibold block mb-1">Accessible at:</span>
              {uploadUrl}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
