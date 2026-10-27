-- =====================================================================
-- Azven Catálogo — estrutura do banco (Supabase / Postgres)
--
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Ele pode ser executado de novo sem apagar dados.
--
-- Segurança:
--   * Toda tabela tem Row Level Security (RLS) ligada.
--   * Visitantes (anon) só LEEM o que está visível no catálogo.
--   * Só quem está na tabela public.admins consegue criar/editar/apagar,
--     e essa regra vale no próprio banco — mesmo que alguém tente chamar
--     a API do Supabase direto, sem passar pelo site.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Cada admin enxerga apenas a própria linha. Ninguém insere/edita por API:
-- novos admins são cadastrados pelo SQL Editor (ver README).
drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;

-- security definer + search_path vazio: a função consulta admins sem
-- depender das policies e sem risco de sequestro de search_path.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Configurações da loja (uma única linha, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id                 smallint primary key default 1 check (id = 1),
  name               text not null default 'Minha Loja'
                     check (char_length(name) between 1 and 80),
  tagline            text check (char_length(tagline) <= 160),
  whatsapp           text not null default ''
                     check (whatsapp ~ '^[0-9]{0,15}$'),
  instagram          text check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  address            text check (char_length(address) <= 200),
  hours_text         text check (char_length(hours_text) <= 200),
  accepting_orders   boolean not null default true,
  delivery_enabled   boolean not null default true,
  pickup_enabled     boolean not null default true,
  delivery_fee_cents integer not null default 0
                     check (delivery_fee_cents between 0 and 100000000),
  min_order_cents    integer not null default 0
                     check (min_order_cents between 0 and 100000000),
  cover_image_path   text check (char_length(cover_image_path) <= 300),
  logo_image_path    text check (char_length(logo_image_path) <= 300),
  updated_at         timestamptz not null default now()
);

-- Para bancos criados antes desta coluna existir.
alter table public.store_settings
  add column if not exists logo_image_path text check (char_length(logo_image_path) <= 300);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

alter table public.store_settings enable row level security;

drop policy if exists "settings_public_read" on public.store_settings;
create policy "settings_public_read" on public.store_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "settings_admin_update" on public.store_settings;
create policy "settings_admin_update" on public.store_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke insert, update, delete, truncate on public.store_settings from anon;
revoke insert, delete, truncate on public.store_settings from authenticated;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

drop policy if exists "categories_admin_insert" on public.categories;
create policy "categories_admin_insert" on public.categories
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "categories_admin_update" on public.categories;
create policy "categories_admin_update" on public.categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "categories_admin_delete" on public.categories;
create policy "categories_admin_delete" on public.categories
  for delete to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.categories from anon;

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null check (char_length(name) between 1 and 100),
  description      text check (char_length(description) <= 600),
  price_cents      integer not null
                   check (price_cents between 0 and 100000000),
  compare_at_cents integer
                   check (compare_at_cents is null or compare_at_cents > price_cents),
  serving          text check (char_length(serving) <= 60),
  tags             text[] not null default '{}'
                   check (cardinality(tags) <= 6),
  image_path       text check (char_length(image_path) <= 300),
  is_visible       boolean not null default true,  -- aparece no catálogo
  is_available     boolean not null default true,  -- false = "Esgotado"
  is_featured      boolean not null default false, -- vitrine "Destaques"
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_category_idx
  on public.products (category_id, sort_order);

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select to anon, authenticated
  using (is_visible or (select public.is_admin()));

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
  for delete to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.products from anon;

-- ---------------------------------------------------------------------
-- Fotos (Supabase Storage)
-- Bucket público para LEITURA das fotos; só admins enviam/apagam.
-- Tamanho e formatos são limitados no próprio bucket.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalogo_admin_select" on storage.objects;
create policy "catalogo_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'catalogo' and (select public.is_admin()));

drop policy if exists "catalogo_admin_insert" on storage.objects;
create policy "catalogo_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and (select public.is_admin()));

drop policy if exists "catalogo_admin_update" on storage.objects;
create policy "catalogo_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and (select public.is_admin()))
  with check (bucket_id = 'catalogo' and (select public.is_admin()));

drop policy if exists "catalogo_admin_delete" on storage.objects;
create policy "catalogo_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalogo' and (select public.is_admin()));
