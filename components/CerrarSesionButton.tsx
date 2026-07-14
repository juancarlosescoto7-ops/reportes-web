"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

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
      className="flex w-full items-center justify-center gap-2 border border-slate-300 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#005f48] hover:bg-white hover:text-[#005f48]"
    >
      <LogOut className="h-3.5 w-3.5" />
      Cerrar sesion
    </button>
  );
}
