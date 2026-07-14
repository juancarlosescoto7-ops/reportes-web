"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  FileScan,
  FileText,
  FolderKanban,
  Home,
  MonitorUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import CerrarSesionButton from "@/components/CerrarSesionButton";

const menu: {
  category: string;
  items: {
    name: string;
    path: string;
    permisoCodigo: string;
    icon: LucideIcon;
  }[];
}[] = [
  {
    category: "General",
    items: [
      {
        name: "Inicio",
        path: "/",
        permisoCodigo: "VER_DASHBOARD",
        icon: Home,
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
        icon: FileText,
      },
      {
        name: "Presupuesto",
        path: "/reportes/presupuesto",
        permisoCodigo: "VER_PRESUPUESTO",
        icon: BarChart3,
      },
      {
        name: "Compromisos",
        path: "/reportes/compromisos-presupuestarios",
        permisoCodigo: "VER_COMPROMISOS",
        icon: ClipboardList,
      },
      {
        name: "Pantalla compartida",
        path: "/reportes/pantalla-compartida",
        permisoCodigo: "VER_EGRESOS",
        icon: MonitorUp,
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
        icon: FolderKanban,
      },
      {
        name: "Ordenes de pago",
        path: "/controles/ordenes-pago",
        permisoCodigo: "VER_EGRESOS",
        icon: FileScan,
      },
      {
        name: "Ingresos",
        path: "/ingresos",
        permisoCodigo: "VER_INGRESOS",
        icon: WalletCards,
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

  const { permisos, cargandoPermisos, rolNombre, nombreUsuario } =
    usePermisosSistema();

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
      {expanded && (
        <div
          onClick={() => setOpen(false)}
          className={[
            "fixed inset-0 z-40 bg-slate-950/10 backdrop-blur-[2px] transition-opacity duration-200",
            open ? "md:hidden" : "pointer-events-none max-md:hidden",
          ].join(" ")}
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed top-3 z-50 h-[calc(100%-1.5rem)] w-60 overflow-hidden
          text-slate-700 shadow-xl shadow-slate-950/8 backdrop-blur-xl
          transform transition-transform duration-300 ease-out
          ${isRight ? "right-0" : "left-0"}

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
              ? "border border-slate-200 bg-white/92"
              : "border border-slate-200/80 bg-white/72"
          }
        `}
      >
        {isAutoHide && (
          <div
            className={`
              absolute top-0 h-full w-2 accent-rail opacity-80 transition-opacity duration-200
              ${hovered || open ? "opacity-0" : "opacity-70"}
              ${isRight ? "left-0" : "right-0"}
            `}
          />
        )}

        <div className="border-b border-slate-200 bg-white/70 px-4 py-4">
          <div className="mb-4 border-l-2 border-[#003331] pl-3">
            <div className="truncate text-[13px] font-semibold text-slate-950">
              Reportes Web
            </div>
            <div className="truncate text-[11px] text-slate-500">
              Panel operativo
            </div>
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Usuario
          </div>

          <div className="mt-1 truncate text-[13px] font-semibold text-slate-800">
            {cargandoPermisos ? "Cargando..." : nombreUsuario ?? "Sin usuario"}
          </div>

          <div className="mt-0.5 truncate text-[11px] font-medium text-[#006b55]">
            {cargandoPermisos ? "Validando accesos" : rolNombre ?? "Sin rol"}
          </div>
        </div>

        <nav className="px-2 py-3 text-[13px]">
          {cargandoPermisos ? (
            <div className="px-2 py-2 text-[12px] text-slate-500">
              Cargando accesos...
            </div>
          ) : menuFiltrado.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-slate-500">
              No tiene modulos asignados.
            </div>
          ) : (
            menuFiltrado.map((section) => (
              <div key={section.category} className="mb-5">
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {section.category}
                </div>

                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = pathname === item.path;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setOpen(false)}
                        className={[
                          "group grid grid-cols-[2rem_1fr] items-center overflow-hidden",
                          "border px-1.5 py-1.5 text-[13px]",
                          "transition-all duration-150",
                          active
                            ? "border-slate-300 bg-slate-100 text-slate-950"
                            : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "grid h-7 w-7 place-items-center transition",
                            active
                              ? "bg-[#003331] text-white"
                              : "text-slate-400 group-hover:bg-white group-hover:text-[#003331]",
                          ].join(" ")}
                        >
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="truncate px-2 leading-none">
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

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <CerrarSesionButton />
        </div>
      </aside>
    </>
  );
}
