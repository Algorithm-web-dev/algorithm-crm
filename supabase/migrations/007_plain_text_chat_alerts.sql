-- ============================================================================
--  007 — Plain-text Google Chat alerts (no emojis).
--
--  Recreates the two alert functions from 006 with the emojis removed from
--  the Google Chat messages. Everything else (recipients, owner, loss
--  reason, "Open in CRM" link) is unchanged. In-app notifications never
--  had emojis.
--
--  Run after 006. Safe to re-run.
-- ============================================================================

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
    format(E'*%s* was deleted by %s\nDeal owner: %s · Was in: %s',
           old.name, actor_name, owner_name, stage_name)
  );

  return old;
end;
$$;

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
    format(E'*%s* moved to *%s*\n%s', new.name, stage_name, details)
    || case when base_url is not null
         then format(E'\n<%s/deals?deal=%s|Open in CRM>', base_url, new.id)
         else '' end
  );

  return new;
end;
$$;
