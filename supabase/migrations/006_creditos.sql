-- Créditos: libro mayor y consumo.
-- Aplicada el 2026-09-07 al proyecto duzfvyfhsvhavptuxehi.

-- Por qué un libro de movimientos y no una columna `saldo` en users:
-- el saldo se puede recalcular, pero un historial perdido no se recupera. Ante
-- un reclamo ("pagué y no me llegaron"), una columna solo dice cuánto hay ahora;
-- el libro dice qué pasó, cuándo y de dónde vino.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  motivo text not null check (motivo in ('compra', 'consumo', 'regalo', 'ajuste', 'reembolso')),
  referencia text,
  detalle jsonb,
  created_at timestamptz not null default now()
);

-- Idempotencia: RevenueCat reintenta sus webhooks ante cualquier duda, así que
-- el MISMO pago llega varias veces. Sin esto, un reintento regala créditos.
create unique index if not exists idx_credit_ledger_idempotencia
  on public.credit_ledger (motivo, referencia) where referencia is not null;

create index if not exists idx_credit_ledger_usuario
  on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- El usuario LEE lo suyo y nada más. NO hay política de INSERT a propósito: si
-- el cliente pudiera escribir aquí, cualquiera con la llave anónima —que va
-- pública en el bundle— se regalaría créditos infinitos.
drop policy if exists "ledger_lee_propio" on public.credit_ledger;
create policy "ledger_lee_propio" on public.credit_ledger
  for select using (auth.uid() = user_id);

create or replace function public.saldo_creditos()
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where user_id = auth.uid();
$$;
revoke all on function public.saldo_creditos() from public;
grant execute on function public.saldo_creditos() to authenticated;

-- Consumo. Comprobar el saldo en el cliente y luego descontarlo sería una
-- carrera: entre la lectura y la escritura caben dos gastos con un solo crédito.
create or replace function public.consumir_creditos(
  cantidad integer, referencia text default null, detalle jsonb default null
) returns integer language plpgsql security definer set search_path = public as $$
declare quien uuid := auth.uid(); saldo integer;
begin
  if quien is null then raise exception 'Sin sesión' using errcode = '28000'; end if;
  if cantidad is null or cantidad <= 0 then
    raise exception 'La cantidad debe ser positiva' using errcode = '22023'; end if;

  -- Cerrojo por usuario: sin él, dos peticiones simultáneas leen el mismo saldo,
  -- ambas lo encuentran suficiente y ambas descuentan. Verificado: cuatro
  -- gastos simultáneos con saldo de 2 dejan pasar exactamente 2.
  perform pg_advisory_xact_lock(hashtext(quien::text));

  select coalesce(sum(delta), 0) into saldo
  from public.credit_ledger where user_id = quien;

  if saldo < cantidad then
    raise exception 'Créditos insuficientes: tienes %, hacen falta %', saldo, cantidad
      using errcode = 'P0001';
  end if;

  insert into public.credit_ledger (user_id, delta, motivo, referencia, detalle)
  values (quien, -cantidad, 'consumo', referencia, detalle);
  return saldo - cantidad;
end;
$$;
revoke all on function public.consumir_creditos(integer, text, jsonb) from public;
grant execute on function public.consumir_creditos(integer, text, jsonb) to authenticated;
