'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Form';
import { toast } from '@/components/ui/Toaster';

export default function ChatTestButton() {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const res = await fetch('/api/alerts/test-chat', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) toast('Test message sent — check the Google Chat space', 'success');
    else toast(body.error || 'Test failed', 'error');
  }

  return (
    <Button onClick={send} disabled={sending}>
      {sending ? 'Sending…' : 'Send test message'}
    </Button>
  );
}
