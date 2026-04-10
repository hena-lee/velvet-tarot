require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { shuffleDeck } = require('./lib/deck');
const { spreads } = require('./lib/spreads');
const { generateReading } = require('./lib/reading');
const { loadHistory, saveReading, deleteReadings, toggleFavorite, updateNotes } = require('./lib/history');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy (Vercel) so express-rate-limit sees the real client IP.
app.set('trust proxy', 1);

// Hard-cap request bodies. Tarot payloads are tiny — 4 KB is plenty and stops
// 100 KB prompt-stuffing attacks cold.
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Card lookup (server-trusted) ----------
// Load cards once at startup. Client only sends card IDs; we look up the rest
// here so the LLM prompt can never be inflated by attacker-controlled data.
const ALL_CARDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf8'));
const CARDS_BY_ID = new Map(ALL_CARDS.map(c => [c.id, c]));

// ---------- Origin allowlist ----------
const ALLOWED_ORIGIN_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'velvettarot.vercel.app',
  // Add custom domain(s) here if you ever attach one.
]);
// Also allow Vercel preview deployments for this project. Matches both the
// hyphenated and non-hyphenated spellings of the project name so preview
// URLs like velvettarot-git-main-hena-lee.vercel.app resolve correctly.
const VERCEL_PREVIEW_RE = /^velvet-?tarot[a-z0-9-]*\.vercel\.app$/i;

function isAllowedOrigin(req) {
  const raw = req.get('origin') || req.get('referer');
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname;
    if (ALLOWED_ORIGIN_HOSTS.has(host)) return true;
    if (VERCEL_PREVIEW_RE.test(host)) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function requireAllowedOrigin(req, res, next) {
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ---------- Rate limiting ----------
// In-memory limiter. On Vercel serverless this resets per cold start, so it's
// not bulletproof — pair it with a Google Cloud quota cap as the real backstop.
// It still blocks the overwhelming majority of casual abuse.
const interpretLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                          // 5 requests / minute / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down and try again in a minute.' }
});

const interpretHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,                         // 30 requests / hour / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Hourly limit reached.' }
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                         // 60 / min / IP for cheap endpoints
  standardHeaders: true,
  legacyHeaders: false
});

