-- Eliminación completa y atómica de arqueos del registro de ingresos.
-- La bitácora conserva evidencia, sin mantener registros activos ni bloquear su reingreso.
begin;

create table if not exists public.bitacora_eliminacion_arqueos (
  id uuid primary key default gen_random_uuid(),
  arqueo_id uuid not null,
  usuario_id uuid not null,
  motivo text not null check (length(trim(motivo)) between 10 and 500),
  datos_anteriores jsonb not null,
  fecha_registro timestamptz not null default now()
);

alter table public.bitacora_eliminacion_arqueos enable row level security;
revoke all on public.bitacora_eliminacion_arqueos from public, anon, authenticated;

-- Mantiene el modelo de corrección de ingresos: sólo la RPC autorizada escribe
-- en la bitácora privada; no se conceden permisos directos sobre ella al cliente.
create or replace function public.eliminar_arqueo_con_depositos(
  p_id uuid,
  p_motivo text,
  p_confirmacion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_arqueo jsonb;
  v_depositos jsonb;
begin
  if v_usuario_id is null then
    raise exception using errcode = '42501', message = 'Debe iniciar sesión para eliminar un arqueo.';
  end if;

  if not exists (
    select 1 from public.obtener_mis_permisos() as permiso
    where permiso.permiso_codigo = 'VER_INGRESOS'
  ) then
    raise exception using errcode = '42501', message = 'No tiene autorización para eliminar arqueos del registro de ingresos.';
  end if;

  if trim(coalesce(p_confirmacion, '')) <> 'ELIMINAR' then
    raise exception 'Escriba ELIMINAR para confirmar la eliminación del arqueo y todos sus depósitos.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) not between 10 and 500 then
    raise exception 'El motivo debe contener entre 10 y 500 caracteres.';
  end if;
  if p_id is null then
    raise exception 'El identificador del arqueo es obligatorio.';
  end if;

  -- El bloqueo impide que se añadan depósitos mientras se elimina el arqueo.
  select to_jsonb(arqueo) into v_arqueo
  from public.arqueos as arqueo where arqueo.id = p_id for update;
  if not found then
    raise exception 'El arqueo indicado ya no existe. Actualice el reporte.';
  end if;

  -- Captura exactamente los depósitos eliminados, incluso ante correcciones concurrentes.
  with eliminados as (
    delete from public.ingresos where id_arqueo = p_id returning *
  )
  select coalesce(jsonb_agg(to_jsonb(eliminados)), '[]'::jsonb)
  into v_depositos from eliminados;

  delete from public.arqueos where id = p_id;

  insert into public.bitacora_eliminacion_arqueos
    (arqueo_id, usuario_id, motivo, datos_anteriores)
  values (p_id, v_usuario_id, trim(p_motivo),
    jsonb_build_object('arqueo', v_arqueo, 'depositos', v_depositos));

  return jsonb_build_object('ok', true, 'id_arqueo', p_id,
    'depositos_eliminados', jsonb_array_length(v_depositos));
exception when foreign_key_violation then
  -- El bloque completo se revierte, incluidos los depósitos ya borrados.
  raise exception 'El arqueo tiene registros vinculados en otro módulo. No se eliminó el arqueo ni sus depósitos. Revise esos vínculos antes de volver a intentarlo.';
end;
$$;

revoke all on function public.eliminar_arqueo_con_depositos(uuid, text, text) from public, anon;
grant execute on function public.eliminar_arqueo_con_depositos(uuid, text, text) to authenticated;

comment on function public.eliminar_arqueo_con_depositos(uuid, text, text) is
  'Elimina un arqueo y todos sus ingresos de forma atómica, con permiso VER_INGRESOS, confirmación y bitácora privada.';

notify pgrst, 'reload schema';
commit;
