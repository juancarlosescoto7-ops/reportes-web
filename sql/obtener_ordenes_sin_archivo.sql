-- La RPC conserva su nombre para no romper consumidores existentes, pero ahora
-- devuelve todas las ordenes junto con el estado real de su archivo.
-- Debe ejecutarse una vez en el SQL Editor de Supabase.

begin;

drop function if exists public.obtener_ordenes_sin_archivo();

create function public.obtener_ordenes_sin_archivo()
returns table (
  no_orden integer,
  fecha date,
  descripcion text,
  tiene_archivo boolean,
  nombre_archivo text,
  ruta_storage text
)
language sql
stable
security invoker
set search_path = public
as $$
  with ordenes as (
    select
      e.no_orden::integer as no_orden,
      min(e.fecha)::date as fecha,
      max(e.descripcion)::text as descripcion
    from public.egresos e
    where e.no_orden is not null
      and e.no_orden > 0
    group by e.no_orden
  )
  select
    o.no_orden,
    o.fecha,
    o.descripcion,
    (archivo.orden_pago is not null) as tiene_archivo,
    archivo.nombre_archivo,
    archivo.ruta_storage
  from ordenes o
  left join lateral (
    select
      opa.orden_pago,
      opa.nombre_archivo::text as nombre_archivo,
      opa.ruta_storage::text as ruta_storage
    from public.orden_pago_archivos opa
    where opa.orden_pago = o.no_orden
    order by
      (nullif(btrim(opa.ruta_storage::text), '') is not null) desc,
      opa.fecha_subida desc nulls last
    limit 1
  ) archivo on true
  order by o.no_orden desc;
$$;

grant execute on function public.obtener_ordenes_sin_archivo() to authenticated;

commit;
