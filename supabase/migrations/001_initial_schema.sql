-- Inkwell AR — Schema inicial (Phase 1-2)
-- Ejecutar en Supabase SQL Editor o via CLI

-- Usuario con tatuaje activado
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  username text unique,
  created_at timestamp with time zone default now()
);

-- Tatuaje registrado
create table if not exists tattoos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  image_url text,       -- foto original en Storage
  mind_url text,        -- archivo .mind compilado en Storage
  glb_url text,         -- modelo 3D vinculado en Storage
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Catálogo de GLBs disponibles
create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  glb_url text not null,
  tier text not null default 'catalog',  -- 'catalog' | 'custom' | 'premium'
  preview_url text,                       -- thumbnail para el selector
  created_at timestamp with time zone default now()
);

-- Índices para queries frecuentes
create index if not exists idx_tattoos_user on tattoos(user_id);
create index if not exists idx_tattoos_active on tattoos(is_active) where is_active = true;
create index if not exists idx_designs_tier on designs(tier);
