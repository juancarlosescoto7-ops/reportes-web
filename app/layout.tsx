import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen bg-gray-50 overflow-hidden`}>

        {/* HEADER */}
        <header className="h-16 w-full relative overflow-hidden">
          <Image
            src="/logo.svg"
            alt="Header"
            fill
            priority
            className="object-cover"
          />
        </header>

        {/* MAIN */}
        <div className="flex h-[calc(100vh-4rem)]">

          {/* SIDEBAR */}
          <aside className="w-64 bg-[#003331] overflow-y-auto">
            <Sidebar />
          </aside>

          {/* CONTENIDO */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>

        </div>

      </body>
    </html>
  );
}