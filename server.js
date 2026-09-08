require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./lib/supabaseClient');

const plantsRouter = require('./routes/plants');
const rowsRouter = require('./routes/rows');
const tubesRouter = require('./routes/tubes');
const summaryRouter = require('./routes/summary');

const app = express();
app.use(cors());
app.use(express.json());

// Public config endpoint — the anon key is safe to expose to the browser
// (it's the same key used everywhere in client-side Supabase apps); actual
// data access is still gated by requireAuth below on every /api route.
app.get('/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_KEY,
  });
});

// Requires a valid Supabase session (checked against Supabase's auth server,
// not just decoded locally) — only people who were invited/created in
// Supabase Auth can reach any /api/* route.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = data.user;
  next();
}

app.use('/api', requireAuth);
app.use('/api/plants', plantsRouter);
app.use('/api/rows', rowsRouter);
app.use('/api/tubes', tubesRouter);
app.use('/api/summary', summaryRouter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NDT attenuation rating server listening on port ${PORT}`);
});
