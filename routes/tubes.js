const express = require('express');
const multer = require('multer');
const supabase = require('../lib/supabaseClient');
const { parseAmplitudeValues, computeTube } = require('../lib/rating');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/tubes
// multipart/form-data: file, row_id, tube_no
// Reads the OmniPC export server-side, computes the rating, and upserts the tube.
router.post('/', upload.single('file'), async (req, res) => {
  const { row_id, tube_no } = req.body;
  if (!row_id || !tube_no) return res.status(400).json({ error: 'row_id and tube_no are required' });
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

  const { data, error } = await supabase
    .from('tubes')
    .upsert(
      {
        row_id,
        tube_no: parseInt(tube_no, 10),
        file_name: req.file.originalname,
        total_points: result.total,
        pct_a: result.pctA,
        pct_b1: result.pctB1,
        pct_b2: result.pctB2,
        pct_c: result.pctC,
        rating: result.rating,
      },
      { onConflict: 'row_id,tube_no' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/tubes?row_id=... — list tubes for a row, padded with NT up to total_tubes
router.get('/', async (req, res) => {
  const { row_id } = req.query;
  if (!row_id) return res.status(400).json({ error: 'row_id is required' });

  const { data: row, error: rowErr } = await supabase
    .from('rows_')
    .select('id, total_tubes')
    .eq('id', row_id)
    .single();
  if (rowErr) return res.status(400).json({ error: rowErr.message });

  const { data: tubes, error } = await supabase
    .from('tubes')
    .select('*')
    .eq('row_id', row_id)
    .order('tube_no');
  if (error) return res.status(500).json({ error: error.message });

  const byNo = {};
  tubes.forEach((t) => { byNo[t.tube_no] = t; });
  const maxNo = Math.max(row.total_tubes || 0, ...tubes.map((t) => t.tube_no), 0);

  const list = [];
  for (let n = 1; n <= maxNo; n++) {
    list.push(byNo[n] || { row_id, tube_no: n, rating: 'NT', total_points: 0, is_placeholder: true });
  }
  res.json(list);
});

// DELETE /api/tubes/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tubes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

module.exports = router;
