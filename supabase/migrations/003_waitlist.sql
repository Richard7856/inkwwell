-- Inkwell AR — Lista de espera de la landing de validación
-- Ejecutar después de 002_rls_policies.sql

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,

  -- Qué tatuaje quiere activar. Texto libre a propósito: en esta etapa
  -- las palabras exactas de la gente valen más que cualquier categoría
  -- que se nos ocurra ahora. De aquí sale el catálogo real.
  tattoo_description text,

  -- Respuesta a "¿cuánto pagarías?". Es LA señal del experimento:
  -- los registros miden interés, esto mide disposición a pagar.
  price_range text,

  -- De dónde llegó (utm, estudio, etc.) para atribuir el canal más adelante
  source text,

  created_at timestamp with time zone default now()
);

-- Un correo, un registro. lower() para que Juan@x.com y juan@x.com no se dupliquen.
create unique index if not exists idx_waitlist_email on waitlist (lower(email));

create index if not exists idx_waitlist_created on waitlist (created_at desc);

-- === RLS ===

alter table waitlist enable row level security;

-- Cualquiera puede apuntarse — el formulario es público y no hay auth.
create policy "waitlist_public_insert"
  on waitlist for insert
  with check (true);

-- NO se crea policy de SELECT, y es deliberado.
--
-- Con RLS activo y sin policy de lectura, nadie puede leer la tabla usando la
-- anon key. Esa key viaja en el bundle del frontend, o sea que es pública:
-- si diéramos lectura, cualquiera podría descargarse la lista completa de
-- correos. La lista se consulta desde el Dashboard de Supabase o con la
-- service role key, nunca desde el cliente.
