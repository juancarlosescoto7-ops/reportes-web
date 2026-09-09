-- Instalación incremental después de borrador_presupuesto.sql.
-- Permite crear rubros SAFT sin crear equivalencias SAMI.
begin;

grant insert on public.rubros_ingresos_saft to authenticated;
drop policy if exists rubros_ingresos_saft_crear_presupuesto on public.rubros_ingresos_saft;
create policy rubros_ingresos_saft_crear_presupuesto
on public.rubros_ingresos_saft for insert to authenticated
with check (
  (select auth.uid()) is not null
  and exists (
    select 1 from public.obtener_mis_permisos() p
    where p.permiso_codigo = 'VER_PRESUPUESTO'
  )
);

create or replace function public.crear_rubro_ingreso_borrador(
  p_borrador_id uuid, p_codigo_saft text, p_descripcion_saft text
)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_codigo text;
  v_descripcion text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Debe iniciar sesión.';
  end if;

  -- RLS exige VER_PRESUPUESTO; el bloqueo evita cambios de estado al crear.
  perform 1 from public.borradores_presupuesto
  where id = p_borrador_id and estado = 'BORRADOR' for update;
  if not found then
    raise exception using errcode = '42501', message = 'El borrador no existe, no es editable o no tiene permiso para modificarlo.';
  end if;

  v_codigo := regexp_replace(regexp_replace(btrim(coalesce(p_codigo_saft, '')), '^''+', ''), '\.0+$', '');
  v_descripcion := btrim(coalesce(p_descripcion_saft, ''));
  if v_codigo = '' or length(v_codigo) > 100 or v_codigo !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$' then
    raise exception 'El código SAFT no es válido.';
  end if;
  if v_descripcion = '' or length(v_descripcion) > 500 then
    raise exception 'La descripción SAFT es obligatoria y no puede exceder 500 caracteres.';
  end if;

  begin
    insert into public.rubros_ingresos_saft(codigo, descripcion)
    values(v_codigo, v_descripcion);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'Ya existe un rubro con ese código SAFT. Búsquelo para configurar su proyección.';
  end;

  -- Ambas inserciones son atómicas y conservan los controles del borrador.
  perform public.guardar_ingreso_borrador(p_borrador_id, v_codigo, 0, 0);
  return v_codigo;
end;
$$;

revoke all on function public.crear_rubro_ingreso_borrador(uuid,text,text) from public, anon;
grant execute on function public.crear_rubro_ingreso_borrador(uuid,text,text) to authenticated;

commit;
