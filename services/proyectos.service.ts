"use client";

import type { ObraPresupuestaria } from "@/lib/proyectos";

type RespuestaObras = {
  obras?: ObraPresupuestaria[];
  error?: string;
};

type RespuestaCrearProyecto = {
  idProyecto?: number;
  error?: string;
};

export async function obtenerObrasPresupuestarias() {
  const response = await fetch("/api/proyectos/obras", {
    method: "GET",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | RespuestaObras
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "No se pudieron cargar las obras.");
  }

  return Array.isArray(payload?.obras) ? payload.obras : [];
}

export async function crearProyectoDesdeObras(params: {
  nombreProyecto: string;
  codigos: string[];
}) {
  const response = await fetch("/api/proyectos/obras", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = (await response.json().catch(() => null)) as
    | RespuestaCrearProyecto
    | null;

  if (!response.ok || !payload?.idProyecto) {
    throw new Error(payload?.error || "No se pudo crear el proyecto.");
  }

  return payload.idProyecto;
}
