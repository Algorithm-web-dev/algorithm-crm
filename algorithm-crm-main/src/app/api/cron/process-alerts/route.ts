import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Deal, AlertRule } from '@/types';

// Run daily at 9am UTC (set in vercel.json). Vercel adds a CRON_SECRET header automatically
// when CRON_SECRET env var is set — we check for it to prevent random calls.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify this is a legit cron call
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service-role key to bypass RLS (we're processing for ALL users)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );

  // 1. Get all enabled rules
  const { data: rules } = await supabase.from('alert_rules').select('*').eq('enabled', true);
  if (!rules || rules.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No active rules' });
  }

  let firedCount = 0;
  const skippedDuplicate = 0;

  // 2. For each rule, find deals that have been in the stage too long
  for (const rule of rules as AlertRule[]) {
    const thresholdMs = rule.days_threshold * 86400000;
    const cutoff = new Date(Date.now() - thresholdMs).toISOString();

    const { data: stalled } = await supabase
      .from('deals')
      .select('*')
      .eq('owner_id', rule.owner_id)
      .eq('deal_stage', rule.deal_stage)
      .lte('stage_entered_at', cutoff);

    if (!stalled) continue;

    for (const deal of stalled as Deal[]) {
      // Dedupe: don't fire twice for the same (deal, rule, stage entry)
      const { data: existing } = await supabase
        .from('alert_firings')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('rule_id', rule.id)
        .eq('stage_entered_at', deal.stage_entered_at)
        .maybeSingle();

      if (existing) continue;

      // Get owner email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', rule.owner_id)
        .single();

      if (!profile) continue;

      // Record the firing
      await supabase.from('alert_firings').insert({
        owner_id: rule.owner_id,
        deal_id: deal.id,
        rule_id: rule.id,
        deal_stage: deal.deal_stage,
        stage_entered_at: deal.stage_entered_at,
      });

      // Send the email — Phase 1 just logs to console.
      // Phase 3 will replace this with actual Gmail/Resend sending.
      console.log(
        `[ALERT] To: ${profile.email} — Deal "${deal.name}" has been in ${deal.deal_stage} for >${rule.days_threshold} days`,
      );

      firedCount++;
    }
  }

  return NextResponse.json({
    processed: firedCount,
    rules: rules.length,
    timestamp: new Date().toISOString(),
  });
}
