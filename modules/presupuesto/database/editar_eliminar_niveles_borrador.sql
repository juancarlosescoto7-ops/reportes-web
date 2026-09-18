-- Edición de nombres y borrado atómico de ramas del borrador.
-- No modifica el presupuesto operativo ni elimina datos al instalarse.

do $$
declare tabla text;
begin
  foreach tabla in array array['borrador_programas','borrador_subprogramas','borrador_proyectos','borrador_actividades','borrador_obras'] loop
    execute format('grant update(nombre) on public.%I to authenticated', tabla);
    execute format('drop policy if exists %I on public.%I', tabla || '_update', tabla);
    execute format('create policy %I on public.%I for update to authenticated using (exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado=''BORRADOR'' and b.creado_por=(select auth.uid()))) with check (exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado=''BORRADOR'' and b.creado_por=(select auth.uid())))', tabla || '_update', tabla);
  end loop;
  foreach tabla in array array['borrador_programas','borrador_subprogramas','borrador_proyectos','borrador_actividades','borrador_obras','borrador_codigos_presupuesto'] loop
    execute format('grant delete on public.%I to authenticated', tabla);
    execute format('drop policy if exists %I on public.%I', tabla || '_delete', tabla);
    execute format('create policy %I on public.%I for delete to authenticated using (exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado=''BORRADOR'' and b.creado_por=(select auth.uid())))', tabla || '_delete', tabla);
  end loop;
end $$;

create or replace function public.editar_nivel_borrador(p_nivel text, p_nivel_id uuid, p_nombre text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_tabla text;
  v_borrador uuid;
  v_estado text;
  v_id uuid;
begin
  v_tabla := case p_nivel when 'Programa' then 'borrador_programas' when 'SubPrograma' then 'borrador_subprogramas' when 'Proyecto' then 'borrador_proyectos' when 'Actividad' then 'borrador_actividades' when 'Obra' then 'borrador_obras' end;
  if v_tabla is null or p_nivel_id is null or nullif(btrim(p_nombre), '') is null then
    raise exception 'Debe indicar el nivel y su nombre.';
  end if;
  if auth.uid() is null or not exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO') then
    raise exception 'No tiene permiso para editar el borrador.';
  end if;
  execute format('select borrador_id from public.%I where id=$1', v_tabla) into v_borrador using p_nivel_id;
  if v_borrador is null then raise exception 'El nivel ya no está disponible.'; end if;
  select estado into v_estado from public.borradores_presupuesto where id=v_borrador and creado_por=auth.uid() for update;
  if v_estado is distinct from 'BORRADOR' then raise exception 'Solo puede editar borradores creados por usted.'; end if;
  execute format('update public.%I set nombre=$1 where id=$2 and borrador_id=$3 returning id', v_tabla) into v_id using btrim(p_nombre), p_nivel_id, v_borrador;
  if v_id is null then raise exception 'No se pudo editar el nivel.'; end if;
  update public.borradores_presupuesto set actualizado_en=now() where id=v_borrador;
  return v_id;
end $$;

create or replace function public.eliminar_rama_borrador(p_nivel text, p_nivel_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_tabla text;
  v_borrador uuid;
  v_estado text;
  v_programas uuid[];
  v_subprogramas uuid[];
  v_proyectos uuid[];
  v_actividades uuid[];
  v_obras uuid[];
  v_id uuid;
begin
  v_tabla := case p_nivel when 'Programa' then 'borrador_programas' when 'SubPrograma' then 'borrador_subprogramas' when 'Proyecto' then 'borrador_proyectos' when 'Actividad' then 'borrador_actividades' when 'Obra' then 'borrador_obras' end;
  if v_tabla is null or p_nivel_id is null then raise exception 'Debe indicar el nivel a borrar.'; end if;
  if auth.uid() is null or not exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO') then
    raise exception 'No tiene permiso para borrar elementos del borrador.';
  end if;
  execute format('select borrador_id from public.%I where id=$1', v_tabla) into v_borrador using p_nivel_id;
  if v_borrador is null then raise exception 'El nivel ya no está disponible.'; end if;
  select estado into v_estado from public.borradores_presupuesto where id=v_borrador and creado_por=auth.uid() for update;
  if v_estado is distinct from 'BORRADOR' then raise exception 'Solo puede borrar elementos de borradores creados por usted.'; end if;
  -- Bloquea la raíz antes de reunir descendientes: evita insertar hijos en ella durante el borrado.
  execute format('select id from public.%I where id=$1 and borrador_id=$2 for update', v_tabla) into v_id using p_nivel_id, v_borrador;
  if v_id is null then raise exception 'El nivel ya no está disponible.'; end if;

  with recursive nodos as (
    select id, programa_id padre_id, 'SubPrograma'::text nivel, 'Programa'::text padre_nivel from public.borrador_subprogramas where borrador_id=v_borrador
    union all select id, subprograma_id, 'Proyecto', 'SubPrograma' from public.borrador_proyectos where borrador_id=v_borrador
    union all select id, proyecto_id, 'Actividad', 'Proyecto' from public.borrador_actividades where borrador_id=v_borrador
    union all select id, actividad_id, 'Obra', 'Actividad' from public.borrador_obras where borrador_id=v_borrador
  ), rama as (
    select p_nivel_id id, p_nivel nivel
    union all select n.id, n.nivel from nodos n join rama r on n.padre_id=r.id and n.padre_nivel=r.nivel
  )
  select array_agg(id) filter(where nivel='Programa'), array_agg(id) filter(where nivel='SubPrograma'),
         array_agg(id) filter(where nivel='Proyecto'), array_agg(id) filter(where nivel='Actividad'), array_agg(id) filter(where nivel='Obra')
  into v_programas, v_subprogramas, v_proyectos, v_actividades, v_obras from rama;

  -- Incluye códigos inactivos para respetar todas las claves foráneas.
  delete from public.borrador_codigos_presupuesto where borrador_id=v_borrador and obra_id=any(v_obras);
  delete from public.borrador_obras where borrador_id=v_borrador and id=any(v_obras);
  delete from public.borrador_actividades where borrador_id=v_borrador and id=any(v_actividades);
  delete from public.borrador_proyectos where borrador_id=v_borrador and id=any(v_proyectos);
  delete from public.borrador_subprogramas where borrador_id=v_borrador and id=any(v_subprogramas);
  delete from public.borrador_programas where borrador_id=v_borrador and id=any(v_programas);
  update public.borradores_presupuesto set actualizado_en=now() where id=v_borrador;
  return v_id;
end $$;

revoke all on function public.editar_nivel_borrador(text,uuid,text) from public, anon;
revoke all on function public.eliminar_rama_borrador(text,uuid) from public, anon;
grant execute on function public.editar_nivel_borrador(text,uuid,text) to authenticated;
grant execute on function public.eliminar_rama_borrador(text,uuid) to authenticated;
notify pgrst, 'reload schema';
