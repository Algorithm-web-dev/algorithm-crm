'use client';

import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  { label: 'Excel (.xlsx)', hint: 'Formatted spreadsheet for the finance tracker', href: '/api/export/deals' },
  { label: 'CSV', hint: 'Plain text, opens in any spreadsheet tool', href: '/api/export/deals?format=csv' },
];

// Export button with a choice of file format.
export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export deals"
        title="Download all deals (value, owner, probability)"
        className="px-3 sm:px-4 py-1.5 bg-deep-navy border border-white/10 text-text-primary font-semibold text-xs rounded-pill hover:bg-white/[0.04] transition inline-flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="hidden sm:inline">Export</span>
        <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-64 z-40 bg-slate-light border border-white/10 rounded-xl shadow-2xl p-1.5"
        >
          {OPTIONS.map((o) => (
            <a
              key={o.label}
              role="menuitem"
              href={o.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <div className="text-xs font-semibold text-text-primary">{o.label}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{o.hint}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
