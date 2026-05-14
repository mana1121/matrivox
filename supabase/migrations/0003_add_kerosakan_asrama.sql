-- ============================================================================
-- Matrivox migration 0003 — add Kerosakan Asrama category.
--
-- Separate bucket for damage/breakage issues inside the asrama (dorm).
-- Distinct from "Fasiliti" which covers general campus damage. Run this
-- in the Supabase SQL editor AFTER 0002. Safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'Kerosakan Asrama'
      and enumtypid = (select oid from pg_type where typname = 'complaint_category')
  ) then
    alter type complaint_category add value 'Kerosakan Asrama';
  end if;
end $$;
