const express = require('express');
const supabase = require('../lib/supabaseClient');

const router = express.Router();

// GET /api/summary?plant_id=... — rekapitulasi: rating counts per row + total,
// with NT padding applied per row's total_tubes (same as the detail table).
router.get('/', async (req, res) => {
  const { plant_id } = req.query;
  if (!plant_id) return res.status(400).json({ error: 'plant_id is required' });

  const { data: rows, error: rowsErr } = await supabase
    .from('rows_')
    .select('id, label, total_tubes')
    .eq('plant_id', plant_id)
    .order('label');
  if (rowsErr) return res.status(500).json({ error: rowsErr.message });

  const ratings = ['A', 'B1', 'B2', 'C', 'NT'];
  const table = {}; // rating -> { [rowLabel]: count }
  ratings.forEach((r) => { table[r] = {}; });
  let totalTubes = 0;

  for (const row of rows) {
    const { data: tubes, error } = await supabase
      .from('tubes')
      .select('tube_no, rating')
      .eq('row_id', row.id);
    if (error) return res.status(500).json({ error: error.message });

    const byNo = {};
    tubes.forEach((t) => { byNo[t.tube_no] = t.rating; });
    const maxNo = Math.max(row.total_tubes || 0, ...tubes.map((t) => t.tube_no), 0);

    ratings.forEach((r) => { table[r][row.label] = 0; });
    for (let n = 1; n <= maxNo; n++) {
      const rating = byNo[n] || 'NT';
      table[rating][row.label] = (table[rating][row.label] || 0) + 1;
      totalTubes++;
    }
  }

  const rowLabels = rows.map((r) => r.label);
  const result = ratings.map((r) => {
    const perRow = rowLabels.map((l) => table[r][l] || 0);
    const total = perRow.reduce((a, b) => a + b, 0);
    return {
      rating: r,
      perRow,
      total,
      percentage: totalTubes ? (total / totalTubes) * 100 : 0,
    };
  });

  res.json({ rowLabels, totalTubes, result });
});

module.exports = router;
