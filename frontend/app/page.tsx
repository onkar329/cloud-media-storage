import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-8">
      <section className="max-w-xl text-center">
        <h1 className="text-4xl font-bold mb-4">Cloud Media Storage</h1>
        <p className="text-slate-600 mb-8">
          Secure file upload, folders, sharing, search and trash.
        </p>
        <div className="flex justify-center gap-3">
          <Link className="rounded-lg bg-blue-600 px-5 py-3 text-white" href="/login">Login</Link>
          <Link className="rounded-lg border px-5 py-3" href="/register">Create account</Link>
        </div>
      </section>
    </main>
  );
}
