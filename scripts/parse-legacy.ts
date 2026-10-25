import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const filePath = path.resolve(process.cwd(), '[Lighter] Costing Badminton.xlsx');
const workbook = XLSX.readFile(filePath);

interface SheetSummary {
  sheetName: string;
  members: string[];
  expenses: { title: string; amount: number; paidBy: string; shares: Record<string, number> }[];
  debtBalances: Record<string, number>;
  totalDebtSum: number;
}

const allSummaries: SheetSummary[] = [];

for (const name of workbook.SheetNames) {
  if (name === 'Note') continue;
  const ws = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

  // 1. Locate member row (usually row 7 or 8 with names starting at column H (index 7))
  let memberRowIdx = -1;
  let members: string[] = [];

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    if (!row) continue;
    // Check if column G or D has keywords like 'Thành viên'
    const colG = String(row[6] || '');
    if (colG.includes('Thành viên') || colG.includes('Tổng ứng trước') || colG.includes('Tổng chi')) {
      // Members are in the row just above or current row
      const targetRow = colG.includes('Thành viên') ? row : rows[r - 1] || row;
      const extracted: string[] = [];
      for (let c = 7; c < targetRow.length; c++) {
        const val = targetRow[c];
        if (val && typeof val === 'string' && val.trim()) {
          extracted.push(val.trim());
        }
      }
      if (extracted.length > 0) {
        memberRowIdx = r;
        members = extracted;
        break;
      }
    }
  }

  // Fallback for members
  if (members.length === 0) {
    for (let r = 2; r < 8; r++) {
      const row = rows[r];
      if (!row) continue;
      const potential = [];
      for (let c = 7; c < (row.length || 0); c++) {
        const val = row[c];
        if (val && typeof val === 'string' && val.trim() && isNaN(Number(val))) {
          potential.push(val.trim());
        }
      }
      if (potential.length >= 3) {
        members = potential;
        break;
      }
    }
  }

  // 2. Locate Dư nợ row
  let debtBalances: Record<string, number> = {};
  let totalDebtSum = 0;

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    if (!row) continue;
    const colG = String(row[6] || '');
    if (colG.includes('Dư nợ') || colG.includes('Số tiền')) {
      for (let c = 0; c < members.length; c++) {
        const rawVal = row[7 + c];
        const num = typeof rawVal === 'number' ? Math.round(rawVal) : 0;
        debtBalances[members[c]] = num;
        totalDebtSum += num;
      }
      break;
    }
  }

  // 3. Locate expense rows (from row 11 to max)
  const expenses: SheetSummary['expenses'] = [];
  for (let r = 10; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const amountVal = row[2]; // Col C
    const paidByVal = row[3]; // Col D
    const titleVal = row[6] || row[4] || ''; // Col G or E

    if (typeof amountVal === 'number' && amountVal > 0 && typeof titleVal === 'string' && titleVal.trim()) {
      const shares: Record<string, number> = {};
      for (let c = 0; c < members.length; c++) {
        const shareVal = row[7 + c];
        if (typeof shareVal === 'number') {
          shares[members[c]] = Math.round(shareVal);
        }
      }
      expenses.push({
        title: titleVal.trim(),
        amount: Math.round(amountVal),
        paidBy: String(paidByVal || '').trim(),
        shares,
      });
    }
  }

  allSummaries.push({
    sheetName: name,
    members,
    expenses,
    debtBalances,
    totalDebtSum,
  });
}

fs.writeFileSync(
  path.resolve(process.cwd(), 'lib/legacyData.json'),
  JSON.stringify(allSummaries, null, 2),
  'utf-8'
);

console.log('Successfully parsed', allSummaries.length, 'sheets to lib/legacyData.json');
