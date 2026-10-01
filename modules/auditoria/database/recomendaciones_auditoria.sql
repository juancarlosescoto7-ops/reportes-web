-- Recomendaciones por orden y resúmenes mensuales de auditoría.
-- Aplicar después de reporte_egresos_auditoria.sql. No modifica los egresos.
begin;

create table public.auditoria_recomendaciones (
  no_orden bigint primary key check (no_orden > 0),
  recomendaciones text not null default '' check (char_length(recomendaciones) <= 10000),
  version integer not null default 1,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid not null default auth.uid()
);

create table public.auditoria_resumenes_mensuales (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (extract(day from mes) = 1),
  resumen text not null check (char_length(trim(resumen)) between 1 and 50000),
  huella_fuentes text not null,
  fuentes jsonb not null,
  total_ordenes integer not null,
  modelo text not null,
  uso_tokens jsonb not null default '{}'::jsonb,
  generado_en timestamptz not null default now(),
  generado_por uuid not null default auth.uid()
);
create index auditoria_resumenes_mes_fecha_idx
  on public.auditoria_resumenes_mensuales (mes, generado_en desc);

create function public.auditoria_puede_gestionar_recomendaciones()
returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.obtener_mis_permisos() p
    where upper(trim(p.rol_codigo)) in ('AUDITORIA', 'ADMIN', 'PRESUPUESTO')
  );
$$;

alter table public.auditoria_recomendaciones enable row level security;
alter table public.auditoria_resumenes_mensuales enable row level security;
revoke all on public.auditoria_recomendaciones from public, anon, authenticated;
revoke all on public.auditoria_resumenes_mensuales from public, anon, authenticated;
grant select, insert, update on public.auditoria_recomendaciones to authenticated;
grant select, insert on public.auditoria_resumenes_mensuales to authenticated;

create policy auditoria_recomendaciones_lectura on public.auditoria_recomendaciones
  for select to authenticated using ((select public.auditoria_puede_gestionar_recomendaciones()));
create policy auditoria_recomendaciones_creacion on public.auditoria_recomendaciones
  for insert to authenticated with check ((select public.auditoria_puede_gestionar_recomendaciones()));
create policy auditoria_recomendaciones_edicion on public.auditoria_recomendaciones
  for update to authenticated
  using ((select public.auditoria_puede_gestionar_recomendaciones()))
  with check ((select public.auditoria_puede_gestionar_recomendaciones()));
create policy auditoria_resumenes_lectura on public.auditoria_resumenes_mensuales
  for select to authenticated using ((select public.auditoria_puede_gestionar_recomendaciones()));
create policy auditoria_resumenes_creacion on public.auditoria_resumenes_mensuales
  for insert to authenticated with check ((select public.auditoria_puede_gestionar_recomendaciones()));

create function public.auditoria_obtener_recomendaciones()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.auditoria_puede_gestionar_recomendaciones() then
    raise exception using errcode = '42501', message = 'No tiene acceso a las recomendaciones de auditoría.';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.no_orden), '[]'::jsonb)
    from public.auditoria_recomendaciones r);
end;
$$;

create function public.auditoria_sellar_recomendacion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.auditoria_puede_gestionar_recomendaciones() then
    raise exception using errcode = '42501', message = 'No tiene permiso para guardar recomendaciones.';
  end if;
  if tg_op = 'UPDATE' and new.no_orden <> old.no_orden then
    raise exception using errcode = '22023', message = 'No se puede cambiar la orden de una recomendación.';
  end if;
  if not exists (select 1 from public.reporte_egresos_auditoria() e where e.no_orden = new.no_orden) then
    raise exception using errcode = '22023', message = 'La orden no existe en auditoría.';
  end if;
  new.recomendaciones := trim(new.recomendaciones);
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  new.actualizado_en := clock_timestamp();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;
create trigger auditoria_sellar_recomendacion
  before insert or update on public.auditoria_recomendaciones
  for each row execute function public.auditoria_sellar_recomendacion();

