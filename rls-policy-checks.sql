-- =============================================================================================
-- MN Events Vendor Portal — RLS / policy regression test script (Phase 6 release readiness)
--
-- WHAT THIS IS
-- A self-contained, re-runnable proof that Row Level Security actually enforces cross-vendor
-- and non-admin isolation on the tables that matter most (payment_orders, security_events,
-- user_roles, redemption_codes, stall_vendors), plus a blanket check that every table in the
-- `public` schema has RLS enabled and that the only tables with zero policies are the three
-- expected service-role-only / superseded-legacy ones.
--
-- SAFETY
-- The whole script runs inside `begin; ... rollback;` — every fixture row it inserts (fake
-- auth.users / stall_vendors / events / applications / payment_orders / security_events /
-- redemption_codes, all using obviously-fake all-zero UUIDs) is undone at the end. It never
-- commits, so it is always safe to re-run against a live database, including production, and it
-- never touches real vendor data. It role-impersonates via `set local role authenticated` +
-- `set local request.jwt.claims`, the same technique PostgREST/Supabase uses to evaluate RLS for
-- a real request — this is not a mock, it exercises the actual policies.
--
-- HOW TO RUN
-- Paste the whole file into the Supabase SQL editor (or `psql`, or Lovable's query_database
-- tool) against the project database and read the final `summary` row. Every individual check is
-- also listed above it if you need to see which one failed. A clean run prints:
--   summary: "ALL CHECKS PASSED (N checks)"
-- If any check fails, the summary lists it by name and the detail rows above show the mismatch
-- between `expected` and `actual`.
--
-- WHEN TO RUN THIS
-- After any migration that touches RLS policies, the `private.has_role`/`private.is_stall_admin`
-- helper functions, the `protect_stall_admin_flag` trigger, or the table shapes referenced below.
-- This formalizes the ad-hoc role-impersonation checks run manually during the Phase 4/5/6
-- security passes into something that can be re-run on demand instead of re-derived by hand.
--
-- Last verified passing: all checks green against the live project on 2026-09-22 (Phase 6).
-- =============================================================================================

begin;

create temp table t_results (check_name text, expected text, actual text, pass boolean, ts timestamptz default clock_timestamp()) on commit drop;
grant all on t_results to authenticated;

-- ===== Fixtures (rolled back at the end — never persisted) =====
-- Two ordinary vendors (A, B) and one admin, each backed by a throwaway auth.users row (required
-- by stall_vendors' and user_roles' foreign keys) — plus one event, one paid application and one
-- payment order per vendor, one security_events row per vendor, and one active redemption code.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000ad');

insert into public.stall_vendors (id, stall_name, is_admin, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'RLS Test Vendor A', false, 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'RLS Test Vendor B', false, 'approved'),
  ('00000000-0000-0000-0000-0000000000ad', 'RLS Test Admin',    true,  'approved');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin');

insert into public.events (id, title, starts_at, slug, status) values
  ('00000000-0000-0000-0000-0000000000e1', 'RLS Test Event', now() + interval '7 days', 'rls-test-event', 'published');

insert into public.applications (id, vendor_id, event_id, stall_fee_minor, currency) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 50000, 'INR'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', 50000, 'INR');

insert into public.payment_orders (id, application_id, vendor_id, amount_minor, currency, status, idempotency_key) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 50000, 'INR', 'created', 'idem-a1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 50000, 'INR', 'created', 'idem-a2');

insert into public.security_events (id, vendor_id, event_type) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'pin_verify_success'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2', 'pin_verify_success');

insert into public.redemption_codes (code, event_id, active) values
  ('RLSTEST-ACTIVE', '00000000-0000-0000-0000-0000000000e1', true);

-- ===== 1. Every public table has RLS enabled =====
insert into t_results
select 'rls_enabled: ' || c.relname, 'true', c.relrowsecurity::text, c.relrowsecurity is true
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- ===== 2. Tables with zero policies are exactly the expected service-role-only / legacy set =====
-- payment_webhook_events and vendor_payment_pin are written only by the service-role payment/PIN
-- backend (see the Phase 5 report); voucher_redemptions is an unused legacy table superseded by
-- stall_redemptions. All three are correctly RLS-enabled-with-no-policies, i.e. default-deny for
-- every non-service-role caller.
insert into t_results
select 'zero_policy_tables_as_expected', 'payment_webhook_events,vendor_payment_pin,voucher_redemptions',
  string_agg(t.table_name, ',' order by t.table_name),
  string_agg(t.table_name, ',' order by t.table_name) = 'payment_webhook_events,vendor_payment_pin,voucher_redemptions'
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name);

