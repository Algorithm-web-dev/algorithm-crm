-- ============================================================================
--  003 — CRM brief (Sept 2026): deal owner, team-wide stage alerts,
--  in-app notifications.
--
--  Run this in the Supabase SQL Editor after 001 and 002. Safe to re-run.
--
--  What it does:
--    1. Adds deals.deal_owner_id (a real user reference, required) and
--       backfills it from deals.owner_id (whoever created the deal).
--    2. Replaces the per-user alert_rules with ONE team-wide rule per stage
--       (stage_alert_rules): "stalled for N days" and/or "notify on entry".
--    3. Adds a notifications table (in-app inbox, one row per user per alert).
--    4. Adds a trigger that notifies every user when a deal enters a stage
--       that has "notify on entry" switched on.
--
--  The old alert_rules / alert_firings tables are left in place but are no
--  longer read or written. They can be dropped once this is confirmed live.
-- ============================================================================

-- Stop seeding per-user alert rules for new sign-ups (replaced below).
drop trigger if exists on_profile_created on profiles;

-- Every auth user needs a profile so they can be a deal owner / get alerts.
insert into profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- ============================================================================
--  1. DEAL OWNER
-- ============================================================================
-- owner_id stays as "created by". deal_owner_id is who is accountable for the
-- deal and can be reassigned. Deleting a user who still owns deals is blocked
-- until those deals are reassigned.

alter table deals add column if not exists deal_owner_id uuid references profiles(id);

-- Backfill: existing deals are owned by whoever created them. Reassign
-- individual deals from the Edit Deal form afterwards if that's wrong.
update deals set deal_owner_id = owner_id where deal_owner_id is null;

alter table deals alter column deal_owner_id set default auth.uid();
alter table deals alter column deal_owner_id set not null;

create index if not exists deals_deal_owner_idx on deals(deal_owner_id);

-- ============================================================================
--  2. STAGE ALERT RULES — one team-wide rule per stage
-- ============================================================================

create table if not exists stage_alert_rules (
  deal_stage       text primary key,
  -- alert everyone when a deal has sat in this stage this many days; null = off
  stall_days       integer check (stall_days is null or stall_days between 1 and 365),
  -- alert everyone the moment a deal moves into this stage
  notify_on_entry  boolean not null default false,
  updated_by       uuid references profiles(id) on delete set null,
  updated_at       timestamptz not null default now()
);

alter table stage_alert_rules enable row level security;

drop policy if exists "team read stage alert rules" on stage_alert_rules;
create policy "team read stage alert rules" on stage_alert_rules
  for select using (auth.uid() is not null);

drop policy if exists "team update stage alert rules" on stage_alert_rules;
create policy "team update stage alert rules" on stage_alert_rules
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- Seed with the previous per-user defaults. Adjust from the Automations page.
insert into stage_alert_rules (deal_stage, stall_days, notify_on_entry) values
  ('inbox',       1,    false),
  ('qualifying',  3,    false),
  ('discovery',   7,    false),
  ('proposal',    7,    false),
  ('negotiation', 5,    false),
  ('verbal',      3,    false),
  ('won',         null, false),
  ('lost',        null, false)
on conflict (deal_stage) do nothing;

-- ============================================================================
--  3. NOTIFICATIONS — in-app inbox (one row per recipient)
-- ============================================================================

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  kind        text not null,            -- 'stalled' | 'stage_entered'
  title       text not null,
  body        text,                     -- includes the deal owner snippet
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  emailed_at  timestamptz               -- set once included in an email digest
);

create index if not exists notifications_user_unread_idx on notifications(user_id, read_at);
create index if not exists notifications_created_idx on notifications(created_at desc);

alter table notifications enable row level security;

drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Dedupe log for stalled alerts: one per (deal, stage entry). Written only by
-- the cron job (service role), so no RLS policies are needed.
create table if not exists deal_alert_log (
  deal_id           uuid not null references deals(id) on delete cascade,
  kind              text not null,
  stage_entered_at  timestamptz not null,
  fired_at          timestamptz not null default now(),
  primary key (deal_id, kind, stage_entered_at)
);

alter table deal_alert_log enable row level security;

-- ============================================================================
--  4. NOTIFY ALL USERS WHEN A DEAL ENTERS A STAGE (if switched on for it)
-- ============================================================================

create or replace function notify_deal_stage_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_notify boolean;
  owner_name text;
begin
  if tg_op = 'UPDATE' and new.deal_stage is not distinct from old.deal_stage then
    return new;
  end if;

  select notify_on_entry into should_notify
  from stage_alert_rules where deal_stage = new.deal_stage;

  if not coalesce(should_notify, false) then
    return new;
  end if;

  select coalesce(full_name, split_part(email, '@', 1)) into owner_name
  from profiles where id = new.deal_owner_id;

  insert into notifications (user_id, deal_id, kind, title, body)
  select p.id,
         new.id,
         'stage_entered',
         format('%s moved to %s', new.name, initcap(new.deal_stage)),
         format('Deal owner: %s', coalesce(owner_name, 'Unassigned'))
  from profiles p;

  return new;
end;
$$;

drop trigger if exists deals_notify_stage_entry on deals;
create trigger deals_notify_stage_entry
  after insert or update of deal_stage on deals
  for each row execute function notify_deal_stage_entry();
