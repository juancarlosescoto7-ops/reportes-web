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
          className={`${inter.className} min-h-screen bg-[#eef1f5] text-slate-900 antialiased`}
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
        className={`${inter.className} h-screen overflow-hidden bg-[#eef1f5] text-slate-900 antialiased`}
      >
        {/* HEADER */}
        <header className="relative h-16 w-full overflow-hidden border-b bg-white flex items-center justify-between">
          {/* IMAGEN HEADER */}
          <div className="absolute inset-0">
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
            className="fixed bottom-5 right-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-[#003331] text-xl text-white shadow-lg transition active:scale-95 md:hidden"
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
        <main className="h-[calc(100vh-4rem)] overflow-hidden bg-[#eef1f5] p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="h-full overflow-y-auto">{children}</div>
        </main>
      </body>
    </html>
  );
}