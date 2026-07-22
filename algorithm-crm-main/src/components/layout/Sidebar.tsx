'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/types';

interface SidebarProps {
  userName: string;
  userEmail: string;
}

const NAV = [
  {
    label: 'Pipeline',
    items: [{ href: '/deals', name: 'Deals', icon: KanbanIcon }],
  },
  {
    label: 'Records',
    items: [
      { href: '/contacts', name: 'Contacts', icon: UsersIcon },
      { href: '/companies', name: 'Companies', icon: BuildingIcon },
    ],
  },
  {
    label: 'Other',
    items: [
      { href: '/automations', name: 'Automations', icon: BoltIcon },
      { href: '/settings', name: 'Settings', icon: SettingsIcon },
    ],
  },
];

export default function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = initialsOf(userName.split(' ')[0], userName.split(' ')[1] ?? '');

  return (
    <aside className="bg-deep-navy border-r border-white/[0.06] flex flex-col py-4 px-3">
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="w-6 h-6 rounded-md bg-brand-gradient flex items-center justify-center text-deep-navy font-extrabold text-sm">
          A
        </div>
        <div className="font-bold text-base tracking-tight">
          Algorithm<span className="text-text-muted font-normal"> CRM</span>
        </div>
      </div>

      {NAV.map((section) => (
        <div key={section.label} className="mb-4">
          <div className="font-mono text-[9px] font-semibold tracking-[0.2em] text-text-muted px-2 mb-2">
            {section.label.toUpperCase()}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium mb-0.5 transition-colors',
                  active
                    ? 'bg-accent/10 border border-accent/20 text-text-primary'
                    : 'text-text-sub hover:bg-white/[0.03] hover:text-text-primary',
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', active ? 'text-accent' : 'opacity-70')} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 px-2 py-1.5 group">
          <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-deep-navy font-bold text-[10px] flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text-primary truncate">{userName}</div>
            <div className="text-[10px] text-text-muted truncate">{userEmail}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-text-muted hover:text-text-primary p-1 rounded opacity-0 group-hover:opacity-100 transition"
            title="Sign out"
          >
            <SignOutIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function KanbanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" />
      <rect x="14" y="3" width="7" height="10" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  );
}
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
