-- Perfil de usuario ligado a Supabase Auth + soporte multi-tatuaje.
-- Aplicada el 2026-09-07 al proyecto duzfvyfhsvhavptuxehi.
--
-- NOTA: el proyecto Supabase es compartido con otra aplicación, que usa la
-- tabla `profiles`. La tabla `users` es exclusiva de Inkwell AR (solo `tattoos`
-- la referencia), verificado por claves foráneas antes de modificarla.

alter table public.users drop column if exists email;
alter table public.users add column if not exists share_slug text unique;
alter table public.users add column if not exists mind_url text;
alter table public.users add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'users_id_fkey' and table_name = 'users' and table_schema = 'public'
  ) then
    alter table public.users
      add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.tattoos add column if not exists target_index integer not null default 0;

create index if not exists idx_users_share_slug on public.users(share_slug);
create index if not exists idx_tattoos_user_target on public.tattoos(user_id, target_index);
