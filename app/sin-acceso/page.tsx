import Link from "next/link";

export default function SinAccesoPage() {
  return (
    <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6">
      <section className="w-full max-w-lg border border-slate-300 bg-white p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Acceso restringido
          </p>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            No tiene permisos para acceder
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Su usuario está autenticado, pero no tiene autorización para ingresar
            a este módulo.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-[#005f48] hover:text-[#005f48]"
          >
            Volver al login
          </Link>
        </div>
      </section>
    </main>
  );
}