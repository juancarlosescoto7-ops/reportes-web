"use client";

import { useEffect } from "react";
import { obtenerOrdenes } from "@/services/ordenes";

export default function ValidarOrdenes() {
  useEffect(() => {
    (async () => {
      const data = await obtenerOrdenes();

      // 🔹 Normalización defensiva
      const ordenes = data
        .map((d: any) => Number(d.no_orden))
        .filter((n: number) => !isNaN(n) && n > 0);

      const min = Math.min(...ordenes);
      const max = Math.max(...ordenes);
      const totalRegistros = data.length;
      const totalOrdenesUnicas = new Set(ordenes).size;

      console.log("=================================");
      console.log("📊 VALIDACIÓN DE DATOS");
      console.log("=================================");
      console.log("🟢 MIN:", min);
      console.log("🔴 MAX:", max);
      console.log("📦 TOTAL REGISTROS:", totalRegistros);
      console.log("🧾 ORDENES ÚNICAS:", totalOrdenesUnicas);
      console.log("=================================");
    })();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Validando órdenes...</h2>
      <p>Revisa la consola (F12)</p>
    </div>
  );
}