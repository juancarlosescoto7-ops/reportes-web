export const SUPABASE_URL = "https://eitcibuiuyyxrmymqyvp.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdGNpYnVpdXl5eHJteW1xeXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjI1OTUsImV4cCI6MjA4MzYzODU5NX0.bxuFJUYVz7AbyUOpvNsPt6-TWXKPX9kNcxIXmVh9UUc";

export async function ejecutarRPC(nombreRPC: string, payload: any = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombreRPC}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,

        // 🔥 CONTROL DE LÍMITE
        "Range-Unit": "items",
        "Range": "0-5000"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Error en RPC");
    }

    const data = await response.json();

    console.log("TOTAL REGISTROS (CORREGIDO):", data.length);

    return data;

  } catch (error) {
    console.error("Error conexión Supabase:", error);
    return [];
  }
}

export async function ejecutarVista(nombreVista: string) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${nombreVista}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Error consultando vista");
    }

    const data = await response.json();

    console.log("TOTAL REGISTROS (VISTA):", data.length);

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
  let desde = 0;
  const limite = 1000;
  let todos: any[] = [];

  while (true) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/${nombreRPC}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${desde}-${desde + limite - 1}`
        },
        body: JSON.stringify(params)
      }
    );

    if (!response.ok) {
      throw new Error(`Error en RPC: ${nombreRPC}`);
    }

    const data = await response.json();

    // 🔴 AQUÍ ESTÁ LA DIFERENCIA
    const contentRange = response.headers.get("content-range");
    console.log("📦 RANGE:", contentRange);

    todos = [...todos, ...data];

    if (contentRange) {
      const total = parseInt(contentRange.split("/")[1]);

      if (desde + limite >= total) {
        console.log("✅ FIN DETECTADO");
        break;
      }
    } else {
      if (data.length < limite) break;
    }

    desde += limite;
  }

  console.log("✅ TOTAL FINAL:", todos.length);

  return todos;
}