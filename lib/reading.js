const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

function buildPrompt(drawnCards, spread, userQuestion) {
  const cardDescriptions = drawnCards.map((card, i) => {
    const orientation = card.isReversed ? 'reversed' : 'upright';
    return [
      `Position: ${spread.positions[i].label} — ${spread.positions[i].description}`,
      `Card: ${card.name} (${orientation})`,
      `Keywords: ${card.keywords[orientation].join(', ')}`
    ].join('\n');
  }).join('\n\n');

  const questionLine = userQuestion
    ? `\nThe querent asks: "${userQuestion}"\n`
    : '';

  const positionList = drawnCards.map((_, i) => spread.positions[i].label).join(', ');
  const summaryNote = userQuestion
    ? 'synthesizing all the cards together and addressing the querent\'s question directly'
    : 'synthesizing all the cards together into a cohesive narrative';

  return `You are a warm, insightful tarot reader. Interpret the following spread.

${cardDescriptions}
${questionLine}
Return a JSON object — no markdown, no code blocks, only raw JSON — with this exact structure:
{
  "sections": [
    { "position": "<position label>", "text": "<2-3 sentences interpreting this card in its position>" },
    ... one object per card in this order: ${positionList}
  ],
  "summary": "<REQUIRED. Never omit. A full comprehensive reading of at least 2 substantial paragraphs ${summaryNote}. Be warm, honest, and evocative. This field must never be empty or null.>"
}`;
}

function parseResponse(text, expectedCardCount) {
  // Strip markdown code fences
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  // Gemini sometimes puts literal newlines inside JSON string values,
  // which is invalid JSON. Fix by replacing unescaped newlines within strings.
  function fixNewlinesInStrings(jsonStr) {
    return jsonStr.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
      return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });
  }

  function tryParse(str) {
    try {
      const parsed = JSON.parse(str);
      if (isValidReading(parsed, expectedCardCount)) return parsed;
    } catch (_) {}
    // Retry with newline fix
    try {
      const parsed = JSON.parse(fixNewlinesInStrings(str));
      if (isValidReading(parsed, expectedCardCount)) return parsed;
    } catch (_) {}
    return null;
  }

  // Try parsing the whole cleaned response
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Sometimes the model wraps JSON with prose — extract the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extracted = tryParse(jsonMatch[0]);
    if (extracted) return extracted;
  }

  return null;
}

function isValidReading(parsed, expectedCardCount) {
  if (!parsed || !Array.isArray(parsed.sections)) return false;
  if (!parsed.summary || parsed.summary.trim().length === 0) return false;
  // Every section must have non-empty text
  if (parsed.sections.length !== expectedCardCount) return false;
  if (parsed.sections.some(s => !s.text || s.text.trim().length === 0)) return false;
  return true;
}

// Transient errors worth a single retry. Validation failures are NOT retried —
// retrying a malformed response just multiplies cost without changing the input.
function isTransientError(err) {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  if (err.name === 'AbortError') return true;
  return /timeout|network|fetch failed|econnreset|enotfound|503|502|504|temporarily/.test(msg);
}

async function generateReading(drawnCards, spread, userQuestion) {
  const prompt = buildPrompt(drawnCards, spread, userQuestion);
  const expectedCardCount = drawnCards.length;
  const TIMEOUT_MS = 20000;
  const MAX_ATTEMPTS = 2; // 1 initial + at most 1 retry, only on transient transport errors

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) =>
          setTimeout(() => {
            const e = new Error('Gemini request timeout');
            e.name = 'AbortError';
            reject(e);
          }, TIMEOUT_MS)
        )
      ]);

      const text = result.response.text().trim();
      const parsed = parseResponse(text, expectedCardCount);
      if (parsed) return parsed;

      // Parsed but invalid — do NOT retry, fall through to fallback below.
      console.error('[reading] Gemini response failed validation');
      return { sections: [], summary: '' };
    } catch (err) {
      lastErr = err;
      console.error(`[reading] Attempt ${attempt} error:`, err.message || err);
      if (attempt < MAX_ATTEMPTS && isTransientError(err)) continue;
      throw err;
    }
  }

  throw lastErr || new Error('Gemini request failed');
}

module.exports = { buildPrompt, generateReading };
