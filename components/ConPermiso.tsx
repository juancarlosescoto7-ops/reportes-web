"use client";

import { ReactNode } from "react";
import { tienePermiso, type Permiso } from "@/lib/permisos-sistema";
import { usePermisosSistema } from "@/hooks/usePermisosSistema";

type ConPermisoProps = {
  permiso: Permiso;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function ConPermiso({
  permiso,
  children,
  fallback = null,
}: ConPermisoProps) {
  const { datosPermisos, cargandoPermisos } = usePermisosSistema();

  if (cargandoPermisos) {
    return null;
  }

  const autorizado = tienePermiso(datosPermisos, permiso);

  if (!autorizado) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}