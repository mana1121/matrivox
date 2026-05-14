-- ============================================================================
-- Matrivox migration 0004 — student profiles
--
-- Optional registry of complainants (students/staff) so the system can:
--   • Recognize the sender by name when a complaint arrives via WhatsApp
--   • Personalize the warm acknowledgement ("Salam Hazman...")
--   • Pass full identity (name, IC, matric) to the PIC notification
--
-- Numbers NOT registered here still work — they just get the generic ack
-- using their phone number. Registration is enrichment, not gating.
-- ============================================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  ic_number text,
  matric_number text,
  whatsapp_phone text not null unique,
  email text,
  role text not null default 'pelajar', -- 'pelajar' | 'staff' | 'pensyarah'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_phone_idx on public.students(whatsapp_phone);
create index if not exists students_matric_idx on public.students(matric_number);

-- Reuse the updated_at trigger created in 0001
drop trigger if exists set_updated_at_students on public.students;
create trigger set_updated_at_students before update on public.students
  for each row execute function public.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — admins manage; PICs can read (so PIC dashboard can show student name)
-- ----------------------------------------------------------------------------
alter table public.students enable row level security;

drop policy if exists students_read on public.students;
create policy students_read on public.students
  for select using (
    public.current_user_role() = 'admin'
    or public.current_user_role() = 'pic'
  );

drop policy if exists students_admin_write on public.students;
create policy students_admin_write on public.students
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ----------------------------------------------------------------------------
-- Seed the first student — the project owner himself.
-- ----------------------------------------------------------------------------
insert into public.students (full_name, ic_number, matric_number, whatsapp_phone, role)
values ('Hazman Jazimin', '830708146527', 'MD0256789', '+60102888897', 'pelajar')
on conflict (whatsapp_phone) do update set
  full_name = excluded.full_name,
  ic_number = excluded.ic_number,
  matric_number = excluded.matric_number,
  role = excluded.role;
