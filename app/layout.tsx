"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/modules/app-shell/components/Sidebar";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import BuscadorUniversal from "@/modules/busqueda-global/components/BuscadorUniversal";
import ComandosTeclado from "@/modules/app-shell/components/ComandosTeclado";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const esLogin = pathname === "/login";

  if (esLogin) {
    return (
      <html lang="es">
        <body
          className={`${inter.className} min-h-screen text-slate-900 antialiased selection:bg-emerald-200/70`}
        >
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body
        className={`${inter.className} h-screen overflow-hidden text-slate-900 antialiased selection:bg-emerald-200/70`}
      >
        <header className="app-header relative z-30 mx-3 mt-3 grid h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:mx-4 sm:gap-6 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <Image src="/logo.png" alt="Municipalidad de Talanga" fill sizes="40px" priority className="object-contain p-1" />
            </div>
            <div className="hidden min-w-0 lg:block">
              <div className="truncate text-[13px] font-bold tracking-tight text-slate-950">Municipalidad de Talanga</div>
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Gestión financiera</div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-3xl items-center">
            <BuscadorUniversal />
          </div>

          <div className="flex items-center gap-2 text-right">
            <ComandosTeclado />
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sistema activo</span>
          </div>

          <button
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
            className="fixed bottom-5 right-5 z-[70] flex h-11 w-11 items-center justify-center border border-slate-900 bg-slate-950 text-white shadow-lg transition hover:bg-[#003331] active:scale-95 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <Sidebar
          open={open}
          setOpen={setOpen}
          mode="auto-hide"
          side="left"
        />

        <main className="h-[calc(100vh-6rem)] overflow-hidden p-3 sm:p-4 md:p-5">
          <div className="h-full overflow-y-auto pr-1">{children}</div>
        </main>
      </body>
    </html>
  );
}
