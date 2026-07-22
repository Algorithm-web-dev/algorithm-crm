'use client';

import { useState } from 'react';
import { DEAL_STAGES, type AlertRule, type DealStageId } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toaster';
import { Input } from '@/components/ui/Form';
import { cn } from '@/lib/utils';

interface Props {
  initialRules: AlertRule[];
}

// Stages we offer rules for (excludes won/lost — no point alerting on closed deals)
const ALERTABLE_STAGES: DealStageId[] = ['inbox', 'qualifying', 'discovery', 'proposal', 'negotiation', 'verbal'];

export default function AlertRulesEditor({ initialRules }: Props) {
  const [rules, setRules] = useState<Record<DealStageId, AlertRule | null>>(() => {
    const byStage: Record<string, AlertRule | null> = {};
    ALERTABLE_STAGES.forEach((s) => {
      byStage[s] = initialRules.find((r) => r.deal_stage === s) || null;
    });
    return byStage as Record<DealStageId, AlertRule | null>;
  });
  const [savingStage, setSavingStage] = useState<string | null>(null);

  async function updateRule(stage: DealStageId, days: number, enabled: boolean) {
    setSavingStage(stage);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingStage(null);
      return;
    }

    const existing = rules[stage];
    if (existing) {
      const { data, error } = await supabase
        .from('alert_rules')
        .update({ days_threshold: days, enabled })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        toast('Save failed', 'error');
      } else {
        setRules((prev) => ({ ...prev, [stage]: data as AlertRule }));
      }
    } else {
      const { data, error } = await supabase
        .from('alert_rules')
        .insert({
          owner_id: user.id,
          deal_stage: stage,
          days_threshold: days,
          enabled,
        })
        .select()
        .single();
      if (error) {
        toast('Save failed', 'error');
      } else {
        setRules((prev) => ({ ...prev, [stage]: data as AlertRule }));
      }
    }
    setSavingStage(null);
  }

  return (
    <div className="space-y-3">
      {ALERTABLE_STAGES.map((stageId) => {
        const stage = DEAL_STAGES.find((s) => s.id === stageId)!;
        const rule = rules[stageId];
        const enabled = rule?.enabled ?? false;
        const days = rule?.days_threshold ?? 7;

        return (
          <div
            key={stageId}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border transition',
              enabled ? 'bg-deep-navy border-white/10' : 'bg-deep-navy/40 border-white/[0.04]',
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
            <div className="flex-1 min-w-0">
              <div
                className="font-mono text-xs font-semibold tracking-[0.15em] mb-0.5"
                style={{ color: stage.color }}
              >
                {stage.name.toUpperCase()}
              </div>
              <div className="text-xs text-text-muted">
                {enabled
                  ? `Alert me when a deal stays in ${stage.name} for more than `
                  : 'Disabled'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                defaultValue={days}
                disabled={!enabled || savingStage === stageId}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0 && val !== days) updateRule(stageId, val, enabled);
                }}
                className="w-20 text-center tabular-nums"
              />
              <span className="text-xs text-text-muted">days</span>
            </div>
            <button
              onClick={() => updateRule(stageId, days, !enabled)}
              disabled={savingStage === stageId}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors',
                enabled ? 'bg-accent' : 'bg-white/10',
              )}
              aria-label={enabled ? 'Disable' : 'Enable'}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        );
      })}
      <p className="text-xs text-text-muted pt-2">
        Alerts run once per day. Each deal can only fire one alert per stage entry — moving the deal to a new
        stage resets its timer.
      </p>
    </div>
  );
}