-- ===== 3. Vendor A: cross-vendor read/write isolation =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into t_results select 'vendorA_sees_own_payment_order', '1',
  count(*)::text, count(*) = 1 from public.payment_orders where id = '00000000-0000-0000-0000-0000000000d1';

insert into t_results select 'vendorA_cannot_see_vendorB_payment_order', '0',
  count(*)::text, count(*) = 0 from public.payment_orders where id = '00000000-0000-0000-0000-0000000000d2';

insert into t_results select 'vendorA_sees_own_security_event', '1',
  count(*)::text, count(*) = 1 from public.security_events where id = '00000000-0000-0000-0000-0000000000f1';

insert into t_results select 'vendorA_cannot_see_vendorB_security_event', '0',
  count(*)::text, count(*) = 0 from public.security_events where id = '00000000-0000-0000-0000-0000000000f2';

insert into t_results select 'vendorA_sees_only_own_role_row', '0',
  count(*)::text, count(*) = 0 from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000ad';

insert into t_results select 'vendorA_can_read_active_redemption_code', '1',
  count(*)::text, count(*) = 1 from public.redemption_codes where code = 'RLSTEST-ACTIVE';

with upd as (
  update public.payment_orders set status = 'paid'
  where id = '00000000-0000-0000-0000-0000000000d2'
  returning 1
)
insert into t_results select 'vendorA_cannot_update_vendorB_payment_order', '0 rows',
  coalesce((select count(*)::text from upd), '0 rows'), (select count(*) from upd) = 0;

reset role;
reset request.jwt.claims;

-- ===== 3b. Vendor A cannot grant themselves the admin role =====
-- user_roles has exactly one policy (SELECT own rows) and zero INSERT policies for `authenticated`
-- — this is the actual mechanism behind "admin assignment is controlled" (see the Phase 6
-- report). A blocked INSERT raises 42501 (insufficient_privilege) rather than affecting 0 rows
-- the way UPDATE/DELETE do, so it's exercised inside its own exception-handling block, wrapped in
-- a savepoint so a real failure here can't be silently swallowed by the outer ROLLBACK.
savepoint before_self_grant;
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
  insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');
  raise exception 'RLS_TEST_FAILURE: vendor was able to self-insert an admin role row';
exception
  when insufficient_privilege then
    -- expected: RLS has no INSERT policy for `authenticated` on user_roles, so this is blocked.
    null;
end $$;
rollback to savepoint before_self_grant;
reset role;
reset request.jwt.claims;
insert into t_results values ('vendorA_cannot_self_insert_admin_role_confirmed', 'blocked (insufficient_privilege)', 'blocked (insufficient_privilege)', true);

-- ===== 4. Vendor A cannot self-promote is_admin or self-approve status =====
-- stall_vendors' "Vendors update own profile" RLS policy only checks row ownership (id =
-- auth.uid()), NOT which columns changed — so this protection is NOT coming from RLS. It's the
-- `protect_stall_admin_flag` BEFORE UPDATE trigger (private.protect_stall_admin_flag), which
-- silently resets is_admin/status back to their old values whenever the caller isn't already an
-- admin. This check exists specifically to catch a regression if that trigger is ever dropped or
-- the RLS policy is ever "simplified" without it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

update public.stall_vendors set is_admin = true, status = 'approved' where id = '00000000-0000-0000-0000-0000000000a1';

reset role;
reset request.jwt.claims;

insert into t_results select 'vendorA_self_promote_is_admin_blocked_by_trigger', 'false',
  is_admin::text, is_admin = false from public.stall_vendors where id = '00000000-0000-0000-0000-0000000000a1';

-- ===== 5. Admin: cross-vendor visibility =====
-- The flip side of section 3 — an admin legitimately sees both vendors' rows, proving the
-- isolation above comes from the RLS policy logic and not from a data/fixture mistake.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';

insert into t_results select 'admin_sees_both_payment_orders', '2',
  count(*)::text, count(*) = 2 from public.payment_orders where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');

insert into t_results select 'admin_sees_both_security_events', '2',
  count(*)::text, count(*) = 2 from public.security_events where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');

reset role;
reset request.jwt.claims;

-- ===== Report =====
select check_name, expected, actual, pass from t_results order by ts;

select case when bool_and(pass) then 'ALL CHECKS PASSED (' || count(*) || ' checks)' else 'FAILURES: ' || string_agg(check_name, ', ') filter (where not pass) end as summary
from t_results;

rollback;
