import { FileUpload } from "@/components/file-upload";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16">
      <FileUpload />
    </main>
  );
}
