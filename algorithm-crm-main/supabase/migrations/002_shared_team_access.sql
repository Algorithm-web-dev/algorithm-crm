-- ============================================================================
--  002 — Shared team access (Option A)
--  All authenticated users share one workspace: everyone can see and edit
--  all deals, contacts, companies and activities. owner_id is kept for
--  attribution (who created it / who gets stall alerts).
--
--  Profiles, alert_rules and alert_firings remain per-user.
--
--  IMPORTANT: with this model, ANY user who can sign up sees everything.
--  Disable open signups in Supabase (Authentication → Sign In / Up →
--  disable "Allow new users to sign up") and invite users manually.
-- ============================================================================

-- DEALS -----------------------------------------------------------------
drop policy if exists "owner crud deals" on deals;
create policy "team crud deals" on deals
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- CONTACTS --------------------------------------------------------------
drop policy if exists "owner crud contacts" on contacts;
create policy "team crud contacts" on contacts
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- COMPANIES -------------------------------------------------------------
drop policy if exists "owner crud companies" on companies;
create policy "team crud companies" on companies
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ACTIVITIES ------------------------------------------------------------
drop policy if exists "owner crud activities" on activities;
create policy "team crud activities" on activities
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- PROFILES: allow team members to read each other's names (for avatars /
-- "owned by" labels), but only update their own.
drop policy if exists "users can read own profile" on profiles;
create policy "team can read profiles" on profiles
  for select using (auth.uid() is not null);
-- (existing "users can update own profile" policy stays as-is)
