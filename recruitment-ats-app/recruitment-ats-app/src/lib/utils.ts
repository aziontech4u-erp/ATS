// ─────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────

import type { Stage } from './types';

export function getInitials(name: string = ''): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??'
  );
}

export function avatarColor(name: string = ''): string {
  const colors = [
    '#2756e8', '#0891b2', '#7c3aed', '#15803d',
    '#d97706', '#dc2626', '#0f766e', '#1d4ed8'
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % colors.length;
  return colors[h];
}

export function stageColors(s: Stage): { bg: string; fg: string; label: string } {
  const map: Record<Stage, { bg: string; fg: string; label: string }> = {
    applied:   { bg: '#eff3ff', fg: '#2756e8', label: 'Applied' },
    screening: { bg: '#ede9fe', fg: '#6d28d9', label: 'Screening' },
    interview: { bg: '#fef3c7', fg: '#b45309', label: 'Interview' },
    offer:     { bg: '#d1fae5', fg: '#065f46', label: 'Offer' },
    hired:     { bg: '#ccfbf1', fg: '#0f766e', label: 'Hired' },
    rejected:  { bg: '#fee2e2', fg: '#991b1b', label: 'Rejected' }
  };
  return map[s] || { bg: '#f7f9ff', fg: '#7b8db0', label: s };
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#15803d';
  if (score >= 60) return '#d97706';
  return '#dc2626';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong Match';
  if (score >= 60) return 'Good Potential';
  return 'Needs Review';
}

export function formatDate(d: string | Date): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateTime(d: string | Date): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount: number, currency: string = 'OMR'): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'OMR' ? 3 : 2,
    maximumFractionDigits: currency === 'OMR' ? 3 : 2
  })}`;
}

export function timeAgo(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(d);
}

export function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const s = val == null ? '' : String(val);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',')
    )
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ─── EXCEL EXPORT ─────────────────────────────────────────────
// Lazy-loads xlsx (SheetJS) so it doesn't bloat the initial bundle
export async function downloadExcel(
  rows: any[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  if (!rows.length) return;
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-size columns based on content length
  const colWidths = Object.keys(rows[0]).map((key) => ({
    wch: Math.min(
      Math.max(
        key.length,
        ...rows.map((r) => String(r[key] ?? '').length)
      ) + 2,
      60
    )
  }));
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ─── PDF EXPORT ───────────────────────────────────────────────
// Lazy-loads jsPDF + autotable for a styled tabular PDF
export async function downloadPDF(
  rows: any[],
  filename: string,
  title: string,
  columns?: { header: string; key: string; width?: number }[]
) {
  if (!rows.length) return;
  const { jsPDF } = await import('jspdf');
  // jspdf-autotable v5 exposes a function: autoTable(doc, opts)
  const autoTableMod: any = await import('jspdf-autotable');
  const autoTable = autoTableMod.default || autoTableMod.autoTable || autoTableMod;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cols = columns || Object.keys(rows[0]).map((k) => ({ header: k, key: k }));

  // Title bar
  doc.setFillColor(39, 86, 232); // brand-500
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 12);

  // Sub-line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleString('en-GB')}  ·  ${rows.length} records`,
    14,
    23
  );
  doc.setTextColor(15, 23, 41);

  // Table — works with both function-style and method-style invocation
  const tableOpts = {
    head: [cols.map((c) => c.header)],
    body: rows.map((r) => cols.map((c) => String(r[c.key] ?? ''))),
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' as const },
    headStyles: { fillColor: [39, 86, 232] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [239, 243, 255] as [number, number, number] },
    margin: { top: 28, left: 8, right: 8 }
  };
  if (typeof autoTable === 'function') {
    autoTable(doc, tableOpts);
  } else if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(tableOpts);
  } else {
    throw new Error('jspdf-autotable not available');
  }

  doc.save(filename);
}
