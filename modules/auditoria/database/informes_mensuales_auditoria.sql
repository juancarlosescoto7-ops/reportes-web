-- Aplicar después de recomendaciones_auditoria.sql.
begin;

-- Conserva los informes anteriores y permite regenerarlos con el análisis ampliado.
alter table public.auditoria_resumenes_mensuales
  add column version_informe integer not null default 1 check (version_informe > 0);

create function public.auditoria_meses_informe()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_meses jsonb;
begin
  if not public.auditoria_puede_gestionar_recomendaciones() then
    raise exception using errcode = '42501', message = 'No tiene acceso a los informes de auditoría.';
  end if;
  with ordenes as (
    select max(e.fecha) as fecha from public.reporte_egresos_auditoria() e group by e.no_orden
  ), periodos as (
    select to_char(o.fecha, 'YYYY-MM') as mes, false as tiene_informe
    from ordenes o where o.fecha is not null
    union all
    select to_char(r.mes, 'YYYY-MM'), true from public.auditoria_resumenes_mensuales r
  ), meses as (
    select p.mes, bool_or(p.tiene_informe) as tiene_informe from periodos p group by p.mes
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.mes desc), '[]'::jsonb)
  into v_meses from meses m;
  return v_meses;
end;
$$;

revoke all on function public.auditoria_meses_informe() from public, anon;
grant execute on function public.auditoria_meses_informe() to authenticated;
notify pgrst, 'reload schema';
commit;
