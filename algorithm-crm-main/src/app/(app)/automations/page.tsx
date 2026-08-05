import { createClient } from '@/lib/supabase/server';
import { DEAL_STAGES, type AlertRule } from '@/types';
import AlertRulesEditor from '@/components/forms/AlertRulesEditor';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('owner_id', user.id);

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-2xl font-extrabold tracking-tight">Automations</h1>
        <span className="text-xs text-text-muted">Stalled deal alerts</span>
      </div>
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl space-y-5">
          <div className="bg-slate-light border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-extrabold mb-1">Stalled deal alerts</h2>
            <p className="text-sm text-text-muted mb-5">
              When a deal sits in a stage for too long, we&apos;ll email you (the deal owner) a reminder.
              Configure the threshold per stage below. Setting a stage to 0 days disables that alert.
            </p>
            <AlertRulesEditor initialRules={(rules as AlertRule[]) ?? []} />
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
