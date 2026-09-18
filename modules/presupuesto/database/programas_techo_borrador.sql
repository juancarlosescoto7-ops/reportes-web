-- Los programas con techo conservan el mismo codigo que id_nivel.
-- Los programas creados por el usuario siguen usando numeracion automatica.

create or replace function public.crear_borrador_presupuesto(p_anio integer,p_ejercicio_base integer default extract(year from current_date)::integer)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if p_anio is null or p_anio<=p_ejercicio_base then raise exception 'El anio del borrador debe ser posterior al ejercicio base.'; end if;
  if not exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO') then raise exception 'No tiene permiso para generar el borrador.'; end if;
  insert into public.borradores_presupuesto(anio,nombre,estado,ejercicio_base,creado_por)
  values(p_anio,'Borrador de presupuesto '||p_anio,'BORRADOR',p_ejercicio_base,auth.uid()) returning id into v_id;
  insert into public.borrador_presupuesto_topes(borrador_id,fuente,nivel_aplicacion,id_nivel,porcentaje_tope)
  select v_id,fuente,nivel_aplicacion,id_nivel,porcentaje_tope from public.topes_porcentaje;
  insert into public.borrador_programas(borrador_id,codigo,nombre,creado_por)
  select v_id,t.id_nivel,coalesce(nullif(btrim(p.nombre),''),'Programa '||t.id_nivel),auth.uid()
  from (select distinct id_nivel from public.borrador_presupuesto_topes
    where borrador_id=v_id and nivel_aplicacion='programa' and btrim(id_nivel)<>'') t
  left join public.programas p on p.id=t.id_nivel;
  insert into public.borrador_presupuesto_fuentes(borrador_id,fuente,nombre_fuente,monto_base)
  select v_id,fuente,max(nombre_fuente),case when fuente='15-013-01' then 0 else sum(coalesce(monto,0)) end
  from public.alzas_fuentes_financiamiento where estado='activo' group by fuente;
  return v_id;
exception when unique_violation then raise exception 'Ya existe un borrador para el anio %.',p_anio;
end $$;

create or replace function public.crear_programa_borrador(p_borrador_id uuid,p_codigo text,p_nombre text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if exists(select 1 from public.borrador_programas where borrador_id=p_borrador_id and codigo=btrim(p_codigo)) then
    raise exception 'El programa % ya existe en este borrador.',btrim(p_codigo);
  end if;
  insert into public.borrador_programas(borrador_id,codigo,nombre,creado_por)
  values(p_borrador_id,btrim(p_codigo),btrim(p_nombre),auth.uid()) returning id into v_id; return v_id;
exception when unique_violation then
  raise exception 'El programa % ya existe en este borrador.',btrim(p_codigo);
end $$;

-- Completa borradores existentes sin alterar programas ni ramas ya creados.
insert into public.borrador_programas(borrador_id,codigo,nombre,creado_por)
select b.id,t.id_nivel,coalesce(nullif(btrim(p.nombre),''),'Programa '||t.id_nivel),b.creado_por
from public.borradores_presupuesto b
join (select distinct borrador_id,id_nivel from public.borrador_presupuesto_topes
  where nivel_aplicacion='programa' and btrim(id_nivel)<>'') t on t.borrador_id=b.id
left join public.programas p on p.id=t.id_nivel
where b.estado='BORRADOR'
on conflict (borrador_id,codigo) do nothing;
