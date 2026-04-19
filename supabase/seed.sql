-- ============================================================================
-- Matrivox seed — run AFTER 0001_init.sql, AND after creating these users in
-- Supabase Auth (Authentication → Users → Add user, with "Auto Confirm User"):
--
--   admin@matrivox.demo            (any password)
--   pic.kebersihan@matrivox.demo
--   pic.ict@matrivox.demo
--   pic.fasiliti@matrivox.demo
--
-- The on_auth_user_created trigger will mirror them into public.users with
-- role='pic' by default. This script then promotes the admin and assigns
-- categories + WhatsApp numbers to each PIC.
-- ============================================================================

-- Admin
update public.users set
  role = 'admin',
  full_name = 'Pentadbir Matrivox',
  whatsapp_phone = '+60100000001',
  is_active = true
where email = 'admin@matrivox.demo';

-- PIC: Kebersihan
update public.users set
  role = 'pic',
  full_name = 'PIC Kebersihan',
  category_assigned = 'Kebersihan',
  whatsapp_phone = '+60100000002',
  is_active = true
where email = 'pic.kebersihan@matrivox.demo';

-- PIC: ICT
update public.users set
  role = 'pic',
  full_name = 'PIC ICT',
  category_assigned = 'ICT',
  whatsapp_phone = '+60100000003',
  is_active = true
where email = 'pic.ict@matrivox.demo';

-- PIC: Fasiliti
update public.users set
  role = 'pic',
  full_name = 'PIC Fasiliti',
  category_assigned = 'Fasiliti',
  whatsapp_phone = '+60100000004',
  is_active = true
where email = 'pic.fasiliti@matrivox.demo';

-- Category → PIC mappings
insert into public.category_pic_assignments (category, pic_user_id)
select 'Kebersihan', id from public.users where email = 'pic.kebersihan@matrivox.demo'
on conflict (category) do update set pic_user_id = excluded.pic_user_id;

insert into public.category_pic_assignments (category, pic_user_id)
select 'ICT', id from public.users where email = 'pic.ict@matrivox.demo'
on conflict (category) do update set pic_user_id = excluded.pic_user_id;

insert into public.category_pic_assignments (category, pic_user_id)
select 'Fasiliti', id from public.users where email = 'pic.fasiliti@matrivox.demo'
on conflict (category) do update set pic_user_id = excluded.pic_user_id;
