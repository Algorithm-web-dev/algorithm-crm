-- ============================================================================
--  006 — Directors can delete deals; deletions alert everyone; Lost alerts
--  include the loss reason.
--
--  Run after 005. Safe to re-run.
--
--  After running, mark the directors (only they can delete deals):
--
--    update profiles set is_director = true
--    where email in ('jamie@algorithm.agency', 'simon@algorithm.agency');
--
--  Check who is a director:  select email, is_director from profiles order by email;
-- ============================================================================

-- ============================================================================
--  1. DIRECTOR FLAG
-- ============================================================================

alter table profiles add column if not exists is_director boolean not null default false;

-- Users can update their own profile (name, currency) through the app, so stop
-- them from promoting themselves: only the SQL editor / service role can change
-- is_director.
create or replace function protect_director_flag()
returns trigger
language plpgsql
as $$
begin
  if new.is_director is distinct from old.is_director
     and current_user in ('authenticated', 'anon') then
    new.is_director := old.is_director;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_director_flag on profiles;
create trigger profiles_protect_director_flag
  before update on profiles
  for each row execute function protect_director_flag();

-- ============================================================================
--  2. ONLY DIRECTORS CAN DELETE DEALS
-- ============================================================================
-- 002 gave every signed-in user full access (including delete). Split it so
-- read / create / edit stay team-wide but delete needs is_director.

drop policy if exists "team crud deals" on deals;

drop policy if exists "team read deals" on deals;
create policy "team read deals" on deals
  for select using (auth.uid() is not null);

drop policy if exists "team insert deals" on deals;
create policy "team insert deals" on deals
  for insert with check (auth.uid() is not null);

drop policy if exists "team update deals" on deals;
create policy "team update deals" on deals
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "directors delete deals" on deals;
create policy "directors delete deals" on deals
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and is_director)
  );

-- ============================================================================
--  3. ALERT EVERYONE WHEN A DEAL IS DELETED
-- ============================================================================
-- Notifications are stored without deal_id (the deal no longer exists).

create or replace function notify_deal_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_name text;
  actor_name text;
  stage_name text := initcap(old.deal_stage);
begin
  select coalesce(full_name, split_part(email, '@', 1)) into owner_name
  from profiles where id = old.deal_owner_id;
  owner_name := coalesce(owner_name, 'Unassigned');

  select coalesce(full_name, split_part(email, '@', 1)) into actor_name
  from profiles where id = auth.uid();
  actor_name := coalesce(actor_name, 'an admin');

  insert into notifications (user_id, deal_id, kind, title, body)
  select p.id,
         null,
         'deleted',
         format('%s was deleted', old.name),
         format('Deleted by %s · Deal owner: %s · Was in: %s', actor_name, owner_name, stage_name)
  from profiles p;

  perform post_to_google_chat(
    format(E'🗑️ *%s* was deleted by %s\nDeal owner: %s · Was in: %s',
           old.name, actor_name, owner_name, stage_name)
  );

  return old;
end;
$$;

drop trigger if exists deals_notify_deleted on deals;
create trigger deals_notify_deleted
  after delete on deals
  for each row execute function notify_deal_deleted();

-- ============================================================================
--  4. STAGE-ENTRY ALERTS: include the loss reason for Lost
-- ============================================================================
-- Same as 004 plus "· Reason: …" when a deal moves to Lost. The loss reason is
-- saved in the same update as the stage change, so it's available here.

create or replace function notify_deal_stage_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_notify boolean;
  owner_name text;
  stage_name text := initcap(new.deal_stage);
  details text;
  base_url text;
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
  owner_name := coalesce(owner_name, 'Unassigned');

  details := format('Deal owner: %s', owner_name);
  if new.deal_stage = 'lost' and new.loss_reason is not null then
    details := details || format(' · Reason: %s', new.loss_reason);
  end if;

  insert into notifications (user_id, deal_id, kind, title, body)
  select p.id,
         new.id,
         'stage_entered',
         format('%s moved to %s', new.name, stage_name),
         details
  from profiles p;

  select rtrim(value, '/') into base_url from integration_settings where key = 'app_url';

  perform post_to_google_chat(
    format(E'%s *%s* moved to *%s*\n%s',
           case when new.deal_stage = 'lost' then '🔴' when new.deal_stage = 'won' then '🏆' else '🔔' end,
           new.name, stage_name, details)
    || case when base_url is not null
         then format(E'\n<%s/deals?deal=%s|Open in CRM>', base_url, new.id)
         else '' end
  );

  return new;
end;
$$;
