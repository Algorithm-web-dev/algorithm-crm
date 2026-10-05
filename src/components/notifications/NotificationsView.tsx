'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Notification, relTime } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function NotificationsView({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.read_at);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    await createClient().from('notifications').update({ read_at: now }).in('id', ids);
    router.refresh(); // update the sidebar badge
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-5 py-3 border-b border-white/[0.06]">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Notifications</h1>
        <span className="text-xs text-text-muted">Deal stage alerts for the whole team</span>
        {unread.length > 0 && (
          <button
            onClick={() => markRead(unread.map((n) => n.id))}
            className="ml-auto text-xs font-medium text-accent hover:text-accent/80 px-3 py-1.5 rounded-lg border border-accent/20 hover:border-accent/40"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-5">
        {items.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-2xl font-extrabold text-text-primary mb-2">No notifications</p>
            <p className="text-sm">Deal stage alerts will show up here. Configure them under Automations.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-2">
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.deal_id ? `/deals?deal=${n.deal_id}` : '/deals'}
                onClick={() => !n.read_at && markRead([n.id])}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border transition-colors',
                  n.read_at
                    ? 'bg-deep-navy/40 border-white/[0.04] hover:border-white/10'
                    : 'bg-slate-light border-accent/30 hover:border-accent/50',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 w-2 h-2 rounded-full flex-shrink-0',
                    n.read_at
                      ? 'bg-transparent'
                      : n.kind === 'stalled'
                      ? 'bg-priority-medium'
                      : n.kind === 'deleted'
                      ? 'bg-priority-high'
                      : 'bg-accent',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary">{n.title}</div>
                  {n.body && <div className="text-xs text-text-sub mt-0.5">{n.body}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
                    {n.kind === 'stalled' ? 'Stalled' : n.kind === 'deleted' ? 'Deleted' : 'Stage change'}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">{relTime(n.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
