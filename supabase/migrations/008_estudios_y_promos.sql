-- Estudios (canal de distribución), atribución y códigos promocionales.
-- Proyecto duzfvyfhsvhavptuxehi.
--
-- POR QUÉ TODO PASA POR FUNCIONES Y NO POR POLÍTICAS DE TABLA:
-- `estudios` guarda contacto y `codigos_promo` guarda códigos que regalan
-- créditos. Ninguna de las dos puede ser legible desde el cliente —la llave
-- anónima viaja pública en el bundle— y `codigos_promo` tampoco escribible.
-- Las funciones SECURITY DEFINER exponen exactamente la operación permitida
-- (registrar, atribuir, canjear) y nada más. Es el mismo principio que
-- `consumir_creditos` en la migración 006.

-- ── Estudios ────────────────────────────────────────────────────────────────

create table if not exists public.estudios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- El código que el estudio le da a sus clientes. Lo elige el estudio: un
  -- código con su nombre ("TINTA") se dicta de viva voz mucho mejor que uno
  -- aleatorio, y de eso depende que se use.
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{4,12}$'),
  contacto text not null,
  ciudad text,
  -- Los primeros estudios llevan comisión mayor. Se decide al registrarse y
  -- queda fijo: cambiar el porcentaje a quien ya firmó rompe la confianza.
  fundador boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.estudios enable row level security;
-- Sin políticas a propósito: ni lectura ni escritura directa desde el cliente.

-- Atribución permanente del usuario a un estudio.
alter table public.users add column if not exists estudio_id uuid references public.estudios(id);
create index if not exists idx_users_estudio on public.users(estudio_id) where estudio_id is not null;

-- Cuántos fundadores hay. Se saca de aquí para que el número viva en un solo
-- lugar y no dentro de cada función.
create or replace function public.cupo_fundadores() returns integer
language sql immutable as $$ select 20 $$;

