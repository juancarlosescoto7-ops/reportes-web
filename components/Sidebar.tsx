"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const menu = [
  {
    category: "General",
    items: [{ name: "Inicio", path: "/" }],
  },
  {
    category: "Reportes",
    items: [
      { name: "Egresos", path: "/reportes/ordenes-de-pago" },
      { name: "Presupuesto", path: "/reportes/presupuesto" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="h-full w-full bg-[#003331] text-white text-sm flex flex-col">

      {/* CONTENIDO */}
      <div className="p-4 flex-1 overflow-y-auto">

        {menu.map((section) => (
          <div key={section.category} className="mb-6">

            {/* CATEGORÍA */}
            <p className="text-xs uppercase tracking-wider text-white/50 mb-3">
              {section.category}
            </p>

            {/* ITEMS */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`block px-3 py-2 rounded-lg transition-all duration-200 ${
                      active
                        ? "bg-[#00FF95] text-[#003331] font-semibold shadow-sm"
                        : "text-white/80 hover:bg-[#00FF95]/10 hover:text-[#00FF95]"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

          </div>
        ))}

      </div>

    </div>
  );
}