import { createBrowserClient } from "@supabase/ssr";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

export function crearClienteSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}

async function obtenerHeadersSupabase(opciones?: {
  contentType?: string;
  range?: string;
}) {
  const supabase = crearClienteSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? SUPABASE_KEY;

  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };

  if (opciones?.contentType) {
    headers["Content-Type"] = opciones.contentType;
  }

  if (opciones?.range) {
    headers["Range-Unit"] = "items";
    headers["Range"] = opciones.range;
  }

  return headers;
}

export async function ejecutarRPC(nombreRPC: string, payload: any = {}) {
  try {
    const headers = await obtenerHeadersSupabase({
      contentType: "application/json",
      range: "0-5000",
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombreRPC}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorTexto = await response.text();
      throw new Error(
        `Error en RPC ${nombreRPC}: ${response.status} - ${errorTexto}`
      );
    }

    const data = await response.json();

    console.log("TOTAL REGISTROS RPC:", Array.isArray(data) ? data.length : 1);

    return data;
  } catch (error) {
    console.error("Error conexión Supabase:", error);
    return [];
  }
}

export async function ejecutarVista(nombreVista: string) {
  try {
    const headers = await obtenerHeadersSupabase();

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${nombreVista}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorTexto = await response.text();
      throw new Error(
        `Error consultando vista ${nombreVista}: ${response.status} - ${errorTexto}`
      );
    }

    const data = await response.json();

    console.log("TOTAL REGISTROS VISTA:", Array.isArray(data) ? data.length : 1);

    return data;
  } catch (error) {
    console.error("Error conexión Supabase:", error);
    return [];
  }
}

export async function ejecutarRPCPaginado(
  nombreRPC: string,
  params: any = {}
) {
  try {
    let desde = 0;
    const limite = 1000;
    let todos: any[] = [];

    while (true) {
      const headers = await obtenerHeadersSupabase({
        contentType: "application/json",
        range: `${desde}-${desde + limite - 1}`,
      });

      headers["Prefer"] = "count=exact";

      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombreRPC}`, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorTexto = await response.text();
        throw new Error(
          `Error en RPC paginado ${nombreRPC}: ${response.status} - ${errorTexto}`
        );
      }

      const data = await response.json();

      const registros = Array.isArray(data) ? data : [];

      todos = [...todos, ...registros];

      console.log("RANGO CONSULTADO:", `${desde}-${desde + limite - 1}`);
      console.log("REGISTROS RECIBIDOS:", registros.length);

      if (registros.length < limite) {
        break;
      }

      desde += limite;
    }

    console.log("TOTAL FINAL:", todos.length);

    return todos;
  } catch (error) {
    console.error("Error conexión Supabase paginada:", error);
    return [];
  }
}

export async function subirArchivoStorage(
  bucket: string,
  rutaStorage: string,
  archivo: File,
  contentType: string = "application/pdf"
) {
  try {
    const headers = await obtenerHeadersSupabase({
      contentType,
    });

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${rutaStorage}`,
      {
        method: "PUT",
        headers,
        body: archivo,
      }
    );

    if (!response.ok) {
      const errorTexto = await response.text();
      throw new Error(
        `Error subiendo archivo: ${response.status} - ${errorTexto}`
      );
    }

    return true;
  } catch (error) {
    console.error("Error Storage Supabase:", error);
    throw error;
  }
}

export type RolUsuario =
  | "ADMIN"
  | "PRESUPUESTO"
  | "TESORERIA"
  | "CONSULTA"
  | "UTM";

export type PerfilUsuario = {
  id: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
};

export async function obtenerPerfilUsuario(): Promise<PerfilUsuario | null> {
  try {
    const supabase = crearClienteSupabase();

    const {
      data: { user },
      error: errorUsuario,
    } = await supabase.auth.getUser();

    if (errorUsuario || !user) {
      console.error("No hay usuario autenticado:", errorUsuario);
      return null;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre, rol, activo")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error obteniendo perfil:", error);
      return null;
    }

    if (!data) {
      console.warn("El usuario existe en Auth, pero no tiene perfil asignado.");
      return null;
    }

    return data as PerfilUsuario;
  } catch (error) {
    console.error("Error general obteniendo perfil:", error);
    return null;
  }
}