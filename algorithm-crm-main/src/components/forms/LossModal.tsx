'use client';

import { useState } from 'react';
import { type Deal, LOSS_REASONS } from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Select, Textarea, Label, Button } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';

interface Props {
  deal: Deal;
  onClose: () => void;
  onComplete: (d: Deal) => void;
}

export default function LossModal({ deal, onClose, onComplete }: Props) {
  const [reason, setReason] = useState<string>(LOSS_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const patch = {
      deal_stage: 'lost' as const,
      loss_reason: reason,
      actual_close_date: new Date().toISOString().split('T')[0],
      last_activity_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', deal.id)
      .select()
      .single();

    if (error) {
      toast('Update failed', 'error');
      setLoading(false);
      return;
    }

    await supabase.from('activities').insert({
      owner_id: user.id,
      deal_id: deal.id,
      contact_id: deal.primary_contact_id,
      company_id: deal.company_id,
      type: 'stage',
      title: `Deal lost — ${reason}`,
      body: notes || null,
    });

    setLoading(false);
    toast('Marked as lost', 'error');
    onComplete(data as Deal);
  }

  return (
    <Modal
      title="Mark deal as Lost"
      subtitle="Loss reason helps improve your pipeline over time"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Mark as Lost'}
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <Label required>Loss reason</Label>
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {LOSS_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did we learn?"
        />
      </div>
    </Modal>
  );
}
