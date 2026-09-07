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

// PATCH /api/rows/:id — update total_tubes and/or riser settings for a row
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const fields = {};
  if (req.body.total_tubes !== undefined) fields.total_tubes = req.body.total_tubes;
  if (req.body.has_riser !== undefined) fields.has_riser = req.body.has_riser;
  if (req.body.riser_position !== undefined) fields.riser_position = req.body.riser_position;
  if (req.body.tube1_direction !== undefined) fields.tube1_direction = req.body.tube1_direction;
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'no updatable fields provided' });

  const { data, error } = await supabase
    .from('rows_')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
