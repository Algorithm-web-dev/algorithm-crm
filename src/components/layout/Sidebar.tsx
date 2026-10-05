'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/types';

export type SidebarMode = 'auto' | 'expanded' | 'collapsed';

interface SidebarProps {
  userName: string;
  userEmail: string;
  unreadCount: number;
  lostCount: number;
  // auto = icon rail on laptops, full width on large monitors (≥1800px)
  mode: SidebarMode;
  onToggle?: () => void; // desktop collapse/expand
  onClose?: () => void; // mobile drawer
}

const NAV = [
  {
    label: 'Pipeline',
    items: [
      { href: '/deals', name: 'Deals', icon: KanbanIcon },
      { href: '/lost', name: 'Lost', icon: LostIcon },
      { href: '/notifications', name: 'Notifications', icon: BellIcon },
    ],
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

export default function Sidebar({ userName, userEmail, unreadCount, lostCount, mode, onToggle, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = initialsOf(userName.split(' ')[0], userName.split(' ')[1] ?? '');

  // Labels/headings: always shown when expanded, never in the icon rail,
  // and from 3xl (≥1800px) up in auto mode.
  const label = mode === 'expanded' ? '' : mode === 'collapsed' ? 'hidden' : 'hidden 3xl:block';
  const railOnly = mode === 'expanded' ? 'hidden' : mode === 'collapsed' ? '' : '3xl:hidden';
  const width = mode === 'expanded' ? 'w-[220px]' : mode === 'collapsed' ? 'w-16' : 'w-16 3xl:w-[220px]';

  return (
    <aside
      className={cn(
        'h-full bg-deep-navy border-r border-white/[0.06] flex flex-col py-4 px-3 flex-shrink-0 transition-[width] duration-200',
        width,
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="w-6 h-6 rounded-md bg-brand-gradient flex items-center justify-center text-deep-navy font-extrabold text-sm flex-shrink-0">
          A
        </div>
        <div className={cn('font-bold text-base tracking-tight whitespace-nowrap', label)}>
          Algorithm<span className="text-text-muted font-normal"> CRM</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 text-text-muted hover:text-text-primary" aria-label="Close menu">
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[18px]">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className={cn('font-mono text-[9px] font-semibold tracking-[0.2em] text-text-muted px-2 mb-2', label)}>
              {section.label.toUpperCase()}
            </div>
            <div className={cn('border-t border-white/[0.06] mx-2 mb-2', railOnly)} />
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              const badge = item.href === '/notifications' && unreadCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  onClick={onClose}
                  className={cn(
                    'relative flex items-center gap-2 px-2 py-2 rounded-md text-xs font-medium mb-0.5 transition-colors',
                    active
                      ? 'bg-accent/10 border border-accent/20 text-text-primary'
                      : 'border border-transparent text-text-sub hover:bg-white/[0.03] hover:text-text-primary',
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-accent' : 'opacity-70')} />
                  <span className={cn('whitespace-nowrap', label)}>{item.name}</span>
                  {item.href === '/lost' && lostCount > 0 && (
                    <span className={cn('ml-auto font-mono text-[10px] text-text-muted', label)}>{lostCount}</span>
                  )}
                  {badge && (
                    <>
                      <span
                        className={cn(
                          'ml-auto font-mono text-[9px] font-semibold bg-accent text-deep-navy px-1.5 py-0.5 rounded-full',
                          label,
                        )}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                      <span className={cn('absolute top-1 left-6 w-2 h-2 rounded-full bg-accent', railOnly)} />
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {onToggle && (
        <button
          onClick={onToggle}
          title="Collapse / expand sidebar"
          aria-label="Collapse or expand sidebar"
          className="flex items-center gap-2 px-2 py-2 mb-2 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
        >
          <ChevronsIcon className={cn('w-4 h-4 flex-shrink-0 transition-transform', mode === 'expanded' && 'rotate-180', mode === 'auto' && '3xl:rotate-180')} />
          <span className={cn('whitespace-nowrap', label)}>Collapse</span>
        </button>
      )}

      <div className="pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 px-1 py-1.5 group">
          <div
            className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-deep-navy font-bold text-[10px] flex-shrink-0"
            title={`${userName} — ${userEmail}`}
          >
            {initials}
          </div>
          <div className={cn('flex-1 min-w-0', label)}>
            <div className="text-xs font-medium text-text-primary truncate">{userName}</div>
            <div className="text-[10px] text-text-muted truncate">{userEmail}</div>
          </div>
          <button
            onClick={handleSignOut}
            className={cn(
              'text-text-muted hover:text-text-primary p-1 rounded transition',
              onClose ? '' : 'opacity-0 group-hover:opacity-100',
              label,
            )}
            title="Sign out"
          >
            <SignOutIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChevronsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" />
      <polyline points="6 17 11 12 6 7" />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
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
export function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function LostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
