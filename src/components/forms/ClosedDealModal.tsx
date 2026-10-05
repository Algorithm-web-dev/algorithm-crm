'use client';

import { useState } from 'react';
import {
  type Deal,
  type Company,
  type Contact,
  type Profile,
  type DealStageId,
  DEAL_STAGES,
  annualisedValue,
  fmtCurrencyFull,
  isEarlyStage,
  profileName,
} from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Select, Label, Button } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';
import DeleteDealModal from './DeleteDealModal';

interface Props {
  deal: Deal; // won or lost
  companies: Company[];
  contacts: Contact[];
  profiles: Profile[];
  isDirector: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdated: (deal: Deal) => void;
  onDeleted: (dealId: string) => void;
}

// Read-only summary for closed deals. Changes are deliberate: Edit, Reopen
// (Lost only) or Delete (Lost only, directors only).
export default function ClosedDealModal({
  deal,
  companies,
  contacts,
  profiles,
  isDirector,
  onClose,
  onEdit,
  onUpdated,
  onDeleted,
}: Props) {
  const isLost = deal.deal_stage === 'lost';
  // A deal without a company can only go back to an early stage — moving it
  // further goes through the normal promote flow on the board.
  const reopenStages = DEAL_STAGES.filter(
    (s) => s.id !== 'won' && s.id !== 'lost' && (deal.company_id || isEarlyStage(s.id)),
  );
  const [reopenStage, setReopenStage] = useState<DealStageId>('inbox');
  const [reopening, setReopening] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const company = companies.find((c) => c.id === deal.company_id);
  const contact = contacts.find((c) => c.id === deal.primary_contact_id);
  const owner = profiles.find((p) => p.id === deal.deal_owner_id);
  const value = annualisedValue(deal);

  async function handleReopen() {
    setReopening(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('deals')
      .update({
        deal_stage: reopenStage,
        loss_reason: null,
        actual_close_date: null,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', deal.id)
      .select()
      .single();
    if (error) {
      toast(error.message || 'Reopen failed', 'error');
      setReopening(false);
      return;
    }
    const stageName = DEAL_STAGES.find((s) => s.id === reopenStage)?.name;
    await supabase.from('activities').insert({
      owner_id: user?.id ?? deal.owner_id,
      deal_id: deal.id,
      contact_id: deal.primary_contact_id,
      company_id: deal.company_id,
      type: 'stage',
      title: 'Deal reopened',
      body: `Moved back to ${stageName} from Lost`,
    });
    toast(`${deal.name.slice(0, 30)} reopened in ${stageName}`, 'success');
    onUpdated(data as Deal);
  }

  if (deleting) {
    return <DeleteDealModal deal={deal} onClose={() => setDeleting(false)} onDeleted={onDeleted} />;
  }

  const rows: [string, string][] = [
    ['Deal owner', profileName(owner)],
    ['Company', company?.name || deal.lead_company_name || '—'],
    [
      'Contact',
      contact
        ? `${contact.first_name} ${contact.last_name ?? ''}`.trim()
        : [deal.lead_first_name, deal.lead_last_name].filter(Boolean).join(' ') || '—',
    ],
    ['Value', value > 0 ? fmtCurrencyFull(value, deal.currency) : '—'],
    [isLost ? 'Lost on' : 'Won on', deal.actual_close_date || '—'],
  ];
  if (isLost) rows.splice(1, 0, ['Loss reason', deal.loss_reason || '—']);

  return (
    <Modal
      title={deal.name}
      subtitle={isLost ? 'Lost deal — closed' : 'Won deal — closed'}
      onClose={onClose}
      footer={
        <>
          {isLost && isDirector && (
            <Button variant="danger" onClick={() => setDeleting(true)} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[130px_1fr] gap-y-2.5 text-sm mb-5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-text-muted pt-0.5">{k}</dt>
            <dd className="text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
      {deal.notes && (
        <div className="mb-5">
          <Label>Notes</Label>
          <p className="text-sm text-text-sub whitespace-pre-wrap">{deal.notes}</p>
        </div>
      )}

      {isLost && (
        <div className="pt-4 border-t border-white/[0.06]">
          <Label>Reopen into</Label>
          <div className="flex gap-2">
            <Select value={reopenStage} onChange={(e) => setReopenStage(e.target.value as DealStageId)}>
              {reopenStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={handleReopen} disabled={reopening} className="flex-shrink-0">
              {reopening ? 'Reopening…' : 'Reopen deal'}
            </Button>
          </div>
          {!deal.company_id && (
            <p className="text-xs text-text-muted mt-1.5">
              No company linked, so it reopens as a lead. Drag it forward on the board to promote it.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
