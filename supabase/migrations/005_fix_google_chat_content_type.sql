-- ============================================================================
--  005 — Fix: Google Chat posts from the database were silently dropped.
--
--  pg_net's net.http_post() only accepts a Content-Type of exactly
--  "application/json" and raises an error for anything else. 004 sent
--  "application/json; charset=UTF-8", so every post failed and the error was
--  swallowed by post_to_google_chat()'s safety handler. (JSON is UTF-8 by
--  definition, so Google Chat doesn't need the charset parameter.)
--
--  Run after 004. Safe to re-run.
-- ============================================================================

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
