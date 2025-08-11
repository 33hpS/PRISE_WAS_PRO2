-- ============================================
-- WASSER PRO — Supabase схема данных (продукты, материалы, техкарты)
-- Кросс‑приложенческая совместимость через уникальные артикулы, вьюху экспорта и RPC.
-- Политики RLS: публичное чтение, запись — только аутентифицированным.
-- ============================================

-- Расширения
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Универсальная функция обновления updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================
-- Справочник материалов
-- ==========================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  article text not null,
  unit text not null default 'шт',
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_article_chk check (length(trim(article)) > 0)
);

-- Уникальность артикула (без учета регистра)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='materials_article_unique_idx'
  ) then
    create unique index materials_article_unique_idx on public.materials (lower(article));
  end if;
end$$;

create index if not exists materials_name_trgm_idx on public.materials using gin (name gin_trgm_ops);
create index if not exists materials_article_trgm_idx on public.materials using gin (article gin_trgm_ops);

drop trigger if exists trg_materials_updated_at on public.materials;
create trigger trg_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

-- ==========================
-- Справочники ценообразования
-- ==========================
create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  markup numeric(6,2) not null default 0,       -- %
  work_cost numeric(12,2) not null default 0,    -- KGS
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_types_updated_at on public.product_types;
create trigger trg_product_types_updated_at
before update on public.product_types
for each row execute function public.set_updated_at();

create table if not exists public.finish_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  markup numeric(6,2) not null default 0,        -- %
  work_cost numeric(12,2),                       -- опционально
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_finish_types_updated_at on public.finish_types;
create trigger trg_finish_types_updated_at
before update on public.finish_types
for each row execute function public.set_updated_at();

-- ==========================
-- Товары (изделия)
-- ==========================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  article text not null,
  collection_id uuid,
  product_type_id uuid references public.product_types(id) on update cascade on delete set null,
  finish_type_id uuid references public.finish_types(id) on update cascade on delete set null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_article_chk check (length(trim(article)) > 0)
);

do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='products_article_unique_idx'
  ) then
    create unique index products_article_unique_idx on public.products (lower(article));
  end if;
end$$;

create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_pt_idx on public.products (product_type_id);
create index if not exists products_ft_idx on public.products (finish_type_id);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ==========================
-- Патч совместимости — гарантирует наличие колонок и FK в products
-- (если таблица была создана ранее без этих полей)
-- ==========================
do $$
begin
  -- Добавим колонки, если отсутствуют
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='product_type_id'
  ) then
    alter table public.products add column product_type_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='finish_type_id'
  ) then
    alter table public.products add column finish_type_id uuid;
  end if;

  -- Добавим внешние ключи, если отсутствуют
  if not exists (select 1 from pg_constraint where conname = 'products_product_type_id_fkey') then
    alter table public.products
      add constraint products_product_type_id_fkey
      foreign key (product_type_id) references public.product_types(id)
      on update cascade on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_finish_type_id_fkey') then
    alter table public.products
      add constraint products_finish_type_id_fkey
      foreign key (finish_type_id) references public.finish_types(id)
      on update cascade on delete set null;
  end if;

  -- Индексы по новым колонкам (если не созданы)
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='products_pt_idx'
  ) then
    create index products_pt_idx on public.products (product_type_id);
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='products_ft_idx'
  ) then
    create index products_ft_idx on public.products (finish_type_id);
  end if;
end$$;

-- ==========================
-- Техкарта (состав изделия)
-- ==========================
create table if not exists public.tech_card_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  material_id uuid not null references public.materials(id) on update cascade,
  quantity numeric(14,4) not null check (quantity >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Один материал в техкарте товара — одна строка (позиция можно хранить отдельно)
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='tci_unique_product_material_idx'
  ) then
    create unique index tci_unique_product_material_idx on public.tech_card_items (product_id, material_id);
  end if;
end$$;

create index if not exists tci_product_idx on public.tech_card_items (product_id);
create index if not exists tci_material_idx on public.tech_card_items (material_id);

drop trigger if exists trg_tci_updated_at on public.tech_card_items;
create trigger trg_tci_updated_at
before update on public.tech_card_items
for each row execute function public.set_updated_at();

