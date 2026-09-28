import { createClient } from '@/lib/supabase/server';
import type { StageAlertRule } from '@/types';
import { DEAL_STAGES } from '@/types';
import { STAGE_PROBABILITY_CONFIG } from '@/config/stageProbabilities';
import StageAlertsEditor from '@/components/forms/StageAlertsEditor';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rules } = await supabase.from('stage_alert_rules').select('*');
  const emailOn = !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM);

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-2xl font-extrabold tracking-tight">Automations</h1>
        <span className="text-xs text-text-muted">Deal stage alerts</span>
      </div>
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl space-y-5">
          <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-extrabold mb-1">Deal stage alerts</h2>
            <p className="text-sm text-text-muted mb-5">
              Team-wide settings — alerts go to <strong>everyone</strong> in the CRM and name the deal owner. They
              appear under Notifications in the sidebar
              {emailOn ? ' and are emailed as a daily digest.' : '. Email delivery is not switched on yet.'}
            </p>
            <StageAlertsEditor initialRules={(rules as StageAlertRule[]) ?? []} />
          </div>

          <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-extrabold mb-1">Stage close probabilities</h2>
            <p className="text-sm text-text-muted mb-4">
              Used for the Weighted pipeline figure and the finance export. Set in{' '}
              <code className="text-text-sub">config/stage-probabilities.json</code> — changes are made by a developer
              and go live on the next deploy.
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {DEAL_STAGES.map((s) => (
                <div key={s.id} className="bg-deep-navy border border-white/[0.06] rounded-lg px-3 py-2">
                  <div className="font-mono text-[10px] tracking-[0.15em]" style={{ color: s.color }}>
                    {s.name.toUpperCase()}
                  </div>
                  <div className="text-lg font-extrabold tabular-nums">{s.prob}%</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Status: {STAGE_PROBABILITY_CONFIG.status}
              {STAGE_PROBABILITY_CONFIG.lastReviewed &&
                ` · Last reviewed ${STAGE_PROBABILITY_CONFIG.lastReviewed}${
                  STAGE_PROBABILITY_CONFIG.reviewedBy ? ` by ${STAGE_PROBABILITY_CONFIG.reviewedBy}` : ''
                }`}
            </p>
          </div>

          <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-extrabold mb-1">Gmail sync</h2>
                <p className="text-sm text-text-muted">Auto-log inbound/outbound emails against contacts.</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] bg-accent/15 text-accent px-2.5 py-1 rounded-full">
                Phase 3
              </span>
            </div>
            <p className="text-sm text-text-muted">
              Coming in the next phase — Gmail OAuth integration to auto-capture emails against your contacts.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
