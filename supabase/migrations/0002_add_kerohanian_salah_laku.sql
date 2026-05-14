-- ============================================================================
-- Matrivox migration 0002 — add 2 new categories: Kerohanian + Salah Laku
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
-- Safe to re-run (uses IF NOT EXISTS where possible).
-- ============================================================================

-- Postgres ALTER TYPE ... ADD VALUE doesn't support IF NOT EXISTS in older
-- versions, so we wrap in DO blocks that check first.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'Kerohanian'
      and enumtypid = (select oid from pg_type where typname = 'complaint_category')
  ) then
    alter type complaint_category add value 'Kerohanian';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'Salah Laku'
      and enumtypid = (select oid from pg_type where typname = 'complaint_category')
  ) then
    alter type complaint_category add value 'Salah Laku';
  end if;
end $$;
