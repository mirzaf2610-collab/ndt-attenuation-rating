const express = require('express');
const supabase = require('../lib/supabaseClient');
const { computeTube } = require('../lib/rating');

const router = express.Router();

// GET /api/plants — list all plants
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('plants').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/plants — create a new plant
// body: { name, threshold_a?, threshold_b1?, threshold_b2?, threshold_justify? }
router.post('/', async (req, res) => {
  const { name, threshold_a, threshold_b1, threshold_b2, threshold_justify } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabase
    .from('plants')
    .insert({
      name: name.trim(),
      threshold_a: threshold_a ?? 50,
      threshold_b1: threshold_b1 ?? 25,
      threshold_b2: threshold_b2 ?? 12.5,
      threshold_justify: threshold_justify ?? 20,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/plants/:id — update thresholds
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = {};
  ['threshold_a', 'threshold_b1', 'threshold_b2', 'threshold_justify', 'name', 'report_meta'].forEach((k) => {
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  });

  const { data, error } = await supabase.from('plants').update(fields).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/plants/:id — deletes the plant and (via cascade) all its rows & tubes
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('plants').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// POST /api/plants/:id/recompute — re-derives pct_a/b1/b2/c and rating for
// EVERY tube in this plant from its stored raw_amplitudes, using the plant's
// CURRENT thresholds. Lets a threshold change apply retroactively without
// re-uploading every file.
router.post('/:id/recompute', async (req, res) => {
  const { id } = req.params;
  const { data: plant, error: plantErr } = await supabase.from('plants').select('*').eq('id', id).single();
  if (plantErr) return res.status(400).json({ error: plantErr.message });

  const th = {
    A: plant.threshold_a,
    B1: plant.threshold_b1,
    B2: plant.threshold_b2,
    justify: plant.threshold_justify,
  };

  const { data: rowsForPlant, error: rowsErr } = await supabase.from('rows_').select('id').eq('plant_id', id);
  if (rowsErr) return res.status(500).json({ error: rowsErr.message });
  const rowIds = rowsForPlant.map((r) => r.id);
  if (rowIds.length === 0) return res.json({ updated: 0 });

  const { data: tubes, error: tubesErr } = await supabase
    .from('tubes')
    .select('id, raw_amplitudes')
    .in('row_id', rowIds);
  if (tubesErr) return res.status(500).json({ error: tubesErr.message });

  let updated = 0;
  for (const tube of tubes) {
    if (!tube.raw_amplitudes) continue; // nothing to recompute from
    const result = computeTube(tube.raw_amplitudes, th);
    const { error: updErr } = await supabase
      .from('tubes')
      .update({
        total_points: result.total,
        pct_a: result.pctA,
        pct_b1: result.pctB1,
        pct_b2: result.pctB2,
        pct_c: result.pctC,
        rating: result.rating,
      })
      .eq('id', tube.id);
    if (!updErr) updated++;
  }

  res.json({ updated, total: tubes.length });
});

module.exports = router;
