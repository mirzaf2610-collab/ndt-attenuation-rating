// Shared parsing + rating logic for OmniPC ultrasonic attenuation exports.
// Mirrors the manual Excel workflow (CONVERT TXT -> HITUNG PERSENTASE -> RESULT TABLE).

function parseNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  let s = String(raw).trim();
  if (s === '' || s === '---' || /^nt$/i.test(s) || /^n\/?a$/i.test(s)) return NaN;
  s = s.replace(/\s+/g, '');
  const hasComma = s.indexOf(',') !== -1;
  const hasDot = s.indexOf('.') !== -1;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

// Extracts the flat list of amplitude value strings from an OmniPC .txt export.
// Skips "Key = Value" metadata lines and the "mm ..." position header line.
function parseAmplitudeValues(text) {
  const lines = text.split(/\r\n|\n|\r/);
  const values = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.indexOf('=') !== -1) continue;
    const tokens = trimmed.split(/\t|,/).map((t) => t.trim());
    if (tokens.length < 2) continue;
    if (/^mm$/i.test(tokens[0])) continue;
    for (let i = 1; i < tokens.length; i++) values.push(tokens[i]);
  }
  return values;
}

// Pulls "Data File = P2B ROW A NO 2" style identity out of file content, if present.
function detectIdentityFromText(text) {
  const m = text.match(/Data File\s*=\s*(.+)/i);
  if (!m) return null;
  const rm = m[1].trim().match(/ROW[\s_]*([A-Za-z0-9]+)[\s_]*(?:NO\.?|TUBE)[\s_]*#?\s*(\d+)/i);
  if (!rm) return null;
  return { rowLabel: rm[1].toUpperCase(), tubeNo: parseInt(rm[2], 10) };
}

const DEFAULT_THRESHOLDS = { A: 50, B1: 25, B2: 12.5, justify: 20 };

function computeTube(rawValues, thresholds) {
  const th = Object.assign({}, DEFAULT_THRESHOLDS, thresholds || {});
  const nums = rawValues.map(parseNumber).filter((v) => !isNaN(v));
  const total = nums.length;
  if (total === 0) {
    return { total: 0, pctA: null, pctB1: null, pctB2: null, pctC: null, rating: 'NT' };
  }
  let cA = 0, cB1 = 0, cB2 = 0, cC = 0;
  nums.forEach((v) => {
    if (v >= th.A) cA++;
    else if (v >= th.B1) cB1++;
    else if (v >= th.B2) cB2++;
    else cC++;
  });
  const pctA = (cA / total) * 100;
  const pctB1 = (cB1 / total) * 100;
  const pctB2 = (cB2 / total) * 100;
  const pctC = (cC / total) * 100;
  let rating;
  if (pctC >= th.justify) rating = 'C';
  else if (pctB2 >= th.justify) rating = 'B2';
  else if (pctB1 >= th.justify) rating = 'B1';
  else if (pctA >= th.justify) rating = 'A';
  else {
    const pairs = [['A', pctA], ['B1', pctB1], ['B2', pctB2], ['C', pctC]];
    rating = pairs.reduce((a, b) => (a[1] >= b[1] ? a : b))[0];
  }
  return { total, pctA, pctB1, pctB2, pctC, rating };
}

module.exports = {
  parseNumber,
  parseAmplitudeValues,
  detectIdentityFromText,
  computeTube,
  DEFAULT_THRESHOLDS,
};