/*
  Alta de un estudio desde la landing. La llama un visitante SIN sesión, igual
  que la lista de espera: exigir cuenta a un tatuador para inscribir su estudio
  mata la conversión en el primer contacto.
*/
create or replace function public.registrar_estudio(
  p_nombre text, p_contacto text, p_codigo text, p_ciudad text default null
) returns table (codigo text, fundador boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_codigo text := upper(trim(p_codigo));
  v_fundador boolean;
begin
  if length(trim(p_nombre)) < 2 then
    raise exception 'nombre_invalido' using errcode = '22023';
  end if;
  if p_contacto !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'contacto_invalido' using errcode = '22023';
  end if;
  if v_codigo !~ '^[A-Z0-9]{4,12}$' then
    raise exception 'codigo_invalido' using errcode = '22023';
  end if;

  -- Bajo concurrencia dos altas podrían ser ambas "la número 20". Es una
  -- promoción, no contabilidad: un fundador de más no rompe nada.
  select count(*) < cupo_fundadores() into v_fundador from estudios;

  begin
    insert into estudios (nombre, codigo, contacto, ciudad, fundador)
    values (trim(p_nombre), v_codigo, lower(trim(p_contacto)), nullif(trim(p_ciudad), ''), v_fundador);
  exception when unique_violation then
    -- Se nombra el error para que el cliente pueda ofrecer "prueba otro
    -- código" en vez de un "error al guardar" que no dice qué hacer
    raise exception 'codigo_ocupado' using errcode = '23505';
  end;

  return query select v_codigo, v_fundador;
end;
$$;
revoke all on function public.registrar_estudio(text, text, text, text) from public;
grant execute on function public.registrar_estudio(text, text, text, text) to anon, authenticated;

/*
  El usuario acredita a su tatuador. Devuelve el nombre del estudio para
  confirmarle en pantalla a quién acreditó, o null si el código no existe.

  La atribución es PERMANENTE: si ya tiene estudio, no se sobreescribe. Un
  estudio que trajo al cliente no puede perderlo porque otro le pase un código
  después — eso invitaría a robar atribuciones.
*/
create or replace function public.atribuir_estudio(p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_estudio estudios%rowtype;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = '28000'; end if;

  select * into v_estudio from estudios where codigo = upper(trim(p_codigo));
  if not found then return null; end if;

  update users set estudio_id = v_estudio.id
  where id = auth.uid() and estudio_id is null;

  return v_estudio.nombre;
end;
$$;
revoke all on function public.atribuir_estudio(text) from public;
grant execute on function public.atribuir_estudio(text) to authenticated;

-- ── Códigos promocionales ───────────────────────────────────────────────────

/*
  Un código regala créditos. Sirve para dos cosas distintas con el mismo
  mecanismo: la prueba gratis que exigen las reglas del Shipaton (los jueces
  no van a pagar para calificar), y que un estudio le muestre el producto a un
  cliente sin cobrarle.

  Se hace del lado de la app y no con los códigos promocionales de Play porque
  los de Play son limitados, lentos de emitir y no se pueden auditar desde aquí.
*/
create table if not exists public.codigos_promo (
  codigo text primary key check (codigo ~ '^[A-Z0-9]{4,16}$'),
  creditos integer not null check (creditos > 0),
  usos_max integer check (usos_max is null or usos_max > 0), -- null = sin tope
  usos integer not null default 0,
  activo boolean not null default true,
  nota text, -- para qué se emitió: "jueces shipaton", "demo estudio X"
  created_at timestamptz not null default now()
);

alter table public.codigos_promo enable row level security;
-- Sin políticas: los códigos solo se leen dentro de canjear_codigo().

-- Un canje por usuario por código. La clave primaria ES la regla.
create table if not exists public.canjes_promo (
  codigo text not null references public.codigos_promo(codigo),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (codigo, user_id)
);

alter table public.canjes_promo enable row level security;
drop policy if exists "canjes_lee_propio" on public.canjes_promo;
create policy "canjes_lee_propio" on public.canjes_promo
  for select using (auth.uid() = user_id);

create or replace function public.canjear_codigo(p_codigo text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  quien uuid := auth.uid();
  v_codigo text := upper(trim(p_codigo));
  promo codigos_promo%rowtype;
begin
  if quien is null then raise exception 'Sin sesión' using errcode = '28000'; end if;

  -- Cerrojo por código: sin él, dos canjes simultáneos del último uso
  -- disponible pasarían los dos. Mismo patrón que consumir_creditos.
  perform pg_advisory_xact_lock(hashtext('promo:' || v_codigo));

  select * into promo from codigos_promo where codigo = v_codigo;
  if not found or not promo.activo then
    raise exception 'codigo_invalido' using errcode = 'P0001';
  end if;
  if promo.usos_max is not null and promo.usos >= promo.usos_max then
    raise exception 'codigo_agotado' using errcode = 'P0001';
  end if;
  if exists (select 1 from canjes_promo where codigo = v_codigo and user_id = quien) then
    raise exception 'codigo_ya_canjeado' using errcode = 'P0001';
  end if;

  insert into canjes_promo (codigo, user_id) values (v_codigo, quien);
  update codigos_promo set usos = usos + 1 where codigo = v_codigo;
  insert into credit_ledger (user_id, delta, motivo, referencia, detalle)
  values (quien, promo.creditos, 'regalo', 'promo:' || v_codigo, jsonb_build_object('nota', promo.nota));

  return promo.creditos;
end;
$$;
revoke all on function public.canjear_codigo(text) from public;
grant execute on function public.canjear_codigo(text) to authenticated;

-- ── Primer crédito a mitad de precio ────────────────────────────────────────

/*
  El SKU `creditos_primero` solo se ofrece a quien nunca ha comprado. Play no
  tiene precio introductorio para productos únicos, así que la regla vive
  aquí y la app oculta el paquete. Un regalo (promo) NO cuenta como compra:
  quien probó gratis sigue teniendo derecho a su primer crédito barato.
*/
create or replace function public.ha_comprado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from credit_ledger where user_id = auth.uid() and motivo = 'compra'
  );
$$;
revoke all on function public.ha_comprado() from public;
grant execute on function public.ha_comprado() to authenticated;
