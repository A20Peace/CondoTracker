-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ CondoTracker — initial schema                                              ║
-- ║                                                                            ║
-- ║ Gerarchia: amministratore (profiles) → condomini (buildings) →             ║
-- ║ unità (units) → condòmini (residents). Le spese (expenses) si              ║
-- ║ distribuiscono in quote (charges) per millesimi.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

-- ─── Helper: codice invito condominio ─────────────────────────────────────────
-- 8 caratteri, alfabeto senza simboli ambigui (0/O, 1/I). Non è un segreto:
-- l'associazione del condòmino richiede comunque la conferma dell'amministratore.
create or replace function public.gen_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- ─── Tabelle ──────────────────────────────────────────────────────────────────

-- Profilo per ogni utente auth (creato automaticamente dal trigger più sotto).
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text,
  email_reminders boolean not null default true,
  reminder_email text,
  created_at timestamptz not null default now()
);

-- Condominio gestito da un amministratore.
create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  address text,
  iban text,
  bank_holder text,
  invite_code text not null unique default public.gen_invite_code(),
  notes text,
  created_at timestamptz not null default now()
);

-- Tabelle millesimali di un condominio (es. "Generale", "Scale", "Riscaldamento").
create table if not exists public.millesimi_tables (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (building_id, name)
);

-- Una sola tabella di default per condominio.
create unique index if not exists millesimi_one_default
  on public.millesimi_tables (building_id) where is_default;

-- Unità abitativa di un condominio.
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  label text not null,
  floor text,
  description text,
  created_at timestamptz not null default now()
);

-- Valore in millesimi di un'unità all'interno di una specifica tabella.
create table if not exists public.unit_shares (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.millesimi_tables(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  millesimi numeric(8, 3) not null default 0,
  created_at timestamptz not null default now(),
  unique (table_id, unit_id)
);

-- Condòmino associato a un'unità. user_id si valorizza alla registrazione;
-- resta null per i contatti aggiunti manualmente dall'amministratore.
create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('pending', 'active')) default 'active',
  created_at timestamptz not null default now()
);

-- Spesa registrata dall'amministratore su un condominio.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  table_id uuid not null references public.millesimi_tables(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12, 2) not null,
  expense_date date,
  due_date date not null,
  document_url text,
  extracted_raw jsonb,
  status text not null check (status in ('draft', 'confirmed')) default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Quota dovuta da una unità per una spesa, con stato di pagamento indipendente.
create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null check (status in ('unpaid', 'declared', 'paid')) default 'unpaid',
  declared_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expense_id, unit_id)
);

