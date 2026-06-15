"use client";

import { useRouter } from "next/navigation";
import { crearClienteSupabase } from "@/lib/supabase";

export default function CerrarSesionButton() {
  const router = useRouter();

  async function cerrarSesion() {
    const supabase = crearClienteSupabase();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      className="border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#005f48] hover:text-[#005f48]"
    >
      Cerrar sesión
    </button>
  );
}