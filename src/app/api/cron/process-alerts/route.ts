import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getChatConfig, postToGoogleChat } from '@/lib/googleChat';
import {
  type Deal,
  type Notification,
  type Profile,
  type StageAlertRule,
  getStage,
  daysBetween,
  profileName,
} from '@/types';

// Run daily at 9am UTC (set in vercel.json). Vercel adds a CRON_SECRET header automatically
// when CRON_SECRET env var is set — we check for it to prevent random calls.
//
// 1. Stalled alerts: for each stage with stall_days set, every deal that has sat in
//    that stage longer than the threshold notifies ALL users (once per stage entry).
// 2. Google Chat: new stalled alerts are posted as one message to the directors'
//    space, if connected (on-entry alerts are posted instantly by a DB trigger).
// 3. Email digest: if RESEND_API_KEY + ALERT_EMAIL_FROM are set, each user is emailed
//    their not-yet-emailed notifications (stalled + stage-entry) in one message.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify this is a legit cron call
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service-role client bypasses RLS (we're processing for ALL users)
  const supabase = createAdminClient();

  const [{ data: rules }, { data: profiles }] = await Promise.all([
    supabase.from('stage_alert_rules').select('*').not('stall_days', 'is', null),
    supabase.from('profiles').select('*'),
  ]);
  const team = (profiles ?? []) as Profile[];
  const profileMap = new Map(team.map((p) => [p.id, p]));

  let stalledFired = 0;
  const chatLines: string[] = [];
  const chat = await getChatConfig(supabase);

  for (const rule of (rules ?? []) as StageAlertRule[]) {
    const cutoff = new Date(Date.now() - rule.stall_days! * 86400000).toISOString();
    const { data: stalled } = await supabase
      .from('deals')
      .select('*')
      .eq('deal_stage', rule.deal_stage)
      .lte('stage_entered_at', cutoff);

    for (const deal of (stalled ?? []) as Deal[]) {
      // Dedupe: one stalled alert per (deal, stage entry). An empty result means
      // the row already existed, i.e. we alerted on this stage entry before.
      const { data: logged } = await supabase
        .from('deal_alert_log')
        .upsert(
          { deal_id: deal.id, kind: 'stalled', stage_entered_at: deal.stage_entered_at },
          { onConflict: 'deal_id,kind,stage_entered_at', ignoreDuplicates: true },
        )
        .select();
      if (!logged || logged.length === 0) continue;

      const stageName = getStage(deal.deal_stage).name;
      const days = daysBetween(deal.stage_entered_at);
      const owner = profileName(profileMap.get(deal.deal_owner_id));

      const { error } = await supabase.from('notifications').insert(
        team.map((p) => ({
          user_id: p.id,
          deal_id: deal.id,
          kind: 'stalled',
          title: `${deal.name} has been in ${stageName} for ${days} days`,
          body: `Deal owner: ${owner}`,
        })),
      );
      if (error) {
        console.error(`[ALERT] notify failed for deal ${deal.id}: ${error.message}`);
        continue;
      }
      console.log(`[ALERT] Stalled: "${deal.name}" in ${stageName} ${days}d — owner ${owner} — ${team.length} users`);
      stalledFired++;
      chatLines.push(
        `• *${deal.name}* — ${stageName} for ${days} days · Deal owner: ${owner}` +
          (chat.appUrl ? ` · <${chat.appUrl}/deals?deal=${deal.id}|Open>` : ''),
      );
    }
  }

  let chatStatus: 'sent' | 'nothing to send' | 'not connected' | 'failed' = 'not connected';
  if (chat.webhookUrl) {
    if (chatLines.length === 0) chatStatus = 'nothing to send';
    else {
      try {
        await postToGoogleChat(chat.webhookUrl, [
          `⏰ *${chatLines.length} stalled deal${chatLines.length === 1 ? '' : 's'}*`,
          ...chatLines,
        ]);
        chatStatus = 'sent';
      } catch (e) {
        console.error(`[ALERT] Google Chat post failed: ${(e as Error).message}`);
        chatStatus = 'failed';
      }
    }
  }

  const emailed = await sendEmailDigests(supabase, profileMap);

  return NextResponse.json({
    stalled_alerts: stalledFired,
    rules: rules?.length ?? 0,
    google_chat: chatStatus,
    emails_sent: emailed,
    timestamp: new Date().toISOString(),
  });
}

async function sendEmailDigests(
  supabase: ReturnType<typeof createAdminClient>,
  profileMap: Map<string, Profile>,
): Promise<number | 'disabled'> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !from) return 'disabled';

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .is('emailed_at', null)
    // don't dump old history on the first run after email is switched on
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('created_at', { ascending: true });

  const byUser = new Map<string, Notification[]>();
  for (const n of (data ?? []) as Notification[]) {
    byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  let sent = 0;

  for (const [userId, items] of Array.from(byUser.entries())) {
    const profile = profileMap.get(userId);
    if (!profile) continue;

    const lines = items.map((n) => `• ${n.title}\n  ${n.body ?? ''}`);
    const text = [
      `Hi ${profileName(profile)},`,
      '',
      `${items.length} deal alert${items.length === 1 ? '' : 's'} from Algorithm CRM:`,
      '',
      ...lines,
      '',
      appUrl ? `Open the CRM: ${appUrl}/notifications` : '',
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [profile.email],
        subject: `Algorithm CRM — ${items.length} deal alert${items.length === 1 ? '' : 's'}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error(`[ALERT] Email to ${profile.email} failed: ${res.status} ${await res.text()}`);
      continue;
    }

    await supabase
      .from('notifications')
      .update({ emailed_at: new Date().toISOString() })
      .in(
        'id',
        items.map((n) => n.id),
      );
    sent++;
  }
  return sent;
}
