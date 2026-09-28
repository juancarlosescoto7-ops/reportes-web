begin;

-- Pruebas aisladas: todas las tablas se sustituyen por tablas temporales sin datos.
-- Ejecutar en una transaccion y terminar con ROLLBACK.
create temporary table cuentas_por_pagar as select * from public.cuentas_por_pagar with no data;
create temporary table compromisos_presupuestarios as select * from public.compromisos_presupuestarios with no data;
create temporary table egresos as select * from public.egresos with no data;
create temporary table documentos_faltantes_orden_pago as select * from public.documentos_faltantes_orden_pago with no data;
create temporary table documentos_cxp as select * from public.documentos_cxp with no data;
create temporary table beneficiarios as select * from public.beneficiarios with no data;
create temporary table ejecuciones_presupuestarias as select * from public.ejecuciones_presupuestarias with no data;
create temporary table bitacora_cxp as select * from public.bitacora_cxp with no data;
create temporary table resultados_prueba (caso text, resultado text);
do $tests$
declare
  caso jsonb;
  respuesta jsonb;
  total numeric;
  deduccion numeric;
begin
  for caso in select value from jsonb_array_elements('[
    {"nombre":"pago total con deduccion","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":125,"no_cheque":10}],"total":1000,"deduccion":125},
    {"nombre":"abono parcial","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":500,"deduccion":100,"no_cheque":10}],"total":500,"deduccion":100},
    {"nombre":"solo deduccion","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":1000,"no_cheque":10}],"total":1000,"deduccion":1000},
    {"nombre":"compatibilidad sin deduccion","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"no_cheque":10}],"total":1000,"deduccion":0},
    {"nombre":"varias cuentas mismo proveedor","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":125,"no_cheque":10},{"no_cxp":2,"tipo_movimiento":"Compra","monto_pago":500,"deduccion":75,"no_cheque":10}],"total":1500,"deduccion":200},
    {"nombre":"varios proveedores","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":125,"no_cheque":10},{"no_cxp":3,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":200,"no_cheque":11}],"total":2000,"deduccion":325},
    {"nombre":"rechaza exceso saldo","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1001,"deduccion":125,"no_cheque":10}],"error":true},
    {"nombre":"rechaza deduccion negativa","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":-1,"no_cheque":10}],"error":true},
    {"nombre":"rechaza banco negativo","pagos":[{"no_cxp":1,"tipo_movimiento":"Compra","monto_pago":1000,"deduccion":1001,"no_cheque":10}],"error":true}
  ]'::jsonb)
  loop
    truncate pg_temp.cuentas_por_pagar, pg_temp.compromisos_presupuestarios, pg_temp.egresos,
      pg_temp.documentos_faltantes_orden_pago, pg_temp.documentos_cxp, pg_temp.beneficiarios,
      pg_temp.ejecuciones_presupuestarias, pg_temp.bitacora_cxp;
    insert into pg_temp.cuentas_por_pagar(no_cxp,tipo_movimiento,haber,debe,id_beneficiario,estado)
      values (1,'Compra',1000,0,'PRUEBA-A','pendiente'),(2,'Compra',1000,0,'PRUEBA-A','pendiente'),(3,'Compra',1000,0,'PRUEBA-B','pendiente');
    insert into pg_temp.compromisos_presupuestarios(cxp_id,tipo_compromiso,monto_ejecutado,ejercicio_fiscal,codigo_presupuestario)
      values (1,'Compra',1000,2026,'PRUEBA'),(2,'Compra',1000,2026,'PRUEBA'),(3,'Compra',1000,2026,'PRUEBA');
    respuesta := public.procesar_pago_multiple_cxp_con_compromiso(caso->'pagos','2026-09-24',null,'PRUEBA','Bancos','Prueba aislada',2026)::jsonb;
    if coalesce((caso->>'error')::boolean,false) then
      if respuesta->>'ok' <> 'false' or exists(select 1 from pg_temp.egresos)
        or exists(select 1 from pg_temp.cuentas_por_pagar where debe <> 0) then
        raise exception 'Validacion fallo: % %', caso->>'nombre', respuesta;
      end if;
    else
      total := (caso->>'total')::numeric;
      deduccion := (caso->>'deduccion')::numeric;
      if respuesta->>'ok' <> 'true' then raise exception 'RPC fallo: % %',caso->>'nombre',respuesta; end if;
      if (select coalesce(sum(haber),0) from pg_temp.egresos where cuenta='Bancos') <> total-deduccion
        or (select coalesce(sum(haber),0) from pg_temp.egresos where cuenta='Deducciones por pagar') <> deduccion
        or (select sum(debe) from pg_temp.cuentas_por_pagar) <> total
        or (select sum(monto_ejecutado) from pg_temp.ejecuciones_presupuestarias) <> total
        or (select coalesce(sum(monto_ejecutado),0) from pg_temp.compromisos_presupuestarios) <> 3000-total
        or (select sum((metadata->>'deduccion')::numeric) from pg_temp.bitacora_cxp) <> deduccion
        or exists(select 1 from pg_temp.egresos where haber <= 0)
        or exists(select 1 from pg_temp.cuentas_por_pagar where (debe=haber) <> (estado='pagado')) then
        raise exception 'Descuadre en %',caso->>'nombre';
      end if;
    end if;
    insert into resultados_prueba values(caso->>'nombre','OK');
  end loop;
end;
$tests$;
select * from resultados_prueba;

rollback;

