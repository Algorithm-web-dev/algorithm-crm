'use client';

import { useDroppable } from '@dnd-kit/core';
import { type Deal, type Profile, annualisedValue, fmtCurrency, initialsOf, profileName } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  kind: 'won' | 'lost';
  deals: Deal[];
  profiles: Profile[];
  onCardClick: (d: Deal) => void;
  className?: string;
}

const STYLE = {
  won: {
    label: 'WON',
    dot: 'bg-accent-2',
    text: 'text-accent-2',
    border: 'border-accent-2/25',
    over: 'border-accent-2 bg-accent-2/5',
    row: 'hover:border-accent-2/40',
    empty: 'Drop a deal here to mark it won',
  },
  lost: {
    label: 'LOST',
    dot: 'bg-red-500',
    text: 'text-red-400',
    border: 'border-red-900/40',
    over: 'border-red-500 bg-red-500/5',
    row: 'hover:border-red-700/40',
    empty: 'Drop a deal here to mark it lost',
  },
};

// Compact drop target for closed deals. Kept narrow and pinned beside the board
// so it's always visible; rows open the closed-deal summary.
export default function ClosedLane({ kind, deals, profiles, onCardClick, className }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: kind });
  const s = STYLE[kind];
  const total = deals.reduce((sum, d) => sum + annualisedValue(d), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-navy border rounded-xl overflow-hidden transition-colors',
        isOver ? s.over : s.border,
        className,
      )}
    >
      <div className="px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
          <span className={cn('font-mono text-[10px] font-semibold tracking-[0.15em]', s.text)}>{s.label}</span>
          <span className="ml-auto font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded-lg bg-white/[0.04]">
            {deals.length}
          </span>
        </div>
        <div className="font-mono text-[10px] text-text-muted mt-1 tabular-nums h-3.5">
          {total > 0 && `${fmtCurrency(total, deals[0]?.currency || 'ZAR')} total`}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
        {deals.length === 0 ? (
          <div className="text-center py-6 px-2 text-[11px] text-text-muted">{s.empty}</div>
        ) : (
          deals.map((deal) => {
            const value = annualisedValue(deal);
            const owner = profileName(profiles.find((p) => p.id === deal.deal_owner_id));
            return (
              <button
                key={deal.id}
                onClick={() => onCardClick(deal)}
                className={cn(
                  'text-left bg-slate-light border border-white/[0.04] rounded-md px-2 py-1.5 transition-colors',
                  s.row,
                )}
              >
                <div className="text-[11px] font-semibold text-text-primary leading-tight truncate">{deal.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted">
                  <span title={`Deal owner: ${owner}`} className="font-mono">
                    {initialsOf(owner.split(' ')[0], owner.split(' ')[1])}
                  </span>
                  {kind === 'lost' && deal.loss_reason && <span className="truncate">· {deal.loss_reason}</span>}
                  {value > 0 && (
                    <span className={cn('ml-auto font-mono tabular-nums flex-shrink-0', s.text)}>
                      {fmtCurrency(value, deal.currency || 'ZAR')}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
