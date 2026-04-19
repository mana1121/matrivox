import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <section className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 ring-1 ring-white/30 grid place-items-center">
            <span className="text-xl font-semibold">M</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Matrivox</span>
        </div>

        <div>
          <h1 className="text-4xl font-semibold leading-tight">
            Aduan kampus, <br />
            <span className="text-brand-200">tersusun secara digital.</span>
          </h1>
          <p className="mt-4 max-w-md text-brand-100/90">
            Matrivox menukar aduan WhatsApp kepada tiket berstruktur, menghalakannya kepada PIC
            yang betul, dan menjejak status sehingga selesai.
          </p>
        </div>

        <div className="text-xs text-brand-100/70">
          © {new Date().getFullYear()} Matrivox · Prototaip Inovasi
        </div>
      </section>

      {/* Right: form */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-600 text-white grid place-items-center font-semibold">
              M
            </div>
            <span className="text-lg font-semibold tracking-tight">Matrivox</span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Log masuk</h2>
          <p className="mt-1 text-sm text-slate-500">
            Akaun Admin atau PIC. Hubungi pentadbir untuk akses baharu.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
