require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const plantsRouter = require('./routes/plants');
const rowsRouter = require('./routes/rows');
const tubesRouter = require('./routes/tubes');
const summaryRouter = require('./routes/summary');

const app = express();
app.use(cors());
app.use(express.json());

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
