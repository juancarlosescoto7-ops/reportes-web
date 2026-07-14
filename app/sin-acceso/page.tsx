import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SinAccesoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="glass-shell w-full max-w-lg p-8">
        <div className="border-b border-slate-200 pb-5">
          <div className="mb-5 grid h-11 w-11 place-items-center bg-[#003331] text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Acceso restringido
          </p>

          <h1 className="mt-3 text-2xl font-semibold text-slate-950">
            No tiene permisos para acceder
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Su usuario esta autenticado, pero no tiene autorizacion para
            ingresar a este modulo.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#005f48] hover:text-[#005f48]"
          >
            Volver al login
          </Link>
        </div>
      </section>
    </main>
  );
}
