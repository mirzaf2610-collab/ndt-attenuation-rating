const express = require('express');
const supabase = require('../lib/supabaseClient');

const router = express.Router();

// GET /api/rows?plant_id=... — list rows for a plant
router.get('/', async (req, res) => {
  const { plant_id } = req.query;
  if (!plant_id) return res.status(400).json({ error: 'plant_id is required' });

  const { data, error } = await supabase
    .from('rows_')
    .select('*')
    .eq('plant_id', plant_id)
    .order('label');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/rows — create a row (label) under a plant
// body: { plant_id, label, total_tubes }
router.post('/', async (req, res) => {
  const { plant_id, label, total_tubes } = req.body;
  if (!plant_id || !label) return res.status(400).json({ error: 'plant_id and label are required' });

  const { data, error } = await supabase
    .from('rows_')
    .upsert(
      { plant_id, label: label.trim().toUpperCase(), total_tubes: total_tubes ?? 0 },
      { onConflict: 'plant_id,label' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/rows/:id — update total_tubes for a row
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { total_tubes } = req.body;
  if (total_tubes === undefined) return res.status(400).json({ error: 'total_tubes is required' });

  const { data, error } = await supabase
    .from('rows_')
    .update({ total_tubes })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
