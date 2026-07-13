"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const esLogin = pathname === "/login";

  /**
   * LOGIN
   * Aquí el sistema muestra únicamente la pantalla de inicio de sesión.
   * No carga Header, Sidebar ni botón de cerrar sesión.
   */
  if (esLogin) {
    return (
      <html lang="es">
        <body
          className={`${inter.className} min-h-screen text-slate-900 antialiased`}
        >
          {children}
        </body>
      </html>
    );
  }

  /**
   * SISTEMA INTERNO
   * Aquí ya se muestra la estructura completa:
   * Header + Sidebar + contenido + cerrar sesión.
   */
  return (
    <html lang="es">
      <body
        className={`${inter.className} h-screen overflow-hidden text-slate-900 antialiased`}
      >
        {/* HEADER */}
        <header className="glass-shell relative z-30 mx-3 mt-3 flex h-14 items-center justify-between overflow-hidden rounded-lg px-4">
          {/* IMAGEN HEADER */}
          <div className="absolute inset-0 opacity-90">
            <Image
              src="/logo.svg"
              alt="Header"
              fill
              priority
              className="object-cover object-left"
            />
          </div>

          {/* BOTÓN MOBILE */}
          <button
            onClick={() => setOpen(!open)}
            className="fixed bottom-5 right-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-[#003331]/95 text-xl text-white shadow-lg shadow-emerald-950/20 backdrop-blur-xl transition active:scale-95 md:hidden"
          >
            ☰
          </button>
        </header>

        {/* SIDEBAR FLOTANTE */}
        <Sidebar
          open={open}
          setOpen={setOpen}
          mode="auto-hide"
          side="left"
        />

        {/* CONTENEDOR PRINCIPAL */}
        <main className="h-[calc(100vh-4.75rem)] overflow-hidden p-3 sm:p-4 md:p-6 lg:p-7">
          <div className="h-full overflow-y-auto rounded-lg">{children}</div>
        </main>
      </body>
    </html>
  );
}
