"use client";

import { useEffect } from "react";
import { testSupabaseOrdenes } from "@/services/debugSupabase";

export default function TestSupabase() {
  useEffect(() => {
    testSupabaseOrdenes();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Test Supabase Limpio</h1>
      <p>Revisa la consola (F12)</p>
    </div>
  );
}