-- Traccia ogni reminder inviato per evitare invii doppi.
--   kind: 'd14','d7','d3','d2','d1','d0' (pre-scadenza, una volta sola)
--         'overdue:YYYY-MM-DD'           (post-scadenza, una volta al giorno)
create table if not exists public.sent_reminders (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references public.charges(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now()
);
create unique index if not exists sent_reminders_charge_kind_uq
  on public.sent_reminders (charge_id, kind);

-- ─── Indici ───────────────────────────────────────────────────────────────────

create index if not exists buildings_admin_idx on public.buildings (admin_id);
create index if not exists millesimi_tables_building_idx on public.millesimi_tables (building_id);
create index if not exists units_building_idx on public.units (building_id);
create index if not exists unit_shares_table_idx on public.unit_shares (table_id);
create index if not exists unit_shares_unit_idx on public.unit_shares (unit_id);
create index if not exists residents_unit_idx on public.residents (unit_id);
create index if not exists residents_user_idx on public.residents (user_id);
create index if not exists residents_email_idx on public.residents (lower(email));
create index if not exists expenses_building_idx on public.expenses (building_id);
create index if not exists expenses_status_idx on public.expenses (status);
create index if not exists charges_expense_idx on public.charges (expense_id);
create index if not exists charges_unit_idx on public.charges (unit_id);
create index if not exists charges_status_idx on public.charges (status);

-- ─── Helper di autorizzazione (SECURITY DEFINER: evitano la ricorsione RLS) ────

create or replace function public.is_building_admin(p_building uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.buildings b
    where b.id = p_building and b.admin_id = p_user
  );
$$;

create or replace function public.is_building_resident(p_building uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    where u.building_id = p_building
      and r.user_id = p_user
      and r.status = 'active'
  );
$$;

create or replace function public.resident_in_unit(p_unit uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.residents r
    where r.unit_id = p_unit and r.user_id = p_user and r.status = 'active'
  );
$$;

create or replace function public.admin_owns_unit(p_unit uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.units u
    join public.buildings b on b.id = u.building_id
    where u.id = p_unit and b.admin_id = p_user
  );
$$;

create or replace function public.admin_owns_table(p_table uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.millesimi_tables mt
    join public.buildings b on b.id = mt.building_id
    where mt.id = p_table and b.admin_id = p_user
  );
$$;

create or replace function public.resident_sees_table(p_table uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.millesimi_tables mt
    where mt.id = p_table
      and public.is_building_resident(mt.building_id, p_user)
  );
$$;

create or replace function public.admin_owns_expense(p_expense uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.expenses e
    join public.buildings b on b.id = e.building_id
    where e.id = p_expense and b.admin_id = p_user
  );
$$;

-- ─── Trigger ──────────────────────────────────────────────────────────────────

-- Crea automaticamente un profilo a ogni nuovo utente auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'utente'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ogni nuovo condominio nasce con una tabella millesimale "Generale" di default.
create or replace function public.handle_new_building()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.millesimi_tables (building_id, name, is_default)
  values (new.id, 'Generale', true)
  on conflict (building_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_building_created on public.buildings;
create trigger on_building_created
  after insert on public.buildings
  for each row execute function public.handle_new_building();

-- Mantiene charges.updated_at aggiornato.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists charges_touch_updated_at on public.charges;
create trigger charges_touch_updated_at
  before update on public.charges
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.millesimi_tables enable row level security;
alter table public.units enable row level security;
alter table public.unit_shares enable row level security;
alter table public.residents enable row level security;
alter table public.expenses enable row level security;
alter table public.charges enable row level security;
alter table public.sent_reminders enable row level security;

-- profiles: solo la propria riga.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert with check (id = auth.uid());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- buildings: l'amministratore gestisce; i condòmini attivi possono leggerlo.
drop policy if exists "buildings admin all" on public.buildings;
create policy "buildings admin all" on public.buildings
  for all using (admin_id = auth.uid()) with check (admin_id = auth.uid());
drop policy if exists "buildings resident read" on public.buildings;
create policy "buildings resident read" on public.buildings
  for select using (public.is_building_resident(id, auth.uid()));

-- millesimi_tables
drop policy if exists "tables admin all" on public.millesimi_tables;
create policy "tables admin all" on public.millesimi_tables
  for all using (public.is_building_admin(building_id, auth.uid()))
  with check (public.is_building_admin(building_id, auth.uid()));
drop policy if exists "tables resident read" on public.millesimi_tables;
create policy "tables resident read" on public.millesimi_tables
  for select using (public.is_building_resident(building_id, auth.uid()));

-- units
drop policy if exists "units admin all" on public.units;
create policy "units admin all" on public.units
  for all using (public.is_building_admin(building_id, auth.uid()))
  with check (public.is_building_admin(building_id, auth.uid()));
drop policy if exists "units resident read" on public.units;
create policy "units resident read" on public.units
  for select using (public.is_building_resident(building_id, auth.uid()));

-- unit_shares
drop policy if exists "shares admin all" on public.unit_shares;
create policy "shares admin all" on public.unit_shares
  for all using (public.admin_owns_table(table_id, auth.uid()))
  with check (public.admin_owns_table(table_id, auth.uid()));
drop policy if exists "shares resident read" on public.unit_shares;
create policy "shares resident read" on public.unit_shares
  for select using (public.resident_sees_table(table_id, auth.uid()));

-- residents: l'amministratore del condominio gestisce; il condòmino vede le
-- proprie associazioni (incluse quelle in attesa di conferma).
drop policy if exists "residents admin all" on public.residents;
create policy "residents admin all" on public.residents
  for all using (public.admin_owns_unit(unit_id, auth.uid()))
  with check (public.admin_owns_unit(unit_id, auth.uid()));
drop policy if exists "residents self read" on public.residents;
create policy "residents self read" on public.residents
  for select using (user_id = auth.uid());

-- expenses: l'amministratore gestisce; i condòmini vedono solo le spese
-- confermate del proprio condominio (trasparenza).
drop policy if exists "expenses admin all" on public.expenses;
create policy "expenses admin all" on public.expenses
  for all using (public.is_building_admin(building_id, auth.uid()))
  with check (public.is_building_admin(building_id, auth.uid()));
drop policy if exists "expenses resident read" on public.expenses;
create policy "expenses resident read" on public.expenses
  for select using (
    status = 'confirmed' and public.is_building_resident(building_id, auth.uid())
  );

-- charges: l'amministratore gestisce; il condòmino vede le quote delle proprie
-- unità. Il passaggio "ho pagato" è gestito da una server action (service role).
drop policy if exists "charges admin all" on public.charges;
create policy "charges admin all" on public.charges
  for all using (public.admin_owns_expense(expense_id, auth.uid()))
  with check (public.admin_owns_expense(expense_id, auth.uid()));
drop policy if exists "charges resident read" on public.charges;
create policy "charges resident read" on public.charges
  for select using (public.resident_in_unit(unit_id, auth.uid()));

-- sent_reminders: scritta/letta solo dal cron (service-role). Nessuna policy.

-- ─── Storage (bucket privato per i documenti giustificativi) ───────────────────

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents read own" on storage.objects;
create policy "documents read own" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents insert own" on storage.objects;
create policy "documents insert own" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents delete own" on storage.objects;
create policy "documents delete own" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
