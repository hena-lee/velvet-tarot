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

async function generateReading(drawnCards, spread, userQuestion) {
  const prompt = buildPrompt(drawnCards, spread, userQuestion);
  const expectedCardCount = drawnCards.length;
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 20000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const result = await model.generateContent(prompt, { signal: controller.signal });
      clearTimeout(timer);

      const text = result.response.text().trim();
      console.log(`[reading] Attempt ${attempt} raw response (first 500 chars):`, text.slice(0, 500));
      const parsed = parseResponse(text, expectedCardCount);

      if (parsed) {
        console.log(`[reading] Attempt ${attempt} parsed OK, summary length: ${parsed.summary?.length || 0}`);
        return parsed;
      }

      console.log(`[reading] Attempt ${attempt} parse/validation FAILED`);
      // Parsed but invalid — retry if attempts remain
      if (attempt < MAX_RETRIES) continue;
    } catch (err) {
      console.error(`[reading] Attempt ${attempt} error:`, err.message || err);
      if (attempt < MAX_RETRIES) continue;
      throw err;
    }
  }

  // All retries exhausted — return best-effort fallback
  return { sections: [], summary: '' };
}

module.exports = { buildPrompt, generateReading };
