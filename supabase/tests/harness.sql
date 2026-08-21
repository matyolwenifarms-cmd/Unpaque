-- A minimal stand-in for the parts of a Supabase project the migrations name.
-- Not a simulation of Supabase: just enough for the migrations to apply and the
-- suites to run against a bare Postgres 16, so schema work can be verified
-- without credentials and without touching a deployed project.
--
-- ONE KNOWN FIDELITY GAP, because it changes what these suites can prove.
-- Migrations here are applied by a genuine superuser, and `force row level
-- security` has no effect on superusers. Supabase's `postgres` role is not a
-- superuser, so a table that wrongly FORCEs RLS breaks there — a security
-- definer function reading it has its own query filtered to nothing — and
-- passes silently here. detective_privacy_test.sql therefore asserts
-- relforcerowsecurity is false directly rather than relying on behaviour.
-- Any future suite touching RLS should do the same.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
