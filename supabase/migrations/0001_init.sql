-- ============================================================================
-- Matrivox MVP — initial schema
-- Run this in the Supabase SQL editor against a fresh project.
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type complaint_category as enum ('Kebersihan', 'ICT', 'Fasiliti');
exception when duplicate_object then null; end $$;

do $$ begin
  create type complaint_status as enum ('Diterima', 'Dalam Tindakan', 'Selesai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'pic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('incoming', 'outgoing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_type as enum ('text', 'image', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type change_source as enum ('whatsapp', 'dashboard', 'system');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- users (mirrors auth.users; row inserted by trigger on signup)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  role user_role not null default 'pic',
  category_assigned complaint_category,
  whatsapp_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);
create index if not exists users_category_idx on public.users(category_assigned);

-- ----------------------------------------------------------------------------
-- complaints
-- ----------------------------------------------------------------------------
create sequence if not exists public.complaint_code_seq start 1;

create or replace function public.next_complaint_code() returns text language sql as $$
  select 'MX-' || lpad(nextval('public.complaint_code_seq')::text, 4, '0')
$$;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_code text not null unique default public.next_complaint_code(),
  complainant_phone text not null,
  original_message text not null,
  ai_summary text,
  category complaint_category,
  location text,
  assigned_pic_user_id uuid references public.users(id) on delete set null,
  status complaint_status not null default 'Diterima',
  evidence_file_url text,
  source_channel text not null default 'whatsapp',
  ai_confidence numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_category_idx on public.complaints(category);
create index if not exists complaints_pic_idx on public.complaints(assigned_pic_user_id);
create index if not exists complaints_created_idx on public.complaints(created_at desc);

-- ----------------------------------------------------------------------------
-- complaint_status_logs
-- ----------------------------------------------------------------------------
create table if not exists public.complaint_status_logs (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  old_status complaint_status,
  new_status complaint_status not null,
  changed_by_user_id uuid references public.users(id) on delete set null,
  change_source change_source not null default 'system',
  override_reason text,
  created_at timestamptz not null default now()
);

create index if not exists status_logs_complaint_idx on public.complaint_status_logs(complaint_id);

-- ----------------------------------------------------------------------------
-- complaint_messages
-- ----------------------------------------------------------------------------
create table if not exists public.complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references public.complaints(id) on delete cascade,
  direction message_direction not null,
  channel text not null default 'whatsapp',
  sender_phone text,
  message_text text,
  message_type message_type not null default 'text',
  raw_payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_complaint_idx on public.complaint_messages(complaint_id);
create index if not exists messages_phone_idx on public.complaint_messages(sender_phone);

-- ----------------------------------------------------------------------------
-- category_pic_assignments (1 PIC per category for MVP — unique constraint on category)
-- ----------------------------------------------------------------------------
create table if not exists public.category_pic_assignments (
  id uuid primary key default gen_random_uuid(),
  category complaint_category not null unique,
  pic_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- system_settings (key/value)
-- ----------------------------------------------------------------------------
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_updated_at_users on public.users;
create trigger set_updated_at_users before update on public.users
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_complaints on public.complaints;
create trigger set_updated_at_complaints before update on public.complaints
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_assignments on public.category_pic_assignments;
create trigger set_updated_at_assignments before update on public.category_pic_assignments
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_settings on public.system_settings;
create trigger set_updated_at_settings before update on public.system_settings
  for each row execute function public.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-mirror auth.users -> public.users
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'pic')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- Status log trigger on status change
-- ----------------------------------------------------------------------------
create or replace function public.tg_log_status_change() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.complaint_status_logs (complaint_id, old_status, new_status, change_source)
    values (new.id, null, new.status, 'system');
  elsif (new.status is distinct from old.status) then
    insert into public.complaint_status_logs (complaint_id, old_status, new_status, change_source)
    values (new.id, old.status, new.status, 'system');
  end if;
  return new;
end; $$;

drop trigger if exists log_complaint_status on public.complaints;
create trigger log_complaint_status
  after insert or update of status on public.complaints
  for each row execute function public.tg_log_status_change();

-- ----------------------------------------------------------------------------
-- Helper: current_user_role / current_user_category
-- ----------------------------------------------------------------------------
create or replace function public.current_user_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.current_user_category() returns complaint_category
  language sql stable security definer set search_path = public as $$
  select category_assigned from public.users where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_status_logs enable row level security;
alter table public.complaint_messages enable row level security;
alter table public.category_pic_assignments enable row level security;
alter table public.system_settings enable row level security;

-- users
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
  for select using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- complaints: admin sees all; PIC sees own category
drop policy if exists complaints_read on public.complaints;
create policy complaints_read on public.complaints
  for select using (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'pic' and category = public.current_user_category())
  );

drop policy if exists complaints_update on public.complaints;
create policy complaints_update on public.complaints
  for update using (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'pic' and category = public.current_user_category())
  );

-- status logs: same visibility as parent complaint
drop policy if exists status_logs_read on public.complaint_status_logs;
create policy status_logs_read on public.complaint_status_logs
  for select using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          public.current_user_role() = 'admin'
          or (public.current_user_role() = 'pic' and c.category = public.current_user_category())
        )
    )
  );

drop policy if exists status_logs_insert on public.complaint_status_logs;
create policy status_logs_insert on public.complaint_status_logs
  for insert with check (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          public.current_user_role() = 'admin'
          or (public.current_user_role() = 'pic' and c.category = public.current_user_category())
        )
    )
  );

-- messages: same visibility
drop policy if exists messages_read on public.complaint_messages;
create policy messages_read on public.complaint_messages
  for select using (
    complaint_id is null and public.current_user_role() = 'admin'
    or exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (
          public.current_user_role() = 'admin'
          or (public.current_user_role() = 'pic' and c.category = public.current_user_category())
        )
    )
  );

-- category_pic_assignments: everyone authenticated can read; only admin writes
drop policy if exists assignments_read on public.category_pic_assignments;
create policy assignments_read on public.category_pic_assignments
  for select using (auth.role() = 'authenticated');

drop policy if exists assignments_admin_write on public.category_pic_assignments;
create policy assignments_admin_write on public.category_pic_assignments
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- system_settings: admin only
drop policy if exists settings_admin on public.system_settings;
create policy settings_admin on public.system_settings
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Storage bucket for evidence files
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Initial settings
-- ----------------------------------------------------------------------------
insert into public.system_settings (key, value_json) values
  ('demo_mode', 'true'::jsonb),
  ('whatsapp_provider', '"demo"'::jsonb),
  ('whatsapp_business_number', '"+60123456789"'::jsonb)
on conflict (key) do nothing;
