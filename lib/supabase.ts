export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_KEY = process.env.SUPABASE_KEY!;

export async function ejecutarRPC(nombreRPC: string, payload: any = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombreRPC}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Error en RPC");
    }

    return await response.json();

  } catch (error) {
    console.error("Error conexión Supabase:", error);
    return [];
  }
}