export const SUPABASE_URL = "https://eitcibuiuyyxrmymqyvp.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdGNpYnVpdXl5eHJteW1xeXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjI1OTUsImV4cCI6MjA4MzYzODU5NX0.bxuFJUYVz7AbyUOpvNsPt6-TWXKPX9kNcxIXmVh9UUc";

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