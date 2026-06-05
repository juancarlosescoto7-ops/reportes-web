// /services/analisisIA.ts

export type ResultadoIA = {
  resumen: string;
  nivel_riesgo: "alto" | "medio" | "bajo";
  hallazgos: string[];
  recomendacion: string;
};

export async function analizarResumenFinanciero(
  data: any[]
): Promise<ResultadoIA | null> {
  try {
    const response = await fetch("/api/analizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
    });

    const result = await response.json();

    if (!result || !result.resumen) {
      console.error("Respuesta IA inválida:", result);
      return null;
    }

    return result;

  } catch (error) {
    console.error("Error en analizarResumenFinanciero:", error);
    return null;
  }
}