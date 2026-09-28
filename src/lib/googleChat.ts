import type { createAdminClient } from '@/lib/supabase/admin';

// Google Chat incoming webhook for the CRM directors' space. The URL lives in
// integration_settings (service-role only) so the DB trigger and the app share it.

type Admin = ReturnType<typeof createAdminClient>;

export interface ChatConfig {
  webhookUrl: string | null;
  appUrl: string | null;
}

export async function getChatConfig(supabase: Admin): Promise<ChatConfig> {
  const { data } = await supabase
    .from('integration_settings')
    .select('key, value')
    .in('key', ['google_chat_webhook_url', 'app_url']);
  const get = (k: string) => data?.find((r) => r.key === k)?.value || null;
  return { webhookUrl: get('google_chat_webhook_url'), appUrl: get('app_url')?.replace(/\/$/, '') ?? null };
}

// Google Chat caps text at 4,096 chars — long lists are split across messages.
const MAX_CHARS = 4000;

export async function postToGoogleChat(webhookUrl: string, lines: string[]): Promise<void> {
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current && current.length + line.length + 1 > MAX_CHARS) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n${line}` : line;
  }
  if (current) chunks.push(current);

  for (const text of chunks) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Google Chat ${res.status}: ${await res.text()}`);
  }
}
