"use client";

import { ReactNode } from "react";
import { tienePermiso, type Permiso } from "@/lib/permisos-sistema";
import { usePerfilUsuario } from "@/src/hooks/usePerfilUsuario";

export default function ConPermiso({
  permiso,
  children,
  fallback = null,
}: {
  permiso: Permiso;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { rol, cargandoPerfil } = usePerfilUsuario();

  if (cargandoPerfil) {
    return null;
  }

  if (!tienePermiso(rol, permiso)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}