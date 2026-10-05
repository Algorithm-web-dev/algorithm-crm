'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  DEAL_STAGES,
  type Deal,
  type Contact,
  type Company,
  type DealStageId,
  type Profile,
  annualisedValue,
  weightedValue,
  fmtCurrencyFull,
  isEarlyStage,
  isClosedStage,
  daysBetween,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import KanbanColumn from './KanbanColumn';
import StageFilterBar, { STAGE_PRESETS } from './StageFilterBar';
import ExportMenu from './ExportMenu';
import { DealCardBody } from './DealCard';
import DealDrawer from '@/components/deals/DealDrawer';
import DealModal from '@/components/forms/DealModal';
import PromoteModal from '@/components/forms/PromoteModal';
import LossModal from '@/components/forms/LossModal';
import ClosedDealModal from '@/components/forms/ClosedDealModal';
import Toaster, { toast } from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';

interface Props {
  initialDeals: Deal[];
  contacts: Contact[];
  companies: Company[];
  profile: Profile;
  profiles: Profile[];
  currentUserId: string;
  openDealId?: string;
}

const STORAGE_KEY = 'crm.deals.visibleStages';
const DEFAULT_VISIBLE = STAGE_PRESETS[0].stages; // Leads
const STAGE_ORDER = DEAL_STAGES.map((s) => s.id);
const sortStages = (ids: DealStageId[]) => STAGE_ORDER.filter((id) => ids.includes(id));

