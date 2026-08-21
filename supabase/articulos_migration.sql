-- Correr este SQL en el editor SQL de Supabase (supabase.com → proyecto → SQL Editor)

create table if not exists public.articulos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  extracto    text,
  contenido   text,
  categoria   text check (categoria in ('deco', 'moda', 'viaje', 'receta')),
  imagen_url  text,
  autor       text not null default 'Casa Gioia',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.articulos enable row level security;

-- Lectura pública sólo para artículos activos (journal y página de lectura)
create policy "Public read active articulos"
  on public.articulos for select
  using (activo = true);
