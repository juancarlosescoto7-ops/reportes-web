"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

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
        <header className="relative z-30 mx-3 mt-3 h-14 overflow-hidden border border-slate-200 bg-white shadow-sm sm:mx-4">
          <Image
            src="/logo.svg"
            alt="Municipalidad de Talanga"
            fill
            priority
            className="object-cover object-left"
          />

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

        <main className="h-[calc(100vh-4.75rem)] overflow-hidden p-3 sm:p-4 md:p-5">
          <div className="h-full overflow-y-auto pr-1">{children}</div>
        </main>
      </body>
    </html>
  );
}
