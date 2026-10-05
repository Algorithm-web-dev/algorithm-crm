import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { EXPORT_COLUMNS, buildDealsWorkbook, type ExportRow } from '@/lib/exportWorkbook';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { type Deal, type Profile, annualisedValue, getStage, profileName } from '@/types';

// ============================================================================
//  GET /api/export/deals — deals for the finance tracker.
//
//  Auth (either):
//    - signed in to the CRM (the Export → Excel / CSV menu on the Deals page), or
//    - an API key matching EXPORT_API_KEY, sent as `Authorization: Bearer <key>`
//      or `?key=<key>` (for Excel → Data → From Web, which can't set headers).
//
//  Query params:
//    format=xlsx (default — Excel workbook) | csv | json
//    status=all (default) | open | won | lost
// ============================================================================

export const dynamic = 'force-dynamic';

const COLUMNS = EXPORT_COLUMNS;

type Row = ExportRow;

function keyMatches(given: string | null): boolean {
  const expected = process.env.EXPORT_API_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function csvCell(v: string | number): string {
  if (typeof v === 'number') return String(v);
  // Neutralise spreadsheet formulas in user-entered text (CSV injection)
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;

  let supabase;
  if (keyMatches(bearer) || keyMatches(params.get('key'))) {
    supabase = createAdminClient();
  } else {
    supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase.from('deals').select('*').order('created_at', { ascending: false });
  const status = params.get('status') ?? 'all';
  if (status === 'open') query = query.not('deal_stage', 'in', '(won,lost)');
  else if (status === 'won' || status === 'lost') query = query.eq('deal_stage', status);
  else if (status !== 'all') {
    return NextResponse.json({ error: 'status must be all, open, won or lost' }, { status: 400 });
  }

  const [{ data: deals, error }, { data: profiles }] = await Promise.all([
    query,
    supabase.from('profiles').select('*'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profileMap = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));

  const rows: Row[] = ((deals ?? []) as Deal[]).map((d) => {
    const owner = profileMap.get(d.deal_owner_id);
    const stage = getStage(d.deal_stage);
    return {
      'Deal ID': d.id,
      'Deal Name': d.name,
      Stage: stage.name,
      'Deal Owner': profileName(owner),
      'Deal Owner Email': owner?.email ?? '',
      Currency: d.currency,
      'Monthly Value': Number(d.monthly_value) || 0,
      'One-off Value': Number(d.one_off_value) || 0,
      'Deal Value (12 x Monthly + One-off)': annualisedValue({
        monthly_value: Number(d.monthly_value),
        one_off_value: Number(d.one_off_value),
      }),
      'Probability (%)': stage.prob,
      'Expected Close Date': d.expected_close_date ?? '',
      'Last Updated': d.updated_at,
    };
  });

  const format = params.get('format') ?? 'xlsx';
  const date = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    return NextResponse.json({ generated_at: new Date().toISOString(), count: rows.length, deals: rows });
  }

  if (format === 'xlsx') {
    const body = await buildDealsWorkbook(rows);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="algorithm-crm-deals-${date}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format !== 'csv') {
    return NextResponse.json({ error: 'format must be xlsx, csv or json' }, { status: 400 });
  }

  const lines = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))];
  // BOM so Excel reads the file as UTF-8
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="algorithm-crm-deals-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

