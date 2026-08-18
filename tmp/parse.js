const XLSX = require('d:/niuma/tmp/node_modules/xlsx');
const fs = require('fs');
const wb = XLSX.readFile('d:/niuma/部门.xls');
let out = '';
const log = s => { out += s + '\n'; };
for (const name of wb.SheetNames) {
  log('=== Sheet: ' + name + ' ===');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  rows.forEach((r, i) => {
    const line = r.map(c => String(c).replace(/\s+/g, ' ')).join(' | ');
    if (line.replace(/[ |\t]/g, '')) log(i + ': ' + line);
  });
}
fs.writeFileSync('d:/niuma/tmp/departments.txt', out, 'utf8');
