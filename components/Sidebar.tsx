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
    {
    category: "Controles",
    items: [
      { name: "Proyectos", path: "/controles/proyectos" },
    ],
  },
];

export default function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <div
      className={`
        fixed md:static top-0 left-0 h-full w-64 bg-[#003331] text-white z-50
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}
    >
      <div className="p-4 text-sm">

        {menu.map((section) => (
          <div key={section.category} className="mb-6">

            <p className="text-xs text-white/50 uppercase mb-3">
              {section.category}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 rounded-lg transition ${
                      active
                        ? "bg-[#00FF95] text-[#003331] font-semibold"
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