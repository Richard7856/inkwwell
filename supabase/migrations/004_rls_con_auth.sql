-- Políticas de acceso con autenticación.
-- Aplicada el 2026-09-07 al proyecto duzfvyfhsvhavptuxehi.
--
-- PRINCIPIO RECTOR: quien ESCANEA nunca inicia sesión. La lectura es pública a
-- propósito; si ver un tatuaje exigiera cuenta, nadie escanearía, y sin
-- escaneos nadie tendría motivo para activar.

alter table public.users enable row level security;

drop policy if exists "users_public_read" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_public_read" on public.users for select using (true);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "tattoos_public_read" on public.tattoos;
drop policy if exists "tattoos_public_insert" on public.tattoos;
drop policy if exists "tattoos_insert" on public.tattoos;
drop policy if exists "tattoos_update_own" on public.tattoos;
drop policy if exists "tattoos_delete_own" on public.tattoos;

create policy "tattoos_public_read" on public.tattoos for select using (true);

-- TRANSITORIA: acepta user_id nulo para no romper el APK ya instalado mientras
-- el login llega al cliente. Al exigir sesión en la activación, se elimina la
-- rama del nulo y queda solo la comprobación de dueño.
create policy "tattoos_insert" on public.tattoos for insert
  with check (user_id is null or auth.uid() = user_id);

create policy "tattoos_update_own" on public.tattoos for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tattoos_delete_own" on public.tattoos for delete
  using (auth.uid() = user_id);
