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

  return `You are a warm, insightful tarot reader. Interpret the following spread as a cohesive reading.

${cardDescriptions}
${questionLine}
Connect the cards across their positions to tell a story. Be warm but honest. Keep it to 2-3 paragraphs.`;
}

async function generateReading(drawnCards, spread, userQuestion) {
  const prompt = buildPrompt(drawnCards, spread, userQuestion);

  const result = await model.generateContent(prompt);

  return result.response.text();
}

module.exports = { buildPrompt, generateReading };
