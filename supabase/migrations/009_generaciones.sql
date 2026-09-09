-- Generación de video: el producto del motor de concurso.
-- Proyecto duzfvyfhsvhavptuxehi.
--
-- ── Por qué existe esta tabla y no solo `tattoos.video_url` ──
-- Una generación tarda minutos y puede fallar, ser rechazada por moderación o
-- quedarse a medias si el usuario cierra la app. El tatuaje necesita saber
-- solo "cuál es mi video"; la generación necesita saber "en qué va, cuánto
-- costó, por qué falló". Mezclar ambas cosas en `tattoos` obligaría a ensuciar
-- el tatuaje con estados transitorios y borrarlos después.
--
-- ── Quién escribe aquí ──
-- Solo el worker, con la llave de servicio. El cliente LEE sus propias filas
-- para mostrar el avance; nunca inserta ni cambia estados. Si pudiera, con la
-- llave anónima —pública en el bundle— cualquiera se marcaría un video como
-- listo o se reembolsaría créditos.

create table if not exists public.generaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tattoo_id uuid not null references public.tattoos(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_proceso', 'lista', 'fallida', 'rechazada')),
  -- Identificador de la petición en Higgsfield. Se guarda en cuanto lo acepta:
  -- es lo único que permite reanudar, cancelar o reclamar a soporte.
  request_id text,
  modelo text not null,
  foto_url text not null,
  historia text not null check (length(historia) between 3 and 600),
  video_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_generaciones_usuario on public.generaciones(user_id, created_at desc);
create index if not exists idx_generaciones_tatuaje on public.generaciones(tattoo_id);

alter table public.generaciones enable row level security;
drop policy if exists "generaciones_lee_propio" on public.generaciones;
create policy "generaciones_lee_propio" on public.generaciones
  for select using (auth.uid() = user_id);
-- Sin políticas de escritura a propósito.

-- El tatuaje lleva video O modelo 3D, nunca ambos (regla 6 de CLAUDE.md).
alter table public.tattoos add column if not exists video_url text;

/*
  Reserva de crédito para una generación. SOLO para el rol de servicio.

  ── Por qué no reusa consumir_creditos() ──
  Esa función lee auth.uid(): está pensada para que el usuario gaste desde la
  app. Aquí quien gasta es el worker en nombre del usuario, con la llave de
  servicio, y no hay sesión de usuario. Recibe el id explícito — y por eso
  mismo NO puede ser llamable por anon ni authenticated: cualquiera podría
  descontarle créditos a otro.

  Mismo cerrojo por usuario que consumir_creditos: sin él, dos generaciones
  simultáneas con un solo crédito pasarían las dos.

  La referencia `generacion:<id>` es única por generación gracias al índice de
  idempotencia del libro mayor: reintentar la reserva no cobra dos veces.
*/
create or replace function public.reservar_credito_generacion(p_user uuid, p_generacion uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare saldo integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select coalesce(sum(delta), 0) into saldo from credit_ledger where user_id = p_user;
  if saldo < 1 then
    raise exception 'Créditos insuficientes: tienes %', saldo using errcode = 'P0001';
  end if;

  insert into credit_ledger (user_id, delta, motivo, referencia, detalle)
  values (p_user, -1, 'consumo', 'generacion:' || p_generacion, jsonb_build_object('generacion', p_generacion))
  on conflict do nothing;

  return saldo - 1;
end;
$$;
revoke all on function public.reservar_credito_generacion(uuid, uuid) from public;
grant execute on function public.reservar_credito_generacion(uuid, uuid) to service_role;

/*
  Devolución del crédito si la generación falla por causa nuestra o del
  proveedor. Un fallo de infraestructura nunca puede costarle al usuario.

  Idempotente por la misma vía: la referencia lleva sufijo propio y el índice
  del libro mayor rechaza el duplicado.
*/
create or replace function public.reembolsar_generacion(p_user uuid, p_generacion uuid)
returns void language sql security definer set search_path = public as $$
  insert into credit_ledger (user_id, delta, motivo, referencia, detalle)
  values (p_user, 1, 'reembolso', 'generacion:' || p_generacion || ':reembolso',
          jsonb_build_object('generacion', p_generacion))
  on conflict do nothing;
$$;
revoke all on function public.reembolsar_generacion(uuid, uuid) from public;
grant execute on function public.reembolsar_generacion(uuid, uuid) to service_role;

-- Los videos generados viven en nuestro Storage: los de Higgsfield caducan a
-- los 7 días. Lectura pública (el escaneo no tiene sesión); escritura solo por
-- el worker con la llave de servicio, que no pasa por políticas.
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;