create function public.auditoria_guardar_recomendacion(
  p_no_orden bigint, p_recomendaciones text, p_version integer
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_fila public.auditoria_recomendaciones;
begin
  if not public.auditoria_puede_gestionar_recomendaciones() then
    raise exception using errcode = '42501', message = 'No tiene permiso para guardar recomendaciones.';
  end if;
  if p_no_orden is null or p_no_orden <= 0 or p_recomendaciones is null
    or char_length(p_recomendaciones) > 10000 or p_version is null or p_version < 0 then
    raise exception using errcode = '22023', message = 'Los datos de la recomendación no son válidos.';
  end if;
  if p_version = 0 then
    insert into public.auditoria_recomendaciones (no_orden, recomendaciones)
    values (p_no_orden, p_recomendaciones)
    on conflict (no_orden) do nothing returning * into v_fila;
  else
    update public.auditoria_recomendaciones
    set recomendaciones = p_recomendaciones
    where no_orden = p_no_orden and version = p_version
    returning * into v_fila;
  end if;
  if v_fila.no_orden is null then
    raise exception using errcode = '40001',
      message = 'Otra persona modificó esta recomendación. Copie su texto y vuelva a cargar la versión guardada antes de editar.';
  end if;
  return to_jsonb(v_fila);
end;
$$;

create function public.auditoria_contexto_mensual(p_mes date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_fuentes jsonb; v_total integer; v_resumen jsonb;
begin
  if not public.auditoria_puede_gestionar_recomendaciones() then
    raise exception using errcode = '42501', message = 'No tiene acceso al resumen de auditoría.';
  end if;
  if p_mes is null or extract(day from p_mes) <> 1 then
    raise exception using errcode = '22023', message = 'Seleccione un mes válido.';
  end if;
  -- Una orden se cuenta una sola vez aunque tenga varios beneficiarios o cheques.
  -- La fecha coincide con la primera fila (fecha descendente) del reporte en pantalla.
  with ordenes as (
    select e.no_orden, max(e.fecha) as fecha,
      string_agg(distinct e.descripcion, E'\n' order by e.descripcion) as descripcion,
      jsonb_agg(distinct e.proveedor order by e.proveedor) as proveedores,
      sum(e.monto_egreso) as monto_egreso
    from public.reporte_egresos_auditoria() e group by e.no_orden
  ), mes as (
    select o.*, r.recomendaciones from ordenes o
    left join public.auditoria_recomendaciones r using (no_orden)
    where o.fecha >= p_mes and o.fecha < (p_mes + interval '1 month')::date
  )
  select count(*)::integer,
    coalesce(jsonb_agg(to_jsonb(m) order by m.no_orden)
      filter (where nullif(trim(m.recomendaciones), '') is not null), '[]'::jsonb)
  into v_total, v_fuentes from mes m;

  select to_jsonb(r) into v_resumen from public.auditoria_resumenes_mensuales r
    where r.mes = p_mes order by r.generado_en desc, r.id desc limit 1;
  return jsonb_build_object(
    'mes', to_char(p_mes, 'YYYY-MM'), 'total_ordenes', v_total,
    'fuentes', v_fuentes, 'huella_fuentes', md5(v_fuentes::text || ':' || v_total::text),
    'resumen', v_resumen,
    'desactualizado', coalesce(v_resumen->>'huella_fuentes' <> md5(v_fuentes::text || ':' || v_total::text), false)
  );
end;
$$;

create function public.auditoria_sellar_resumen()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_contexto jsonb;
begin
  v_contexto := public.auditoria_contexto_mensual(new.mes);
  if jsonb_array_length(v_contexto->'fuentes') = 0 then
    raise exception using errcode = '22023', message = 'Este mes no tiene recomendaciones registradas.';
  end if;
  if new.huella_fuentes is distinct from v_contexto->>'huella_fuentes' then
    raise exception using errcode = '40001',
      message = 'Las recomendaciones cambiaron durante la generación. Vuelva a generar el resumen.';
  end if;
  new.fuentes := v_contexto->'fuentes';
  new.total_ordenes := (v_contexto->>'total_ordenes')::integer;
  new.generado_por := auth.uid();
  new.generado_en := clock_timestamp();
  return new;
end;
$$;
create trigger auditoria_sellar_resumen before insert on public.auditoria_resumenes_mensuales
  for each row execute function public.auditoria_sellar_resumen();

revoke all on function public.auditoria_puede_gestionar_recomendaciones() from public, anon;
revoke all on function public.auditoria_obtener_recomendaciones() from public, anon;
revoke all on function public.auditoria_sellar_recomendacion() from public, anon;
revoke all on function public.auditoria_guardar_recomendacion(bigint, text, integer) from public, anon;
revoke all on function public.auditoria_contexto_mensual(date) from public, anon;
revoke all on function public.auditoria_sellar_resumen() from public, anon;
grant execute on function public.auditoria_puede_gestionar_recomendaciones() to authenticated;
grant execute on function public.auditoria_obtener_recomendaciones() to authenticated;
grant execute on function public.auditoria_guardar_recomendacion(bigint, text, integer) to authenticated;
grant execute on function public.auditoria_contexto_mensual(date) to authenticated;

comment on table public.auditoria_recomendaciones is 'Campo de recomendaciones de auditoría por orden de pago; edición compartida entre los roles de auditoría.';
comment on table public.auditoria_resumenes_mensuales is 'Historial de resúmenes IA con copia exacta de recomendaciones y contexto del mes analizado.';
notify pgrst, 'reload schema';
commit;
