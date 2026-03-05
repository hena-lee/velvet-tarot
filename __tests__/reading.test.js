const { buildPrompt } = require('../lib/reading');

// mock cards as they'd come out of drawCards()
const mockCards = [
  {
    id: 'major_16',
    name: 'The Tower',
    arcana: 'major',
    suit: null,
    number: 16,
    keywords: {
      upright: ['upheaval', 'sudden change', 'revelation', 'chaos'],
      reversed: ['avoidance', 'delayed disaster', 'fear of change', 'narrowly avoided']
    },
    meaning: {
      upright: 'Sudden upheaval tears down what was built on shaky ground.',
      reversed: 'You sense something unstable but are avoiding the reckoning.'
    },
    isReversed: false
  },
  {
    id: 'major_09',
    name: 'The Hermit',
    arcana: 'major',
    suit: null,
    number: 9,
    keywords: {
      upright: ['solitude', 'reflection', 'inner guidance', 'searching'],
      reversed: ['isolation', 'loneliness', 'withdrawal', 'lost']
    },
    meaning: {
      upright: 'Step back from the noise.',
      reversed: 'Isolation has gone too far.'
    },
    isReversed: true
  },
  {
    id: 'major_17',
    name: 'The Star',
    arcana: 'major',
    suit: null,
    number: 17,
    keywords: {
      upright: ['hope', 'renewal', 'inspiration', 'serenity'],
      reversed: ['despair', 'disconnection', 'lack of faith', 'discouragement']
    },
    meaning: {
      upright: 'After the storm, hope returns.',
      reversed: 'Faith is wavering.'
    },
    isReversed: false
  }
];

const mockSpread = {
  name: 'Past, Present, Future',
  cardCount: 3,
  positions: [
    { label: 'Past', description: 'What led you to this moment' },
    { label: 'Present', description: 'Where you stand now' },
    { label: 'Future', description: 'Where this path is leading' }
  ]
};

describe('buildPrompt', () => {
  test('includes all card names', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).toContain('The Tower');
    expect(prompt).toContain('The Hermit');
    expect(prompt).toContain('The Star');
  });

  test('includes position labels and descriptions', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).toContain('Past');
    expect(prompt).toContain('What led you to this moment');
    expect(prompt).toContain('Present');
    expect(prompt).toContain('Future');
  });

  test('uses upright keywords for upright cards', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).toContain('upheaval, sudden change, revelation, chaos');
  });

  test('uses reversed keywords for reversed cards', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).toContain('isolation, loneliness, withdrawal, lost');
  });

  test('labels orientation correctly', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).toContain('The Tower (upright)');
    expect(prompt).toContain('The Hermit (reversed)');
    expect(prompt).toContain('The Star (upright)');
  });

  test('includes user question when provided', () => {
    const prompt = buildPrompt(mockCards, mockSpread, 'Should I change careers?');
    expect(prompt).toContain('The querent asks: "Should I change careers?"');
  });

  test('omits querent line when no question provided', () => {
    const prompt = buildPrompt(mockCards, mockSpread, null);
    expect(prompt).not.toContain('querent');
  });

  test('omits querent line for empty string question', () => {
    const prompt = buildPrompt(mockCards, mockSpread, '');
    expect(prompt).not.toContain('querent');
  });
});