// Small targets (stage chips) need pointer-based hit testing; fall back to
// rectangle overlap so dropping near a column still works.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export default function DealsView({
  initialDeals,
  contacts: initialContacts,
  companies: initialCompanies,
  profile,
  profiles,
  currentUserId,
  openDealId,
}: Props) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [visible, setVisible] = useState<DealStageId[]>(DEFAULT_VISIBLE);

  // Remembered per browser
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(saved)) {
        const valid = sortStages(saved.filter((id): id is DealStageId => STAGE_ORDER.includes(id)));
        if (valid.length) setVisible(valid);
      }
    } catch {
      // ignore
    }
  }, []);
  function updateVisible(next: DealStageId[]) {
    if (next.length === 0) return; // never hide the last stage
    const sorted = sortStages(next);
    setVisible(sorted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      // ignore
    }
  }
  const toggleStage = (id: DealStageId) =>
    updateVisible(visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id]);

  // Open deals → drawer; Won/Lost → closed-deal summary. Deep link: /deals?deal=<id>
  const linked = (openDealId && initialDeals.find((d) => d.id === openDealId)) || null;
  const [drawerId, setDrawerId] = useState<string | null>(
    linked && !isClosedStage(linked.deal_stage) ? linked.id : null,
  );
  const [viewingClosed, setViewingClosed] = useState<Deal | null>(
    linked && isClosedStage(linked.deal_stage) ? linked : null,
  );
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState<{ deal: Deal; newStage: DealStageId } | null>(null);
  const [markingLost, setMarkingLost] = useState<Deal | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // A deal that becomes Won/Lost leaves the drawer
  const drawerDeal = deals.find((d) => d.id === drawerId && !isClosedStage(d.deal_stage)) || null;

  function openDeal(d: Deal) {
    if (isClosedStage(d.deal_stage)) setViewingClosed(d);
    else setDrawerId(d.id);
  }
  function clearDeepLink() {
    if (openDealId) router.replace('/deals');
  }

  // Mouse: drag after 5px. Touch: long-press (250ms) so swiping still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const supabase = createClient();

  const metrics = useMemo(() => {
    const open = deals.filter((d) => !isClosedStage(d.deal_stage));
    const qualified = open.filter((d) => !isEarlyStage(d.deal_stage));
    return {
      totalPipeline: qualified.reduce((s, d) => s + annualisedValue(d), 0),
      weighted: qualified.reduce((s, d) => s + weightedValue(d), 0),
      qualifiedCount: qualified.length,
      earlyCount: open.length - qualified.length,
      wonRecent: deals
        .filter((d) => d.deal_stage === 'won' && (daysBetween(d.actual_close_date) ?? 999) < 30)
        .reduce((s, d) => s + annualisedValue(d), 0),
      activeMRR: deals
        .filter((d) => d.deal_stage === 'won')
        .reduce((s, d) => s + (Number(d.monthly_value) || 0), 0),
    };
  }, [deals]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STAGE_ORDER.map((id) => [id, 0])) as Record<DealStageId, number>;
    deals.forEach((d) => c[d.deal_stage]++);
    return c;
  }, [deals]);

  const activeDeal = activeDragId ? deals.find((d) => d.id === activeDragId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    if (!event.over) return;
    const deal = deals.find((d) => d.id === String(event.active.id));
    // Columns use the stage id; chips use "chip:<stage>"
    const newStage = String(event.over.id).replace(/^chip:/, '') as DealStageId;
    if (deal) moveDeal(deal, newStage);
  }

  // Shared by drag-and-drop and the drawer's "Move to …" button.
  async function moveDeal(deal: Deal, newStage: DealStageId) {
    if (deal.deal_stage === newStage) return;

    // Lost requires a reason — checked before promotion so a lead can be
    // closed out without first creating Contact/Company records.
    if (newStage === 'lost') {
      setMarkingLost(deal);
      return;
    }

    // Promotion: early → not early, and no linked contact yet
    if (isEarlyStage(deal.deal_stage) && !isEarlyStage(newStage) && !deal.primary_contact_id) {
      setPromoting({ deal, newStage });
      return;
    }

    if (newStage === 'won' && !confirm(`Mark "${deal.name}" as WON?`)) return;

    const patch: Partial<Deal> = {
      deal_stage: newStage,
      last_activity_at: new Date().toISOString(),
    };
    if (newStage === 'won') {
      patch.actual_close_date = new Date().toISOString().split('T')[0];
      patch.loss_reason = null;
    } else if (isClosedStage(deal.deal_stage)) {
      // Dragged out of Won/Lost = reopened
      patch.actual_close_date = null;
      patch.loss_reason = null;
    }

    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, ...patch } : d)));

    const { error } = await supabase.from('deals').update(patch).eq('id', deal.id);
    if (error) {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
      toast('Update failed', 'error');
      return;
    }
    const from = DEAL_STAGES.find((s) => s.id === deal.deal_stage)?.name;
    const to = DEAL_STAGES.find((s) => s.id === newStage)?.name;
    await supabase.from('activities').insert({
      owner_id: deal.owner_id,
      deal_id: deal.id,
      contact_id: deal.primary_contact_id,
      company_id: deal.company_id,
      type: 'stage',
      title: isClosedStage(deal.deal_stage) ? 'Deal reopened' : `Stage → ${to}`,
      body: `Moved from ${from}${isClosedStage(deal.deal_stage) ? ` to ${to}` : ''}`,
    });
    toast(`${deal.name.slice(0, 30)} → ${to}`, 'success');
  }

  function onDealUpdated(d: Deal) {
    setDeals((prev) => prev.map((x) => (x.id === d.id ? d : x)));
  }
  function onPromoteComplete(updated: { deal: Deal; contact?: Contact; company?: Company }) {
    onDealUpdated(updated.deal);
    if (updated.contact) setContacts((prev) => [...prev, updated.contact!]);
    if (updated.company) setCompanies((prev) => [...prev, updated.company!]);
    setPromoting(null);
  }

  const currency = profile?.default_currency || 'ZAR';
  const visibleStages = DEAL_STAGES.filter((s) => visible.includes(s.id));

  return (
    <>
      {/* HEADER: title · metrics · actions */}
      <div className="px-3 sm:px-6 py-3.5 border-b border-white/[0.06] flex flex-wrap items-center gap-x-7 gap-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-none">Deals</h1>
          <div className="text-[11.5px] text-text-muted mt-1">Your unified pipeline</div>
        </div>

        <div className="order-last w-full grid grid-cols-2 gap-y-3 sm:flex sm:gap-y-0 xl:order-none xl:w-auto">
          <Metric
            label="Qualified Pipeline"
            value={fmtCurrencyFull(metrics.totalPipeline, currency)}
            sub={`${metrics.qualifiedCount} deals · ${metrics.earlyCount} in early stages`}
            gradient
          />
          <Metric label="Weighted" value={fmtCurrencyFull(metrics.weighted, currency)} sub="By stage probability" />
          <Metric
            label="Won 30d"
            value={fmtCurrencyFull(metrics.wonRecent, currency)}
            sub="Annualised"
            highlight="success"
          />
          <Metric label="Active MRR" value={fmtCurrencyFull(metrics.activeMRR, currency)} sub="From won retainers" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ExportMenu />
          <button
            onClick={() => setCreating(true)}
            className="px-3 sm:px-4 py-1.5 bg-brand-gradient text-deep-navy font-semibold text-xs rounded-pill hover:brightness-110 transition inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Deal
          </button>
        </div>
      </div>

      {/* FILTER BAR + BOARD (one DndContext so chips are drop targets) */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="flex-1 min-h-0 overflow-auto px-3 sm:px-6 pt-4 pb-5 flex flex-col gap-3">
          <StageFilterBar
            visible={visible}
            counts={counts}
            dragging={!!activeDragId}
            onToggle={toggleStage}
            onPreset={updateVisible}
          />
          <div
            className="flex-1 min-h-[300px] grid gap-2.5 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${visibleStages.length}, minmax(260px, 1fr))` }}
          >
            {visibleStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={deals.filter((d) => d.deal_stage === stage.id)}
                contacts={contacts}
                companies={companies}
                profiles={profiles}
                onCardClick={openDeal}
                onHide={visible.length > 1 ? () => toggleStage(stage.id) : undefined}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeDeal ? (
            <div className="w-[260px] rotate-[1.5deg] cursor-grabbing">
              <DealCardBody deal={activeDeal} contacts={contacts} companies={companies} profiles={profiles} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* DRAWER + MODALS */}
      {drawerDeal && (
        <DealDrawer
          deal={drawerDeal}
          contacts={contacts}
          companies={companies}
          profiles={profiles}
          onClose={() => {
            setDrawerId(null);
            clearDeepLink();
          }}
          onEdit={() => setEditingDeal(drawerDeal)}
          onMarkLost={() => setMarkingLost(drawerDeal)}
          onMove={(to) => moveDeal(drawerDeal, to.id)}
          onUpdated={onDealUpdated}
        />
      )}

      {(creating || editingDeal) && (
        <DealModal
          deal={editingDeal}
          contacts={contacts}
          companies={companies}
          profiles={profiles}
          currentUserId={currentUserId}
          defaultCurrency={currency}
          onCompanyCreated={(c) => setCompanies((prev) => [...prev, c])}
          onClose={() => {
            setCreating(false);
            setEditingDeal(null);
          }}
          onSaved={(d) => {
            if (editingDeal) onDealUpdated(d);
            else {
              setDeals((prev) => [d, ...prev]);
              // make sure the new deal is on screen
              if (!visible.includes(d.deal_stage)) updateVisible([...visible, d.deal_stage]);
            }
            setCreating(false);
            setEditingDeal(null);
          }}
        />
      )}

      {viewingClosed && (
        <ClosedDealModal
          deal={viewingClosed}
          companies={companies}
          contacts={contacts}
          profiles={profiles}
          isDirector={!!profile?.is_director}
          onClose={() => {
            setViewingClosed(null);
            clearDeepLink();
          }}
          onEdit={() => {
            setEditingDeal(viewingClosed);
            setViewingClosed(null);
          }}
          onUpdated={(d) => {
            onDealUpdated(d);
            setViewingClosed(null);
          }}
          onDeleted={(id) => {
            setDeals((prev) => prev.filter((d) => d.id !== id));
            setViewingClosed(null);
            clearDeepLink();
          }}
        />
      )}

      {promoting && (
        <PromoteModal
          deal={promoting.deal}
          newStage={promoting.newStage}
          contacts={contacts}
          companies={companies}
          onClose={() => setPromoting(null)}
          onComplete={onPromoteComplete}
        />
      )}

      {markingLost && (
        <LossModal
          deal={markingLost}
          onClose={() => setMarkingLost(null)}
          onComplete={(d) => {
            onDealUpdated(d);
            setMarkingLost(null);
          }}
        />
      )}

      <Toaster />
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  gradient,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient?: boolean;
  highlight?: 'success';
}) {
  return (
    <div className="min-w-0 sm:px-6 sm:border-l border-white/[0.06] sm:first:pl-0 sm:first:border-l-0 xl:first:pl-6 xl:first:border-l">
      <div className="font-mono text-[9px] font-semibold tracking-[0.15em] text-text-muted mb-1 uppercase truncate">
        {label}
      </div>
      <div
        className={cn(
          'text-[20px] font-extrabold tracking-tight leading-none tabular-nums truncate',
          gradient ? 'gradient-text' : highlight === 'success' ? 'text-accent-2' : 'text-text-primary',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-text-muted mt-1 truncate">{sub}</div>}
    </div>
  );
}
