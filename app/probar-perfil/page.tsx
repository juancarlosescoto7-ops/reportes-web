"use client";

import { useEffect, useState } from "react";
import { obtenerPerfilUsuario, PerfilUsuario } from "@/lib/supabase";

export default function ProbarPerfilPage() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarPerfil() {
      const datosPerfil = await obtenerPerfilUsuario();

      setPerfil(datosPerfil);
      setCargando(false);
    }

    cargarPerfil();
  }, []);

  if (cargando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="border border-slate-300 bg-white px-8 py-6 shadow-sm">
          <p className="text-sm text-slate-600">Cargando perfil...</p>
        </div>
      </main>
    );
  }

  if (!perfil) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="border border-red-300 bg-white px-8 py-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">
            Perfil no encontrado
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            El usuario inició sesión, pero no tiene un perfil institucional
            asignado en Supabase.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6">
      <section className="w-full max-w-lg border border-slate-300 bg-white p-8 shadow-sm">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Perfil institucional
          </p>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Usuario autenticado
          </h1>
        </div>

        <div className="mt-6 space-y-4 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-semibold text-slate-700">ID:</span>
            <span className="text-slate-600 break-all">{perfil.id}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-semibold text-slate-700">Nombre:</span>
            <span className="text-slate-600">{perfil.nombre}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-semibold text-slate-700">Rol:</span>
            <span className="font-bold text-[#005f48]">{perfil.rol}</span>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-4">
            <span className="font-semibold text-slate-700">Activo:</span>
            <span className="text-slate-600">
              {perfil.activo ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}