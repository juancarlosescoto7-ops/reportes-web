"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import CerrarSesionButton from "@/components/CerrarSesionButton";

const menu: {
  category: string;
  items: {
    name: string;
    path: string;
    permisoCodigo: string;
  }[];
}[] = [
  {
    category: "General",
    items: [
      {
        name: "Inicio",
        path: "/",
        permisoCodigo: "VER_DASHBOARD",
      },
    ],
  },
  {
    category: "Reportes",
    items: [
      {
        name: "Egresos",
        path: "/reportes/ordenes-de-pago",
        permisoCodigo: "VER_EGRESOS",
      },
      {
        name: "Presupuesto",
        path: "/reportes/presupuesto",
        permisoCodigo: "VER_PRESUPUESTO",
      },
      {
        name: "Compromisos",
        path: "/reportes/compromisos-presupuestarios",
        permisoCodigo: "VER_COMPROMISOS",
      },
      {
        name: "Pantalla compartida",
        path: "/reportes/pantalla-compartida",
        permisoCodigo: "VER_EGRESOS",
      },
    ],
  },
  {
    category: "Controles",
    items: [
      {
        name: "Proyectos",
        path: "/controles/proyectos",
        permisoCodigo: "VER_PROYECTOS",
      },
      {
        name: "Ingresos",
        path: "/ingresos",
        permisoCodigo: "VER_INGRESOS",
      },
    ],
  },
];

type SidebarSide = "left" | "right";
type SidebarMode = "normal" | "auto-hide";

export default function Sidebar({
  open,
  setOpen,
  side = "left",
  mode = "auto-hide",
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  side?: SidebarSide;
  mode?: SidebarMode;
}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);

  const {
    permisos,
    cargandoPermisos,
    rolNombre,
    nombreUsuario,
  } = usePermisosSistema();

  const isRight = side === "right";
  const isAutoHide = mode === "auto-hide";

  const expanded = open || hovered || !isAutoHide;

  const menuFiltrado = menu
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        permisos.includes(item.permisoCodigo)
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* OVERLAY MÓVIL */}
      {expanded && (
        <div
          onClick={() => setOpen(false)}
          className={[
            "fixed inset-0 z-40 bg-slate-950/12 backdrop-blur-[6px] transition-opacity duration-200",
            open ? "md:hidden" : "pointer-events-none max-md:hidden",
          ].join(" ")}
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed top-3 z-50 h-[calc(100%-1.5rem)] w-60 overflow-hidden
          text-slate-700 shadow-2xl shadow-slate-950/10 backdrop-blur-2xl
          transform transition-transform duration-300 ease-out
          ${isRight ? "right-0 rounded-l-lg" : "left-0 rounded-r-lg"}

          ${
            expanded
              ? "translate-x-0"
              : isRight
              ? "translate-x-[calc(100%-12px)]"
              : "-translate-x-[calc(100%-12px)]"
          }

          ${
            open
              ? "translate-x-0"
              : isRight
              ? "max-md:translate-x-full"
              : "max-md:-translate-x-full"
          }

          ${
            expanded
              ? "border border-white/75 bg-white/95"
              : "border border-white/50 bg-white/82"
          }
        `}
      >
        {/* RASTRO / PESTAÑA DE HOVER */}
        {isAutoHide && (
          <div
            className={`
              absolute top-0 h-full w-3
              accent-rail
              opacity-70 transition-opacity duration-200
              ${hovered || open ? "opacity-0" : "opacity-70"}
              ${isRight ? "left-0" : "right-0"}
            `}
          />
        )}

        {/* USUARIO */}
        <div className="border-b border-slate-200/60 bg-white/55 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Usuario
          </div>

          <div className="mt-1 truncate text-[13px] font-semibold text-slate-800">
            {cargandoPermisos
              ? "Cargando..."
              : nombreUsuario ?? "Sin usuario"}
          </div>

          <div className="mt-0.5 truncate text-[11px] font-medium text-[#005f48]">
            {cargandoPermisos ? "Validando accesos" : rolNombre ?? "Sin rol"}
          </div>
        </div>

        {/* MENÚ */}
        <nav className="px-2 py-3 text-[13px]">
          {cargandoPermisos ? (
            <div className="px-2 py-2 text-[12px] text-slate-500">
              Cargando accesos...
            </div>
          ) : menuFiltrado.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-slate-500">
              No tiene módulos asignados.
            </div>
          ) : (
            menuFiltrado.map((section) => (
              <div key={section.category} className="mb-5">
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {section.category}
                </div>

                <div className="space-y-[1px]">
                  {section.items.map((item) => {
                    const active = pathname === item.path;

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setOpen(false)}
                        className={[
                          "group grid grid-cols-[3px_1fr] items-center overflow-hidden rounded-md",
                          "border border-transparent",
                          "text-[13px]",
                          "transition-all duration-150",
                          active
                            ? "border-emerald-900/10 bg-white/85 text-slate-950 shadow-sm"
                            : "text-slate-500 hover:border-slate-300/70 hover:bg-white/65 hover:text-slate-900",
                        ].join(" ")}
                      >
                        {/* INDICADOR ACTIVO */}
                        <span
                          className={[
                            "h-full min-h-[32px]",
                            active ? "accent-rail" : "bg-transparent",
                          ].join(" ")}
                        />

                        {/* TEXTO */}
                        <span className="px-3 py-2 leading-none">
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* PIE / SESIÓN */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl">
          <CerrarSesionButton />
        </div>
      </aside>
    </>
  );
}
