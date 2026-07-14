"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

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
      setError("Correo o contrasena incorrectos.");
      return;
    }

    const permisos = await obtenerMisPermisos();

    const rutasPermitidas =
      permisos?.permisosDetalle
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
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="glass-shell grid min-h-[540px] w-full max-w-[980px] grid-cols-1 overflow-hidden md:grid-cols-[1fr_420px]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#003331] p-10 text-white md:flex">
          <div className="absolute inset-0 opacity-12">
            <Image
              src="/logo.svg"
              alt=""
              fill
              priority
              className="object-cover object-left"
            />
          </div>

          <div className="relative">
            <div className="relative mb-10 h-12 w-44 overflow-hidden border border-white/20 bg-white/10 px-3">
              <Image
                src="/logo.svg"
                alt="Municipalidad de Talanga"
                fill
                priority
                className="object-contain object-left brightness-0 invert"
              />
            </div>

            <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
              Sistema Administrativo Municipal
            </h1>

            <p className="mt-5 max-w-md text-sm leading-6 text-white/72">
              Plataforma institucional para consulta y gestion de procesos
              internos.
            </p>
          </div>

          <div className="relative border-t border-white/15 pt-6">
            <p className="text-xs uppercase tracking-[0.18em] text-white/54">
              Acceso autorizado
            </p>
            <p className="mt-2 text-sm text-white/78">
              Municipalidad de Talanga
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white/82 p-8 backdrop-blur-xl md:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <div className="mb-5 grid h-11 w-11 place-items-center bg-[#003331] text-white">
                <LockKeyhole className="h-5 w-5" />
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Inicio de sesion
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Acceso al sistema
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Ingrese sus credenciales para continuar.
              </p>
            </div>

            <form onSubmit={iniciarSesion} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Correo electronico
                </label>

                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                  placeholder="usuario@correo.com"
                  className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005f48]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Contrasena
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Ingrese su contrasena"
                  className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#005f48]"
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
                className="h-11 w-full bg-[#003331] text-sm font-semibold text-white transition hover:bg-[#002624] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? "Validando credenciales..." : "Ingresar"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200/70 pt-5">
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
