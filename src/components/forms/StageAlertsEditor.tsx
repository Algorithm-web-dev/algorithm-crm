'use client';

import { useState } from 'react';
import { DEAL_STAGES, type StageAlertRule, type DealStageId } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toaster';
import { Input } from '@/components/ui/Form';
import { cn } from '@/lib/utils';

interface Props {
  initialRules: StageAlertRule[];
}

// Stalled alerts make no sense on closed deals, but "notify on entry" does (e.g. Won).
const CLOSED_STAGES: DealStageId[] = ['won', 'lost'];

export default function StageAlertsEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<Record<string, StageAlertRule>>(() =>
    Object.fromEntries(initialRules.map((r) => [r.deal_stage, r])),
  );
  const [savingStage, setSavingStage] = useState<string | null>(null);

  async function save(stage: DealStageId, patch: Partial<Pick<StageAlertRule, 'stall_days' | 'notify_on_entry'>>) {
    setSavingStage(stage);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('stage_alert_rules')
      .update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('deal_stage', stage)
      .select()
      .single();
    if (error) toast('Save failed', 'error');
    else {
      setRules((prev) => ({ ...prev, [stage]: data as StageAlertRule }));
      toast('Saved — applies to the whole team', 'success');
    }
    setSavingStage(null);
  }

  if (initialRules.length === 0) {
    return (
      <p className="text-sm text-priority-high">
        No stage alert settings found. Run <code>supabase/migrations/003_owner_alerts_notifications.sql</code> in
        the Supabase SQL editor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_150px_110px] gap-4 px-4 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        <span>Stage</span>
        <span>Stalled after</span>
        <span className="text-right">On entry</span>
      </div>
      {DEAL_STAGES.map((stage) => {
        const rule = rules[stage.id];
        if (!rule) return null;
        const closed = CLOSED_STAGES.includes(stage.id);
        const stallOn = rule.stall_days != null;
        const saving = savingStage === stage.id;

        return (
          <div
            key={stage.id}
            className={cn(
              'grid grid-cols-[1fr_150px_110px] gap-4 items-center p-4 rounded-lg border transition',
              stallOn || rule.notify_on_entry ? 'bg-deep-navy border-white/10' : 'bg-deep-navy/40 border-white/[0.04]',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold tracking-[0.15em]" style={{ color: stage.color }}>
                  {stage.name.toUpperCase()}
                </div>
                <div className="text-[11px] text-text-muted">{stage.prob}% close probability</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {closed ? (
                <span className="text-xs text-text-muted">n/a</span>
              ) : (
                <>
                  <Input
                    key={`${stage.id}-${rule.stall_days}`}
                    type="number"
                    min="1"
                    max="365"
                    placeholder="off"
                    defaultValue={rule.stall_days ?? ''}
                    disabled={saving}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const val = raw === '' ? null : parseInt(raw, 10);
                      if (val !== null && (isNaN(val) || val < 1 || val > 365)) {
                        toast('Enter 1–365 days, or leave blank to switch off', 'error');
                        e.target.value = rule.stall_days == null ? '' : String(rule.stall_days);
                        return;
                      }
                      if (val !== rule.stall_days) save(stage.id, { stall_days: val });
                    }}
                    className="w-20 text-center tabular-nums"
                  />
                  <span className="text-xs text-text-muted">days</span>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => save(stage.id, { notify_on_entry: !rule.notify_on_entry })}
                disabled={saving}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  rule.notify_on_entry ? 'bg-accent' : 'bg-white/10',
                )}
                aria-label={`${rule.notify_on_entry ? 'Disable' : 'Enable'} alert when a deal enters ${stage.name}`}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    rule.notify_on_entry ? 'translate-x-[18px]' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-text-muted pt-2">
        <strong>Stalled after</strong> — alert everyone when a deal sits in a stage for this many days without moving
        (checked once a day at 09:00 UTC; one alert per stage visit; leave blank to switch off).{' '}
        <strong>On entry</strong> — alert everyone the moment a deal moves into that stage. Every alert names the deal
        owner.
      </p>
    </div>
  );
}
