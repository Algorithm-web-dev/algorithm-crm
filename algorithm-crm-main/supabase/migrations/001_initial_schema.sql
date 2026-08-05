-- ============================================================================
--  Algorithm CRM — Supabase Schema
--  Run this in the Supabase SQL Editor on a fresh project.
-- ============================================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================================
--  USERS (extends auth.users)
-- ============================================================================
-- A row in `profiles` is auto-created via trigger when an auth user signs up.

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  default_currency text not null default 'ZAR',
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users can read own profile" on profiles
  for select using (auth.uid() = id);

create policy "users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
--  COMPANIES
-- ============================================================================

create table if not exists companies (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  website     text,
  industry    text,
  size        text,
  country     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index companies_owner_idx on companies(owner_id);

alter table companies enable row level security;
create policy "owner crud companies" on companies
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
--  CONTACTS
-- ============================================================================

create table if not exists contacts (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  first_name  text not null,
  last_name   text,
  email       text not null,
  phone       text,
  role_title  text,
  linkedin_url text,
  notes       text,
  last_contacted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contacts_owner_idx on contacts(owner_id);
create index contacts_company_idx on contacts(company_id);
create unique index contacts_owner_email_idx on contacts(owner_id, lower(email));

alter table contacts enable row level security;
create policy "owner crud contacts" on contacts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
--  DEALS — unified pipeline
-- ============================================================================
-- Stages: inbox, qualifying, discovery, proposal, negotiation, verbal, won, lost
-- Early stages (inbox, qualifying) may hold lead_* fields without a linked contact.

create table if not exists deals (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  deal_stage  text not null default 'inbox',
  priority    text not null default 'Medium',
  source      text,
  notes       text,

  -- linked records (null for early-stage deals)
  company_id          uuid references companies(id) on delete set null,
  primary_contact_id  uuid references contacts(id) on delete set null,

  -- early-stage prospect fields (used before promotion)
  lead_first_name     text,
  lead_last_name      text,
  lead_email          text,
  lead_company_name   text,
  lead_role           text,

  -- value & timing
  monthly_value       numeric(12,2) default 0,
  one_off_value       numeric(12,2) default 0,
  currency            text not null default 'ZAR',
  expected_close_date date,
  actual_close_date   date,
  loss_reason         text,

  -- stage timing — for alerts
  stage_entered_at    timestamptz not null default now(),
  last_activity_at    timestamptz not null default now(),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index deals_owner_idx on deals(owner_id);
create index deals_stage_idx on deals(deal_stage);
create index deals_company_idx on deals(company_id);
create index deals_contact_idx on deals(primary_contact_id);

alter table deals enable row level security;
create policy "owner crud deals" on deals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Update stage_entered_at when deal_stage changes
create or replace function update_deal_stage_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.deal_stage is distinct from old.deal_stage then
    new.stage_entered_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deals_stage_change on deals;
create trigger deals_stage_change
  before update on deals
  for each row execute function update_deal_stage_timestamps();

-- ============================================================================
--  ACTIVITIES — timeline events on deals
-- ============================================================================

create table if not exists activities (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  company_id  uuid references companies(id) on delete set null,
  type        text not null,           -- 'stage' | 'note' | 'email' | 'task'
  direction   text,                    -- 'inbound' | 'outbound' for emails
  title       text not null,
  body        text,
  created_at  timestamptz not null default now()
);

create index activities_owner_idx on activities(owner_id);
create index activities_deal_idx on activities(deal_id);
create index activities_contact_idx on activities(contact_id);
create index activities_created_idx on activities(created_at desc);

alter table activities enable row level security;
create policy "owner crud activities" on activities
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
--  ALERT RULES — configured per-user, fire per-stage
-- ============================================================================

create table if not exists alert_rules (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  deal_stage  text not null,           -- the stage being watched
  days_threshold integer not null,     -- fire after this many days in stage
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (owner_id, deal_stage)
);

alter table alert_rules enable row level security;
create policy "owner crud alert rules" on alert_rules
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
--  ALERT FIRINGS — record of when an alert fired (prevents duplicates)
-- ============================================================================

create table if not exists alert_firings (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  deal_id     uuid not null references deals(id) on delete cascade,
  rule_id     uuid not null references alert_rules(id) on delete cascade,
  deal_stage  text not null,
  fired_at    timestamptz not null default now(),
  snoozed_until timestamptz,
  dismissed_at  timestamptz,
  -- only one firing per (deal, rule, stage_entered_at) — recorded for dedupe
  stage_entered_at timestamptz not null
);

create index alert_firings_owner_idx on alert_firings(owner_id);
create index alert_firings_deal_idx on alert_firings(deal_id);
create unique index alert_firings_dedupe_idx on alert_firings(deal_id, rule_id, stage_entered_at);

alter table alert_firings enable row level security;
create policy "owner crud alert firings" on alert_firings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================================
--  DEFAULT ALERT RULES — seed on first profile creation
-- ============================================================================

create or replace function seed_default_alert_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into alert_rules (owner_id, deal_stage, days_threshold, enabled) values
    (new.id, 'inbox',       1,  true),
    (new.id, 'qualifying',  3,  true),
    (new.id, 'discovery',   7,  true),
    (new.id, 'proposal',    7,  true),
    (new.id, 'negotiation', 5,  true),
    (new.id, 'verbal',      3,  true)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on profiles;
create trigger on_profile_created
  after insert on profiles
  for each row execute function seed_default_alert_rules();
