"use client";

import { useEffect, useState } from "react";
import {
  obtenerMisPermisos,
  SesionPermisos,
} from "@/lib/permisos-sistema";

export function usePermisosSistema() {
  const [datosPermisos, setDatosPermisos] =
    useState<SesionPermisos | null>(null);

  const [cargandoPermisos, setCargandoPermisos] = useState(true);

  useEffect(() => {
    async function cargarPermisos() {
      const permisos = await obtenerMisPermisos();

      setDatosPermisos(permisos);
      setCargandoPermisos(false);
    }

    cargarPermisos();
  }, []);

  return {
    datosPermisos,
    cargandoPermisos,
    permisos: datosPermisos?.permisos ?? [],
    rolCodigo: datosPermisos?.rolCodigo ?? null,
    rolNombre: datosPermisos?.rolNombre ?? null,
    nombreUsuario: datosPermisos?.nombreUsuario ?? null,
  };
}