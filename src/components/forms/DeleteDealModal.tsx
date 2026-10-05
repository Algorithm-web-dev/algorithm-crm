'use client';

import { useState } from 'react';
import type { Deal } from '@/types';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { Input, Label, Button } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';

interface Props {
  deal: Deal;
  onClose: () => void;
  onDeleted: (dealId: string) => void;
}

// Directors only — the database also enforces this (migration 006).
export default function DeleteDealModal({ deal, onClose, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const matches = confirmText.trim() === deal.name.trim();

  async function handleDelete() {
    setLoading(true);
    const { data, error } = await createClient().from('deals').delete().eq('id', deal.id).select('id');
    setLoading(false);
    if (error) {
      toast(error.message || 'Delete failed', 'error');
      return;
    }
    // RLS silently deletes nothing for non-directors
    if (!data || data.length === 0) {
      toast('Only directors can delete deals', 'error');
      return;
    }
    toast(`Deleted "${deal.name.slice(0, 30)}"`, 'success');
    onDeleted(deal.id);
  }

  return (
    <Modal
      title="Delete deal permanently"
      subtitle="This can't be undone. The deal and its activity history are removed for everyone."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={!matches || loading}>
            {loading ? 'Deleting…' : 'Delete deal'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-sub mb-4">
        Everyone in the CRM and the directors&apos; Google Chat space will be notified that you deleted it.
      </p>
      <Label>
        Type <span className="text-text-primary normal-case">{deal.name}</span> to confirm
      </Label>
      <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
    </Modal>
  );
}
