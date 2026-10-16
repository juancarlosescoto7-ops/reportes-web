-- Lectura del historial limitada al permiso del módulo de cuentas por pagar.
create policy bitacora_cxp_select_reporte_mensual
on public.bitacora_cxp for select to authenticated
using ((select exists (
  select 1 from public.obtener_mis_permisos() p
  where p.permiso_codigo = 'VER_COMPROMISOS'
)));

-- Una sola instantánea: evita mezclar saldos e historial de consultas separadas.
create or replace function public.obtener_datos_reporte_mensual_cxp(p_corte date)
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.obtener_mis_permisos() p
    where p.permiso_codigo = 'VER_COMPROMISOS'
  ) then
    raise exception 'No tiene permiso para consultar cuentas por pagar.' using errcode = '42501';
  end if;
  if p_corte is null then
    raise exception 'Debe indicar la fecha de corte.';
  end if;
  return jsonb_build_object(
    'cuentas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cp.id::text, 'no_cxp', cp.no_cxp::text,
        'tipo_movimiento', cp.tipo_movimiento, 'fecha', cp.fecha,
        'descripcion', cp.descripcion, 'haber', cp.haber, 'debe', cp.debe,
        'estado', cp.estado, 'fecha_pago', cp.fecha_pago,
        'fecha_anulacion', (cp.fecha_anulacion at time zone 'America/Tegucigalpa')::date,
        'proveedor_id', cp.id_beneficiario,
        'proveedor_nombre', coalesce(b.nombre, cp.id_beneficiario, 'Sin proveedor')
      ) order by cp.id)
      from public.cuentas_por_pagar cp
      left join public.beneficiarios b on b.id = cp.id_beneficiario
      where cp.fecha <= p_corte or cp.fecha is null
    ), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'no_cxp', h.no_cxp::text, 'tipo_movimiento', h.tipo_movimiento,
        'accion', h.accion, 'metadata', h.metadata
      ) order by h.fecha_registro, h.id)
      from public.bitacora_cxp h
      where h.accion in ('pago_parcial_con_compromiso', 'pago_multiple_con_compromiso',
                         'depuracion_pagada', 'depuracion_anulada')
        and exists (select 1 from public.cuentas_por_pagar cp
          where cp.no_cxp = h.no_cxp
            and coalesce(cp.tipo_movimiento, '') = coalesce(h.tipo_movimiento, '')
            and (cp.fecha <= p_corte or cp.fecha is null))
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.obtener_datos_reporte_mensual_cxp(date) from public, anon;
grant execute on function public.obtener_datos_reporte_mensual_cxp(date) to authenticated;
