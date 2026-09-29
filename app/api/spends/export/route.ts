import { categoryName } from '@/lib/categories';
import { requireUser, route } from '@/lib/server/http';
import { listSpends } from '@/lib/server/spends';

// Cells starting with = + - @ are neutralised so spreadsheets never execute them.
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = route(async () => {
  const user = await requireUser();
  const spends = await listSpends(user.id, '2000-01-01', '9999-12-31', 100_000);
  const rows = [['date', 'amount', 'currency', 'title', 'category', 'note', 'heard']];
  for (const s of [...spends].reverse()) {
    rows.push([s.date, String(s.amount), user.currency, s.title, categoryName(s.category), s.note, s.heard]);
  }
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="spends-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
