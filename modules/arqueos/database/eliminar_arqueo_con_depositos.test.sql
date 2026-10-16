-- Prueba la función instalada contra tablas temporales; no modifica arqueos reales.
begin;
create temporary table arqueos (id uuid primary key default gen_random_uuid(), fecha date not null, total numeric not null, descripcion text);
create temporary table ingresos (id uuid primary key default gen_random_uuid(), id_arqueo uuid not null references pg_temp.arqueos(id) on delete cascade, monto numeric, cuenta text);
create temporary table bitacora_eliminacion_arqueos (like public.bitacora_eliminacion_arqueos including defaults);
create temporary table vinculos_arqueo (arqueo_id uuid references pg_temp.arqueos(id) on delete restrict);
create temporary table resultados_prueba (caso text, resultado text);

do $preparar$
declare definicion text;
begin
  definicion := pg_get_functiondef('public.eliminar_arqueo_con_depositos(uuid,text,text)'::regprocedure);
  definicion := replace(definicion, 'public.eliminar_arqueo_con_depositos', 'pg_temp.eliminar_arqueo_con_depositos');
  definicion := replace(definicion, 'public.arqueos', 'pg_temp.arqueos');
  definicion := replace(definicion, 'public.ingresos', 'pg_temp.ingresos');
  definicion := replace(definicion, 'public.bitacora_eliminacion_arqueos', 'pg_temp.bitacora_eliminacion_arqueos');
  execute definicion;
end;
$preparar$;

do $pruebas$
declare
  usuario uuid;
  objetivo uuid;
  otro uuid;
  nuevo uuid;
  respuesta jsonb;
begin
  select us.id into usuario from public.usuarios_sistema us
  join public.roles r on r.id = us.rol_id
  join public.rol_permisos rp on rp.rol_id = r.id
  join public.permisos p on p.id = rp.permiso_id
  where us.activo and r.activo and p.activo and p.codigo = 'VER_INGRESOS' limit 1;
  if usuario is null then raise exception 'Se requiere un usuario con VER_INGRESOS para probar permisos.'; end if;

  insert into pg_temp.arqueos (fecha, total, descripcion) values ('2026-10-01', 300, 'Prueba aislada') returning id into objetivo;
  insert into pg_temp.arqueos (fecha, total, descripcion) values ('2026-10-01', 50, 'Otro arqueo') returning id into otro;
  insert into pg_temp.ingresos (id_arqueo,monto,cuenta) values (objetivo,100,'Cuenta A'),(objetivo,200,'Cuenta B'),(otro,50,'Cuenta A');

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','ELIMINAR');
    raise exception 'Se permitió eliminar sin sesión';
  exception when insufficient_privilege then null;
  end;
  insert into resultados_prueba values ('Rechaza sesión ausente','OK');

  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','ELIMINAR');
    raise exception 'Se permitió eliminar sin permiso';
  exception when insufficient_privilege then null;
  end;
  insert into resultados_prueba values ('Rechaza usuario sin permiso','OK');

  perform set_config('request.jwt.claim.sub',usuario::text,true);
  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','CORREGIR');
    raise exception 'Se permitió confirmación incorrecta';
  exception when raise_exception then
    if sqlerrm not like 'Escriba ELIMINAR%' then raise; end if;
  end;
  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'corto','ELIMINAR');
    raise exception 'Se permitió motivo inválido';
  exception when raise_exception then
    if sqlerrm not like 'El motivo debe%' then raise; end if;
  end;
  insert into resultados_prueba values ('Exige confirmación y motivo válidos','OK');

  insert into pg_temp.vinculos_arqueo values (objetivo);
  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','ELIMINAR');
    raise exception 'Se permitió eliminar con dependencias';
  exception when raise_exception then
    if sqlerrm not like 'El arqueo tiene registros vinculados%' then raise; end if;
  end;
  if (select count(*) from pg_temp.ingresos where id_arqueo=objetivo) <> 2
    or not exists(select 1 from pg_temp.arqueos where id=objetivo)
    or exists(select 1 from pg_temp.bitacora_eliminacion_arqueos) then
    raise exception 'La eliminación fallida dejó cambios parciales';
  end if;
  delete from pg_temp.vinculos_arqueo where arqueo_id=objetivo;
  insert into resultados_prueba values ('Revierte todos los cambios ante dependencias','OK');

  respuesta := pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','ELIMINAR');
  if respuesta->>'ok' <> 'true' or respuesta->>'id_arqueo' <> objetivo::text
    or (respuesta->>'depositos_eliminados')::int <> 2
    or exists(select 1 from pg_temp.arqueos where id=objetivo)
    or exists(select 1 from pg_temp.ingresos where id_arqueo=objetivo)
    or (select count(*) from pg_temp.ingresos where id_arqueo=otro) <> 1
    or not exists(select 1 from pg_temp.bitacora_eliminacion_arqueos
      where arqueo_id=objetivo and usuario_id=usuario
        and jsonb_array_length(datos_anteriores->'depositos')=2) then
    raise exception 'No se eliminó exactamente el arqueo completo con su bitácora';
  end if;
  insert into resultados_prueba values ('Elimina todos los depósitos, conserva otros arqueos y registra bitácora','OK');

  begin
    perform pg_temp.eliminar_arqueo_con_depositos(objetivo,'Registro duplicado','ELIMINAR');
    raise exception 'Se informó éxito al eliminar dos veces';
  exception when raise_exception then
    if sqlerrm not like 'El arqueo indicado ya no existe%' then raise; end if;
  end;
  insert into resultados_prueba values ('Rechaza arqueo inexistente o ya eliminado','OK');

  insert into pg_temp.arqueos (fecha,total,descripcion) values ('2026-10-01',300,'Prueba aislada') returning id into nuevo;
  insert into pg_temp.ingresos (id_arqueo,monto,cuenta) values (nuevo,100,'Cuenta A'),(nuevo,200,'Cuenta B');
  if (select count(*) from pg_temp.ingresos where id_arqueo=nuevo) <> 2 then raise exception 'Falló el reingreso'; end if;
  insert into resultados_prueba values ('Permite registrar nuevamente la fecha y depósitos','OK');

  if has_function_privilege('anon','public.eliminar_arqueo_con_depositos(uuid,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.eliminar_arqueo_con_depositos(uuid,text,text)','EXECUTE')
    or has_table_privilege('authenticated','public.bitacora_eliminacion_arqueos','SELECT') then
    raise exception 'Permisos de función o bitácora incorrectos';
  end if;
  insert into resultados_prueba values ('RPC autenticada y bitácora privada','OK');
end;
$pruebas$;
select * from resultados_prueba;
rollback;
