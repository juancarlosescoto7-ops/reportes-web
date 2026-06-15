"use client";

import { useEffect, useState } from "react";
import {
  obtenerMisPermisos,
  SesionPermisos,
} from "@/lib/permisos-sistema";

import CerrarSesionButton from "@/components/CerrarSesionButton";

export default function ProbarPermisosPage() {
  const [datos, setDatos] = useState<SesionPermisos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const permisos = await obtenerMisPermisos();
      setDatos(permisos);
      setCargando(false);
    }

    cargar();
  }, []);

  if (cargando) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6">
        <section className="border border-slate-300 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Cargando permisos...</p>
        </section>
      </main>
    );
  }

  if (!datos) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6">
        <section className="w-full max-w-lg border border-red-300 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">
            No se encontraron permisos
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Puede que el usuario no haya iniciado sesión o que no esté vinculado
            en la tabla usuarios_sistema.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-6 py-10">
      <section className="mx-auto max-w-3xl border border-slate-300 bg-white p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Permisos del usuario autenticado
              </p>

              <h1 className="mt-3 text-2xl font-semibold text-slate-900">
                {datos.nombreUsuario}
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                Rol:{" "}
                <span className="font-semibold text-[#005f48]">
                  {datos.rolNombre}
                </span>
              </p>
            </div>

            <CerrarSesionButton />
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Permisos asignados
          </h2>

          <div className="mt-4 space-y-2">
            {datos.permisosDetalle.map((permiso) => (
              <div
                key={permiso.permiso_codigo}
                className="grid grid-cols-[180px_1fr] border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <span className="font-semibold text-slate-700">
                  {permiso.permiso_codigo}
                </span>

                <span className="text-slate-600">
                  {permiso.permiso_nombre} — {permiso.ruta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}