-- ==========================
-- Вьюха экспорта товаров с техкартой и ценами
-- ==========================
create or replace view public.v_products_export
as
select
  p.id,
  p.name,
  p.article,
  p.collection_id,
  p.product_type_id,
  pt.name as product_type_name,
  pt.markup as product_type_markup,
  pt.work_cost as product_type_work_cost,
  p.finish_type_id,
  ft.name as finish_type_name,
  ft.markup as finish_type_markup,
  coalesce(ft.work_cost, 0) as finish_type_work_cost,
  p.image_url,
  p.created_at,
  p.updated_at,

  -- Техкарта (подробно)
  coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'materialId', t.material_id,
                 'quantity', t.quantity,
                 'position', t.position,
                 'name', m.name,
                 'article', m.article,
                 'unit', m.unit,
                 'price', m.price
               )
               order by t.position, m.name
             )
      from public.tech_card_items t
      join public.materials m on m.id = t.material_id
      where t.product_id = p.id
    ), '[]'::jsonb
  ) as techcard,

  -- Стоимости
  coalesce((
    select sum((t.quantity) * (m.price))
    from public.tech_card_items t
    join public.materials m on m.id = t.material_id
    where t.product_id = p.id
  ), 0)::numeric(14,2)                      as material_cost,

  coalesce(pt.work_cost, 0)::numeric(14,2)  as work_cost,

  (
    coalesce((
      select sum((t.quantity) * (m.price))
      from public.tech_card_items t
      join public.materials m on m.id = t.material_id
      where t.product_id = p.id
    ), 0) + coalesce(pt.work_cost, 0)
  )::numeric(14,2)                           as base_price,

  (
    (
      coalesce((
        select sum((t.quantity) * (m.price))
        from public.tech_card_items t
        join public.materials m on m.id = t.material_id
        where t.product_id = p.id
      ), 0) + coalesce(pt.work_cost, 0)
    ) * (1 + coalesce(pt.markup,0)/100.0)
  )::numeric(14,4)                            as price_after_type,

  (
    (
      (
        coalesce((
          select sum((t.quantity) * (m.price))
          from public.tech_card_items t
          join public.materials m on m.id = t.material_id
          where t.product_id = p.id
        ), 0) + coalesce(pt.work_cost, 0)
      ) * (1 + coalesce(pt.markup,0)/100.0)
    ) * (1 + coalesce(ft.markup,0)/100.0)
  )::numeric(14,2)                            as final_price
from public.products p
left join public.product_types pt on pt.id = p.product_type_id
left join public.finish_types ft on ft.id = p.finish_type_id;

-- Доступ к вьюхе (для REST)
grant select on public.v_products_export to anon, authenticated;

