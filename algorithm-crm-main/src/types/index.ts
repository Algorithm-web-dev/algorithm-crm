// ============================================================================
//  Domain types for Algorithm CRM
//  Mirrors the Postgres schema in supabase/migrations/001_initial_schema.sql
// ============================================================================

export type DealStageId =
  | 'inbox'
  | 'qualifying'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'verbal'
  | 'won'
  | 'lost';

export type Priority = 'High' | 'Medium' | 'Low';

export type Currency = 'ZAR' | 'GBP' | 'USD' | 'EUR';

export interface DealStage {
  id: DealStageId;
  name: string;
  color: string;
  prob: number;
  early: boolean;
}

export const DEAL_STAGES: DealStage[] = [
  { id: 'inbox',       name: 'Inbox',       color: '#8a94b0', prob: 5,   early: true  },
  { id: 'qualifying',  name: 'Qualifying',  color: '#4f8cff', prob: 15,  early: true  },
  { id: 'discovery',   name: 'Discovery',   color: '#3b82f6', prob: 25,  early: false },
  { id: 'proposal',    name: 'Proposal',    color: '#8a5cff', prob: 45,  early: false },
  { id: 'negotiation', name: 'Negotiation', color: '#a855f7', prob: 65,  early: false },
  { id: 'verbal',      name: 'Verbal',      color: '#db2777', prob: 85,  early: false },
  { id: 'won',         name: 'Won',         color: '#00e0a0', prob: 100, early: false },
  { id: 'lost',        name: 'Lost',        color: '#c1272d', prob: 0,   early: false },
];

export const DEAL_SOURCES = [
  'Website form',
  'Referral',
  'Email',
  'LinkedIn',
  'Cold outreach',
  'Manual',
  'Other',
] as const;

export const LOSS_REASONS = [
  'Price',
  'Timing',
  'Went with competitor',
  'No decision',
  'Not a fit',
  'Other',
] as const;

export const CURRENCIES: Currency[] = ['ZAR', 'GBP', 'USD', 'EUR'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ZAR: 'R',
  GBP: '£',
  USD: '$',
  EUR: '€',
};

// ============================================================================
//  Entities
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  default_currency: Currency;
  created_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  owner_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  role_title: string | null;
  linkedin_url: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  owner_id: string;
  name: string;
  deal_stage: DealStageId;
  priority: Priority;
  source: string | null;
  notes: string | null;

  company_id: string | null;
  primary_contact_id: string | null;

  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_email: string | null;
  lead_company_name: string | null;
  lead_role: string | null;

  monthly_value: number;
  one_off_value: number;
  currency: Currency;
  expected_close_date: string | null;
  actual_close_date: string | null;
  loss_reason: string | null;

  stage_entered_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  owner_id: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  type: 'stage' | 'note' | 'email' | 'task';
  direction: 'inbound' | 'outbound' | null;
  title: string;
  body: string | null;
  created_at: string;
}

export interface AlertRule {
  id: string;
  owner_id: string;
  deal_stage: DealStageId;
  days_threshold: number;
  enabled: boolean;
  created_at: string;
}

export interface AlertFiring {
  id: string;
  owner_id: string;
  deal_id: string;
  rule_id: string;
  deal_stage: DealStageId;
  fired_at: string;
  snoozed_until: string | null;
  dismissed_at: string | null;
  stage_entered_at: string;
}

// ============================================================================
//  Computed helpers
// ============================================================================

export function annualisedValue(deal: Pick<Deal, 'monthly_value' | 'one_off_value'>): number {
  return (deal.monthly_value || 0) * 12 + (deal.one_off_value || 0);
}

export function weightedValue(deal: Pick<Deal, 'monthly_value' | 'one_off_value' | 'deal_stage'>): number {
  const stage = DEAL_STAGES.find((s) => s.id === deal.deal_stage);
  return (annualisedValue(deal) * (stage?.prob ?? 0)) / 100;
}

export function getStage(id: DealStageId): DealStage {
  return DEAL_STAGES.find((s) => s.id === id) ?? DEAL_STAGES[0];
}

export function isEarlyStage(id: DealStageId): boolean {
  return getStage(id).early;
}

export function fmtCurrency(v: number | null | undefined, currency: Currency = 'ZAR'): string {
  if (v == null || v === 0) return '—';
  const sym = CURRENCY_SYMBOLS[currency];
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `${sym}${v.toFixed(0)}`;
}

export function fmtCurrencyFull(v: number | null | undefined, currency: Currency = 'ZAR'): string {
  if (v == null) return '—';
  const sym = CURRENCY_SYMBOLS[currency];
  return sym + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / 86400000);
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = daysBetween(iso) ?? 0;
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function initialsOf(first: string | null | undefined, last: string | null | undefined): string {
  return ((first?.[0] ?? '?') + (last?.[0] ?? '')).toUpperCase();
}
