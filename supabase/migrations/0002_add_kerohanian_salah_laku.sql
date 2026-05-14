-- ============================================================================
-- Matrivox migration 0002 — add ONE new category covering both moral/
-- religious conduct AND general student misconduct.
--
-- Single PIC handles all student-behavior cases (LGBT, khalwat, ponteng,
-- merokok, dll). Run this in the Supabase SQL editor AFTER 0001_init.sql.
-- Safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'Kerohanian & Salah Laku'
      and enumtypid = (select oid from pg_type where typname = 'complaint_category')
  ) then
    alter type complaint_category add value 'Kerohanian & Salah Laku';
  end if;
end $$;