// ---------- Global tripwire ----------
// Process-lifetime safety net. On Vercel this resets per cold start, but it
// caps any single warm instance from being a runaway cost source.
const GLOBAL_INTERPRET_CAP = Number(process.env.GLOBAL_INTERPRET_CAP || 500);
let interpretCount = 0;
function tripwire(req, res, next) {
  if (interpretCount >= GLOBAL_INTERPRET_CAP) {
    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
  interpretCount++;
  next();
}

// ---------- Validation helpers ----------
function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function validateInterpretInput(body) {
  if (!isPlainObject(body)) return 'Invalid request body';

  const { spreadType, cards, question } = body;

  // spreadType: must be a known key
  if (typeof spreadType !== 'string' || !Object.prototype.hasOwnProperty.call(spreads, spreadType)) {
    return 'Invalid spreadType';
  }
  const spread = spreads[spreadType];

  // cards: must be array of correct length, each entry { id: string, isReversed: boolean }
  if (!Array.isArray(cards) || cards.length !== spread.cardCount) {
    return `Expected ${spread.cardCount} cards for ${spread.name}`;
  }
  if (cards.length > 10) return 'Too many cards'; // belt-and-suspenders cap

  for (const c of cards) {
    if (!isPlainObject(c)) return 'Invalid card entry';
    if (typeof c.id !== 'string' || c.id.length > 64) return 'Invalid card id';
    if (typeof c.isReversed !== 'boolean') return 'Invalid card orientation';
    if (!CARDS_BY_ID.has(c.id)) return 'Unknown card id';
  }

  // question: optional string, capped at 500 chars
  if (question != null) {
    if (typeof question !== 'string') return 'Invalid question';
    if (question.length > 500) return 'Question too long (max 500 characters)';
  }

  return null;
}

// Build the trusted card objects we hand to the LLM and return to the client.
function resolveCards(clientCards) {
  return clientCards.map(c => {
    const full = CARDS_BY_ID.get(c.id);
    return { ...full, isReversed: !!c.isReversed };
  });
}

// ---------- Routes ----------

// Tells the client whether server-side storage is available.
// On Vercel the filesystem is read-only, so the client falls back to IndexedDB.
app.get('/api/config', generalLimiter, (req, res) => {
  res.json({ serverStorage: !process.env.VERCEL });
});

app.post('/api/shuffle', generalLimiter, (req, res) => {
  const deck = shuffleDeck();
  res.json(deck);
});

app.post(
  '/api/interpret',
  requireAllowedOrigin,
  interpretLimiter,
  interpretHourlyLimiter,
  tripwire,
  async (req, res) => {
    const validationError = validateInterpretInput(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { spreadType, question } = req.body;
    const spread = spreads[spreadType];
    const cards = resolveCards(req.body.cards);
    const trimmedQuestion = question ? question.trim() : null;

    const isVercel = !!process.env.VERCEL;
    function trySave(entry) {
      if (isVercel) return null;
      try { return saveReading(entry); } catch (_) { return null; }
    }

    try {
      const reading = await generateReading(cards, spread, trimmedQuestion);

      // If Gemini returned empty sections, fill them from card meanings
      if (!reading.sections || reading.sections.length === 0) {
        reading.sections = cards.map((card, i) => {
          const orientation = card.isReversed ? 'reversed' : 'upright';
          return {
            position: spread.positions[i].label,
            text: `${card.name} (${orientation}) — ${card.meaning[orientation]}`
          };
        });
      }
      if (!reading.summary) {
        reading.summary = 'The cards hold their counsel. Sit with each position above and let their meaning unfold in stillness.';
      }

      const result = { cards, spread: spread.name, reading };
      const saved = trySave({ spreadType, question: trimmedQuestion, ...result });
      res.json({ ...result, savedId: saved ? saved.id : null });
    } catch (err) {
      console.error('[interpret] Gemini failed:', err.message || err);
      const fallbackReading = {
        sections: cards.map((card, i) => {
          const orientation = card.isReversed ? 'reversed' : 'upright';
          return {
            position: spread.positions[i].label,
            text: `${card.name} (${orientation}) — ${card.meaning[orientation]}`
          };
        }),
        summary: 'The spirits were quiet this time. The card meanings above offer guidance — sit with them and let your intuition speak.'
      };
      const result = { cards, spread: spread.name, reading: fallbackReading };
      const saved = trySave({ spreadType, question: trimmedQuestion, ...result });
      res.json({ ...result, savedId: saved ? saved.id : null });
    }
  }
);

app.get('/api/cards', generalLimiter, (req, res) => {
  res.json(ALL_CARDS);
});

app.get('/api/history', generalLimiter, (req, res) => {
  if (process.env.VERCEL) return res.json([]);
  const history = loadHistory();
  res.json(history);
});

app.patch('/api/history/:id/favorite', generalLimiter, (req, res) => {
  const id = Number(req.params.id);
  const entry = toggleFavorite(id);
  if (!entry) {
    return res.status(404).json({ error: 'Reading not found' });
  }
  res.json({ id: entry.id, favorite: entry.favorite });
});

app.post('/api/history/delete', generalLimiter, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  deleteReadings(ids);
  res.json({ success: true });
});

app.patch('/api/history/:id/notes', generalLimiter, (req, res) => {
  if (process.env.VERCEL) return res.status(403).json({ error: 'Not available on hosted version' });
  const id = Number(req.params.id);
  const { notes } = req.body;
  const entry = updateNotes(id, notes ?? null);
  if (!entry) return res.status(404).json({ error: 'Reading not found' });
  res.json({ success: true });
});

// Quiet error handler — keeps payload-too-large and JSON parse errors from
// dumping stack traces into production logs.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error('[server] Unhandled error:', err && err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Tarot server running at http://localhost:${PORT}`);
});
