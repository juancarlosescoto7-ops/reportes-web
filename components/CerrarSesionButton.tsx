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
      className="w-full rounded-md border border-slate-300/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition hover:border-[#005f48]/50 hover:bg-white/90 hover:text-[#005f48]"
    >
      Cerrar sesión
    </button>
  );
}
