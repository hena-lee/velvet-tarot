require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { shuffleDeck } = require('./lib/deck');
const { spreads } = require('./lib/spreads');
const { generateReading } = require('./lib/reading');
const { loadHistory, saveReading, deleteReadings, toggleFavorite } = require('./lib/history');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/shuffle', (req, res) => {
  const deck = shuffleDeck();
  res.json(deck);
});

app.post('/api/interpret', async (req, res) => {
  const { cards, spreadType, question } = req.body;

  const spread = spreads[spreadType];
  if (!spread) {
    return res.status(400).json({ error: `Unknown spread type: "${spreadType}"` });
  }

  if (!cards || cards.length !== spread.cardCount) {
    return res.status(400).json({ error: `Expected ${spread.cardCount} cards for ${spread.name}` });
  }

  try {
    const reading = await generateReading(cards, spread, question || null);
    const result = { cards, spread: spread.name, reading };
    saveReading({ spreadType, question: question || null, ...result });
    res.json(result);
  } catch (err) {
    const fallback = cards.map((card, i) => {
      const orientation = card.isReversed ? 'reversed' : 'upright';
      return `${spread.positions[i].label}: ${card.name} (${orientation}) — ${card.meaning[orientation]}`;
    }).join('\n\n');

    const result = { cards, spread: spread.name, reading: fallback };
    saveReading({ spreadType, question: question || null, ...result });
    res.status(500).json({ error: 'Intelligent reading unavailable', ...result });
  }
});

app.get('/api/cards', (req, res) => {
  const cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf8'));
  res.json(cards);
});

app.get('/api/history', (req, res) => {
  const history = loadHistory();
  res.json(history);
});

app.patch('/api/history/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  const entry = toggleFavorite(id);
  if (!entry) {
    return res.status(404).json({ error: 'Reading not found' });
  }
  res.json({ id: entry.id, favorite: entry.favorite });
});

app.post('/api/history/delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  deleteReadings(ids);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Tarot server running at http://localhost:${PORT}`);
});
