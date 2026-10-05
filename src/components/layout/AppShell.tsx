'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar, { BellIcon, MenuIcon, type SidebarMode } from './Sidebar';

interface Props {
  userName: string;
  userEmail: string;
  unreadCount: number;
  children: React.ReactNode;
}

const STORAGE_KEY = 'crm.sidebar';

// Layout for every signed-in page:
//  - lg+ (≥1024px): fixed sidebar — icon rail on laptops, full on ≥1800px,
//    with a toggle that is remembered per browser.
//  - below lg: top bar with a menu button that opens the sidebar as a drawer.
export default function AppShell({ userName, userEmail, unreadCount, children }: Props) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>('auto');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'expanded' || saved === 'collapsed') setMode(saved);
    } catch {
      // storage unavailable — stay on auto
    }
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  function toggleSidebar() {
    const wide = window.matchMedia('(min-width: 1800px)').matches;
    const current = mode === 'auto' ? (wide ? 'expanded' : 'collapsed') : mode;
    const next = current === 'expanded' ? 'collapsed' : 'expanded';
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const shared = { userName, userEmail, unreadCount };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-deep-navy">
      <div className="hidden lg:flex">
        <Sidebar {...shared} mode={mode} onToggle={toggleSidebar} />
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full shadow-2xl">
            <Sidebar {...shared} mode="expanded" onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-3 px-4 h-12 border-b border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 -ml-1.5 text-text-sub hover:text-text-primary"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-gradient flex items-center justify-center text-deep-navy font-extrabold text-sm">
              A
            </div>
            <span className="font-bold text-sm tracking-tight">
              Algorithm<span className="text-text-muted font-normal"> CRM</span>
            </span>
          </div>
          <Link
            href="/notifications"
            className="ml-auto relative p-1.5 text-text-sub hover:text-text-primary"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          >
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-deep-navy font-mono text-[9px] font-semibold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </header>
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
