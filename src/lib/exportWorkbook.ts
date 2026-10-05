import ExcelJS from 'exceljs';

export const EXPORT_COLUMNS = [
  'Deal ID',
  'Deal Name',
  'Stage',
  'Deal Owner',
  'Deal Owner Email',
  'Currency',
  'Monthly Value',
  'One-off Value',
  'Deal Value (12 x Monthly + One-off)',
  'Probability (%)',
  'Expected Close Date',
  'Last Updated',
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string | number>;

// Finance-ready workbook: typed numbers/dates, probability as a real percentage
// (so Value × Probability works directly), frozen bold header with filters.
export async function buildDealsWorkbook(rows: ExportRow[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Algorithm CRM';
  wb.created = new Date();
  const ws = wb.addWorksheet('Deals', { views: [{ state: 'frozen', ySplit: 1 }] });

  const money = '#,##0';
  ws.columns = [
    { header: 'Deal ID', key: 'id', width: 38 },
    { header: 'Deal Name', key: 'name', width: 36 },
    { header: 'Stage', key: 'stage', width: 13 },
    { header: 'Deal Owner', key: 'owner', width: 18 },
    { header: 'Deal Owner Email', key: 'ownerEmail', width: 30 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Monthly Value', key: 'monthly', width: 15, style: { numFmt: money } },
    { header: 'One-off Value', key: 'oneOff', width: 15, style: { numFmt: money } },
    { header: 'Deal Value (12 x Monthly + One-off)', key: 'value', width: 22, style: { numFmt: money } },
    { header: 'Probability', key: 'prob', width: 12, style: { numFmt: '0%' } },
    { header: 'Expected Close Date', key: 'close', width: 18, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Last Updated', key: 'updated', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
  ];

  for (const r of rows) {
    const close = r['Expected Close Date'];
    ws.addRow({
      id: r['Deal ID'],
      name: r['Deal Name'],
      stage: r.Stage,
      owner: r['Deal Owner'],
      ownerEmail: r['Deal Owner Email'],
      currency: r.Currency,
      monthly: r['Monthly Value'],
      oneOff: r['One-off Value'],
      value: r['Deal Value (12 x Monthly + One-off)'],
      prob: Number(r['Probability (%)']) / 100,
      close: close ? new Date(`${close}T00:00:00Z`) : null,
      updated: new Date(String(r['Last Updated'])),
    });
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
