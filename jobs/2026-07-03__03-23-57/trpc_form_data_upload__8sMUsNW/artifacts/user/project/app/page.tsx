'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import Image from 'next/image';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.uploadFile.useMutation({
    onSuccess: (data) => {
      console.log('Upload successful:', data);
    },
    onError: (error) => {
      console.error('Upload error:', error);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await uploadMutation.mutateAsync(formData);
    } catch (err) {
      console.error('Failed to upload file:', err);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    uploadMutation.reset();
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            tRPC v11 File Upload
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Upload images seamlessly using native FormData
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="flex flex-col items-center justify-center">
            {!previewUrl ? (
              <label className="w-full flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 text-blue-500 rounded-lg shadow-lg tracking-wide uppercase border border-blue-500 border-dashed cursor-pointer hover:bg-blue-500 hover:text-white transition-all duration-300">
                <svg
                  className="w-8 h-8"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
                </svg>
                <span className="mt-2 text-sm leading-normal font-semibold">Select a file</span>
                <input
                  type="file"
                  name="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
            ) : (
              <div className="w-full space-y-4">
                <div className="relative h-64 w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate max-w-[250px] font-medium">{selectedFile?.name}</span>
                  <span>{selectedFile ? (selectedFile.size / 1024).toFixed(1) : 0} KB</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            {previewUrl && (
              <button
                type="button"
                onClick={handleReset}
                disabled={uploadMutation.isPending}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Reset
              </button>
            )}
            <button
              type="submit"
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>

        {/* Success State */}
        {uploadMutation.isSuccess && uploadMutation.data && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg space-y-4">
            <h3 className="text-sm font-bold text-green-800 dark:text-green-400 flex items-center">
              <svg className="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Upload Successful!
            </h3>
            <div className="relative h-64 w-full rounded-lg overflow-hidden border border-green-200 dark:border-green-800 bg-white dark:bg-gray-900">
              <Image
                src={uploadMutation.data.url}
                alt="Uploaded Image"
                fill
                className="object-contain"
              />
            </div>
            <div className="text-xs text-green-700 dark:text-green-400 space-y-1">
              <p><span className="font-semibold">URL:</span> <a href={uploadMutation.data.url} target="_blank" rel="noreferrer" className="underline hover:text-green-900 dark:hover:text-green-200">{uploadMutation.data.url}</a></p>
              <p><span className="font-semibold">Name:</span> {uploadMutation.data.name}</p>
              <p><span className="font-semibold">Type:</span> {uploadMutation.data.type}</p>
              <p><span className="font-semibold">Size:</span> {(uploadMutation.data.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {uploadMutation.isError && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Upload Failed</h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                {uploadMutation.error.message || 'An unexpected error occurred.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
