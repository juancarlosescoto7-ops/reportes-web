-- Clon estructural del modulo de presupuesto para formulacion futura.
-- Copia el sistema (tablas, flujo y techos), nunca los datos operativos.

create table if not exists public.borradores_presupuesto (
  id uuid primary key default gen_random_uuid(),
  anio integer not null unique check(anio between 2000 and 2200),
  nombre text not null,
  estado text not null default 'BORRADOR' check(estado in ('BORRADOR','EN_REVISION','APROBADO')),
  ejercicio_base integer not null,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create table if not exists public.borrador_presupuesto_topes (
  id uuid primary key default gen_random_uuid(),
  borrador_id uuid not null references public.borradores_presupuesto(id) on delete cascade,
  fuente text not null,
  nivel_aplicacion text not null,
  id_nivel text not null,
  porcentaje_tope numeric not null check(porcentaje_tope>=0),
  creado_en timestamptz not null default now(),
  unique(borrador_id,fuente,nivel_aplicacion,id_nivel)
);
create table if not exists public.borrador_presupuesto_fuentes (
  id uuid primary key default gen_random_uuid(),
  borrador_id uuid not null references public.borradores_presupuesto(id) on delete cascade,
  fuente text not null,
  nombre_fuente text,
  monto_base numeric not null default 0 check(monto_base>=0),
  creado_en timestamptz not null default now(),
  unique(borrador_id,fuente)
);
create index if not exists borrador_topes_borrador_idx on public.borrador_presupuesto_topes(borrador_id);
create index if not exists borrador_fuentes_borrador_idx on public.borrador_presupuesto_fuentes(borrador_id);

alter table public.borradores_presupuesto enable row level security;
alter table public.borrador_presupuesto_topes enable row level security;
alter table public.borrador_presupuesto_fuentes enable row level security;
grant select,insert,update on public.borradores_presupuesto to authenticated;
grant select,insert on public.borrador_presupuesto_topes,public.borrador_presupuesto_fuentes to authenticated;
revoke all on public.borradores_presupuesto,public.borrador_presupuesto_topes,public.borrador_presupuesto_fuentes from anon;

drop policy if exists borradores_presupuesto_select on public.borradores_presupuesto;
create policy borradores_presupuesto_select on public.borradores_presupuesto for select to authenticated
using(exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO'));
drop policy if exists borradores_presupuesto_insert on public.borradores_presupuesto;
create policy borradores_presupuesto_insert on public.borradores_presupuesto for insert to authenticated
with check(
  creado_por=(select auth.uid()) and estado='BORRADOR'
  and exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO')
);
drop policy if exists borradores_presupuesto_update on public.borradores_presupuesto;
create policy borradores_presupuesto_update on public.borradores_presupuesto for update to authenticated
using(estado='BORRADOR' and exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO'))
with check(estado='BORRADOR' and exists(select 1 from public.obtener_mis_permisos() p where p.permiso_codigo='VER_PRESUPUESTO'));

drop policy if exists borrador_topes_select on public.borrador_presupuesto_topes;
create policy borrador_topes_select on public.borrador_presupuesto_topes for select to authenticated
using(exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id));
drop policy if exists borrador_topes_insert on public.borrador_presupuesto_topes;
create policy borrador_topes_insert on public.borrador_presupuesto_topes for insert to authenticated
with check(exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR'));
drop policy if exists borrador_fuentes_select on public.borrador_presupuesto_fuentes;
create policy borrador_fuentes_select on public.borrador_presupuesto_fuentes for select to authenticated
using(exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id));
drop policy if exists borrador_fuentes_insert on public.borrador_presupuesto_fuentes;
create policy borrador_fuentes_insert on public.borrador_presupuesto_fuentes for insert to authenticated
with check(exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR'));

create table if not exists public.borrador_programas (
  id uuid primary key default gen_random_uuid(),
  borrador_id uuid not null references public.borradores_presupuesto(id) on delete cascade,
  codigo text not null check (btrim(codigo)<>''), nombre text not null check (btrim(nombre)<>''),
  creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
  unique(borrador_id,id), unique(borrador_id,codigo)
);
create table if not exists public.borrador_subprogramas (
  id uuid primary key default gen_random_uuid(), borrador_id uuid not null,
  programa_id uuid not null, fragmento text not null check(btrim(fragmento)<>''),
  codigo text not null, nombre text not null check(btrim(nombre)<>''),
  creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
  unique(borrador_id,id), unique(borrador_id,codigo),
  foreign key(borrador_id,programa_id) references public.borrador_programas(borrador_id,id) on delete restrict
);
create table if not exists public.borrador_proyectos (
  id uuid primary key default gen_random_uuid(), borrador_id uuid not null,
  subprograma_id uuid not null, fragmento text not null check(btrim(fragmento)<>''),
  codigo text not null, nombre text not null check(btrim(nombre)<>''),
  creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
  unique(borrador_id,id), unique(borrador_id,codigo),
  foreign key(borrador_id,subprograma_id) references public.borrador_subprogramas(borrador_id,id) on delete restrict
);
create table if not exists public.borrador_actividades (
  id uuid primary key default gen_random_uuid(), borrador_id uuid not null,
  proyecto_id uuid not null, fragmento text not null check(btrim(fragmento)<>''),
  codigo text not null, nombre text not null check(btrim(nombre)<>''),
  creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
  unique(borrador_id,id), unique(borrador_id,codigo),
  foreign key(borrador_id,proyecto_id) references public.borrador_proyectos(borrador_id,id) on delete restrict
);
create table if not exists public.borrador_obras (
  id uuid primary key default gen_random_uuid(), borrador_id uuid not null,
  actividad_id uuid not null, fragmento text not null check(btrim(fragmento)<>''),
  codigo text not null, nombre text not null check(btrim(nombre)<>''),
  creado_por uuid not null default auth.uid() references auth.users(id), creado_en timestamptz not null default now(),
  unique(borrador_id,id), unique(borrador_id,codigo),
  foreign key(borrador_id,actividad_id) references public.borrador_actividades(borrador_id,id) on delete restrict
);
create table if not exists public.borrador_codigos_presupuesto (
  id uuid primary key default gen_random_uuid(), borrador_id uuid not null,
  obra_id uuid not null, codigo text not null, objeto text not null,
  fuente text not null, tipo_inversion text not null,
  monto numeric not null default 0 check(monto>=0), activo boolean not null default true,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  unique(borrador_id,id),
  foreign key(borrador_id,obra_id) references public.borrador_obras(borrador_id,id) on delete restrict
);
create unique index if not exists borrador_codigos_activos_uidx on public.borrador_codigos_presupuesto(borrador_id,codigo) where activo;

create index if not exists borrador_subprogramas_programa_idx on public.borrador_subprogramas(programa_id);
create index if not exists borrador_proyectos_subprograma_idx on public.borrador_proyectos(subprograma_id);
create index if not exists borrador_actividades_proyecto_idx on public.borrador_actividades(proyecto_id);
create index if not exists borrador_obras_actividad_idx on public.borrador_obras(actividad_id);
create index if not exists borrador_codigos_obra_idx on public.borrador_codigos_presupuesto(obra_id);
create index if not exists borrador_subprogramas_relacion_idx on public.borrador_subprogramas(borrador_id,programa_id);
create index if not exists borrador_proyectos_relacion_idx on public.borrador_proyectos(borrador_id,subprograma_id);
create index if not exists borrador_actividades_relacion_idx on public.borrador_actividades(borrador_id,proyecto_id);
create index if not exists borrador_obras_relacion_idx on public.borrador_obras(borrador_id,actividad_id);
create index if not exists borrador_codigos_relacion_idx on public.borrador_codigos_presupuesto(borrador_id,obra_id);
create index if not exists borrador_codigos_techo_idx on public.borrador_codigos_presupuesto(borrador_id,fuente,tipo_inversion) where activo;

alter table public.borrador_programas enable row level security;
alter table public.borrador_subprogramas enable row level security;
alter table public.borrador_proyectos enable row level security;
alter table public.borrador_actividades enable row level security;
alter table public.borrador_obras enable row level security;
alter table public.borrador_codigos_presupuesto enable row level security;
grant select,insert on public.borrador_programas,public.borrador_subprogramas,public.borrador_proyectos,public.borrador_actividades,public.borrador_obras to authenticated;
grant select,insert,update on public.borrador_codigos_presupuesto to authenticated;
revoke all on public.borrador_programas,public.borrador_subprogramas,public.borrador_proyectos,public.borrador_actividades,public.borrador_obras,public.borrador_codigos_presupuesto from anon;

do $$
declare t text;
begin
  foreach t in array array['borrador_programas','borrador_subprogramas','borrador_proyectos','borrador_actividades','borrador_obras','borrador_codigos_presupuesto'] loop
    execute format('drop policy if exists %I on public.%I',t||'_select',t);
    execute format('create policy %I on public.%I for select to authenticated using (exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id))',t||'_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (creado_por=(select auth.uid()) and exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado=''BORRADOR''))',t||'_insert',t);
  end loop;
end $$;
drop policy if exists borrador_codigos_presupuesto_update on public.borrador_codigos_presupuesto;
create policy borrador_codigos_presupuesto_update on public.borrador_codigos_presupuesto
for update to authenticated using (
  exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR')
) with check (
  creado_por=(select auth.uid()) and exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR')
);

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
create or replace function public.crear_subprograma_borrador(p_borrador_id uuid,p_programa_id uuid,p_fragmento text,p_nombre text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_padre text;
begin
  select codigo into v_padre from public.borrador_programas where id=p_programa_id and borrador_id=p_borrador_id;
  if not found then raise exception 'El programa no pertenece al borrador.'; end if;
  insert into public.borrador_subprogramas(borrador_id,programa_id,fragmento,codigo,nombre,creado_por)
  values(p_borrador_id,p_programa_id,btrim(p_fragmento),v_padre||' '||btrim(p_fragmento),btrim(p_nombre),auth.uid()) returning id into v_id; return v_id;
end $$;
create or replace function public.crear_proyecto_borrador(p_borrador_id uuid,p_subprograma_id uuid,p_fragmento text,p_nombre text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_padre text;
begin
  select codigo into v_padre from public.borrador_subprogramas where id=p_subprograma_id and borrador_id=p_borrador_id;
  if not found then raise exception 'El subprograma no pertenece al borrador.'; end if;
  insert into public.borrador_proyectos(borrador_id,subprograma_id,fragmento,codigo,nombre,creado_por)
  values(p_borrador_id,p_subprograma_id,btrim(p_fragmento),v_padre||' '||btrim(p_fragmento),btrim(p_nombre),auth.uid()) returning id into v_id; return v_id;
end $$;
create or replace function public.crear_actividad_borrador(p_borrador_id uuid,p_proyecto_id uuid,p_fragmento text,p_nombre text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_padre text;
begin
  select codigo into v_padre from public.borrador_proyectos where id=p_proyecto_id and borrador_id=p_borrador_id;
  if not found then raise exception 'El proyecto no pertenece al borrador.'; end if;
  insert into public.borrador_actividades(borrador_id,proyecto_id,fragmento,codigo,nombre,creado_por)
  values(p_borrador_id,p_proyecto_id,btrim(p_fragmento),v_padre||' '||btrim(p_fragmento),btrim(p_nombre),auth.uid()) returning id into v_id; return v_id;
end $$;
create or replace function public.crear_obra_borrador(p_borrador_id uuid,p_actividad_id uuid,p_fragmento text,p_nombre text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_padre text;
begin
  select codigo into v_padre from public.borrador_actividades where id=p_actividad_id and borrador_id=p_borrador_id;
  if not found then raise exception 'La actividad no pertenece al borrador.'; end if;
  insert into public.borrador_obras(borrador_id,actividad_id,fragmento,codigo,nombre,creado_por)
  values(p_borrador_id,p_actividad_id,btrim(p_fragmento),v_padre||' '||btrim(p_fragmento),btrim(p_nombre),auth.uid()) returning id into v_id; return v_id;
end $$;

create table if not exists public.borrador_presupuesto_ingresos (
  id uuid primary key default gen_random_uuid(),
  borrador_id uuid not null references public.borradores_presupuesto(id) on delete cascade,
  codigo_saft text not null references public.rubros_ingresos_saft(codigo) on update cascade,
  cantidad_negocios bigint not null default 0 check(cantidad_negocios>=0),
  monto_por_negocio numeric not null default 0 check(monto_por_negocio>=0),
  presupuesto_proyectado numeric generated always as (cantidad_negocios*monto_por_negocio) stored,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  unique(borrador_id,codigo_saft)
);

create or replace function public.validar_codigo_borrador() returns trigger
language plpgsql security invoker set search_path=public as $$
declare v_programa text; v_obra text; v_monto_fuente numeric; v_usado numeric; v_permitido numeric; v_aplica boolean:=false; r record;
begin
  if not new.activo then new.actualizado_en:=now(); return new; end if;
  perform pg_advisory_xact_lock(hashtext(new.borrador_id::text));
  if not exists(select 1 from public.borradores_presupuesto b where b.id=new.borrador_id and b.estado='BORRADOR') then raise exception 'El borrador no existe o ya no es editable.'; end if;
  select p.codigo,o.codigo into v_programa,v_obra
  from public.borrador_obras o join public.borrador_actividades a on a.id=o.actividad_id
  join public.borrador_proyectos py on py.id=a.proyecto_id join public.borrador_subprogramas s on s.id=py.subprograma_id
  join public.borrador_programas p on p.id=s.programa_id
  where o.id=new.obra_id and o.borrador_id=new.borrador_id;
  if not found then raise exception 'La obra no pertenece al borrador.'; end if;
  new.objeto:=btrim(new.objeto); new.fuente:=btrim(new.fuente); new.tipo_inversion:=btrim(new.tipo_inversion);
  new.codigo:=v_obra||' '||new.objeto||' '||new.fuente||' '||new.tipo_inversion; new.actualizado_en:=now();
  select monto_base into v_monto_fuente from public.borrador_presupuesto_fuentes where borrador_id=new.borrador_id and fuente=new.fuente;
  if not found then raise exception 'La fuente % no esta configurada.',new.fuente; end if;
  if new.fuente='15-013-01' then
    select coalesce(sum(presupuesto_proyectado),0) into v_monto_fuente
    from public.borrador_presupuesto_ingresos where borrador_id=new.borrador_id;
  end if;
  select coalesce(sum(c.monto),0) into v_usado from public.borrador_codigos_presupuesto c where c.borrador_id=new.borrador_id and c.activo and c.fuente=new.fuente and c.id<>new.id;
  if v_usado+new.monto>v_monto_fuente+0.005 then raise exception 'La fuente % solo dispone de L %.2f.',new.fuente,greatest(v_monto_fuente-v_usado,0); end if;
  for r in select nivel_aplicacion,id_nivel,porcentaje_tope from public.borrador_presupuesto_topes
    where borrador_id=new.borrador_id and fuente=new.fuente
      and ((nivel_aplicacion='programa' and id_nivel=v_programa) or (nivel_aplicacion='tipo_inversion' and id_nivel=new.tipo_inversion))
  loop
    v_aplica:=true; v_permitido:=round(v_monto_fuente*r.porcentaje_tope/100,2);
    select coalesce(sum(c.monto),0) into v_usado
    from public.borrador_codigos_presupuesto c join public.borrador_obras o on o.id=c.obra_id
    join public.borrador_actividades a on a.id=o.actividad_id join public.borrador_proyectos py on py.id=a.proyecto_id
    join public.borrador_subprogramas s on s.id=py.subprograma_id join public.borrador_programas p on p.id=s.programa_id
    where c.borrador_id=new.borrador_id and c.activo and c.fuente=new.fuente and c.id<>new.id
      and case r.nivel_aplicacion when 'programa' then p.codigo=r.id_nivel when 'tipo_inversion' then c.tipo_inversion=r.id_nivel else false end;
    if v_usado+new.monto>v_permitido+0.005 then raise exception 'El techo % % de la fuente % solo dispone de L %.2f.',r.nivel_aplicacion,r.id_nivel,new.fuente,greatest(v_permitido-v_usado,0); end if;
  end loop;
  if not v_aplica then raise exception 'No existe un techo aplicable para programa %, tipo % y fuente %.',v_programa,new.tipo_inversion,new.fuente; end if;
  return new;
end $$;
drop trigger if exists validar_codigo_borrador on public.borrador_codigos_presupuesto;
create trigger validar_codigo_borrador before insert or update on public.borrador_codigos_presupuesto for each row execute function public.validar_codigo_borrador();

create or replace function public.crear_codigo_presupuesto_borrador(p_borrador_id uuid,p_obra_id uuid,p_objeto text,p_fuente text,p_tipo_inversion text,p_monto numeric)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  insert into public.borrador_codigos_presupuesto(borrador_id,obra_id,codigo,objeto,fuente,tipo_inversion,monto,creado_por)
  values(p_borrador_id,p_obra_id,'',p_objeto,p_fuente,p_tipo_inversion,p_monto,auth.uid()) returning id into v_id; return v_id;
end $$;
create or replace function public.actualizar_monto_codigo_borrador(p_codigo_id uuid,p_monto numeric)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  update public.borrador_codigos_presupuesto set monto=p_monto,actualizado_en=now() where id=p_codigo_id and activo returning id into v_id;
  if v_id is null then raise exception 'El codigo no existe o ya no es editable.'; end if; return v_id;
end $$;
create or replace function public.desactivar_codigo_borrador(p_codigo_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  update public.borrador_codigos_presupuesto set activo=false,actualizado_en=now() where id=p_codigo_id and activo returning id into v_id;
  if v_id is null then raise exception 'El codigo no existe o ya no es editable.'; end if; return v_id;
end $$;

create or replace function public.obtener_control_techos_borrador(p_borrador_id uuid)
returns table(fuente text,nivel_aplicacion text,id_nivel text,porcentaje_tope numeric,monto_fuente numeric,monto_permitido numeric,monto_asignado numeric,monto_disponible numeric,porcentaje_usado numeric,estado text)
language sql stable security invoker set search_path=public as $$
with fuentes_efectivas as (
  select f.borrador_id,f.fuente,
    case when f.fuente='15-013-01' then coalesce((select sum(i.presupuesto_proyectado) from public.borrador_presupuesto_ingresos i where i.borrador_id=f.borrador_id),0)
      else f.monto_base end monto_base
  from public.borrador_presupuesto_fuentes f
), base as (
  select c.id,c.fuente,c.tipo_inversion,c.monto,p.codigo programa
  from public.borrador_codigos_presupuesto c join public.borrador_obras o on o.id=c.obra_id
  join public.borrador_actividades a on a.id=o.actividad_id join public.borrador_proyectos py on py.id=a.proyecto_id
  join public.borrador_subprogramas s on s.id=py.subprograma_id join public.borrador_programas p on p.id=s.programa_id
  where c.borrador_id=p_borrador_id and c.activo
)
select t.fuente,t.nivel_aplicacion,t.id_nivel,round(t.porcentaje_tope,2),round(coalesce(f.monto_base,0),2),
  round(coalesce(f.monto_base,0)*t.porcentaje_tope/100,2),round(coalesce(sum(b.monto),0),2),
  round(coalesce(f.monto_base,0)*t.porcentaje_tope/100-coalesce(sum(b.monto),0),2),
  case when coalesce(f.monto_base,0)*t.porcentaje_tope=0 then 0 else round(coalesce(sum(b.monto),0)/nullif(coalesce(f.monto_base,0)*t.porcentaje_tope/100,0),4) end,
  case when coalesce(f.monto_base,0)*t.porcentaje_tope/100-coalesce(sum(b.monto),0)<0 then 'SOBREPASADO'
    when coalesce(f.monto_base,0)*t.porcentaje_tope/100-coalesce(sum(b.monto),0)=0 then 'SIN_DISPONIBLE' else 'DISPONIBLE' end
from public.borrador_presupuesto_topes t left join fuentes_efectivas f on f.borrador_id=t.borrador_id and f.fuente=t.fuente
left join base b on b.fuente=t.fuente and ((t.nivel_aplicacion='programa' and b.programa=t.id_nivel) or (t.nivel_aplicacion='tipo_inversion' and b.tipo_inversion=t.id_nivel))
where t.borrador_id=p_borrador_id group by t.fuente,t.nivel_aplicacion,t.id_nivel,t.porcentaje_tope,f.monto_base
order by t.fuente,t.nivel_aplicacion,t.id_nivel;
$$;

create index if not exists borrador_ingresos_borrador_idx on public.borrador_presupuesto_ingresos(borrador_id);
create index if not exists borrador_ingresos_codigo_saft_idx on public.borrador_presupuesto_ingresos(codigo_saft);
alter table public.borrador_presupuesto_ingresos enable row level security;
grant select,insert,update on public.borrador_presupuesto_ingresos to authenticated;
revoke all on public.borrador_presupuesto_ingresos from anon;
drop policy if exists borrador_ingresos_select on public.borrador_presupuesto_ingresos;
create policy borrador_ingresos_select on public.borrador_presupuesto_ingresos for select to authenticated
using(exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id));
drop policy if exists borrador_ingresos_insert on public.borrador_presupuesto_ingresos;
create policy borrador_ingresos_insert on public.borrador_presupuesto_ingresos for insert to authenticated
with check(creado_por=(select auth.uid()) and exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR'));
drop policy if exists borrador_ingresos_update on public.borrador_presupuesto_ingresos;
create policy borrador_ingresos_update on public.borrador_presupuesto_ingresos for update to authenticated
using(creado_por=(select auth.uid()) and exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR'))
with check(creado_por=(select auth.uid()) and exists(select 1 from public.borradores_presupuesto b where b.id=borrador_id and b.estado='BORRADOR'));

create or replace function public.sincronizar_techo_ingresos_borrador() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_borrador uuid; v_total numeric; v_asignado numeric; v_permitido numeric; r record;
begin
  v_borrador:=case when tg_op='DELETE' then old.borrador_id else new.borrador_id end;
  perform pg_advisory_xact_lock(hashtext(v_borrador::text));
  select coalesce(sum(presupuesto_proyectado),0) into v_total
  from public.borrador_presupuesto_ingresos where borrador_id=v_borrador;
  select coalesce(sum(monto),0) into v_asignado from public.borrador_codigos_presupuesto
  where borrador_id=v_borrador and activo and fuente='15-013-01';
  if v_asignado>v_total+0.005 then
    raise exception 'El ingreso proyectado 15-013 no puede ser menor que los gastos ya asignados (L %.2f).',v_asignado;
  end if;
  for r in select nivel_aplicacion,id_nivel,porcentaje_tope from public.borrador_presupuesto_topes
    where borrador_id=v_borrador and fuente='15-013-01'
  loop
    v_permitido:=round(v_total*r.porcentaje_tope/100,2);
    if r.nivel_aplicacion='tipo_inversion' then
      select coalesce(sum(monto),0) into v_asignado from public.borrador_codigos_presupuesto
      where borrador_id=v_borrador and activo and fuente='15-013-01' and tipo_inversion=r.id_nivel;
    else
      select coalesce(sum(c.monto),0) into v_asignado
      from public.borrador_codigos_presupuesto c join public.borrador_obras o on o.id=c.obra_id
      join public.borrador_actividades a on a.id=o.actividad_id join public.borrador_proyectos py on py.id=a.proyecto_id
      join public.borrador_subprogramas s on s.id=py.subprograma_id join public.borrador_programas p on p.id=s.programa_id
      where c.borrador_id=v_borrador and c.activo and c.fuente='15-013-01' and p.codigo=r.id_nivel;
    end if;
    if v_asignado>v_permitido+0.005 then
      raise exception 'El ingreso proyectado deja el techo % % por debajo de los L %.2f ya asignados.',r.nivel_aplicacion,r.id_nivel,v_asignado;
    end if;
  end loop;
  update public.borrador_presupuesto_fuentes set monto_base=v_total
  where borrador_id=v_borrador and fuente='15-013-01';
  if not found then
    insert into public.borrador_presupuesto_fuentes(borrador_id,fuente,nombre_fuente,monto_base)
    values(v_borrador,'15-013-01','Fondos propios',v_total);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists sincronizar_techo_ingresos on public.borrador_presupuesto_ingresos;
create trigger sincronizar_techo_ingresos after insert or update or delete on public.borrador_presupuesto_ingresos
for each row execute function public.sincronizar_techo_ingresos_borrador();

create or replace function public.guardar_ingreso_borrador(p_borrador_id uuid,p_codigo_saft text,p_cantidad_negocios bigint,p_monto_por_negocio numeric)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if p_cantidad_negocios<0 or p_monto_por_negocio<0 then raise exception 'Cantidad y monto deben ser mayores o iguales a cero.'; end if;
  insert into public.borrador_presupuesto_ingresos(borrador_id,codigo_saft,cantidad_negocios,monto_por_negocio,creado_por)
  values(p_borrador_id,btrim(p_codigo_saft),p_cantidad_negocios,p_monto_por_negocio,auth.uid())
  on conflict(borrador_id,codigo_saft) do update set
    cantidad_negocios=excluded.cantidad_negocios,monto_por_negocio=excluded.monto_por_negocio,actualizado_en=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.crear_borrador_presupuesto(integer,integer) from public,anon;
revoke all on function public.crear_programa_borrador(uuid,text,text) from public,anon;
revoke all on function public.crear_subprograma_borrador(uuid,uuid,text,text) from public,anon;
revoke all on function public.crear_proyecto_borrador(uuid,uuid,text,text) from public,anon;
revoke all on function public.crear_actividad_borrador(uuid,uuid,text,text) from public,anon;
revoke all on function public.crear_obra_borrador(uuid,uuid,text,text) from public,anon;
revoke all on function public.crear_codigo_presupuesto_borrador(uuid,uuid,text,text,text,numeric) from public,anon;
revoke all on function public.actualizar_monto_codigo_borrador(uuid,numeric) from public,anon;
revoke all on function public.desactivar_codigo_borrador(uuid) from public,anon;
revoke all on function public.obtener_control_techos_borrador(uuid) from public,anon;
revoke all on function public.validar_codigo_borrador() from public,anon,authenticated;
revoke all on function public.sincronizar_techo_ingresos_borrador() from public,anon,authenticated;
revoke all on function public.guardar_ingreso_borrador(uuid,text,bigint,numeric) from public,anon;
grant execute on function public.crear_borrador_presupuesto(integer,integer) to authenticated;
grant execute on function public.crear_programa_borrador(uuid,text,text) to authenticated;
grant execute on function public.crear_subprograma_borrador(uuid,uuid,text,text) to authenticated;
grant execute on function public.crear_proyecto_borrador(uuid,uuid,text,text) to authenticated;
grant execute on function public.crear_actividad_borrador(uuid,uuid,text,text) to authenticated;
grant execute on function public.crear_obra_borrador(uuid,uuid,text,text) to authenticated;
grant execute on function public.crear_codigo_presupuesto_borrador(uuid,uuid,text,text,text,numeric) to authenticated;
grant execute on function public.actualizar_monto_codigo_borrador(uuid,numeric) to authenticated;
grant execute on function public.desactivar_codigo_borrador(uuid) to authenticated;
grant execute on function public.obtener_control_techos_borrador(uuid) to authenticated;
grant execute on function public.guardar_ingreso_borrador(uuid,text,bigint,numeric) to authenticated;
