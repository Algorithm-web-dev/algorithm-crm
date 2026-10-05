'use client';

import { useDroppable } from '@dnd-kit/core';
import { DEAL_STAGES, type DealStage, type DealStageId } from '@/types';
import { cn } from '@/lib/utils';

export const STAGE_PRESETS: { label: string; stages: DealStageId[] }[] = [
  { label: 'Leads', stages: ['inbox', 'qualifying'] },
  { label: 'Active', stages: ['discovery', 'proposal', 'negotiation', 'verbal'] },
  { label: 'Closed', stages: ['won', 'lost'] },
  { label: 'All', stages: DEAL_STAGES.map((s) => s.id) },
];

interface Props {
  visible: DealStageId[];
  counts: Record<DealStageId, number>;
  dragging: boolean;
  onToggle: (id: DealStageId) => void;
  onPreset: (stages: DealStageId[]) => void;
}

// Presets + one chip per stage. Chips toggle column visibility and are also
// drop targets (id "chip:<stage>"), so a deal can be moved to a hidden stage.
export default function StageFilterBar({ visible, counts, dragging, onToggle, onPreset }: Props) {
  const visibleKey = visible.join(',');
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-navy border border-white/[0.06] rounded-xl">
      <div className="flex bg-deep-navy border border-white/[0.08] rounded-full p-[3px]">
        {STAGE_PRESETS.map((p) => {
          const active = p.stages.join(',') === visibleKey;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onPreset(p.stages)}
              aria-pressed={active}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                active ? 'bg-slate-light text-text-primary' : 'text-text-muted hover:text-text-sub',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />
      {DEAL_STAGES.map((stage) => (
        <StageChip
          key={stage.id}
          stage={stage}
          visible={visible.includes(stage.id)}
          count={counts[stage.id] ?? 0}
          onClick={() => onToggle(stage.id)}
        />
      ))}
      <span
        // idle hint only where it fits on the same row; the drag hint is shorter
        className={cn(
          'ml-auto pr-1 text-[11.5px] hidden',
          dragging ? 'xl:inline text-text-primary' : '2xl:inline text-text-muted',
        )}
      >
        {dragging ? 'Drop on any stage to move the deal' : 'Click stages to show or hide · drag deals onto any stage'}
      </span>
    </div>
  );
}

function StageChip({
  stage,
  visible,
  count,
  onClick,
}: {
  stage: DealStage;
  visible: boolean;
  count: number;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `chip:${stage.id}` });
  const style: React.CSSProperties | undefined = isOver
    ? { background: `${stage.color}40`, borderColor: stage.color, transform: 'scale(1.06)' }
    : visible
    ? { background: `${stage.color}1f`, borderColor: stage.color }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      aria-pressed={visible}
      title={visible ? `Hide ${stage.name}` : `Show ${stage.name}`}
      style={style}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
        'transition-[background-color,border-color,transform] duration-[120ms]',
        visible || isOver ? 'text-text-primary' : 'border-white/10 text-text-sub hover:text-text-primary',
      )}
    >
      <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: stage.color }} />
      {stage.name}
      <span className="font-mono text-[10px] text-text-muted">{count}</span>
    </button>
  );
}
