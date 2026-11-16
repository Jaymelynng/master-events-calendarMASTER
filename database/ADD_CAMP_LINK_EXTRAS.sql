-- Admin > Camp Data > Master link list (2026-11-16, Jayme: "I WANT A OVERALL SUMMER CAMP Camp Data button WITH
-- MASTER LINKS, MASTER PRICING ... THEN EACH GYM PAGE"). Every camp link and camp-type link is built live from the
-- synced iClass data; this table holds ONLY the two things iClass's camp data does not have:
--   flex_full / flex_half  the gym's Flex Week product (an iClass PRODUCT, not a camp), with its price and link
--   leave_off              a camp kept off every list on purpose, with the reason
--                          (is_public = true: a real camp parents can find, but do not advertise it;
--                           is_public = false: not a real offering, e.g. a hidden duplicate)
-- Moved here from the claude.ai "Summer Camp Data" page (db doc lists/links, from Jayme's link page pasted 11/16/2026),
-- with that page's gym codes changed to this database's (AAR -> AAG, EGF -> EAG, PGN -> PLG).
create table if not exists public.camp_link_extras (
  id serial primary key,
  gym_id text not null references public.gyms(id),
  kind text not null check (kind in ('flex_full', 'flex_half', 'leave_off')),
  label text,
  price numeric,
  url text,
  camp_id integer,
  is_public boolean,
  reason text,
  source text,
  created_at timestamptz not null default now()
);
comment on table public.camp_link_extras is
  'Admin > Camp Data > Master link list: the only link facts not in the synced iClass camp data. flex_full/flex_half = the gym''s Flex Week product (iClass product, not a camp): label, price, url. leave_off = camp_id kept off every link list, with reason; is_public true = real camp, do not advertise; false = not a real offering (e.g. hidden duplicate). Everything else on the link list is built live from iclass_camp_audit.';

alter table public.camp_link_extras enable row level security;
drop policy if exists "Public read camp_link_extras" on public.camp_link_extras;
create policy "Public read camp_link_extras" on public.camp_link_extras for select using (true);

insert into public.camp_link_extras (gym_id, kind, label, price, url, camp_id, is_public, reason, source)
select * from (values
  ('AAG','flex_full','Full Day',430,'https://portal.iclasspro.com/allaroundgym/products/product/flexible-camp-week-full-day',null::int,null::boolean,null,'Jayme''s camp link page 11/16/2026'),
  ('CCP','flex_full','Full Day',345,'https://portal.iclasspro.com/capgymavery/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('CPF','flex_full','Full Day',315,'https://portal.iclasspro.com/capgymhp/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('CRR','flex_full','Full Day',315,'https://portal.iclasspro.com/capgymroundrock/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('EAG','flex_full','Full Day',295,'https://portal.iclasspro.com/eaglegymnasticsfrisco/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('EST','flex_full','Full Day',270,'https://portal.iclasspro.com/estrellagymnastics/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('HGA','flex_full','Full Day',400,'https://portal.iclasspro.com/houstongymnastics/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('MGC','flex_full','Full Day',395,'https://portal.iclasspro.com/metrogymnastics/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('OAS','flex_full','Full Day',315,'https://portal.iclasspro.com/oasisgymnastics/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('PLG','flex_full','Full Day',600,'https://portal.iclasspro.com/planetgymnasticsnatick/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('RBA','flex_full','Full Day',250,'https://portal.iclasspro.com/rbatascocita/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('RBK','flex_full','Full Day',250,'https://portal.iclasspro.com/rbkingwood/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('SGT','flex_full','Full Day',390,'https://portal.iclasspro.com/scottsdalegymnastics/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('TIG','flex_full','Full Day',355,'https://portal.iclasspro.com/tigar/products/product/flexible-camp-week-full-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('AAG','flex_half','Half Day',240,'https://portal.iclasspro.com/allaroundgym/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('CCP','flex_half','Half Day',270,'https://portal.iclasspro.com/capgymavery/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('CRR','flex_half','Half Day',240,'https://portal.iclasspro.com/capgymroundrock/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('EAG','flex_half','Half Day AM',175,'https://portal.iclasspro.com/eaglegymnasticsfrisco/products/product/flexible-camp-week-half-day-am',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('EAG','flex_half','Half Day PM',150,'https://portal.iclasspro.com/eaglegymnasticsfrisco/products/product/flexible-camp-week-half-day-pm',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('EST','flex_half','Half Day',205,'https://portal.iclasspro.com/estrellagymnastics/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('OAS','flex_half','Half Day',240,'https://portal.iclasspro.com/oasisgymnastics/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('PLG','flex_half','Half Day',325,'https://portal.iclasspro.com/planetgymnasticsnatick/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('SGT','flex_half','Half Day',315,'https://portal.iclasspro.com/scottsdalegymnastics/products/product/flexible-camp-week-half-day',null,null,null,'Jayme''s camp link page 11/16/2026'),
  ('MGC','leave_off',null,null,null,117,true,'Company and Crew only - DO NOT advertise or include in the promo (Lindsay 11/15)','claude.ai Summer Camp Data page 11/16/2026'),
  ('OAS','leave_off',null,null,null,1055,false,'Hidden duplicate of 1054 (Week 9 Girls Gymnastics Full Day)','claude.ai Summer Camp Data page 11/16/2026')
) v(gym_id, kind, label, price, url, camp_id, is_public, reason, source)
where not exists (select 1 from public.camp_link_extras);
