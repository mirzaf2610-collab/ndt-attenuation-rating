const express = require('express');
const supabase = require('../lib/supabaseClient');

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
  ['threshold_a', 'threshold_b1', 'threshold_b2', 'threshold_justify', 'name'].forEach((k) => {
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  });

  const { data, error } = await supabase.from('plants').update(fields).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
