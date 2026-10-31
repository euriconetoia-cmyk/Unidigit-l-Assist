// Gerador de planilha Excel (.xlsx) sem dependências: monta o ZIP (sem compressão) e o XML na mão. Só texto e números; nunca fórmulas.
// Ideia de partida: projeto "SENAI Extensões" (Julio Alves, MIT) — reescrito aqui com testes. Funções puras (sem DOM), testadas em tests/xlsx.test.js.
(function (root) {
  'use strict';
  const ALN = root.ALN;
  const enc = new TextEncoder();

  // remove caracteres que o XML não aceita e escapa os especiais
  const xml = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  function colName(index) { let n = index + 1, s = ''; while (n > 0) { n -= 1; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }

  // nome de aba: sem \ / ? * [ ] :, até 31 caracteres, único sem diferenciar maiúsculas
  function sheetNames(list) {
    const used = new Set();
    return list.map((raw, i) => {
      const base = String(raw || '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31) || `Planilha${i + 1}`;
      let name = base, k = 2;
      while (used.has(name.toLowerCase())) { const extra = ` (${k++})`; name = `${base.slice(0, 31 - extra.length)}${extra}`; }
      used.add(name.toLowerCase());
      return name;
    });
  }

  function cellXml(ref, value, style) {
    if (value === null || value === undefined || value === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
    if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${style ? ` s="${style}"` : ' s="2"'}><v>${value}</v></c>` : '';
    return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }

  function widthsFor(rows) {
    const max = [];
    rows.forEach(r => r.forEach((v, c) => { const len = v == null ? 0 : String(v).split('\n').reduce((m, l) => Math.max(m, l.length), 0); max[c] = Math.max(max[c] || 0, len); }));
    return max.map(len => Math.min(60, Math.max(10, len + 2)));
  }

  function sheetXml(sheet) {
    const rows = sheet.rows || [];
    const widths = sheet.widths || widthsFor(rows);
    const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const header = sheet.header !== false && rows.length > 0;
    const data = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cellXml(`${colName(ci)}${ri + 1}`, v, header && ri === 0 ? 1 : 0)).join('')}</row>`).join('');
    const lastCol = colName(Math.max(0, (rows[0] ? rows[0].length : 1) - 1));
    const view = header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const filter = header && rows.length > 1 ? `<autoFilter ref="A1:${lastCol}${rows.length}"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${data}</sheetData>${filter}</worksheet>`;
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5CAD"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  // ---- ZIP sem compressão ----
  const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(data) { let c = 0xFFFFFFFF; for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const u16 = v => Uint8Array.of(v & 255, (v >>> 8) & 255);
  const u32 = v => Uint8Array.of(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  function concat(parts) { const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
  function zip(files, now = new Date()) {
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const local = [], central = []; let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), data = typeof f.content === 'string' ? enc.encode(f.content) : f.content, crc = crc32(data);
      const lh = concat([u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
      local.push(lh, data);
      central.push(concat([u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
      offset += lh.length + data.length;
    });
    const cd = concat(central);
    return concat([...local, cd, concat([u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])]);
  }

  // sheets: [{ name, rows: [[...]], header = true, widths? }] → Uint8Array (.xlsx)
  function build(sheets, now) {
    const list = (sheets && sheets.length ? sheets : [{ name: 'Planilha', rows: [] }]);
    const names = sheetNames(list.map(s => s.name));
    const overrides = list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const rels = list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('');
    const files = [
      { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>` },
      { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', content: STYLES },
      ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s) }))
    ];
    return zip(files, now);
  }
  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  ALN.xlsx = { build, sheetNames, colName, crc32, MIME };
})(globalThis);