-- ==========================
-- RPC: Создать товар с техкартой одной командой
-- ==========================
/*
  Пример вызова (REST RPC):
  POST /rest/v1/rpc/api_create_product_with_techcard
  {
    "_name": "Тумба подвесная 600 Белая",
    "_article": "TB-600-WHT",
    "_product_type_id": null,
    "_finish_type_id": null,
    "_image_url": "https://example.com/photo.jpg",
    "_tech_items": [
      { "materialId": "UUID_ЛДСП", "quantity": 1.5, "position": 1 },
      { "materialId": "UUID_Кромка", "quantity": 4, "position": 2 },
      { "materialId": "UUID_Петля", "quantity": 2, "position": 3 }
    ]
  }
  Возвращает: UUID созданного продукта
*/
create or replace function public.api_create_product_with_techcard(
  _name text,
  _article text,
  _product_type_id uuid default null,
  _finish_type_id uuid default null,
  _image_url text default null,
  _tech_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_product_id uuid;
  v_item jsonb;
  v_mat_id uuid;
  v_qty numeric;
  v_pos int;
begin
  insert into public.products(name, article, product_type_id, finish_type_id, image_url)
  values (_name, _article, _product_type_id, _finish_type_id, _image_url)
  returning id into v_product_id;

  for v_item in select * from jsonb_array_elements(coalesce(_tech_items, '[]'::jsonb))
  loop
    v_mat_id := nullif(v_item->>'materialId','')::uuid;
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_pos := coalesce((v_item->>'position')::int, 0);

    if v_mat_id is not null and v_qty > 0 then
      insert into public.tech_card_items(product_id, material_id, quantity, position)
      values (v_product_id, v_mat_id, v_qty, v_pos)
      on conflict (product_id, material_id)
      do update set quantity = excluded.quantity,
                    position = excluded.position,
                    updated_at = now();
    end if;
  end loop;

  return v_product_id;
end;
$$;

revoke all on function public.api_create_product_with_techcard(text, text, uuid, uuid, text, jsonb) from public;
grant execute on function public.api_create_product_with_techcard(text, text, uuid, uuid, text, jsonb) to authenticated;

-- ==========================
-- RPC: Upsert товара по артикулу + полная замена техкарты
-- (удобно для синхронизаций между приложениями)
-- ==========================
/*
  Вызов:
  POST /rest/v1/rpc/api_upsert_product_with_techcard_by_article
  {
    "_name": "Тумба 600 Белая",
    "_article": "TB-600-WHT",
    "_product_type_id": null,
    "_finish_type_id": null,
    "_image_url": null,
    "_tech_items": [
      { "materialId": "UUID_ЛДСП", "quantity": 1.5, "position": 1 },
      { "materialId": "UUID_Кромка", "quantity": 4, "position": 2 }
    ]
  }
  Возвращает: UUID товара
*/
create or replace function public.api_upsert_product_with_techcard_by_article(
  _name text,
  _article text,
  _product_type_id uuid default null,
  _finish_type_id uuid default null,
  _image_url text default null,
  _tech_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_product_id uuid;
begin
  -- upsert по артикулу
  insert into public.products (name, article, product_type_id, finish_type_id, image_url)
  values (_name, _article, _product_type_id, _finish_type_id, _image_url)
  on conflict (article)
  do update set
    name = excluded.name,
    product_type_id = excluded.product_type_id,
    finish_type_id = excluded.finish_type_id,
    image_url = excluded.image_url,
    updated_at = now()
  returning id into v_product_id;

  -- Полная замена техкарты
  delete from public.tech_card_items where product_id = v_product_id;

  insert into public.tech_card_items (product_id, material_id, quantity, position)
  select
    v_product_id,
    nullif(elem->>'materialId','')::uuid as material_id,
    coalesce((elem->>'quantity')::numeric, 0) as quantity,
    coalesce((elem->>'position')::int, 0) as position
  from jsonb_array_elements(coalesce(_tech_items, '[]'::jsonb)) as elem
  where nullif(elem->>'materialId','') is not null
    and coalesce((elem->>'quantity')::numeric, 0) > 0;

  return v_product_id;
end;
$$;

revoke all on function public.api_upsert_product_with_techcard_by_article(text, text, uuid, uuid, text, jsonb) from public;
grant execute on function public.api_upsert_product_with_techcard_by_article(text, text, uuid, uuid, text, jsonb) to authenticated;

-- ==========================
-- RLS Политики безопасности
-- ==========================
alter table if exists public.materials enable row level security;
alter table if exists public.product_types enable row level security;
alter table if exists public.finish_types enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.tech_card_items enable row level security;

-- Публичное чтение
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='materials_select_public') then
    create policy materials_select_public on public.materials for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_types' and policyname='pt_select_public') then
    create policy pt_select_public on public.product_types for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finish_types' and policyname='ft_select_public') then
    create policy ft_select_public on public.finish_types for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_select_public') then
    create policy products_select_public on public.products for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tech_card_items' and policyname='tci_select_public') then
    create policy tci_select_public on public.tech_card_items for select using (true);
  end if;
end$$;

-- Запись только для authenticated
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='materials' and policyname='materials_write_auth') then
    create policy materials_write_auth on public.materials
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_types' and policyname='pt_write_auth') then
    create policy pt_write_auth on public.product_types
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finish_types' and policyname='ft_write_auth') then
    create policy ft_write_auth on public.finish_types
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_write_auth') then
    create policy products_write_auth on public.products
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tech_card_items' and policyname='tci_write_auth') then
    create policy tci_write_auth on public.tech_card_items
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end$$;

-- Доп. права на таблицы (для PostgREST)
grant select on public.materials, public.product_types, public.finish_types, public.products, public.tech_card_items to anon, authenticated;
grant insert, update, delete on public.materials, public.product_types, public.finish_types, public.products, public.tech_card_items to authenticated;

-- ============================================
-- Необязательная быстрая проверка (закомментировано)
-- insert into public.product_types(name, markup, work_cost) values ('Тумбы', 10, 1000) on conflict do nothing;
-- insert into public.finish_types(name, markup) values ('Стандарт', 0) on conflict do nothing;
-- ============================================