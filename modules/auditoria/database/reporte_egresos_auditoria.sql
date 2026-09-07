-- Ejecutar una vez en el SQL Editor de Supabase.
-- Expone cada cheque con su beneficiario en un renglon independiente,
-- junto con la orden de pago documental correspondiente.
-- No consulta ni devuelve ejecución presupuestaria.

begin;

drop function if exists public.reporte_egresos_auditoria();

create function public.reporte_egresos_auditoria()
returns table (
  no_orden bigint,
  fecha date,
  descripcion text,
  proveedor text,
  cheque text,
  monto_egreso numeric,
  nombre_archivo text,
  ruta_storage text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Debe iniciar sesión para consultar el reporte de auditoría.';
  end if;

  if not exists (
    select 1
    from public.obtener_mis_permisos() as permiso
    where upper(trim(permiso.rol_codigo)) in (
      'AUDITORIA',
      'ADMIN',
      'PRESUPUESTO'
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'El reporte está restringido a Auditoría, Administración y Presupuesto.';
  end if;

  return query
  with egresos_por_cheque as (
    select
      e.no_orden::bigint as no_orden,
      min(e.fecha)::date as fecha,
      coalesce(
        max(nullif(trim(e.descripcion::text), '')),
        'Sin descripción'
      )::text as descripcion,
      coalesce(
        nullif(trim(b.nombre::text), ''),
        nullif(trim(e.id_beneficiario::text), ''),
        'Sin proveedor identificado'
      )::text as proveedor,
      coalesce(
        nullif(nullif(trim(e.no_cheque::text), ''), '0'),
        'Sin cheque'
      )::text as cheque,
      coalesce(sum(e.haber), 0)::numeric as monto_egreso
    from public.egresos as e
    left join public.beneficiarios as b
      on b.id::text = e.id_beneficiario::text
    where e.no_orden is not null
      and e.no_orden > 0
    group by
      e.no_orden,
      e.id_beneficiario,
      b.nombre,
      nullif(nullif(trim(e.no_cheque::text), ''), '0')
  )
  select
    egreso.no_orden,
    egreso.fecha,
    egreso.descripcion,
    egreso.proveedor,
    egreso.cheque,
    egreso.monto_egreso,
    archivo.nombre_archivo,
    archivo.ruta_storage
  from egresos_por_cheque as egreso
  left join lateral (
    select
      opa.nombre_archivo::text as nombre_archivo,
      opa.ruta_storage::text as ruta_storage
    from public.orden_pago_archivos as opa
    where opa.orden_pago::bigint = egreso.no_orden
    order by
      (nullif(trim(opa.ruta_storage::text), '') is not null) desc,
      opa.fecha_subida desc nulls last
    limit 1
  ) as archivo on true
  order by
    egreso.fecha desc nulls last,
    egreso.no_orden desc,
    egreso.proveedor,
    egreso.cheque;
end;
$$;

revoke all on function public.reporte_egresos_auditoria()
from public, anon;

grant execute on function public.reporte_egresos_auditoria()
to authenticated;

comment on function public.reporte_egresos_auditoria() is
  'Reporte de egresos por cheque y beneficiario para Auditoría, Administración y Presupuesto; no expone ejecución presupuestaria.';

commit;
