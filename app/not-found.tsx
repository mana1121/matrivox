import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div className="text-center">
        <div className="text-5xl font-semibold text-slate-300">404</div>
        <p className="mt-2 text-slate-600">Halaman tidak dijumpai.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Kembali ke laman utama
        </Link>
      </div>
    </main>
  );
}
