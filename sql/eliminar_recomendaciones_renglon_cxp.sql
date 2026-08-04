-- Desinstalacion completa del experimento de recomendaciones IA de renglon.
--
-- ADVERTENCIA: este script elimina definitivamente la tabla
-- public.recomendaciones_renglon_cxp y todos los datos almacenados en ella.
-- No afecta las recomendaciones financieras existentes de CxP.

begin;

drop trigger if exists trg_sincronizar_recomendacion_renglon_cxp
  on public.compromisos_presupuestarios;

drop function if exists public.sincronizar_recomendacion_renglon_cxp();

drop function if exists public.registrar_error_recomendacion_renglon_cxp(
  uuid,
  text
);

drop function if exists public.guardar_recomendacion_renglon_cxp(
  uuid,
  text,
  text,
  text,
  text,
  text[],
  numeric,
  text,
  jsonb,
  text,
  text,
  bigint,
  bigint
);

drop function if exists public.obtener_historial_renglones_cxp_para_ia(
  integer
);

drop function if exists public.obtener_recomendaciones_renglon_cxp();

drop function if exists public.reclamar_recomendaciones_renglon_cxp(
  integer,
  integer
);

drop function if exists public.es_usuario_presupuesto_actual();

-- DROP TABLE elimina tambien sus politicas RLS, indices y restricciones.
drop table if exists public.recomendaciones_renglon_cxp;

commit;

-- Verificacion: ambas consultas deben devolver cero filas.
select
  n.nspname as esquema,
  p.proname as funcion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%recomendacion%renglon%'
    or p.proname = 'es_usuario_presupuesto_actual'
  );

select
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and tablename = 'recomendaciones_renglon_cxp';
