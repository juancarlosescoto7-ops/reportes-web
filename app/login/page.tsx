"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase";
import { obtenerMisPermisos } from "@/lib/permisos-sistema";

export default function LoginPage() {
  const router = useRouter();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setCargando(true);

    const supabase = crearClienteSupabase();

    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });

    setCargando(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

      const permisos = await obtenerMisPermisos();

      const rutasPermitidas = permisos?.permisosDetalle
        .map((permiso) => permiso.ruta)
        .filter((ruta): ruta is string => Boolean(ruta)) ?? [];

      const rutasPrioridad = [
        "/",
        "/controles/proyectos",
        "/reportes/ordenes-de-pago",
        "/reportes/presupuesto",
        "/reportes/compromisos-presupuestarios",
      ];

      const primeraRutaPermitida =
        rutasPrioridad.find((ruta) => rutasPermitidas.includes(ruta)) ??
        rutasPermitidas[0] ??
        "/sin-acceso";

      router.push(primeraRutaPermitida);
      router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6">
      <section className="w-full max-w-[920px] min-h-[520px] bg-white border border-slate-300 grid grid-cols-1 md:grid-cols-[1fr_420px] shadow-sm">
        {/* PANEL INSTITUCIONAL */}
        <div className="hidden md:flex flex-col justify-between bg-[#005f48] p-10 text-white">
          <div>
            <div className="mb-10">
              <div className="h-12 w-12 border border-white/40 flex items-center justify-center text-sm font-bold">
                MT
              </div>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              Sistema Administrativo Municipal
            </h1>

            <p className="mt-5 max-w-md text-sm leading-6 text-white/75">
              Plataforma institucional para consulta y gestión de procesos
              internos.
            </p>
          </div>

          <div className="border-t border-white/20 pt-6">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
              Acceso autorizado
            </p>
            <p className="mt-2 text-sm text-white/80">
              Municipalidad de Talanga
            </p>
          </div>
        </div>

        {/* FORMULARIO */}
        <div className="flex items-center justify-center p-8 md:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Inicio de sesión
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                Acceso al sistema
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Ingrese sus credenciales para continuar.
              </p>
            </div>

            <form onSubmit={iniciarSesion} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Correo electrónico
                </label>

                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                  placeholder="usuario@correo.com"
                  className="w-full h-11 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005f48]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Ingrese su contraseña"
                  className="w-full h-11 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005f48]"
                />
              </div>

              {error && (
                <div className="border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full h-11 bg-[#005f48] text-sm font-semibold text-white transition hover:bg-[#004b39] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? "Validando credenciales..." : "Ingresar"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                Acceso exclusivo para usuarios autorizados.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}