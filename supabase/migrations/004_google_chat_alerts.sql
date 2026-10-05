-- ============================================================================
--  004 — Send deal alerts to the CRM directors' Google Chat space.
--
--  Run after 003. Safe to re-run.
--
--  After running, connect the space (Google Chat → space → Apps & integrations
--  → Webhooks → Add webhook → copy URL) and save it here:
--
--    insert into integration_settings (key, value) values
--      ('google_chat_webhook_url', 'https://chat.googleapis.com/v1/spaces/…'),
--      ('app_url', 'https://your-crm.vercel.app')
--    on conflict (key) do update set value = excluded.value, updated_at = now();
--
--  To disconnect:  delete from integration_settings where key = 'google_chat_webhook_url';
-- ============================================================================

-- Supabase's async HTTP client (Database → Extensions → pg_net).
create extension if not exists pg_net;

-- Secrets / integration config. RLS on with NO policies: readable only by the
-- service role (cron, API routes) and security-definer functions — never the browser.
create table if not exists integration_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table integration_settings enable row level security;

-- Post a message to the directors' Google Chat space, if connected.
-- Fire-and-forget: pg_net sends after commit, and any error is swallowed so a
-- Chat outage can never stop a deal from being saved.
create or replace function post_to_google_chat(message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook text;
begin
  select value into webhook from integration_settings where key = 'google_chat_webhook_url';
  if webhook is null or webhook = '' then
    return;
  end if;

  perform net.http_post(
    url     := webhook,
    body    := jsonb_build_object('text', message),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'Google Chat post failed: %', sqlerrm;
end;
$$;

revoke all on function post_to_google_chat(text) from public, anon, authenticated;

-- Same as 003, plus a Google Chat post (one per stage entry, not one per user).
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

  insert into notifications (user_id, deal_id, kind, title, body)
  select p.id,
         new.id,
         'stage_entered',
         format('%s moved to %s', new.name, stage_name),
         format('Deal owner: %s', owner_name)
  from profiles p;

  select rtrim(value, '/') into base_url from integration_settings where key = 'app_url';

  perform post_to_google_chat(
    format(E'🔔 *%s* moved to *%s*\nDeal owner: %s', new.name, stage_name, owner_name)
    || case when base_url is not null
         then format(E'\n<%s/deals?deal=%s|Open in CRM>', base_url, new.id)
         else '' end
  );

  return new;
end;
$$;
