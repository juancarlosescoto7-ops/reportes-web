"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Image from "next/image";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <html lang="en">
      <body className={`${inter.className} h-screen bg-gray-50 overflow-hidden`}>

        {/* HEADER */}
        <header className="h-16 w-full overflow-hidden relative bg-white border-b flex items-center">

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
            className="md:hidden fixed top-20 left-3 z-[60] bg-[#003331] text-white px-3 py-2 rounded-md shadow-md"
          >
            ☰
          </button>

        </header>

        {/* OVERLAY MOBILE */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
          />
        )}

        {/* CONTENEDOR PRINCIPAL */}
        <div className="relative h-[calc(100vh-4rem)]">

          {/* SIDEBAR DESKTOP */}
          <aside className="hidden md:block fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] bg-[#003331] overflow-y-auto z-50">
            <Sidebar open={open} setOpen={setOpen} />
          </aside>

          {/* SIDEBAR MOBILE (OVERLAY CONTROLADO POR COMPONENTE) */}
          <div className="md:hidden">
            <Sidebar open={open} setOpen={setOpen} />
          </div>

          {/* CONTENIDO */}
          <main className="h-full md:ml-64 overflow-y-auto p-6">
            {children}
          </main>

        </div>

      </body>
    </html>
  );
}