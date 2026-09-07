const express = require('express');
const multer = require('multer');
const supabase = require('../lib/supabaseClient');
const { parseAmplitudeValues, computeTube, parseNumber } = require('../lib/rating');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const RISER_TUBE_NO = 0; // sentinel — riser sits outside the normal 1..N numbering

// POST /api/tubes
// multipart/form-data: file, row_id, tube_no (or is_riser=true instead of tube_no), side ('N'|'S', default 'N')
// Reads the OmniPC export server-side, computes the rating, and upserts the tube.
// Each tube can have up to two independent scans — one per side (e.g. North/South) —
// stored as separate rows sharing the same tube_no.
router.post('/', upload.single('file'), async (req, res) => {
  const { row_id } = req.body;
  const isRiser = req.body.is_riser === 'true' || req.body.is_riser === true;
  const tubeNo = isRiser ? RISER_TUBE_NO : parseInt(req.body.tube_no, 10);
  const side = req.body.side === 'S' ? 'S' : 'N';
  if (!row_id || (!isRiser && !req.body.tube_no)) {
    return res.status(400).json({ error: 'row_id and tube_no (or is_riser) are required' });
  }
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  // Fetch the plant's thresholds via the row -> plant relationship.
  const { data: rowData, error: rowErr } = await supabase
    .from('rows_')
    .select('id, plant_id, plants(threshold_a, threshold_b1, threshold_b2, threshold_justify)')
    .eq('id', row_id)
    .single();
  if (rowErr) return res.status(400).json({ error: rowErr.message });

  const th = {
    A: rowData.plants.threshold_a,
    B1: rowData.plants.threshold_b1,
    B2: rowData.plants.threshold_b2,
    justify: rowData.plants.threshold_justify,
  };

  const text = req.file.buffer.toString('utf8');
  const rawValues = parseAmplitudeValues(text);
  const result = computeTube(rawValues, th);

  // Numeric array for the visualization strip — null marks an invalid/untested point.
  const rawAmplitudes = rawValues.map((v) => {
    const n = parseNumber(v);
    return isNaN(n) ? null : n;
  });

  const { data, error } = await supabase
    .from('tubes')
    .upsert(
      {
        row_id,
        tube_no: tubeNo,
        side,
        is_riser: isRiser,
        file_name: req.file.originalname,
        total_points: result.total,
        pct_a: result.pctA,
        pct_b1: result.pctB1,
        pct_b2: result.pctB2,
        pct_c: result.pctC,
        rating: result.rating,
        raw_amplitudes: rawAmplitudes,
      },
      { onConflict: 'row_id,tube_no,side' }
    )
    .select('id, row_id, tube_no, side, is_riser, file_name, total_points, pct_a, pct_b1, pct_b2, pct_c, rating')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/tubes?row_id=... — list tubes for a row, padded with NT up to total_tubes.
// Each tube number produces TWO rows (side N and side S), independent of each other.
// The riser (if enabled) is a single row spliced in at its configured position.
router.get('/', async (req, res) => {
  const { row_id } = req.query;
  if (!row_id) return res.status(400).json({ error: 'row_id is required' });

  const { data: row, error: rowErr } = await supabase
    .from('rows_')
    .select('id, total_tubes, has_riser, riser_position')
    .eq('id', row_id)
    .single();
  if (rowErr) return res.status(400).json({ error: rowErr.message });

  const { data: tubes, error } = await supabase
    .from('tubes')
    .select('id, row_id, tube_no, side, is_riser, file_name, total_points, pct_a, pct_b1, pct_b2, pct_c, rating')
    .eq('row_id', row_id)
    .order('tube_no');
  if (error) return res.status(500).json({ error: error.message });

  const byKey = {};
  let riserTube = null;
  tubes.forEach((t) => {
    if (t.is_riser) riserTube = t;
    else byKey[t.tube_no + '_' + t.side] = t;
  });
  const maxNo = Math.max(row.total_tubes || 0, ...tubes.filter((t) => !t.is_riser).map((t) => t.tube_no), 0);

  const list = [];
  for (let n = 1; n <= maxNo; n++) {
    ['N', 'S'].forEach((side) => {
      list.push(byKey[n + '_' + side] || { row_id, tube_no: n, side, rating: 'NT', total_points: 0, is_placeholder: true });
    });
  }

  if (row.has_riser) {
    const riserEntry = riserTube || { row_id, tube_no: RISER_TUBE_NO, rating: 'NT', total_points: 0, is_placeholder: true };
    riserEntry.is_riser = true;
    // riser_position counts tubes, not table rows — each tube now occupies 2 rows (N/S).
    const pos = Math.max(0, Math.min(list.length, (row.riser_position || 0) * 2));
    list.splice(pos, 0, riserEntry);
  }

  res.json(list);
});

// GET /api/tubes/visual?row_id=...&buckets=150&side=N
// Downsampled amplitude strip per tube (for the "Visualisasi Hasil Pemeriksaan Tube"
// display, matching the report's colour-coded tube columns). Keeps payload small by
// averaging the raw scan into a fixed number of vertical buckets per tube. Shows one
// side at a time (default N) — the riser (if enabled) is always shown regardless of
// the selected side, since it's typically scanned once.
router.get('/visual', async (req, res) => {
  const { row_id } = req.query;
  const buckets = Math.min(Math.max(parseInt(req.query.buckets, 10) || 150, 10), 500);
  const side = req.query.side === 'S' ? 'S' : 'N';
  if (!row_id) return res.status(400).json({ error: 'row_id is required' });

  const { data: row, error: rowErr } = await supabase
    .from('rows_')
    .select('id, total_tubes, has_riser, riser_position')
    .eq('id', row_id)
    .single();
  if (rowErr) return res.status(400).json({ error: rowErr.message });

  const { data: tubes, error } = await supabase
    .from('tubes')
    .select('tube_no, side, is_riser, rating, raw_amplitudes')
    .eq('row_id', row_id)
    .order('tube_no');
  if (error) return res.status(500).json({ error: error.message });

  const byNo = {};
  let riserTube = null;
  tubes.forEach((t) => {
    if (t.is_riser) { riserTube = t; return; }
    if (t.side === side) byNo[t.tube_no] = t;
  });
  const maxNo = Math.max(row.total_tubes || 0, ...tubes.filter((t) => !t.is_riser).map((t) => t.tube_no), 0);

  // Every tube's own raw scan is stretched/compressed to fill the full column
  // height — a shorter scan gets stretched to fit, a longer one gets compressed.
  // Trims the trailing run of invalid/no-signal ("---") points so the
  // stretch below maps only the actually-measured extent of the tube to
  // the full column height — untested tail doesn't eat into the column.
  function measuredLength(values) {
    let end = values.length;
    while (end > 0 && (values[end - 1] === null || values[end - 1] === undefined || isNaN(values[end - 1]))) {
      end--;
    }
    return end;
  }

  function downsample(values) {
    if (!values || values.length === 0) return null;
    const n = measuredLength(values);
    if (n === 0) return null;
    const out = new Array(buckets).fill(null);
    for (let i = 0; i < buckets; i++) {
      const start = Math.floor((i / buckets) * n);
      const end = Math.max(start + 1, Math.floor(((i + 1) / buckets) * n));
      let sum = 0, count = 0;
      for (let j = start; j < end && j < n; j++) {
        const v = values[j];
        if (v !== null && v !== undefined && !isNaN(v)) { sum += v; count++; }
      }
      out[i] = count > 0 ? sum / count : null;
    }
    return out;
  }

  const list = [];
  for (let n = 1; n <= maxNo; n++) {
    const t = byNo[n];
    list.push({
      tube_no: n,
      rating: t ? t.rating : 'NT',
      strip: t ? downsample(t.raw_amplitudes) : null,
    });
  }

  if (row.has_riser) {
    const riserEntry = {
      tube_no: 'R',
      is_riser: true,
      rating: riserTube ? riserTube.rating : 'NT',
      strip: riserTube ? downsample(riserTube.raw_amplitudes) : null,
    };
    const pos = Math.max(0, Math.min(list.length, row.riser_position || 0));
    list.splice(pos, 0, riserEntry);
  }

  res.json({ buckets, side, tubes: list });
});

// DELETE /api/tubes/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tubes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

module.exports = router;
